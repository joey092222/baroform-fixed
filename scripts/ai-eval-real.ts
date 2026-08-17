import OpenAI from "openai";
import { buildSurveyAiRequest } from "../app/survey-ai";
import { goldenSurveyCases } from "../tests/fixtures/ai-golden-surveys";

if (
  process.env.RUN_REAL_AI_TESTS !== "true" ||
  process.env.ALLOW_REAL_OPENAI_IN_NON_PRODUCTION !== "true"
) {
  console.error(
    "실제 AI 평가는 RUN_REAL_AI_TESTS=true와 ALLOW_REAL_OPENAI_IN_NON_PRODUCTION=true가 모두 필요합니다.",
  );
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) throw new Error("OPENAI_API_KEY is required");
const maximumCalls = Math.min(
  10,
  Math.max(1, Number.parseInt(process.env.MAX_REAL_AI_TEST_CALLS ?? "3", 10) || 3),
);
const selectedCases = goldenSurveyCases.slice(0, Math.min(5, Math.floor(maximumCalls / 2)));
const expectedCalls = selectedCases.length * 2;
console.log(`Terra/Sol 비교 예정: ${selectedCases.length}개 사례, ${expectedCalls}회 호출`);
if (expectedCalls === 0 || expectedCalls > maximumCalls) process.exit(1);

const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 280_000 });
for (const fixture of selectedCases) {
  for (const model of ["gpt-5.6-terra", "gpt-5.6-sol"] as const) {
    const startedAt = performance.now();
    const request = buildSurveyAiRequest(fixture.prompt, null, model, {
      surveyMode: model.endsWith("sol") ? "research" : "standard",
      questionCount: fixture.questionCount,
      reasoningEffort: "medium",
      serviceTier: "default",
    });
    const response = await client.responses.parse(request);
    console.log(JSON.stringify({
      fixture: fixture.id,
      model,
      status: response.status,
      inputTokens: response.usage?.input_tokens ?? 0,
      cachedInputTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      latencyMs: Math.round(performance.now() - startedAt),
      serviceTier: response.service_tier ?? null,
    }));
  }
}
