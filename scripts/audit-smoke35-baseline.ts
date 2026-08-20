import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { evaluateSemanticResult } from "../evals/survey-regression/v1/evaluation";
import {
  getSmoke35AuditDecision,
  smoke35AuditCaseIds,
  type Smoke35AuditJudgment,
} from "../evals/survey-regression/v1/smoke35-audit-v1";
import type { SurveyRegressionResult } from "../evals/survey-regression/v1/schema";

const root = process.cwd();
const runId = "smoke35-v1-cfc2162-20260820";
const resultsPath = resolve(
  root,
  `.artifacts/survey-regression/v1/${runId}/results.json`,
);
const results = JSON.parse(await readFile(resultsPath, "utf8")) as SurveyRegressionResult[];

if (results.length !== 35 || smoke35AuditCaseIds.length !== 35) {
  throw new Error(
    `SMOKE35_AUDIT_CASE_COUNT:results=${results.length}:manual=${smoke35AuditCaseIds.length}`,
  );
}
if (new Set(smoke35AuditCaseIds).size !== 35) {
  throw new Error("SMOKE35_AUDIT_DUPLICATE_CASE_ID");
}
for (const result of results) getSmoke35AuditDecision(result.caseId);

const actualFailure = (judgment: Smoke35AuditJudgment) =>
  judgment === "true_product_failure" ||
  judgment === "evaluator_false_negative";
const autoFailure = (fatalFailures: SurveyRegressionResult["fatalFailures"]) =>
  fatalFailures.length > 0;
const countBy = <T>(values: T[], key: (value: T) => string) =>
  Object.fromEntries(
    [...values.reduce((counts, value) => {
      const name = key(value);
      counts.set(name, (counts.get(name) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : numerator / denominator;

const audited = results
  .map((result) => {
    const manual = getSmoke35AuditDecision(result.caseId);
    const regraded = evaluateSemanticResult(result.expected, result);
    return {
      ...result,
      automaticJudgment: autoFailure(result.fatalFailures)
        ? "auto_failure" as const
        : "auto_pass" as const,
      regradedFatalFailures: regraded.fatalFailures,
      regradedWarnings: regraded.warnings,
      regradedAutomaticJudgment: autoFailure(regraded.fatalFailures)
        ? "auto_failure" as const
        : "auto_pass" as const,
      manualJudgment: manual.judgment,
      manualRationale: manual.rationale,
    };
  })
  .sort((left, right) => left.caseId.localeCompare(right.caseId));

const scored = audited.filter(
  (result) =>
    result.manualJudgment !== "dataset_specification_error" &&
    result.manualJudgment !== "ambiguous_specification",
);
const calculateMetrics = (
  judgment: (result: (typeof scored)[number]) => "auto_failure" | "auto_pass",
) => {
  const truePositive = scored.filter(
    (result) => judgment(result) === "auto_failure" && actualFailure(result.manualJudgment),
  ).length;
  const falsePositive = scored.filter(
    (result) => judgment(result) === "auto_failure" && !actualFailure(result.manualJudgment),
  ).length;
  const trueNegative = scored.filter(
    (result) => judgment(result) === "auto_pass" && !actualFailure(result.manualJudgment),
  ).length;
  const falseNegative = scored.filter(
    (result) => judgment(result) === "auto_pass" && actualFailure(result.manualJudgment),
  ).length;
  return {
    truePositive,
    falsePositive,
    trueNegative,
    falseNegative,
    precision: ratio(truePositive, truePositive + falsePositive),
    recall: ratio(truePositive, truePositive + falseNegative),
    falsePositiveRate: ratio(falsePositive, falsePositive + trueNegative),
    falseNegativeRate: ratio(falseNegative, falseNegative + truePositive),
  };
};
const originalMetrics = calculateMetrics((result) => result.automaticJudgment);
const regradedMetrics = calculateMetrics((result) => result.regradedAutomaticJudgment);
const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
const escapeCell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
const rows = audited.map(
  (result) =>
    `| ${result.caseId} | ${result.automaticJudgment} | ${result.regradedAutomaticJudgment} | ${result.manualJudgment} | ${escapeCell(result.manualRationale)} |`,
).join("\n");
const report = `# Smoke 35 v1 Manual Semantic Audit

## Frozen baseline

- Run ID: \`${runId}\`
- Application commit: \`cfc21622d93459357dd3c8f98bda7d0a0bdb9bf0\`
- Cases reviewed: ${audited.length}/35
- OpenAI calls during audit: 0
- Original artifacts modified: no

## Manual judgment distribution

\`\`\`json
${JSON.stringify(countBy(audited, (result) => result.manualJudgment), null, 2)}
\`\`\`

Dataset specification errors are excluded from the confusion matrix.

## Original evaluator confusion matrix

| | Actual product failure | Actual pass |
| --- | ---: | ---: |
| Automatic failure | ${originalMetrics.truePositive} | ${originalMetrics.falsePositive} |
| Automatic pass | ${originalMetrics.falseNegative} | ${originalMetrics.trueNegative} |

- Precision: ${percent(originalMetrics.precision)}
- Recall: ${percent(originalMetrics.recall)}
- False-positive rate: ${percent(originalMetrics.falsePositiveRate)}
- False-negative rate: ${percent(originalMetrics.falseNegativeRate)}

## Stored-output regrade

| | Actual product failure | Actual pass |
| --- | ---: | ---: |
| Regraded failure | ${regradedMetrics.truePositive} | ${regradedMetrics.falsePositive} |
| Regraded pass | ${regradedMetrics.falseNegative} | ${regradedMetrics.trueNegative} |

- Precision: ${percent(regradedMetrics.precision)}
- Recall: ${percent(regradedMetrics.recall)}
- False-positive rate: ${percent(regradedMetrics.falsePositiveRate)}
- False-negative rate: ${percent(regradedMetrics.falseNegativeRate)}
- OpenAI calls used for regrade: 0

## Case audit

| Case | Original automatic | Regraded automatic | Manual | Rationale |
| --- | --- | --- | --- | --- |
${rows}
`;

const caseAudit = audited.map((result) => ({
  caseId: result.caseId,
  input: result.input,
  inputQuality: result.expected.inputQuality ?? null,
  expectedOutcome: result.expected.expectedOutcome,
  expectedTargetPopulation: result.expected.expectedTargetPopulation,
  expectedEligibilityConditions: result.expected.expectedEligibilityConditions ?? [],
  contextEntities: result.expected.contextEntities ?? [],
  expectedSurveyObject: result.expected.expectedSurveyObject,
  expectedPurposeConcepts: result.expected.expectedPurposeConcepts,
  requiredQuestionConcepts: result.expected.requiredQuestionConcepts,
  clarificationExpected: result.expected.clarificationExpected,
  actualRespondentGroup: result.finalRespondentGroup,
  actualEvaluationTarget: result.finalEvaluationTarget,
  title: result.title,
  description: result.description,
  questions: result.questions,
  generationSource: result.generationSource,
  classification: result.classification,
  modelCallCount: result.modelCallCount,
  repairCount: result.repairCount,
  fallbackCount: result.fallbackCount,
  changedQuestionIds: result.changedQuestionIds,
  changedFieldsByQuestion: result.changedFieldsByQuestion,
  errorCode: result.responseCode ?? null,
  errorStage: result.responseStage ?? null,
  fatalFailures: result.fatalFailures,
  warnings: result.warnings,
  automaticJudgment: result.automaticJudgment,
  regradedFatalFailures: result.regradedFatalFailures,
  regradedAutomaticJudgment: result.regradedAutomaticJudgment,
  manualJudgment: result.manualJudgment,
  manualRationale: result.manualRationale,
  requestId: result.requestId,
  inputTokens: result.inputTokens,
  outputTokens: result.outputTokens,
  totalTokens: result.totalTokens,
  latencyMs: result.latencyMs,
}));

await Promise.all([
  writeFile(
    resolve(root, "reports/smoke35-v1-baseline.json"),
    `${JSON.stringify(audited, null, 2)}\n`,
    "utf8",
  ),
  writeFile(resolve(root, "reports/smoke35-v1-baseline.md"), report, "utf8"),
  writeFile(
    resolve(root, "reports/smoke35-v1-case-audit.json"),
    `${JSON.stringify(caseAudit, null, 2)}\n`,
    "utf8",
  ),
]);

console.log(JSON.stringify({
  total: audited.length,
  judgments: countBy(audited, (result) => result.manualJudgment),
  originalMetrics,
  regradedMetrics,
}, null, 2));
