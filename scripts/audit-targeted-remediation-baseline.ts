import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { evaluateSemanticResult } from "../evals/survey-regression/v1/evaluation";
import type { SurveyRegressionResult } from "../evals/survey-regression/v1/schema";
import {
  getTargetedRemediationAuditDecision,
  targetedRemediationAuditCaseIds,
  type TargetedRemediationAuditJudgment,
} from "../evals/survey-regression/v1.1/targeted-remediation-audit-v1";

const root = process.cwd();
const runId = "targeted-c235c03-c3-final2-20260820";
const applicationCommit = "c235c03b4abdab4b2c1a6eb0a1903abc07af926d";
const resultsPath = resolve(
  root,
  `.artifacts/survey-regression/v1.1-targeted-remediation/${runId}/results.json`,
);
const results = JSON.parse(
  await readFile(resultsPath, "utf8"),
) as SurveyRegressionResult[];

if (results.length !== 18 || targetedRemediationAuditCaseIds.length !== 18) {
  throw new Error(
    `TARGETED_AUDIT_CASE_COUNT:results=${results.length}:manual=${targetedRemediationAuditCaseIds.length}`,
  );
}
if (new Set(targetedRemediationAuditCaseIds).size !== 18) {
  throw new Error("TARGETED_AUDIT_DUPLICATE_CASE_ID");
}
for (const result of results) getTargetedRemediationAuditDecision(result.caseId);

const actualFailure = (judgment: TargetedRemediationAuditJudgment) =>
  judgment === "true_product_failure" || judgment === "evaluator_false_negative";
const autoFailure = (fatalFailures: SurveyRegressionResult["fatalFailures"]) =>
  fatalFailures.length > 0;
const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : numerator / denominator;
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

const audited = results
  .map((result) => {
    const manual = getTargetedRemediationAuditDecision(result.caseId);
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
      manualRepairJudgment: manual.repairJudgment,
      manualRepairRationale: manual.repairRationale,
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
    `| ${result.caseId} | ${result.automaticJudgment} | ${result.regradedAutomaticJudgment} | ${result.manualJudgment} | ${result.manualRepairJudgment} | ${escapeCell(result.manualRationale)} |`,
).join("\n");

const report = `# Targeted 18 v1 Blocked Baseline and Manual Audit

## Frozen baseline

- Run ID: \`${runId}\`
- Application commit: \`${applicationCommit}\`
- Cases reviewed: ${audited.length}/18
- OpenAI calls during audit: 0
- Original artifacts modified: no
- Gate state: \`TARGETED_REGRESSION_BLOCKED\`

## Manual judgment distribution

\`\`\`json
${JSON.stringify(countBy(audited, (result) => result.manualJudgment), null, 2)}
\`\`\`

## Partial repair audit

\`\`\`json
${JSON.stringify(countBy(audited, (result) => result.manualRepairJudgment), null, 2)}
\`\`\`

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

| Case | Original automatic | Regraded automatic | Manual | Repair audit | Rationale |
| --- | --- | --- | --- | --- | --- |
${rows}
`;

const caseAudit = audited.map((result) => ({
  caseId: result.caseId,
  input: result.input,
  expected: result.expected,
  requestId: result.requestId,
  generationSource: result.generationSource,
  classification: result.classification,
  modelCallCount: result.modelCallCount,
  repairCount: result.repairCount,
  fallbackCount: result.fallbackCount,
  changedQuestionIds: result.changedQuestionIds,
  changedFieldsByQuestion: result.changedFieldsByQuestion,
  fallbackReason: result.fallbackReason,
  finalRespondentGroup: result.finalRespondentGroup,
  finalEvaluationTarget: result.finalEvaluationTarget,
  title: result.title,
  description: result.description,
  questions: result.questions,
  questionsBeforePostprocess: result.questionsBeforePostprocess,
  fatalFailures: result.fatalFailures,
  warnings: result.warnings,
  automaticJudgment: result.automaticJudgment,
  regradedFatalFailures: result.regradedFatalFailures,
  regradedAutomaticJudgment: result.regradedAutomaticJudgment,
  manualJudgment: result.manualJudgment,
  manualRationale: result.manualRationale,
  manualRepairJudgment: result.manualRepairJudgment,
  manualRepairRationale: result.manualRepairRationale,
}));

await Promise.all([
  writeFile(
    resolve(root, "reports/targeted18-v1-blocked-baseline.json"),
    `${JSON.stringify(audited, null, 2)}\n`,
    "utf8",
  ),
  writeFile(
    resolve(root, "reports/targeted18-v1-blocked-baseline.md"),
    report,
    "utf8",
  ),
  writeFile(
    resolve(root, "reports/targeted18-v1-case-audit.json"),
    `${JSON.stringify(caseAudit, null, 2)}\n`,
    "utf8",
  ),
]);

console.log(JSON.stringify({
  total: audited.length,
  judgments: countBy(audited, (result) => result.manualJudgment),
  repairJudgments: countBy(audited, (result) => result.manualRepairJudgment),
  originalMetrics,
  regradedMetrics,
}, null, 2));
