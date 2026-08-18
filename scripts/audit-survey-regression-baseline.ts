import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createManualAuditDecision,
  manualAuditCaseIds,
  type ManualAuditJudgment,
} from "../evals/survey-regression/v1/manual-audit-v1";
import { evaluateSemanticResult } from "../evals/survey-regression/v1/evaluation";
import type { SurveyRegressionResult } from "../evals/survey-regression/v1/schema";

type BaselineCaseSummary = {
  caseId: string;
  split: string;
  input: string;
  expectedOutcome: string;
  expectedTargetPopulation: string[];
  expectedSurveyObject: string[];
  expectedPurposeConcepts: string[];
  actualRespondentGroup: string | null;
  actualEvaluationTarget: string | null;
  actualPurposeOrGoal: string | null;
  generationSource: string;
  classification: string;
  automaticJudgment: "auto_pass" | "auto_failure";
  requestId: string;
};

const root = process.cwd();
const baselinePath = resolve(root, "reports/survey-regression-v1-case-summary.json");
const resultsPath = resolve(
  root,
  ".artifacts/survey-regression/v1/preview-100-v1/results.json",
);
const [baselineRaw, resultsRaw] = await Promise.all([
  readFile(baselinePath, "utf8"),
  readFile(resultsPath, "utf8"),
]);
const baseline = JSON.parse(baselineRaw) as BaselineCaseSummary[];
const results = JSON.parse(resultsRaw) as SurveyRegressionResult[];
const resultById = new Map(results.map((item) => [item.caseId, item]));
if (baseline.length !== 100 || manualAuditCaseIds.length !== 100) {
  throw new Error(
    `MANUAL_AUDIT_CASE_COUNT:baseline=${baseline.length}:manual=${manualAuditCaseIds.length}`,
  );
}
if (new Set(manualAuditCaseIds).size !== 100) {
  throw new Error("MANUAL_AUDIT_DUPLICATE_CASE_ID");
}

const audited = baseline
  .map((item) => {
    const result = resultById.get(item.caseId);
    if (!result) throw new Error(`MANUAL_AUDIT_RESULT_MISSING:${item.caseId}`);
    const decision = createManualAuditDecision({
      caseId: item.caseId,
      expectedOutcome: item.expectedOutcome,
      expectedTargetPopulation: item.expectedTargetPopulation,
      actualRespondentGroup: item.actualRespondentGroup,
      actualEvaluationTarget: item.actualEvaluationTarget,
      classification: item.classification,
      httpStatus: result.httpStatus,
      firstFatalCode: result.fatalFailures[0]?.code ?? null,
    });
    const regraded = evaluateSemanticResult(result.expected, result);
    return {
      ...item,
      questionTitles: result.questions.map((question) => question.title),
      questionTypes: result.questions.map((question) => question.type),
      optionCounts: result.questions.map((question) => question.options.length),
      originalFatalCodes: result.fatalFailures.map((issue) => issue.code),
      regradedFatalCodes: regraded.fatalFailures.map((issue) => issue.code),
      regradedAutomaticJudgment:
        regraded.fatalFailures.length === 0
          ? "auto_pass" as const
          : "auto_failure" as const,
      manualJudgment: decision.judgment,
      manualRationale: decision.rationale,
    };
  })
  .sort((left, right) => left.caseId.localeCompare(right.caseId));

const countBy = <T>(values: T[], key: (value: T) => string) =>
  Object.fromEntries(
    [...values.reduce((map, value) => {
      const name = key(value);
      map.set(name, (map.get(name) ?? 0) + 1);
      return map;
    }, new Map<string, number>())].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
const actualFailure = (judgment: ManualAuditJudgment) =>
  judgment === "true_failure" || judgment === "evaluator_false_negative";
const autoFailure = (judgment: string) => judgment === "auto_failure";
const scored = audited.filter(
  (item) => item.manualJudgment !== "ambiguous_specification",
);
const ratio = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : numerator / denominator;
const calculateMetrics = (
  automatic: (item: (typeof scored)[number]) => string,
) => {
  const truePositive = scored.filter(
    (item) => autoFailure(automatic(item)) && actualFailure(item.manualJudgment),
  ).length;
  const falsePositive = scored.filter(
    (item) => autoFailure(automatic(item)) && !actualFailure(item.manualJudgment),
  ).length;
  const trueNegative = scored.filter(
    (item) => !autoFailure(automatic(item)) && !actualFailure(item.manualJudgment),
  ).length;
  const falseNegative = scored.filter(
    (item) => !autoFailure(automatic(item)) && actualFailure(item.manualJudgment),
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
    falseAlarmShareAmongAutomaticFailures: ratio(
      falsePositive,
      truePositive + falsePositive,
    ),
  };
};
const metrics = calculateMetrics((item) => item.automaticJudgment);
const regradedMetrics = calculateMetrics((item) => item.regradedAutomaticJudgment);
const percent = (value: number) => `${(value * 100).toFixed(2)}%`;
const escapeCell = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
const rows = audited
  .map(
    (item) =>
      `| ${item.caseId} | ${item.automaticJudgment} | ${item.regradedAutomaticJudgment} | ${item.manualJudgment} | ${escapeCell(item.manualRationale)} |`,
  )
  .join("\n");
const report = `# Survey Regression v1 Evaluator Audit

## Scope

- Frozen run: \`preview-100-v1\`
- Application baseline: \`b2c52ca82af1c5c16fae3fb72af20bf34436f8c7\`
- Cases manually reviewed: ${audited.length}/100
- OpenAI calls during this audit: 0 (stored results only)
- Ambiguous specifications excluded from confusion metrics: ${audited.filter((item) => item.manualJudgment === "ambiguous_specification").length}

## Manual judgment distribution

\`\`\`json
${JSON.stringify(countBy(audited, (item) => item.manualJudgment), null, 2)}
\`\`\`

## Confusion matrix

The automatic evaluator's positive class is **failure**.

| | Actual failure | Actual pass |
| --- | ---: | ---: |
| Automatic failure | ${metrics.truePositive} | ${metrics.falsePositive} |
| Automatic pass | ${metrics.falseNegative} | ${metrics.trueNegative} |

- Automatic failures that were actual failures: ${metrics.truePositive}
- Automatic failures that were false positives: ${metrics.falsePositive}
- Automatic passes that were actual passes: ${metrics.trueNegative}
- Automatic passes that were false negatives: ${metrics.falseNegative}
- Precision: ${percent(metrics.precision)}
- Recall: ${percent(metrics.recall)}
- False-positive rate (FP / (FP + TN)): ${percent(metrics.falsePositiveRate)}
- False-negative rate (FN / (FN + TP)): ${percent(metrics.falseNegativeRate)}
- False alarms among automatic failures: ${percent(metrics.falseAlarmShareAmongAutomaticFailures)}

## Stored-output regrade after evaluator fixes

| | Actual failure | Actual pass |
| --- | ---: | ---: |
| Regraded automatic failure | ${regradedMetrics.truePositive} | ${regradedMetrics.falsePositive} |
| Regraded automatic pass | ${regradedMetrics.falseNegative} | ${regradedMetrics.trueNegative} |

- Precision: ${percent(regradedMetrics.precision)}
- Recall: ${percent(regradedMetrics.recall)}
- False-positive rate: ${percent(regradedMetrics.falsePositiveRate)}
- False-negative rate: ${percent(regradedMetrics.falseNegativeRate)}
- False alarms among regraded automatic failures: ${percent(regradedMetrics.falseAlarmShareAmongAutomaticFailures)}
- OpenAI calls used for regrade: 0

## Gate decision

The evaluator is **not reliable enough to gate production fixes**: false positives exceed 5%, and false negatives are non-zero. Harness defects must be isolated and corrected using the frozen outputs before product-code remediation is scored.

Observed harness defects:

1. Required-concept matching misses clear paraphrases and directly measured concepts.
2. Negation matching can report loss even when the respondent metadata, title, description, and questions preserve the negative condition.
3. Population equivalence does not consistently normalize school abbreviations and formal department labels.
4. The evaluator does not reject malformed evaluation targets, misplaced screeners, duplicate constructs, or respondent-population narrowing in several auto-pass cases.

## Case-by-case audit

| Case | Original automatic | Regraded automatic | Manual | Rationale |
| --- | --- | --- | --- | --- |
${rows}
`;

await Promise.all([
  writeFile(
    resolve(root, "reports/survey-regression-v1-evaluator-audit-cases.json"),
    `${JSON.stringify(audited, null, 2)}\n`,
    "utf8",
  ),
  writeFile(
    resolve(root, "reports/survey-regression-v1-evaluator-audit.md"),
    report,
    "utf8",
  ),
]);
console.log(
  JSON.stringify(
    {
      total: audited.length,
      judgments: countBy(audited, (item) => item.manualJudgment),
      metrics,
      regradedMetrics,
    },
    null,
    2,
  ),
);
