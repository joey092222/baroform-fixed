import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  allCases,
  devCases,
  devSeed,
  holdoutCases,
  holdoutSeed,
} from "../evals/survey-regression/v1/dataset-source";
import {
  trigramSimilarity,
  validateDatasetQuality,
} from "../evals/survey-regression/v1/dataset-utils";
import {
  assertNoSecrets,
  classifyGenerationPath,
  redactSecrets,
} from "../evals/survey-regression/v1/evaluation";
import {
  emptyCheckpoint,
  liveEvaluationCostCapUsd,
  pendingCases,
  projectLiveEvaluationCost,
  readCheckpoint,
  writeCheckpoint,
} from "../evals/survey-regression/v1/runner-utils";
import { surveyRegressionCaseSchema } from "../evals/survey-regression/v1/schema";

test("100개 층화 데이터셋의 스키마와 분포가 고정돼 있다", () => {
  assert.equal(devCases.length, 80);
  assert.equal(holdoutCases.length, 20);
  assert.equal(allCases.length, 100);
  assert.equal(devSeed, "baroform-regression-v1-dev-20260818");
  assert.equal(holdoutSeed, "baroform-regression-v1-holdout-20260818");
  for (const item of allCases) surveyRegressionCaseSchema.parse(item);

  const quality = validateDatasetQuality(allCases);
  assert.deepEqual(quality.errors, []);
  assert.equal(quality.counts.standard, 85);
  assert.equal(quality.counts.research, 15);
  assert.equal(quality.counts.clarification, 8);
  assert.ok(quality.counts.negation >= 20);
  assert.ok(quality.counts.timeframe >= 15);
  assert.ok(quality.counts.virtualEntity >= 20);
  assert.ok(quality.counts.nonUniversity >= 20);
  assert.ok(quality.counts.multipleTargets >= 10);
  assert.ok(quality.counts.singleTargetMultiPurpose >= 15);
  assert.ok(quality.counts.complexOrder >= 10);
  assert.ok(quality.counts.noisyInput >= 10);
  assert.deepEqual(quality.highSimilarityPairs, []);
});

test("개발과 Holdout의 가상 고유명사 풀이 분리돼 있다", () => {
  const devText = devCases.map((item) => item.input).join(" ");
  const holdoutText = holdoutCases.map((item) => item.input).join(" ");
  for (const term of ["새봄대학교", "솔빛관", "별마루", "온새미"]) {
    assert.match(devText, new RegExp(term));
    assert.doesNotMatch(holdoutText, new RegExp(term));
  }
  for (const term of ["한울대학교", "늘봄관", "해든", "다온"]) {
    assert.match(holdoutText, new RegExp(term));
    assert.doesNotMatch(devText, new RegExp(term));
  }
});

test("정규화 trigram 중복 기준은 동일 문장과 다른 문장을 구분한다", () => {
  assert.equal(trigramSimilarity("학교 만족도", "학교 만족도"), 1);
  assert.ok(trigramSimilarity("학교 만족도", "직장인 통근 시간") < 0.3);
});

test("생성 경로 fixture 여섯 종류를 상호 배타적으로 분류한다", () => {
  const base = {
    httpStatus: 200,
    responseType: "survey",
    generationSource: "openai",
    repairCount: 0,
    fallbackCount: 0,
    fallbackReason: null,
    normalizedMetadataPaths: [] as string[],
  };
  assert.equal(classifyGenerationPath(base), "clean_model_success");
  assert.equal(
    classifyGenerationPath({ ...base, normalizedMetadataPaths: ["survey_plan.target"] }),
    "deterministic_metadata_normalization",
  );
  assert.equal(
    classifyGenerationPath({ ...base, generationSource: "openai_partial_repair", repairCount: 1 }),
    "partial_repair",
  );
  assert.equal(
    classifyGenerationPath({ ...base, generationSource: "openai_question_validation_fallback", fallbackCount: 1, fallbackReason: "model-output-rejected" }),
    "hard_fallback",
  );
  assert.equal(
    classifyGenerationPath({ ...base, httpStatus: 500, responseType: "error" }),
    "request_failure",
  );
  assert.equal(
    classifyGenerationPath({ ...base, responseType: "clarification", generationSource: "clarification" }),
    "clarification",
  );
});

test("checkpoint는 완료 사례를 재실행 목록에서 제외한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "baroform-regression-"));
  const path = join(directory, "checkpoint.json");
  try {
    const checkpoint = emptyCheckpoint("test-run");
    checkpoint.completedCaseIds = [devCases[0].id, devCases[1].id];
    checkpoint.caseSummaries = [{
      caseId: devCases[0].id,
      split: "dev",
      requestId: "reg-v1-test",
      classification: "clean_model_success",
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      latencyMs: 1_000,
      estimatedCostUsd: 0.01,
      errorCode: null,
      errorStage: null,
      resultFile: `cases/${devCases[0].id}.json`,
    }];
    checkpoint.modelCallsIncludingRetries = 2;
    await writeCheckpoint(path, checkpoint);
    const restored = await readCheckpoint(path, "test-run");
    assert.deepEqual(restored.completedCaseIds, [...checkpoint.completedCaseIds].sort());
    assert.deepEqual(restored.caseSummaries, checkpoint.caseSummaries);
    assert.deepEqual(
      pendingCases(devCases.slice(0, 3), restored).map((item) => item.id),
      [devCases[2].id],
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("실평가 비용은 현재 기준에서 상한 이내이고 과도한 추정은 차단된다", () => {
  const projection = projectLiveEvaluationCost(allCases);
  assert.equal(projection.withinCap, true);
  assert.equal(projection.estimatedWebSearchCostUsd, 1);
  assert.ok(projection.projectedCostUsd < liveEvaluationCostCapUsd);
  const excessive = projectLiveEvaluationCost(allCases, {
    averageInputTokens: 500_000,
    averageOutputTokens: 100_000,
  });
  assert.equal(excessive.withinCap, false);
});

test("secret redaction이 API key와 Authorization을 감춘다", () => {
  const source = "api_key=sk-example0123456789 Authorization: Bearer token-example-123456";
  const redacted = redactSecrets(source);
  assert.doesNotMatch(redacted, /sk-example/);
  assert.doesNotMatch(redacted, /token-example/);
  assert.throws(() => assertNoSecrets(source), /SECRET_PATTERN_DETECTED/);
  assert.doesNotThrow(() => assertNoSecrets("synthetic survey result"));
});
