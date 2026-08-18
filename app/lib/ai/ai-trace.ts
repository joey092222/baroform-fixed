export type AiTraceStage =
  | "client_submit"
  | "server_received"
  | "input_normalized"
  | "prompt_built"
  | "openai_request_started"
  | "openai_response_received"
  | "parse_started"
  | "parse_succeeded"
  | "parse_failed"
  | "postprocess_succeeded"
  | "fallback_used"
  | "retry_started"
  | "ui_payload_created"
  | "request_failed";

export type AiTraceEvent = {
  requestId: string;
  stage: AiTraceStage;
  timestamp: string;
  data: unknown;
};

const sensitiveKeyPattern =
  /(?:authorization|cookie|password|secret|api[_-]?key|session|access[_-]?token|refresh[_-]?token|file[_-]?data|data[_-]?url|image[_-]?url)/i;

type AiTraceSink = (event: AiTraceEvent) => void;

let testTraceOverride: { enabled: true; sink: AiTraceSink } | null = null;

function traceFlagEnabled() {
  if (process.env.NODE_ENV !== "production" && testTraceOverride) return true;
  const flag =
    typeof window === "undefined"
      ? process.env.BAROFORM_AI_TRACE
      : process.env.BAROFORM_AI_TRACE_CLIENT;
  return flag === "true";
}

export function isAiTraceEnabled() {
  return process.env.NODE_ENV !== "production" && traceFlagEnabled();
}

export function redactSensitiveData(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (depth > 8) return "[TRUNCATED_DEPTH]";
  if (typeof value === "string") {
    if (/^data:[^;]+;base64,/i.test(value)) return "[REDACTED_ATTACHMENT]";
    return value.length > 20_000 ? `${value.slice(0, 20_000)}…[TRUNCATED]` : value;
  }
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => redactSensitiveData(item, depth + 1, seen));
  }
  const redacted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, 100)) {
    redacted[key] = sensitiveKeyPattern.test(key)
      ? "[REDACTED]"
      : redactSensitiveData(item, depth + 1, seen);
  }
  return redacted;
}

export function traceAiEvent(
  event: Omit<AiTraceEvent, "timestamp">,
  sink?: AiTraceSink,
): AiTraceEvent | null {
  if (!isAiTraceEnabled()) return null;
  const payload: AiTraceEvent = {
    ...event,
    timestamp: new Date().toISOString(),
    data: redactSensitiveData(event.data),
  };
  const targetSink =
    sink ??
    testTraceOverride?.sink ??
    ((tracePayload: AiTraceEvent) =>
      console.info("baroform-ai-trace", tracePayload));
  targetSink(payload);
  return payload;
}

export async function withAiTraceForTest<T>(
  sink: AiTraceSink,
  operation: () => Promise<T> | T,
): Promise<T> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("AI_TRACE_TEST_OVERRIDE_DISABLED_IN_PRODUCTION");
  }
  const previous = testTraceOverride;
  testTraceOverride = { enabled: true, sink };
  try {
    return await operation();
  } finally {
    testTraceOverride = previous;
  }
}

function textLength(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (Array.isArray(value)) {
    return value.reduce((total, part) => {
      if (!part || typeof part !== "object") return total;
      const text = (part as { text?: unknown }).text;
      return total + (typeof text === "string" ? text.length : 0);
    }, 0);
  }
  return 0;
}

export function openAiUserMessages(input: unknown): string[] {
  if (!Array.isArray(input)) return typeof input === "string" ? [input] : [];
  return input.flatMap((message) => {
    if (!message || typeof message !== "object") return [];
    const candidate = message as { role?: unknown; content?: unknown };
    if (candidate.role !== "user") return [];
    if (typeof candidate.content === "string") return [candidate.content];
    if (!Array.isArray(candidate.content)) return [];
    return candidate.content.flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const text = (part as { type?: unknown; text?: unknown }).text;
      return typeof text === "string" ? [text] : [];
    });
  });
}

export function openAiMessageText(input: unknown): string {
  if (typeof input === "string") return input;
  if (!Array.isArray(input)) return "";
  return input
    .flatMap((message) => {
      if (!message || typeof message !== "object") return [];
      const content = (message as { content?: unknown }).content;
      if (typeof content === "string") return [content];
      if (!Array.isArray(content)) return [];
      return content.flatMap((part) => {
        if (!part || typeof part !== "object") return [];
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? [text] : [];
      });
    })
    .join("\n");
}

export function summarizeOpenAiRequestForTrace(
  request: Record<string, unknown>,
  rawUserInput: string,
  details: { timeoutMs: number; developerPromptVersion: string },
) {
  const input = request.input;
  const messages = Array.isArray(input) ? input : [];
  const roles = messages.map((message) =>
    message && typeof message === "object"
      ? String((message as { role?: unknown }).role ?? "unknown")
      : "unknown",
  );
  const serializedPrompt = JSON.stringify({ instructions: request.instructions, input });
  const userMessages = openAiUserMessages(input);
  return {
    model: request.model ?? null,
    reasoning: request.reasoning ?? null,
    temperature: request.temperature ?? null,
    maxOutputTokens: request.max_output_tokens ?? null,
    timeoutMs: details.timeoutMs,
    tools: request.tools ?? [],
    messageCount: messages.length,
    messageRoles: roles,
    messageCharacterCounts: messages.map((message) =>
      message && typeof message === "object"
        ? textLength((message as { content?: unknown }).content)
        : textLength(message),
    ),
    instructionCharacterCount: textLength(request.instructions),
    totalPromptCharacterCount: serializedPrompt.length,
    developerPromptVersion: details.developerPromptVersion,
    instructions: request.instructions ?? null,
    messages: input,
    userMessages,
    rawInputOccurrenceCount: rawUserInput
      ? serializedPrompt.split(rawUserInput).length - 1
      : 0,
  };
}

export function summarizeOpenAiResponseForTrace(response: unknown) {
  if (!response || typeof response !== "object") return { present: false };
  const payload = response as {
    id?: unknown;
    status?: unknown;
    incomplete_details?: { reason?: unknown } | null;
    output_parsed?: unknown;
    output?: unknown;
    output_text?: unknown;
    usage?: { output_tokens?: unknown };
  };
  const outputItems = Array.isArray(payload.output) ? payload.output : [];
  return {
    present: true,
    responseId: typeof payload.id === "string" ? payload.id : null,
    responseStatus: typeof payload.status === "string" ? payload.status : null,
    incompleteReason:
      typeof payload.incomplete_details?.reason === "string"
        ? payload.incomplete_details.reason
        : null,
    outputTokens:
      typeof payload.usage?.output_tokens === "number"
        ? payload.usage.output_tokens
        : null,
    outputItemTypes: outputItems.map((item) =>
      item && typeof item === "object"
        ? String((item as { type?: unknown }).type ?? "unknown")
        : "unknown",
    ),
    outputParsedPresent:
      payload.output_parsed !== null && payload.output_parsed !== undefined,
    outputParsed: payload.output_parsed ?? null,
    rawTextOutput: typeof payload.output_text === "string" ? payload.output_text : null,
    refusalPresent: JSON.stringify(outputItems).includes('"type":"refusal"'),
    truncated: payload.status === "incomplete",
  };
}
