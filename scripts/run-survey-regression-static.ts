import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { buildSurveyAiRequest } from "../app/survey-ai";
import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent";
import { resolveSurveyGenerationModel } from "../app/lib/ai/model-router";
import { createSurveyPlan } from "../app/survey-planning";
import {
  mergeDatasets,
  readRegressionDataset,
  validateDatasetQuality,
} from "../evals/survey-regression/v1/dataset-utils";
import {
  conceptPresent,
  semanticTextMatch,
} from "../evals/survey-regression/v1/evaluation";
import type { SurveyRegressionCase } from "../evals/survey-regression/v1/schema";

type StaticIssue = { code: string; message: string; fatal: boolean };

function userTexts(request: ReturnType<typeof buildSurveyAiRequest>) {
  return request.input.flatMap((message) => {
    if (message.role !== "user") return [];
    if (typeof message.content === "string") return [message.content];
    return message.content
      .filter((item) => item.type === "input_text")
      .map((item) => item.text);
  });
}

function occurrences(value: string, needle: string) {
  return needle ? value.split(needle).length - 1 : 0;
}

function evaluateCase(testCase: SurveyRegressionCase) {
  const studyType = testCase.surveyMode === "research" ? "research" : "general";
  const canonical = parseCanonicalSurveyIntent(testCase.input, studyType);
  const plan = createSurveyPlan(canonical.surveyIntent, testCase.questionCount);
  const route = resolveSurveyGenerationModel(testCase.surveyMode);
  const request = buildSurveyAiRequest(testCase.input, null, route.model, {
    surveyMode: testCase.surveyMode,
    targetGrade: "전학년",
    questionCount: testCase.questionCount,
    canonicalIntent: canonical,
    surveyPlan: plan,
    reasoningEffort: route.reasoningEffort,
    serviceTier: route.requestedServiceTier,
    references: { images: [], files: [], links: [] },
  });
  const actualUserTexts = userTexts(request);
  const nonUser = JSON.stringify({
    instructions: request.instructions,
    developer: request.input.filter((item) => item.role !== "user"),
  });
  const target = canonical.surveyIntent.targetPopulation ?? "";
  const object = canonical.surveyIntent.evaluationTargets.join(" ") ||
    canonical.surveyIntent.surveyObject || canonical.generationContext.primaryEntity;
  const planText = JSON.stringify(plan);
  const issues: StaticIssue[] = [];

  if (actualUserTexts.length !== 1 || actualUserTexts[0] !== testCase.input) {
    issues.push({ code: "USER_INPUT_NOT_EXACTLY_ONCE", message: JSON.stringify(actualUserTexts), fatal: true });
  }
  if (occurrences(nonUser, testCase.input) !== 0) {
    issues.push({ code: "USER_INPUT_DUPLICATED_OUTSIDE_USER_ROLE", message: "원문이 developer 또는 instructions에 중복됨", fatal: true });
  }
  if (testCase.expectedOutcome === "survey" && !semanticTextMatch(target, testCase.expectedTargetPopulation)) {
    issues.push({ code: "STATIC_TARGET_POPULATION_MISMATCH", message: target, fatal: true });
  }
  if (testCase.expectedOutcome === "survey" && !semanticTextMatch(object ?? "", testCase.expectedSurveyObject)) {
    issues.push({ code: "STATIC_SURVEY_OBJECT_MISMATCH", message: object ?? "", fatal: true });
  }
  if (!testCase.expectedIntentModes.includes(canonical.surveyIntent.intentMode)) {
    issues.push({ code: "STATIC_INTENT_MODE_MISMATCH", message: canonical.surveyIntent.intentMode, fatal: true });
  }
  if (canonical.surveyIntent.targetCardinality !== testCase.expectedTargetCardinality) {
    issues.push({ code: "STATIC_TARGET_CARDINALITY_MISMATCH", message: canonical.surveyIntent.targetCardinality, fatal: true });
  }
  if (
    testCase.expectedOutcome === "clarification" &&
    !canonical.ambiguity.requiresClarification &&
    !canonical.surveyIntent.requiresCreatorClarification
  ) {
    issues.push({ code: "STATIC_CLARIFICATION_NOT_DETECTED", message: "모호성이 clarification으로 표시되지 않음", fatal: true });
  }
  if (
    testCase.expectedOutcome === "survey" &&
    (canonical.ambiguity.requiresClarification || canonical.surveyIntent.requiresCreatorClarification)
  ) {
    issues.push({ code: "STATIC_UNEXPECTED_CLARIFICATION", message: canonical.ambiguity.code ?? "creator-clarification", fatal: true });
  }
  if (
    testCase.mustPreserveNegation &&
    !canonical.surveyIntent.includesNonUsers &&
    !/(?:않|없|비이용|미구매|불참|미가입)/.test(target)
  ) {
    issues.push({ code: "STATIC_NEGATION_LOST", message: target, fatal: true });
  }
  for (const concept of testCase.requiredQuestionConcepts) {
    if (!conceptPresent(concept, planText) && !conceptPresent(concept, JSON.stringify(canonical))) {
      issues.push({ code: "STATIC_PLAN_CONCEPT_MISSING", message: concept, fatal: false });
    }
  }

  return {
    caseId: testCase.id,
    split: testCase.split,
    input: testCase.input,
    surveyMode: testCase.surveyMode,
    expectedOutcome: testCase.expectedOutcome,
    canonical: {
      normalizedInput: canonical.normalizedInput,
      targetPopulation: canonical.surveyIntent.targetPopulation,
      surveyObject: canonical.surveyIntent.surveyObject,
      evaluationTargets: canonical.surveyIntent.evaluationTargets,
      purposeBlocks: canonical.surveyIntent.purposeBlocks,
      includesNonUsers: canonical.surveyIntent.includesNonUsers,
      explicitTimeframe: canonical.surveyIntent.explicitTimeframe,
      targetCardinality: canonical.surveyIntent.targetCardinality,
      intentMode: canonical.surveyIntent.intentMode,
      surveyArchetype: canonical.surveyArchetype,
      ambiguity: canonical.ambiguity,
    },
    plan: {
      intentMode: plan.intentMode,
      targetPopulation: plan.targetPopulation,
      evaluationTargets: plan.evaluationTargets,
      targetCardinality: plan.targetCardinality,
      requestedQuestionCount: plan.requestedQuestionCount,
      blocks: plan.blocks,
    },
    request: {
      model: request.model,
      reasoning: request.reasoning,
      webSearchRequested: "tools" in request,
      userRoleInputCount: actualUserTexts.length,
      rawInputOccurrencesInUserRole: actualUserTexts.reduce(
        (total, text) => total + occurrences(text, testCase.input),
        0,
      ),
      rawInputOccurrencesOutsideUserRole: occurrences(nonUser, testCase.input),
      modelCallCount: 0,
    },
    issues,
    passed: issues.every((item) => !item.fatal),
  };
}

const root = process.cwd();
const dev = await readRegressionDataset(resolve(root, "evals/survey-regression/v1/dev.json"));
const holdout = await readRegressionDataset(resolve(root, "evals/survey-regression/v1/holdout.json"));
const cases = mergeDatasets(dev, holdout);
const quality = validateDatasetQuality(cases);
if (quality.errors.length > 0) throw new Error(quality.errors.join("\n"));

const results = cases.map(evaluateCase);
const outputDirectory = resolve(
  root,
  process.env.SURVEY_REGRESSION_ARTIFACT_DIR ?? ".artifacts/survey-regression/v1/static-v1",
);
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, "dataset-quality.json"), `${JSON.stringify(quality, null, 2)}\n`),
  writeFile(resolve(outputDirectory, "static-results.json"), `${JSON.stringify(results, null, 2)}\n`),
]);

const fatal = results.flatMap((item) => item.issues.filter((issue) => issue.fatal));
const invariants = results.flatMap((item) =>
  item.issues.filter((issue) =>
    issue.code === "USER_INPUT_NOT_EXACTLY_ONCE" ||
    issue.code === "USER_INPUT_DUPLICATED_OUTSIDE_USER_ROLE",
  ),
);
const summary = {
  cases: results.length,
  modelCalls: 0,
  passed: results.filter((item) => item.passed).length,
  failed: results.filter((item) => !item.passed).length,
  fatalIssueCount: fatal.length,
  promptInvariantIssueCount: invariants.length,
  bySplit: {
    dev: results.filter((item) => item.split === "dev" && item.passed).length,
    holdout: results.filter((item) => item.split === "holdout" && item.passed).length,
  },
  outputDirectory,
};
await writeFile(resolve(outputDirectory, "static-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (invariants.length > 0) process.exitCode = 1;
