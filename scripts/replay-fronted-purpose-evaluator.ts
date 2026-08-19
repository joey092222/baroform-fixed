import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluateSemanticResult } from "../evals/survey-regression/v1/evaluation.ts";
import { generationPathSchema } from "../evals/survey-regression/v1/schema.ts";
import { frontedPurposeSmokeCases } from "../evals/survey-regression/v1.1/fronted-purpose-smoke.ts";

type BaselineCase = {
  caseId: string;
  actual: {
    respondentGroup: string | null;
    canonicalTargetPopulation: string | null;
    evaluationTarget: string | null;
    canonicalSurveyObject: string | null;
    title: string | null;
    description: string | null;
    questions: Array<{
      title: string;
      type: string | null;
      options: string[];
      reason?: string | null;
    }>;
  };
  generation: {
    httpStatus: number;
    responseType: string | null;
    classification: string;
  };
  evaluation: {
    automatic: {
      passed: boolean;
      fatalFailures: Array<{ code: string }>;
    };
    manual: {
      verdict: "true_product_failure" | "evaluator_false_positive" | "accepted";
    };
  };
};

type ConfusionMatrix = {
  truePositive: number;
  falsePositive: number;
  trueNegative: number;
  falseNegative: number;
};

function confusion(
  entries: Array<{ truthFailure: boolean; predictedFailure: boolean }>,
): ConfusionMatrix {
  return entries.reduce<ConfusionMatrix>(
    (matrix, entry) => {
      if (entry.truthFailure && entry.predictedFailure) matrix.truePositive += 1;
      if (!entry.truthFailure && entry.predictedFailure) matrix.falsePositive += 1;
      if (!entry.truthFailure && !entry.predictedFailure) matrix.trueNegative += 1;
      if (entry.truthFailure && !entry.predictedFailure) matrix.falseNegative += 1;
      return matrix;
    },
    { truePositive: 0, falsePositive: 0, trueNegative: 0, falseNegative: 0 },
  );
}

const reportPath = path.join(
  process.cwd(),
  "reports",
  "fronted-purpose-smoke-v1-baseline.json",
);
const baseline = JSON.parse(await readFile(reportPath, "utf8")) as {
  cases: BaselineCase[];
};

const replay = baseline.cases.map((item) => {
  const fixture = frontedPurposeSmokeCases.find(
    (candidate) => candidate.id === item.caseId,
  );
  if (!fixture) throw new Error(`FRONTED_FIXTURE_MISSING:${item.caseId}`);
  const classification = generationPathSchema.parse(
    item.generation.classification,
  );
  const evaluated = evaluateSemanticResult(fixture, {
    classification,
    httpStatus: item.generation.httpStatus,
    responseType: item.generation.responseType,
    canonicalTargetPopulation: item.actual.canonicalTargetPopulation,
    finalRespondentGroup: item.actual.respondentGroup,
    canonicalSurveyObject: item.actual.canonicalSurveyObject,
    finalEvaluationTarget: item.actual.evaluationTarget,
    title: item.actual.title,
    description: item.actual.description,
    questions: item.actual.questions,
    schemaIssues: [],
    semanticIssues: [],
    qualityIssues: [],
  });
  const truthFailure =
    item.evaluation.manual.verdict === "true_product_failure";
  return {
    caseId: item.caseId,
    manualVerdict: item.evaluation.manual.verdict,
    truthFailure,
    before: {
      predictedFailure: !item.evaluation.automatic.passed,
      fatalCodes: item.evaluation.automatic.fatalFailures.map(
        (issue) => issue.code,
      ),
    },
    after: {
      predictedFailure: evaluated.fatalFailures.length > 0,
      fatalCodes: evaluated.fatalFailures.map((issue) => issue.code),
      warnings: evaluated.warnings.map((issue) => issue.code),
    },
    actualQuestionsChanged: false,
  };
});

const output = {
  sourceBaseline: "fronted-purpose-smoke-v1",
  replayType: "stored-results-evaluator-only",
  openAiCalls: 0,
  before: confusion(
    replay.map((item) => ({
      truthFailure: item.truthFailure,
      predictedFailure: item.before.predictedFailure,
    })),
  ),
  after: confusion(
    replay.map((item) => ({
      truthFailure: item.truthFailure,
      predictedFailure: item.after.predictedFailure,
    })),
  ),
  cases: replay,
};

const outputJsonPath = path.join(
  process.cwd(),
  "reports",
  "fronted-purpose-smoke-v1-evaluator-replay.json",
);
const outputMarkdownPath = path.join(
  process.cwd(),
  "reports",
  "fronted-purpose-smoke-v1-evaluator-replay.md",
);
await writeFile(outputJsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

const markdown = `# Fronted-purpose smoke v1 evaluator replay\n\n` +
  `- 실제 OpenAI 호출: 0\n` +
  `- replay 범위: 저장된 최종 설문에 대한 evaluator 재채점만 수행\n` +
  `- 수정 전 confusion matrix: TP ${output.before.truePositive}, FP ${output.before.falsePositive}, TN ${output.before.trueNegative}, FN ${output.before.falseNegative}\n` +
  `- 수정 후 confusion matrix: TP ${output.after.truePositive}, FP ${output.after.falsePositive}, TN ${output.after.trueNegative}, FN ${output.after.falseNegative}\n\n` +
  `| caseId | 수동 판정 | 수정 전 | 수정 후 | 수정 전 fatal | 수정 후 fatal |\n` +
  `| --- | --- | --- | --- | --- | --- |\n` +
  replay
    .map(
      (item) =>
        `| ${item.caseId} | ${item.manualVerdict} | ${item.before.predictedFailure ? "fail" : "pass"} | ${item.after.predictedFailure ? "fail" : "pass"} | ${item.before.fatalCodes.join(", ") || "-"} | ${item.after.fatalCodes.join(", ") || "-"} |`,
    )
    .join("\n") +
  `\n`;
await writeFile(outputMarkdownPath, markdown, "utf8");
