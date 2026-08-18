import OpenAI from "openai";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import type {
  BaroformAiRequestType,
  BaroformOpenAiModel,
  BaroformReasoningEffort,
  BaroformServiceTier,
} from "./model-router";

export const openAiMaxRetries = 1;
export const defaultOpenAiTimeoutMs = 280_000;

const initialFetch = globalThis.fetch;
let testApiKeyOverride: string | null = null;

export function resolveOpenAiApiKey() {
  if (process.env.NODE_ENV !== "production" && testApiKeyOverride) {
    return testApiKeyOverride;
  }
  return process.env.OPENAI_API_KEY?.trim() || null;
}

export async function withOpenAiApiKeyForTest<T>(
  apiKey: string,
  operation: () => Promise<T> | T,
): Promise<T> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("OPENAI_TEST_KEY_OVERRIDE_DISABLED_IN_PRODUCTION");
  }
  const previous = testApiKeyOverride;
  testApiKeyOverride = apiKey;
  try {
    return await operation();
  } finally {
    testApiKeyOverride = previous;
  }
}

export function hasInjectedTestTransport() {
  return process.env.NODE_ENV === "test" && globalThis.fetch !== initialFetch;
}

export function shouldMockOpenAi() {
  if (process.env.AI_MOCK_MODE === "true") return true;
  if (process.env.NODE_ENV === "test") return !hasInjectedTestTransport();
  const vercelEnvironment = process.env.VERCEL_ENV;
  if (
    (vercelEnvironment === "preview" || vercelEnvironment === "development") &&
    process.env.ALLOW_REAL_OPENAI_IN_NON_PRODUCTION !== "true"
  ) {
    return true;
  }
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_REAL_OPENAI_IN_NON_PRODUCTION !== "true"
  ) {
    return true;
  }
  return false;
}

export function createTrackedOpenAiClient(
  apiKey: string,
  timeout = defaultOpenAiTimeoutMs,
) {
  if (shouldMockOpenAi()) {
    throw new Error("OPENAI_NETWORK_BLOCKED_IN_NON_PRODUCTION");
  }
  // Hidden SDK retries are disabled so the wrapper can record the actual retry count.
  return new OpenAI({ apiKey, maxRetries: 0, timeout });
}

export function isTransientOpenAiError(error: unknown) {
  if (error instanceof OpenAI.APIUserAbortError) return false;
  if (
    error instanceof OpenAI.APIConnectionTimeoutError ||
    error instanceof OpenAI.APIConnectionError ||
    error instanceof TypeError
  ) {
    return true;
  }
  return (
    error instanceof OpenAI.APIError &&
    (error.status === 429 || (typeof error.status === "number" && error.status >= 500))
  );
}

export async function runOpenAiWithTransientRetry<T>(
  operation: () => Promise<T>,
  onRetry?: (retryCount: number, error: unknown) => void,
) {
  let retryCount = 0;
  for (;;) {
    try {
      return { value: await operation(), retryCount };
    } catch (error) {
      if (!isTransientOpenAiError(error) || retryCount >= openAiMaxRetries) throw error;
      retryCount += 1;
      onRetry?.(retryCount, error);
    }
  }
}

export const openAiPricing = {
  lastVerifiedAt: "2026-08-17",
  currency: "USD",
  perMillionTokens: {
    "gpt-5.6-sol": { input: 5, cachedInput: 0.5, output: 30 },
    "gpt-5.6-terra": { input: 2.5, cachedInput: 0.25, output: 15 },
    "gpt-5.6-luna": { input: 1, cachedInput: 0.1, output: 6 },
  },
} as const;

type UsageContext = {
  requestId: string;
  userId?: string | null;
  surveyId?: string | null;
  requestType: BaroformAiRequestType;
  surveyMode?: "standard" | "research" | null;
  model: BaroformOpenAiModel;
  reasoningEffort: BaroformReasoningEffort;
  requestedServiceTier: BaroformServiceTier;
  webSearchCalls?: number;
  retryCount?: number;
  startedAt: number;
  success: boolean;
  errorCode?: string | null;
};

function responseUsage(response: OpenAIResponse | null | undefined) {
  const usage = response?.usage;
  const input = usage?.input_tokens ?? 0;
  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  const cacheWrite =
    (usage?.input_tokens_details as { cache_write_tokens?: number } | undefined)
      ?.cache_write_tokens ?? 0;
  const output = usage?.output_tokens ?? 0;
  const reasoning = usage?.output_tokens_details?.reasoning_tokens ?? 0;
  return {
    inputTokens: input,
    cachedInputTokens: cached,
    cacheWriteTokens: cacheWrite,
    uncachedInputTokens: Math.max(0, input - cached),
    outputTokens: output,
    reasoningTokens: reasoning,
    totalTokens: usage?.total_tokens ?? input + output,
  };
}

export function estimateOpenAiCost(
  model: BaroformOpenAiModel,
  usage: ReturnType<typeof responseUsage>,
) {
  const prices = openAiPricing.perMillionTokens[model];
  if (!prices) {
    console.warn("baroform-ai-unknown-model-pricing", { model });
    return null;
  }
  return (
    (usage.uncachedInputTokens * prices.input +
      usage.cachedInputTokens * prices.cachedInput +
      usage.outputTokens * prices.output) /
    1_000_000
  );
}

function isPricedModel(value: string): value is BaroformOpenAiModel {
  return value in openAiPricing.perMillionTokens;
}

export function logOpenAiUsage(
  response: OpenAIResponse | null | undefined,
  context: UsageContext,
) {
  const usage = responseUsage(response);
  const actualModel = response?.model || context.model;
  const actualServiceTier = response?.service_tier ?? null;
  if (
    actualServiceTier &&
    actualServiceTier !== "default" &&
    actualServiceTier !== "fast" &&
    actualServiceTier !== "priority"
  ) {
    console.warn("baroform-ai-unexpected-service-tier", { actualServiceTier });
  }
  const estimatedCostUsd = isPricedModel(actualModel)
    ? estimateOpenAiCost(actualModel, usage)
    : null;
  if (estimatedCostUsd === null) {
    console.warn("baroform-ai-cost-not-estimated", { actualModel });
  }
  console.info("baroform-ai-usage", {
    requestId: context.requestId,
    userId: context.userId ?? null,
    surveyId: context.surveyId ?? null,
    requestType: context.requestType,
    surveyMode: context.surveyMode ?? null,
    requestedModel: context.model,
    actualModel,
    reasoningEffort: context.reasoningEffort,
    requestedServiceTier: context.requestedServiceTier,
    actualServiceTier,
    ...usage,
    webSearchCalls: context.webSearchCalls ?? 0,
    retryCount: context.retryCount ?? 0,
    success: context.success,
    errorCode: context.errorCode ?? null,
    latencyMs: Math.round(performance.now() - context.startedAt),
    estimatedCostUsd,
    occurredAt: new Date().toISOString(),
  });
}
