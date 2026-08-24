import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  classifySurveyRevision,
  resolveOpenAiServiceTier,
  resolveSurveyGenerationModel,
  resolveSurveyRevisionModel,
} from "../app/lib/ai/model-router";
import {
  createTrackedOpenAiClient,
  logOpenAiUsage,
  openAiMaxRetries,
  runOpenAiWithTransientRetry,
  shouldMockOpenAi,
} from "../app/lib/ai/openai-runtime";
import {
  buildSurveyAiRequest,
  shouldUseWebSearchForSurvey,
} from "../app/survey-ai";
import { POST as createSurveyDraft } from "../app/api/survey-draft/route";
import { structuredReadyPayload } from "./structured-payload";
import { openAiUploadRequest } from "../app/reference-file-upload";

function withEnvironment(
  values: Record<string, string | undefined>,
  action: () => void,
) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    action();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("Medium/High 설문은 명시적 Terra/Sol 모델과 기존 reasoning을 사용한다", () => {
  withEnvironment(
    {
      AI_MODEL_SURVEY_MEDIUM: undefined,
      AI_MODEL_SURVEY_HIGH: undefined,
      AI_REASONING_SURVEY_MEDIUM: undefined,
      AI_REASONING_SURVEY_HIGH: undefined,
      OPENAI_SERVICE_TIER: undefined,
    },
    () => {
      assert.deepEqual(resolveSurveyGenerationModel("standard"), {
        model: "gpt-5.6-terra",
        reasoningEffort: "medium",
        requestedServiceTier: "default",
      });
      assert.deepEqual(resolveSurveyGenerationModel("research"), {
        model: "gpt-5.6-sol",
        reasoningEffort: "high",
        requestedServiceTier: "default",
      });
    },
  );
});

test("간단한 표현 수정은 Luna, 구조·분기 수정은 Terra를 사용한다", () => {
  assert.equal(classifySurveyRevision("3번 문항을 자연스러운 존댓말로 고쳐줘"), "simple");
  assert.equal(resolveSurveyRevisionModel("3번 문항 오탈자만 고쳐줘").model, "gpt-5.6-luna");
  assert.equal(classifySurveyRevision("응답 대상과 분기 로직을 다시 설계해줘"), "complex");
  assert.equal(resolveSurveyRevisionModel("응답 대상과 분기 로직을 다시 설계해줘").model, "gpt-5.6-terra");
});

test("일반 tier는 default이고 허가 없는 Fast/Priority는 차단한다", () => {
  withEnvironment({ OPENAI_SERVICE_TIER: undefined }, () => {
    assert.equal(resolveOpenAiServiceTier(), "default");
  });
  withEnvironment(
    {
      NODE_ENV: "test",
      OPENAI_SERVICE_TIER: "fast",
      ALLOW_OPENAI_FAST_TIER: "false",
    },
    () => assert.throws(() => resolveOpenAiServiceTier(), /disabled/),
  );
});

test("test와 Preview는 실제 OpenAI 네트워크를 기본 차단한다", () => {
  withEnvironment(
    {
      NODE_ENV: "test",
      AI_MOCK_MODE: "false",
      ALLOW_REAL_OPENAI_IN_NON_PRODUCTION: "false",
    },
    () => {
      assert.equal(shouldMockOpenAi(), true);
      assert.throws(
        () => createTrackedOpenAiClient("not-a-real-key"),
        /OPENAI_NETWORK_BLOCKED_IN_NON_PRODUCTION/,
      );
    },
  );
  withEnvironment(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      ALLOW_REAL_OPENAI_IN_NON_PRODUCTION: "false",
    },
    () => assert.equal(shouldMockOpenAi(), true),
  );
});

test("mock 모드의 파일 참고 업로드는 OpenAI 네트워크 없이 실제 응답 형태를 반환한다", async () => {
  const start = await openAiUploadRequest("/uploads", {
    method: "POST",
    body: JSON.stringify({ bytes: 128 }),
  });
  const started = await start.json() as { id: string };
  assert.match(started.id, /^upload_mock_/);
  const complete = await openAiUploadRequest(`/uploads/${started.id}/complete`, {
    method: "POST",
    body: JSON.stringify({ part_ids: ["part_mock_1"] }),
  });
  const completed = await complete.json() as { file: { id: string; bytes: number } };
  assert.match(completed.file.id, /^file-mock_/);
  assert.equal(completed.file.bytes, 128);
});

test("Responses 요청은 default tier, 줄어든 출력 상한, 검색 1회 제한을 사용한다", () => {
  const plain = buildSurveyAiRequest(
    "대학생의 전반적인 대학생활 만족도 조사",
    null,
    "gpt-5.6-terra",
    { surveyMode: "standard", questionCount: 10 },
  );
  assert.equal(plain.service_tier, "default");
  assert.equal(plain.max_output_tokens, 10_000);
  assert.equal(plain.tools, undefined);

  const searched = buildSurveyAiRequest(
    "맛나샘의 현재 운영 정보를 확인해 이용 경험을 조사",
    null,
    "gpt-5.6-terra",
    { surveyMode: "standard", questionCount: 10 },
  );
  assert.equal(searched.max_tool_calls, 1);
  assert.equal(searched.tool_choice, "required");
});

test("일반 대학 설문은 검색을 생략하고 고유 시설·서비스는 검색한다", () => {
  assert.equal(
    shouldUseWebSearchForSurvey("연세대학교 경영학과 신입생 학교생활 적응 조사"),
    false,
  );
  assert.equal(shouldUseWebSearchForSurvey("맛나샘 이용 경험 조사"), true);
  assert.equal(shouldUseWebSearchForSurvey("한경관 빈자리 현황 조사"), true);
  assert.equal(shouldUseWebSearchForSurvey("네이버웹툰 이용 현황 조사"), true);
});

test("SDK 자동 retry는 transient 오류에 대해 최대 1회다", () => {
  assert.equal(openAiMaxRetries, 1);
});

test("일시 네트워크 오류는 한 번만 재시도하고 실제 횟수를 반환한다", async () => {
  let calls = 0;
  const result = await runOpenAiWithTransientRetry(async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("temporary network failure");
    return "ok";
  });
  assert.deepEqual(result, { value: "ok", retryCount: 1 });
  assert.equal(calls, 2);
});

test("사용량 로그에 모델, tier, 캐시 토큰과 비용이 기록된다", () => {
  const entries: unknown[] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => entries.push(args);
  try {
    logOpenAiUsage(
      {
        model: "gpt-5.6-terra",
        service_tier: "default",
        usage: {
          input_tokens: 1000,
          input_tokens_details: { cached_tokens: 400 },
          output_tokens: 200,
          output_tokens_details: { reasoning_tokens: 50 },
          total_tokens: 1200,
        },
      } as never,
      {
        requestId: "req-usage-test",
        requestType: "survey_generate",
        model: "gpt-5.6-terra",
        reasoningEffort: "medium",
        requestedServiceTier: "default",
        startedAt: performance.now(),
        success: true,
      },
    );
  } finally {
    console.info = original;
  }
  const payload = (entries[0] as unknown[])[1] as Record<string, unknown>;
  assert.equal(payload.actualModel, "gpt-5.6-terra");
  assert.equal(payload.actualServiceTier, "default");
  assert.equal(payload.cachedInputTokens, 400);
  assert.equal(typeof payload.estimatedCostUsd, "number");
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    if (["node_modules", ".next", "dist", "build"].includes(name)) return [];
    return statSync(absolute).isDirectory()
      ? sourceFiles(absolute)
      : /\.(?:ts|tsx|js|mjs)$/.test(name)
        ? [absolute]
        : [];
  });
}

test("운영 app 코드에는 gpt-5.6 별칭과 직접 Responses fetch가 남아 있지 않다", () => {
  const appRoot = path.resolve("app");
  const contents = sourceFiles(appRoot).map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(contents, /["']gpt-5\.6["']/);
  assert.doesNotMatch(contents, /api\.openai\.com\/v1\/responses/);
});

test("동일 payload의 동시 생성 요청은 OpenAI 작업 하나를 공유한다", async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  let modelCalls = 0;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => {
    modelCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 30));
    return Response.json({
      id: "resp_single_flight_test",
      object: "response",
      model: "gpt-5.6-terra",
      service_tier: "default",
      usage: {
        input_tokens: 10,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 1,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 11,
      },
      ...structuredReadyPayload(),
    });
  };
  try {
    const prompt =
      "최근 4주 동안 네이버웹툰을 이용한 대학생 대상 네이버웹툰 이용 현황 조사";
    const makeRequest = () =>
      new Request("http://localhost/api/survey-draft", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({ prompt, surveyMode: "standard", questionCount: 7 }),
      });
    const [first, second] = await Promise.all([
      createSurveyDraft(makeRequest()),
      createSurveyDraft(makeRequest()),
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(modelCalls, 1);
    assert.equal(second.headers.get("x-baroform-ai-cache"), "shared-in-flight");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey) process.env.OPENAI_API_KEY = previousKey;
    else delete process.env.OPENAI_API_KEY;
  }
});
