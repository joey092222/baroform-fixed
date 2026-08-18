import { randomUUID } from "node:crypto";

import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import { readSurveyGenerationResponse } from "../app/survey-generation-client";

type LiveCase = {
  id: string;
  input: string;
  audience: RegExp;
  entity: RegExp;
  surveyType: RegExp;
  requiredQuestions: RegExp[];
  forbiddenQuestions?: RegExp[];
};

type Question = { title?: unknown };
type Blueprint = {
  title?: unknown;
  description?: unknown;
  aiQuestions?: Question[];
};

type TraceSnapshot = {
  requestId?: unknown;
  rawUserInput?: unknown;
  normalizedInput?: unknown;
  parsedSurveyContext?: {
    audience?: unknown;
    primaryEntity?: unknown;
  } | null;
  extractedAudience?: unknown;
  extractedEntities?: unknown;
  extractedResearchGoals?: unknown;
  selectedSurveyType?: unknown;
  selectedTemplateKey?: unknown;
  generationSource?: unknown;
  fallbackUsed?: unknown;
  fallbackReason?: unknown;
  modelCallCount?: unknown;
  repairCount?: unknown;
  fallbackCount?: unknown;
  semanticViolationCodes?: unknown;
  qualityViolationCodes?: unknown;
  questionsBeforePostprocess?: unknown;
  finalQuestions?: unknown;
  responseStatus?: unknown;
  responseIncompleteReason?: unknown;
  outputParsedPresent?: unknown;
  totalElapsedMs?: unknown;
};

type AiTraceEvent = {
  requestId?: unknown;
  stage?: unknown;
  data?: unknown;
};

type UsageLog = {
  requestId?: unknown;
  requestedModel?: unknown;
  actualModel?: unknown;
  inputTokens?: unknown;
  cachedInputTokens?: unknown;
  outputTokens?: unknown;
  totalTokens?: unknown;
  retryCount?: unknown;
  latencyMs?: unknown;
  estimatedCostUsd?: unknown;
};

const forbiddenUsagePhrases = [
  /경험에 대해를 이용/,
  /경험을 이용한 적/,
  /만족도를 이용한 적/,
  /인식을 얼마나 자주 이용/,
];

const cases: LiveCase[] = [
  {
    id: "academic-satisfaction",
    input: "경영대에 대한 연세대 경영대생들 만족도",
    audience: /연세대\s*경영대생/,
    entity: /경영대/,
    surveyType: /satisfaction|evaluation/,
    requiredQuestions: [/만족/, /불편|개선/],
  },
  {
    id: "mobility-experience",
    input: "연세대학교 학생들의 대우관 등하교 경험",
    audience: /연세대학교?\s*학생/,
    entity: /대우관/,
    surveyType: /mobility_experience/,
    requiredQuestions: [
      /빈도|횟수|얼마나 자주/,
      /이동 수단|교통수단/,
      /소요 시간|걸리는 시간/,
      /혼잡/,
      /안전/,
      /불편/,
    ],
    forbiddenQuestions: [/대우관.*이용한 적/, /대우관.*얼마나 자주 이용/],
  },
  {
    id: "platform-usage",
    input: "국내 최대 웹툰 플랫폼인 네이버 웹툰의 대학생들의 이용 현황과 경험",
    audience: /대학생/,
    entity: /네이버\s*웹툰/,
    surveyType: /service_usage|platform_usage/,
    requiredQuestions: [/이용한 적|이용 경험/, /빈도|얼마나 자주/, /만족/, /불편/],
  },
  {
    id: "cafeteria-usage",
    input: "연세대학교 학생들의 한경관 학식 이용 경험",
    audience: /연세대학교?\s*학생/,
    entity: /한경관\s*학식/,
    surveyType: /service_usage|facility_usage|satisfaction/,
    requiredQuestions: [/이용|방문/, /만족/, /개선|불편/],
  },
  {
    id: "known-service-satisfaction",
    input: "맛나샘을 이용하는 학생들의 만족도와 개선 의견",
    audience: /맛나샘을 이용하는 학생/,
    entity: /맛나샘/,
    surveyType: /service_usage|satisfaction/,
    requiredQuestions: [/만족/, /개선|불편/],
  },
  {
    id: "unseen-facility-image-and-use",
    input: "연세대 전체 학생이 바라보는 경영대 시설의 이미지와 이용 경험",
    audience: /연세대\s*전체\s*학생/,
    entity: /경영대\s*시설/,
    surveyType: /mixed|facility_usage|attitude/,
    requiredQuestions: [/이미지|인식/, /이용|방문/],
  },
  {
    id: "unseen-non-user-barrier",
    input: "맛나샘을 이용하지 않는 연세대 학생들이 이용하지 않는 이유",
    audience: /맛나샘을 이용하지 않는 연세대 학생/,
    entity: /맛나샘/,
    surveyType: /attitude|need|non.?use/,
    requiredQuestions: [/이용하지 않는 이유|비이용 이유|이용을 망설/],
    forbiddenQuestions: [/현재.*만족|전반적으로.*만족/],
  },
  {
    id: "unseen-relative-mobility",
    input: "대우관을 오가는 학생들이 느끼는 접근성, 혼잡도와 이동 불편",
    audience: /대우관을 오가는 학생/,
    entity: /대우관/,
    surveyType: /mobility_experience/,
    requiredQuestions: [/접근성/, /혼잡/, /이동.*불편|불편/],
    forbiddenQuestions: [/대우관.*이용한 적/, /대우관.*얼마나 자주 이용/],
  },
];

function requireLiveEnvironment() {
  const required = {
    BAROFORM_AI_TRACE: process.env.BAROFORM_AI_TRACE,
    BAROFORM_ALLOW_LIVE_AI_TESTS: process.env.BAROFORM_ALLOW_LIVE_AI_TESTS,
    ALLOW_REAL_OPENAI_IN_NON_PRODUCTION:
      process.env.ALLOW_REAL_OPENAI_IN_NON_PRODUCTION,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => value !== "true")
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`LIVE_AI_GUARD_DISABLED:${missing.join(",")}`);
  }
  if (process.env.AI_MOCK_MODE === "true") {
    throw new Error("LIVE_AI_MOCK_MODE_ENABLED");
  }
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("LIVE_AI_PRODUCTION_FORBIDDEN");
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("LIVE_AI_API_KEY_MISSING");
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function countOccurrences(source: string, needle: string) {
  return needle ? source.split(needle).length - 1 : 0;
}

function matchesEveryQuestion(questions: string[], patterns: RegExp[]) {
  return patterns.every((pattern) => questions.some((question) => pattern.test(question)));
}

requireLiveEnvironment();

const maximumRouteCalls = Math.min(
  8,
  Math.max(8, Number(process.env.MAX_REAL_AI_TEST_CALLS ?? "8")),
);
const selectedCases = cases.slice(0, maximumRouteCalls);
const traceSnapshots = new Map<string, TraceSnapshot>();
const aiTraceEvents = new Map<string, AiTraceEvent[]>();
const usageLogs = new Map<string, UsageLog>();
const originalInfo = console.info;

console.info = (...args: unknown[]) => {
  const [marker, payload] = args;
  if (marker === "survey-generation-trace") {
    const snapshot = payload as TraceSnapshot;
    if (typeof snapshot.requestId === "string") {
      traceSnapshots.set(snapshot.requestId, snapshot);
    }
    return;
  }
  if (marker === "baroform-ai-trace") {
    const event = payload as AiTraceEvent;
    if (typeof event.requestId === "string") {
      const events = aiTraceEvents.get(event.requestId) ?? [];
      events.push(event);
      aiTraceEvents.set(event.requestId, events);
    }
    return;
  }
  if (marker === "baroform-ai-usage") {
    const usage = payload as UsageLog;
    if (typeof usage.requestId === "string") usageLogs.set(usage.requestId, usage);
    return;
  }
  originalInfo(...args);
};

const results: Record<string, unknown>[] = [];
let totalModelCalls = 0;

try {
  for (const liveCase of selectedCases) {
    const requestId = `live-${randomUUID()}`;
    const startedAt = Date.now();
    try {
    const response = await createSurveyDraft(
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
          "user-agent": "baroform-live-e2e",
          "x-baroform-client-request-id": requestId,
          "x-baroform-client-submit-at": String(startedAt),
        },
        body: JSON.stringify({
          prompt: liveCase.input,
          userInput: liveCase.input,
          surveyMode: "standard",
          targetGrade: "전학년",
          questionCount: 7,
          references: { images: [], files: [], links: [] },
        }),
      }),
    );
    const rawBody = (await response.clone().json()) as Record<string, unknown>;
    const parsed = await readSurveyGenerationResponse<
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>
    >(response);
    const responseRecord = record(parsed) ?? {};
    const blueprint = record(responseRecord.blueprint) as Blueprint | null;
    const questions = (blueprint?.aiQuestions ?? [])
      .map((question) => text(question.title))
      .filter(Boolean);
    const snapshot = traceSnapshots.get(requestId) ?? {};
    const usage = usageLogs.get(requestId) ?? {};
    const events = aiTraceEvents.get(requestId) ?? [];
    const promptEvent = events.find((event) => event.stage === "prompt_built");
    const promptData = record(promptEvent?.data) ?? {};
    const postprocessEvent = events.find(
      (event) => event.stage === "postprocess_succeeded",
    );
    const postprocessData = record(postprocessEvent?.data) ?? {};
    const userMessages = strings(promptData.userMessages);
    const developerAndSystemText = JSON.stringify({
      instructions: promptData.instructions,
      messages: Array.isArray(promptData.messages)
        ? promptData.messages.filter((message) => {
            const item = record(message);
            return item?.role !== "user";
          })
        : [],
    });
    const parsedContext = record(snapshot.parsedSurveyContext) ?? {};
    const audience = text(snapshot.extractedAudience) || text(parsedContext.audience);
    const entity = strings(snapshot.extractedEntities).join(" ") || text(parsedContext.primaryEntity);
    const surveyType = text(snapshot.selectedSurveyType);
    const routeModelCalls = numberValue(snapshot.modelCallCount);
    const retryCount = numberValue(usage.retryCount);
    totalModelCalls += routeModelCalls + retryCount;

    const violations: string[] = [];
    if (response.status !== 200) violations.push(`http:${response.status}`);
    if (responseRecord.type !== "survey") violations.push(`type:${String(responseRecord.type)}`);
    if (!liveCase.audience.test(audience)) violations.push(`audience:${audience}`);
    if (!liveCase.entity.test(entity)) violations.push(`entity:${entity}`);
    if (!liveCase.surveyType.test(surveyType)) violations.push(`surveyType:${surveyType}`);
    if (!matchesEveryQuestion(questions, liveCase.requiredQuestions)) {
      violations.push("required-question-coverage");
    }
    const forbidden = [...forbiddenUsagePhrases, ...(liveCase.forbiddenQuestions ?? [])];
    if (forbidden.some((pattern) => questions.some((question) => pattern.test(question)))) {
      violations.push("forbidden-question");
    }
    if (snapshot.rawUserInput !== liveCase.input) violations.push("raw-input-changed");
    if (snapshot.normalizedInput !== liveCase.input) violations.push("normalized-input-changed");
    if (userMessages.length !== 1 || userMessages[0] !== liveCase.input) {
      violations.push("openai-user-message-not-exactly-once");
    }
    if (countOccurrences(developerAndSystemText, liveCase.input) !== 0) {
      violations.push("raw-input-duplicated-outside-user-message");
    }
    if (numberValue(promptData.rawInputOccurrenceCount) !== 1) {
      violations.push("raw-input-occurrence-count");
    }
    if (routeModelCalls < 1) violations.push("model-not-called");
    if (snapshot.fallbackUsed === true || snapshot.fallbackReason) {
      violations.push(`fallback:${text(snapshot.fallbackReason) || "unknown"}`);
    }
    if (snapshot.responseStatus !== "completed") {
      violations.push(`response-status:${text(snapshot.responseStatus)}`);
    }
    if (snapshot.outputParsedPresent !== true) violations.push("output-parsed-missing");
    if (!events.some((event) => event.stage === "parse_succeeded")) {
      violations.push("parse-not-succeeded");
    }
    if (!events.some((event) => event.stage === "postprocess_succeeded")) {
      violations.push("postprocess-not-succeeded");
    }
    if (
      JSON.stringify(postprocessData.postprocessedSurvey ?? null) !==
      JSON.stringify(blueprint ?? null)
    ) {
      violations.push("api-payload-differs-from-postprocess");
    }
    if (totalModelCalls > 12) {
      throw new Error(`LIVE_AI_HARD_CALL_LIMIT_EXCEEDED:${totalModelCalls}`);
    }

    results.push({
      id: liveCase.id,
      input: liveCase.input,
      requestId,
      httpStatus: response.status,
      responseType: responseRecord.type ?? rawBody.type ?? null,
      responseStatus: responseRecord.status ?? rawBody.status ?? null,
      title: blueprint?.title ?? null,
      description: blueprint?.description ?? null,
      audience,
      entity,
      researchGoals: strings(snapshot.extractedResearchGoals),
      selectedSurveyType: surveyType,
      selectedTemplateKey: snapshot.selectedTemplateKey ?? null,
      generationSource: snapshot.generationSource ?? null,
      fallbackUsed: snapshot.fallbackUsed ?? null,
      fallbackReason: snapshot.fallbackReason ?? null,
      modelCallCount: routeModelCalls,
      retryCount,
      repairCount: snapshot.repairCount ?? null,
      fallbackCount: snapshot.fallbackCount ?? null,
      responseStatusFromOpenAi: snapshot.responseStatus ?? null,
      incompleteReason: snapshot.responseIncompleteReason ?? null,
      outputParsedPresent: snapshot.outputParsedPresent ?? null,
      semanticViolationCodes: snapshot.semanticViolationCodes ?? [],
      qualityViolationCodes: snapshot.qualityViolationCodes ?? [],
      questionsBeforePostprocess: snapshot.questionsBeforePostprocess ?? [],
      finalQuestions: questions,
      uiPayload: blueprint,
      model: usage.actualModel ?? usage.requestedModel ?? null,
      tokens: {
        input: usage.inputTokens ?? null,
        cachedInput: usage.cachedInputTokens ?? null,
        output: usage.outputTokens ?? null,
        total: usage.totalTokens ?? null,
      },
      estimatedCostUsd: usage.estimatedCostUsd ?? null,
      elapsedMs: Date.now() - startedAt,
      tracedElapsedMs: snapshot.totalElapsedMs ?? null,
      passed: violations.length === 0,
      violations,
    });
    } catch (error) {
      const snapshot = traceSnapshots.get(requestId) ?? {};
      const usage = usageLogs.get(requestId) ?? {};
      const routeModelCalls = numberValue(snapshot.modelCallCount);
      const retryCount = numberValue(usage.retryCount);
      totalModelCalls += routeModelCalls + retryCount;
      results.push({
        id: liveCase.id,
        input: liveCase.input,
        requestId,
        generationSource: snapshot.generationSource ?? null,
        fallbackReason: snapshot.fallbackReason ?? null,
        modelCallCount: routeModelCalls,
        retryCount,
        repairCount: snapshot.repairCount ?? null,
        fallbackCount: snapshot.fallbackCount ?? null,
        responseStatusFromOpenAi: snapshot.responseStatus ?? null,
        incompleteReason: snapshot.responseIncompleteReason ?? null,
        outputParsedPresent: snapshot.outputParsedPresent ?? null,
        questionsBeforePostprocess: snapshot.questionsBeforePostprocess ?? [],
        finalQuestions: snapshot.finalQuestions ?? [],
        elapsedMs: Date.now() - startedAt,
        passed: false,
        violations: [
          `request-error:${error instanceof Error ? error.name : "UnknownError"}`,
        ],
      });
      if (totalModelCalls > 12) {
        throw new Error(`LIVE_AI_HARD_CALL_LIMIT_EXCEEDED:${totalModelCalls}`);
      }
    }
  }
} finally {
  console.info = originalInfo;
}

const failed = results.filter((result) => result.passed !== true);
process.stdout.write(
  `${JSON.stringify(
    {
      environment: {
        nodeEnv: process.env.NODE_ENV ?? null,
        vercelEnv: process.env.VERCEL_ENV ?? null,
        traceEnabled: process.env.BAROFORM_AI_TRACE === "true",
        apiKeyPresent: Boolean(process.env.OPENAI_API_KEY?.trim()),
      },
      route: "POST /api/survey-draft",
      attemptedCases: results.length,
      totalModelCallsIncludingRetries: totalModelCalls,
      passed: failed.length === 0 && results.length >= 8,
      results,
    },
    null,
    2,
  )}\n`,
);

if (failed.length > 0 || results.length < 8) process.exitCode = 1;
