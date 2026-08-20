import assert from "node:assert/strict";
import test from "node:test";

import {
  smoke35AuditCaseIds,
  smoke35AuditDecisions,
  type Smoke35AuditJudgment,
} from "../evals/survey-regression/v1/smoke35-audit-v1";

test("smoke35 수동 감사가 모든 사례를 한 번씩 분류한다", () => {
  assert.equal(smoke35AuditCaseIds.length, 35);
  assert.equal(new Set(smoke35AuditCaseIds).size, 35);

  const counts = Object.values(smoke35AuditDecisions).reduce<
    Record<Smoke35AuditJudgment, number>
  >(
    (accumulator, decision) => {
      accumulator[decision.judgment] += 1;
      assert.ok(decision.rationale.trim().length >= 20);
      return accumulator;
    },
    {
      true_pass: 0,
      true_product_failure: 0,
      evaluator_false_positive: 0,
      evaluator_false_negative: 0,
      dataset_specification_error: 0,
      ambiguous_specification: 0,
    },
  );

  assert.deepEqual(counts, {
    true_pass: 7,
    true_product_failure: 16,
    evaluator_false_positive: 6,
    evaluator_false_negative: 3,
    dataset_specification_error: 3,
    ambiguous_specification: 0,
  });
});
