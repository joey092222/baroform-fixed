import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
  evaluateSemanticResult,
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
import { auditedSurveyRegressionDatasetSchema } from "../evals/survey-regression/v1.1/schema";
import { frontedPurposeSmokeCases } from "../evals/survey-regression/v1.1/fronted-purpose-smoke";

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

test("실제 모델 호출 전 Preview rate limit은 제품 요청 실패와 분리한다", () => {
  const base = {
    responseType: "error",
    generationSource: null,
    repairCount: 0,
    fallbackCount: 0,
    fallbackReason: null,
    normalizedMetadataPaths: [] as string[],
    outputParsed: false,
  };
  assert.equal(
    classifyGenerationPath({
      ...base,
      httpStatus: 429,
      responseCode: "RATE_LIMITED",
      modelCallCount: 0,
    }),
    "environment_rate_limited",
  );
  assert.equal(
    classifyGenerationPath({
      ...base,
      httpStatus: 422,
      responseCode: "SEMANTIC_VALIDATION_FAILED",
      modelCallCount: 1,
    }),
    "request_failure",
  );
  assert.equal(
    classifyGenerationPath({
      ...base,
      httpStatus: 500,
      responseCode: "MODEL_REQUEST_FAILED",
      modelCallCount: 1,
    }),
    "request_failure",
  );
  assert.equal(
    classifyGenerationPath({
      ...base,
      httpStatus: 200,
      responseType: "survey",
      responseCode: null,
      generationSource: "initial_local_blueprint",
      fallbackReason: "mock-mode",
      modelCallCount: 0,
    }),
    "environment_runtime_inactive",
  );
});

test("v1.1 감사본은 원본 100건을 보존하며 입력 품질과 의미 역할을 동결한다", async () => {
  const [devRaw, holdoutRaw] = await Promise.all([
    readFile(join(process.cwd(), "evals/survey-regression/v1.1/dev.json"), "utf8"),
    readFile(join(process.cwd(), "evals/survey-regression/v1.1/holdout.json"), "utf8"),
  ]);
  const datasets = [devRaw, holdoutRaw].map((raw) =>
    auditedSurveyRegressionDatasetSchema.parse(JSON.parse(raw)),
  );
  const auditedCases = datasets.flatMap((dataset) => dataset.cases);
  const audited = auditedCases.find((item) => item.id === "dev-complex-011");

  assert.equal(datasets[0].cases.length, 80);
  assert.equal(datasets[1].cases.length, 20);
  assert.equal(auditedCases.length, 100);
  assert.equal(auditedCases.filter((item) => item.inputQuality === "clear").length, 73);
  assert.equal(auditedCases.filter((item) => item.inputQuality === "noisy_recoverable").length, 19);
  assert.equal(auditedCases.filter((item) => item.inputQuality === "ambiguous").length, 8);
  assert.equal(auditedCases.filter((item) => item.inputQuality === "invalid_test_sentence").length, 0);
  assert.ok(audited);
  assert.equal(audited.inputQuality, "noisy_recoverable");
  assert.deepEqual(audited.contextEntities, ["별마루 카페"]);
  assert.deepEqual(audited.expectedEligibilityConditions, ["최근 한 달 내 별마루 카페 이용"]);
  assert.deepEqual(audited.expectedSurveyObject, ["별마루 카페의 새 메뉴"]);
  assert.deepEqual(audited.expectedPurposeConcepts, ["새 메뉴 만족도"]);
  assert.deepEqual(audited.requiredQuestionConcepts, ["만족도"]);
  assert.equal(audited.screeningExpected, true);
});

test("evaluator는 적격 조건·조사 대상·조사 목적 누락을 서로 다른 코드로 판정한다", async () => {
  const devRaw = await readFile(
    join(process.cwd(), "evals/survey-regression/v1.1/dev.json"),
    "utf8",
  );
  const dataset = auditedSurveyRegressionDatasetSchema.parse(JSON.parse(devRaw));
  const audited = dataset.cases.find((item) => item.id === "dev-complex-011");
  assert.ok(audited);

  const broken = evaluateSemanticResult(audited, {
    classification: "partial_repair",
    httpStatus: 200,
    responseType: "survey",
    canonicalTargetPopulation: null,
    finalRespondentGroup: "관련 경험이 있는 응답자",
    canonicalSurveyObject: null,
    finalEvaluationTarget: "새 메뉴 만족도는 별마루 카페",
    title: "별마루 카페 새 메뉴 만족도 조사",
    description: "별마루 카페의 새 메뉴 만족도를 확인합니다.",
    questions: [
      { title: "새 메뉴에 얼마나 만족하시나요?", type: "scale", options: ["1", "2", "3", "4", "5"] },
    ],
    schemaIssues: [],
    semanticIssues: [],
    qualityIssues: [],
  });
  const codes = broken.fatalFailures.map((item) => item.code);

  assert.ok(codes.includes("TARGET_POPULATION_MISMATCH"));
  assert.ok(codes.includes("ELIGIBILITY_CONDITION_DROPPED"));
  assert.ok(codes.includes("ELIGIBILITY_CHECK_MISSING"));
  assert.ok(codes.includes("SURVEY_OBJECT_MISMATCH"));
  assert.equal(codes.includes("REQUIRED_PURPOSE_MISSING"), false);
  assert.equal(codes.includes("REQUIRED_QUESTION_CONCEPT_MISSING"), false);
});

test("목적 선행형 20건 smoke fixture는 clear 8·noisy 6·ambiguous 3·control 3으로 고정된다", () => {
  assert.equal(frontedPurposeSmokeCases.length, 20);
  assert.equal(
    frontedPurposeSmokeCases.filter((item) => item.id.startsWith("fronted-clear-")).length,
    8,
  );
  assert.equal(
    frontedPurposeSmokeCases.filter((item) => item.id.startsWith("fronted-noisy-")).length,
    6,
  );
  assert.equal(
    frontedPurposeSmokeCases.filter((item) => item.id.startsWith("fronted-ambiguous-")).length,
    3,
  );
  assert.equal(
    frontedPurposeSmokeCases.filter((item) => item.id.startsWith("fronted-control-")).length,
    3,
  );
  for (const item of frontedPurposeSmokeCases) surveyRegressionCaseSchema.parse(item);
  assertNoSecrets(JSON.stringify(frontedPurposeSmokeCases));
});
