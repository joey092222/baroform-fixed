import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluateSemanticResult } from "../evals/survey-regression/v1/evaluation.ts";
import { frontedPurposeSmokeCases } from "../evals/survey-regression/v1.1/fronted-purpose-smoke.ts";
import { parseCanonicalSurveyIntent } from "../app/survey-canonical-intent.ts";
import {
  analyzeSurveyPrompt,
  resizeSurveyQuestions,
} from "../app/survey-intent.ts";

type BaselineCase = {
  caseId: string;
  input: string;
  expectedOutcome: "survey" | "clarification";
  actual: {
    questions: Array<{ title: string }>;
  };
  generation: {
    classification: string;
    responseType: string | null;
  };
  evaluation: {
    automatic: {
      passed: boolean;
      fatalFailures: Array<{ code: string }>;
    };
  };
};

const baselinePath = path.join(
  process.cwd(),
  "reports",
  "fronted-purpose-smoke-v1-baseline.json",
);
const evaluatorReplayPath = path.join(
  process.cwd(),
  "reports",
  "fronted-purpose-smoke-v1-evaluator-replay.json",
);
const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as {
  cases: BaselineCase[];
};
const evaluatorReplay = JSON.parse(
  await readFile(evaluatorReplayPath, "utf8"),
) as {
  before: Record<string, number>;
  after: Record<string, number>;
};

const cases = baseline.cases.map((stored) => {
  const fixture = frontedPurposeSmokeCases.find(
    (candidate) => candidate.id === stored.caseId,
  );
  if (!fixture) throw new Error(`FRONTED_FIXTURE_MISSING:${stored.caseId}`);

  const canonical = parseCanonicalSurveyIntent(stored.input);
  const clarification = canonical.ambiguity.requiresClarification;
  const blueprint = analyzeSurveyPrompt(stored.input, canonical);
  const questions = clarification
    ? []
    : resizeSurveyQuestions(blueprint.aiQuestions, fixture.questionCount);
  const responseType = clarification ? "clarification" : "survey";
  const evaluated = evaluateSemanticResult(fixture, {
    classification: clarification
      ? "clarification"
      : "deterministic_metadata_normalization",
    httpStatus: 200,
    responseType,
    canonicalTargetPopulation: canonical.surveyIntent.targetPopulation,
    finalRespondentGroup:
      blueprint.respondentGroup ?? canonical.surveyIntent.targetPopulation,
    canonicalSurveyObject: canonical.surveyIntent.surveyObject,
    finalEvaluationTarget:
      blueprint.evaluationTarget ?? canonical.surveyIntent.surveyObject,
    title: blueprint.title,
    description: blueprint.description,
    questions: questions.map((question) => ({
      title: question.title,
      type: question.type,
      options: question.options ?? [],
      reason: question.reason,
    })),
    schemaIssues: [],
    semanticIssues: [],
    qualityIssues: [],
  });
  const storedTitles = stored.actual.questions.map((question) => question.title);
  const localTitles = questions.map((question) => question.title);

  return {
    caseId: stored.caseId,
    expectedOutcome: stored.expectedOutcome,
    stored: {
      classification: stored.generation.classification,
      responseType: stored.generation.responseType,
      fatalCodes: stored.evaluation.automatic.fatalFailures.map(
        (issue) => issue.code,
      ),
      questionCount: storedTitles.length,
    },
    local: {
      responseType,
      targetPopulation: canonical.surveyIntent.targetPopulation,
      surveyObject: canonical.surveyIntent.surveyObject,
      contextEntity: canonical.generationContext.contextEntity,
      eligibilityActivity: canonical.generationContext.eligibilityActivity,
      eligibilityTimeframe: canonical.generationContext.eligibilityTimeframe,
      screeningRequired: canonical.surveyIntent.screeningRequired,
      negation: canonical.surveyIntent.negation,
      selectedTemplateKey: blueprint.selectedTemplateKey ?? null,
      fatalCodes: evaluated.fatalFailures.map((issue) => issue.code),
      warningCodes: evaluated.warnings.map((issue) => issue.code),
      questionCount: localTitles.length,
      questions: localTitles,
    },
    localBlueprintDiffersFromStoredFinal:
      JSON.stringify(localTitles) !== JSON.stringify(storedTitles),
  };
});

const summary = {
  total: cases.length,
  localPass: cases.filter((item) => item.local.fatalCodes.length === 0).length,
  localFail: cases.filter((item) => item.local.fatalCodes.length > 0).length,
  clarificationPass: cases.filter(
    (item) =>
      item.expectedOutcome === "clarification" &&
      item.local.responseType === "clarification" &&
      item.local.fatalCodes.length === 0,
  ).length,
  surveyPass: cases.filter(
    (item) =>
      item.expectedOutcome === "survey" && item.local.fatalCodes.length === 0,
  ).length,
  storedFinalSurveyQuestionSets: cases.filter(
    (item) => item.stored.questionCount > 0,
  ).length,
  localBlueprintDiffCount: cases.filter(
    (item) => item.localBlueprintDiffersFromStoredFinal,
  ).length,
};

const output = {
  sourceBaseline: "fronted-purpose-smoke-v1",
  replayType:
    "stored-final-evaluator-plus-current-canonical-deterministic-blueprint",
  openAiCalls: 0,
  sourceAvailability: {
    storedFinalSurveyQuestionSets: summary.storedFinalSurveyQuestionSets,
    storedClarifications: cases.filter(
      (item) => item.stored.responseType === "clarification",
    ).length,
    storedStructuredModelOutputs: 0,
    storedQuestionsBeforePostprocess: 0,
  },
  limitations: [
    "불변 baseline에는 원본 또는 sanitized structured model output이 저장되어 있지 않습니다.",
    "questionsBeforePostprocess도 저장되어 있지 않아 과거 모델 출력의 structured parse, repair, fallback selection을 그대로 재생할 수 없습니다.",
    "따라서 저장된 최종 설문은 evaluator 재채점에만 사용하고, 현재 parser와 deterministic blueprint는 동일 입력으로 별도 검증합니다.",
    "localBlueprintDiffersFromStoredFinal은 두 경로의 문항 차이이며 과거 모델 문항을 수정했다는 뜻이 아닙니다.",
  ],
  evaluatorReplay: {
    before: evaluatorReplay.before,
    after: evaluatorReplay.after,
  },
  summary,
  cases,
};

const jsonPath = path.join(
  process.cwd(),
  "reports",
  "fronted-purpose-smoke-v1-local-replay.json",
);
const markdownPath = path.join(
  process.cwd(),
  "reports",
  "fronted-purpose-smoke-v1-local-replay.md",
);
await writeFile(jsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

const markdown = `# Fronted-purpose smoke v1 local replay\n\n` +
  `- 실제 OpenAI 호출: 0\n` +
  `- 저장 최종 설문 문항 세트: ${summary.storedFinalSurveyQuestionSets}/20\n` +
  `- 저장 clarification: ${output.sourceAvailability.storedClarifications}/20\n` +
  `- 저장 structured model output: 0/20\n` +
  `- 저장 questionsBeforePostprocess: 0/20\n` +
  `- 현재 canonical + deterministic blueprint 의미 통과: ${summary.localPass}/${summary.total}\n` +
  `- survey 통과: ${summary.surveyPass}/17\n` +
  `- clarification 통과: ${summary.clarificationPass}/3\n` +
  `- evaluator 수정 전: TP ${evaluatorReplay.before.truePositive}, FP ${evaluatorReplay.before.falsePositive}, TN ${evaluatorReplay.before.trueNegative}, FN ${evaluatorReplay.before.falseNegative}\n` +
  `- evaluator 수정 후: TP ${evaluatorReplay.after.truePositive}, FP ${evaluatorReplay.after.falsePositive}, TN ${evaluatorReplay.after.trueNegative}, FN ${evaluatorReplay.after.falseNegative}\n\n` +
  `## Replay 제한\n\n` +
  output.limitations.map((item) => `- ${item}`).join("\n") +
  `\n\n| caseId | 기대 | 기존 경로 | 로컬 응답 | 로컬 문항 | 로컬 fatal |\n` +
  `| --- | --- | --- | --- | ---: | --- |\n` +
  cases
    .map(
      (item) =>
        `| ${item.caseId} | ${item.expectedOutcome} | ${item.stored.classification} | ${item.local.responseType} | ${item.local.questionCount} | ${item.local.fatalCodes.join(", ") || "-"} |`,
    )
    .join("\n") +
  `\n`;
await writeFile(markdownPath, markdown, "utf8");
