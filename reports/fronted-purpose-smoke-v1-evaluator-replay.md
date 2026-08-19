# Fronted-purpose smoke v1 evaluator replay

- 실제 OpenAI 호출: 0
- replay 범위: 저장된 최종 설문에 대한 evaluator 재채점만 수행
- 수정 전 confusion matrix: TP 8, FP 2, TN 10, FN 0
- 수정 후 confusion matrix: TP 8, FP 0, TN 12, FN 0

| caseId | 수동 판정 | 수정 전 | 수정 후 | 수정 전 fatal | 수정 후 fatal |
| --- | --- | --- | --- | --- | --- |
| fronted-ambiguous-001 | accepted | pass | pass | - | - |
| fronted-ambiguous-002 | accepted | pass | pass | - | - |
| fronted-ambiguous-003 | accepted | pass | pass | - | - |
| fronted-clear-001 | accepted | pass | pass | - | - |
| fronted-clear-002 | true_product_failure | fail | fail | REQUEST_FAILURE, ELIGIBILITY_CHECK_MISSING, REQUIRED_PURPOSE_MISSING, REQUIRED_QUESTION_CONCEPT_MISSING, OVERALL_SATISFACTION_MISSING, QUESTION_COUNT_MISMATCH | REQUEST_FAILURE, ELIGIBILITY_CHECK_MISSING, REQUIRED_PURPOSE_MISSING, REQUIRED_QUESTION_CONCEPT_MISSING, OVERALL_SATISFACTION_MISSING, QUESTION_COUNT_MISMATCH |
| fronted-clear-003 | true_product_failure | fail | fail | HARD_FALLBACK, SCHEMA_ISSUES | HARD_FALLBACK |
| fronted-clear-004 | true_product_failure | fail | fail | HARD_FALLBACK, SCHEMA_ISSUES | HARD_FALLBACK |
| fronted-clear-005 | accepted | pass | pass | - | - |
| fronted-clear-006 | true_product_failure | fail | fail | REQUEST_FAILURE, ELIGIBILITY_CHECK_MISSING, REQUIRED_PURPOSE_MISSING, REQUIRED_QUESTION_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH | REQUEST_FAILURE, ELIGIBILITY_CHECK_MISSING, REQUIRED_PURPOSE_MISSING, REQUIRED_QUESTION_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH |
| fronted-clear-007 | evaluator_false_positive | fail | pass | SURVEY_OBJECT_MISMATCH | - |
| fronted-clear-008 | accepted | pass | pass | - | - |
| fronted-control-001 | true_product_failure | fail | fail | TARGET_POPULATION_MISMATCH, REQUIRED_QUESTION_CONCEPT_MISSING | TARGET_POPULATION_MISMATCH, REQUIRED_QUESTION_CONCEPT_MISSING |
| fronted-control-002 | accepted | pass | pass | - | - |
| fronted-control-003 | evaluator_false_positive | fail | pass | REQUIRED_QUESTION_CONCEPT_MISSING | - |
| fronted-noisy-001 | true_product_failure | fail | fail | OVERALL_SATISFACTION_MISSING | OVERALL_SATISFACTION_MISSING |
| fronted-noisy-002 | true_product_failure | fail | fail | HARD_FALLBACK | HARD_FALLBACK |
| fronted-noisy-003 | accepted | pass | pass | - | - |
| fronted-noisy-004 | accepted | pass | pass | - | - |
| fronted-noisy-005 | accepted | pass | pass | - | - |
| fronted-noisy-006 | true_product_failure | fail | fail | REQUEST_FAILURE, ELIGIBILITY_CHECK_MISSING, REQUIRED_PURPOSE_MISSING, REQUIRED_QUESTION_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH | REQUEST_FAILURE, ELIGIBILITY_CHECK_MISSING, REQUIRED_PURPOSE_MISSING, REQUIRED_QUESTION_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH |
