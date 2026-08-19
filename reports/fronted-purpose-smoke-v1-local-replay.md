# Fronted-purpose smoke v1 local replay

- 실제 OpenAI 호출: 0
- 저장 최종 설문 문항 세트: 14/20
- 저장 clarification: 3/20
- 저장 structured model output: 0/20
- 저장 questionsBeforePostprocess: 0/20
- 현재 canonical + deterministic blueprint 의미 통과: 20/20
- survey 통과: 17/17
- clarification 통과: 3/3
- evaluator 수정 전: TP 8, FP 2, TN 10, FN 0
- evaluator 수정 후: TP 8, FP 0, TN 12, FN 0

## Replay 제한

- 불변 baseline에는 원본 또는 sanitized structured model output이 저장되어 있지 않습니다.
- questionsBeforePostprocess도 저장되어 있지 않아 과거 모델 출력의 structured parse, repair, fallback selection을 그대로 재생할 수 없습니다.
- 따라서 저장된 최종 설문은 evaluator 재채점에만 사용하고, 현재 parser와 deterministic blueprint는 동일 입력으로 별도 검증합니다.
- localBlueprintDiffersFromStoredFinal은 두 경로의 문항 차이이며 과거 모델 문항을 수정했다는 뜻이 아닙니다.

| caseId | 기대 | 기존 경로 | 로컬 응답 | 로컬 문항 | 로컬 fatal |
| --- | --- | --- | --- | ---: | --- |
| fronted-ambiguous-001 | clarification | clarification | clarification | 0 | - |
| fronted-ambiguous-002 | clarification | clarification | clarification | 0 | - |
| fronted-ambiguous-003 | clarification | clarification | clarification | 0 | - |
| fronted-clear-001 | survey | deterministic_metadata_normalization | survey | 7 | - |
| fronted-clear-002 | survey | request_failure | survey | 7 | - |
| fronted-clear-003 | survey | hard_fallback | survey | 7 | - |
| fronted-clear-004 | survey | hard_fallback | survey | 7 | - |
| fronted-clear-005 | survey | deterministic_metadata_normalization | survey | 7 | - |
| fronted-clear-006 | survey | request_failure | survey | 7 | - |
| fronted-clear-007 | survey | deterministic_metadata_normalization | survey | 7 | - |
| fronted-clear-008 | survey | deterministic_metadata_normalization | survey | 7 | - |
| fronted-control-001 | survey | partial_repair | survey | 7 | - |
| fronted-control-002 | survey | partial_repair | survey | 7 | - |
| fronted-control-003 | survey | partial_repair | survey | 7 | - |
| fronted-noisy-001 | survey | partial_repair | survey | 7 | - |
| fronted-noisy-002 | survey | hard_fallback | survey | 7 | - |
| fronted-noisy-003 | survey | deterministic_metadata_normalization | survey | 7 | - |
| fronted-noisy-004 | survey | deterministic_metadata_normalization | survey | 7 | - |
| fronted-noisy-005 | survey | deterministic_metadata_normalization | survey | 7 | - |
| fronted-noisy-006 | survey | request_failure | survey | 7 | - |
