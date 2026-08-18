# Survey Regression v1 Evaluator Audit

## Scope

- Frozen run: `preview-100-v1`
- Application baseline: `b2c52ca82af1c5c16fae3fb72af20bf34436f8c7`
- Cases manually reviewed: 100/100
- OpenAI calls during this audit: 0 (stored results only)
- Ambiguous specifications excluded from confusion metrics: 3

## Manual judgment distribution

```json
{
  "ambiguous_specification": 3,
  "evaluator_false_negative": 9,
  "evaluator_false_positive": 4,
  "true_failure": 83,
  "true_pass": 1
}
```

## Confusion matrix

The automatic evaluator's positive class is **failure**.

| | Actual failure | Actual pass |
| --- | ---: | ---: |
| Automatic failure | 83 | 4 |
| Automatic pass | 9 | 1 |

- Automatic failures that were actual failures: 83
- Automatic failures that were false positives: 4
- Automatic passes that were actual passes: 1
- Automatic passes that were false negatives: 9
- Precision: 95.40%
- Recall: 90.22%
- False-positive rate (FP / (FP + TN)): 80.00%
- False-negative rate (FN / (FN + TP)): 9.78%
- False alarms among automatic failures: 4.60%

## Stored-output regrade after evaluator fixes

| | Actual failure | Actual pass |
| --- | ---: | ---: |
| Regraded automatic failure | 92 | 0 |
| Regraded automatic pass | 0 | 5 |

- Precision: 100.00%
- Recall: 100.00%
- False-positive rate: 0.00%
- False-negative rate: 0.00%
- False alarms among regraded automatic failures: 0.00%
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
| dev-clarify-001 | auto_failure | auto_failure | true_failure | 응답 대상이나 구체적 조사 대상이 빠진 모호한 입력에 clarification 대신 임의의 설문을 생성해 실제 실패임. |
| dev-clarify-002 | auto_failure | auto_failure | true_failure | 응답 대상이나 구체적 조사 대상이 빠진 모호한 입력에 clarification 대신 임의의 설문을 생성해 실제 실패임. |
| dev-clarify-003 | auto_failure | auto_failure | true_failure | 응답 대상이나 구체적 조사 대상이 빠진 모호한 입력에 clarification 대신 임의의 설문을 생성해 실제 실패임. |
| dev-clarify-004 | auto_failure | auto_failure | true_failure | 응답 대상이나 구체적 조사 대상이 빠진 모호한 입력에 clarification 대신 임의의 설문을 생성해 실제 실패임. |
| dev-clarify-005 | auto_failure | auto_failure | true_failure | 응답 대상이나 구체적 조사 대상이 빠진 모호한 입력에 clarification 대신 임의의 설문을 생성해 실제 실패임. |
| dev-clarify-006 | auto_failure | auto_failure | true_failure | 응답 대상이나 구체적 조사 대상이 빠진 모호한 입력에 clarification 대신 임의의 설문을 생성해 실제 실패임. |
| dev-complex-001 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '새봄대학교 중앙도서관 이용자'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-complex-002 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-complex-003 | auto_failure | auto_failure | true_failure | evaluationTarget '인지도, 비이용 이유, 이용 의향'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-complex-004 | auto_failure | auto_failure | true_failure | evaluationTarget '이용 패턴, 불편, 재등록 의향'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-complex-005 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '새봄대학교 구성원'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-complex-006 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-complex-007 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-complex-008 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-complex-009 | auto_pass | auto_failure | evaluator_false_negative | 문항은 이동 경험을 측정하지만 evaluationTarget이 '에게 ... 묻고 싶어'라는 요청 문장을 그대로 포함해 조사 대상 metadata가 손상됐는데 자동 통과함. |
| dev-complex-010 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| dev-complex-011 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '최근 한 달 별마루 카페를 이용한 주민'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-complex-012 | auto_failure | auto_failure | true_failure | evaluationTarget '동아리 안 한 신입생한테 학교 적응이랑 가입 안 한 이유 물어보기'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-complex-013 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-complex-014 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| dev-complex-015 | auto_pass | auto_failure | evaluator_false_negative | '학교생활 만족도에 미치는은'과 '교통수단별에'처럼 핵심 관계 문항이 문법·의미상 깨졌는데 자동 통과함. |
| dev-complex-016 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-general-001 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '새봄대학교 심리학과 1학년'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-general-002 | auto_pass | auto_failure | evaluator_false_negative | 대상을 야간 강좌 수강 직장인에서 전체 직장인으로 넓히고 첫 문항에 조사 목적 전체를 삽입했는데 자동 통과함. |
| dev-general-003 | auto_failure | auto_failure | true_failure | evaluationTarget '향후'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-general-004 | auto_failure | auto_failure | true_failure | 최종 evaluationTarget이 비어 있어 설문이 무엇을 측정하는지 공개 metadata와 후속 분석 단계에서 보존되지 않는 실제 실패임. |
| dev-general-005 | auto_failure | auto_failure | ambiguous_specification | 원문은 접근성과 이동 불편만 요구하지만 fixture가 소요 시간을 필수로 지정해 자동 실패의 일부가 평가 specification 과잉에서 발생함. |
| dev-general-006 | auto_failure | auto_failure | true_failure | evaluationTarget '환승역 혼잡과 이동 안전 체감'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-general-007 | auto_failure | auto_failure | true_failure | evaluationTarget '휠체어 이용자가 공공도서관'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-general-008 | auto_failure | auto_failure | true_failure | evaluationTarget '자전거와 전동킥보드로 출퇴근하는 사람들의 이동 시간과 안전 경험 비교'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-general-009 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-general-010 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '재택근무자'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-general-011 | auto_pass | auto_failure | evaluator_false_negative | 비구매자 대상 설문에서 구매 여부를 다시 묻고 일반 상황 filler를 추가해 대상 조건과 문항 효율이 훼손됐는데 자동 통과함. |
| dev-general-012 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-general-013 | auto_failure | auto_failure | true_failure | evaluationTarget '새봄대학교'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-general-014 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-general-015 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| dev-general-016 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| dev-general-017 | auto_failure | auto_failure | true_failure | HTTP 500에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| dev-general-018 | auto_failure | auto_failure | true_failure | evaluationTarget '미가입 이유와 관심 활동'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-general-019 | auto_failure | auto_failure | true_failure | evaluationTarget '봄꽃 축제'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-general-020 | auto_failure | auto_pass | evaluator_false_positive | 참여 프로그램을 먼저 구분한 뒤 도움 정도와 만족도를 같은 척도로 측정해 집단 비교가 가능하므로 목적 coverage 실패 판정이 오탐임. |
| dev-general-021 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| dev-general-022 | auto_failure | auto_failure | true_failure | evaluationTarget '인지도와 이용 장벽'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-general-023 | auto_failure | auto_failure | true_failure | evaluationTarget '원격근무 팀원의 협업 도구 피로와 소속감'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-general-024 | auto_failure | auto_failure | ambiguous_specification | 원문은 시간관리와 스트레스를 요구하지만 fixture가 실제 시간 사용량까지 필수로 지정해 기대값이 원문보다 과도하게 구체적임. |
| dev-general-025 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-general-026 | auto_failure | auto_pass | evaluator_false_positive | 미구매 이유와 최대 추가 지불 의향을 명시적으로 묻고 있어 비이용 이유와 비용 개념 누락 판정이 오탐임. |
| dev-general-027 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| dev-general-028 | auto_pass | auto_failure | evaluator_false_negative | 공공자전거 이용 여부 스크리너가 마지막에 배치되어 앞선 경험 문항의 응답 적격성을 보장하지 못하는데 자동 통과함. |
| dev-general-029 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-general-030 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-general-031 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '주 1회도 운동하지 않는 성인'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-general-032 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| dev-noisy-001 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '새봄대학교 구성원'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-noisy-002 | auto_failure | auto_failure | ambiguous_specification | 원문은 주간 커피 지출만 명시하지만 fixture가 구매 빈도까지 필수로 요구해 통과 여부를 단정할 수 없는 specification 문제임. |
| dev-noisy-003 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '동아리에 가입하지 않은 사람'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-noisy-004 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '온새미 앱 사용자'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-noisy-005 | auto_failure | auto_failure | true_failure | evaluationTarget '배달 안시킨 1인가구 왜'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-noisy-006 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '팀플 경험자'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-past-001 | auto_pass | auto_pass | true_pass | 응답 대상과 경영대라는 조사 대상이 정확하고 만족도·불편·개선 요구를 자연스러운 7개 문항으로 측정해 자동 통과가 타당함. |
| dev-past-002 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '연세대 경영대생'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-past-003 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '경영대생'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-past-004 | auto_pass | auto_failure | evaluator_false_negative | 비이용 경영대생이라는 핵심 응답 대상을 '관련 경험이 있는 응답자'로 일반화해 metadata 계약을 잃었는데 자동 통과함. |
| dev-past-005 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-past-006 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| dev-past-007 | auto_failure | auto_failure | true_failure | evaluationTarget '지난달 연세대 재학생이 대우관'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-past-008 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| dev-past-009 | auto_pass | auto_failure | evaluator_false_negative | 전체 대학생 대상 입력을 네이버 웹툰 이용자로 축소하여 비이용자의 현황을 수집할 수 없는데 자동 통과함. |
| dev-past-010 | auto_failure | auto_failure | true_failure | 응답 대상 '네웹 안 쓰는 대학생'이 기대 대상 '네이버 웹툰을 이용하지 않는 대학생'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-past-011 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-past-012 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| dev-past-013 | auto_pass | auto_failure | evaluator_false_negative | 전체 연세대학교 학생 대상 입력을 한경관 학식 이용자로 축소하여 비이용 경험 경로를 배제했는데 자동 통과함. |
| dev-past-014 | auto_failure | auto_pass | evaluator_false_positive | 응답 대상·제목·설명·모든 핵심 문항이 한경관 학식을 먹지 않는 조건을 보존하므로 부정 표현 손실과 비이용 이유 누락 판정이 오탐임. |
| dev-past-015 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-past-016 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| dev-past-017 | auto_pass | auto_failure | evaluator_false_negative | 전반적 만족도를 직접 측정하지 않고 불편 문항을 중복 배치해 핵심 목적 coverage와 문항 품질이 부족한데 자동 통과함. |
| dev-past-018 | auto_failure | auto_failure | true_failure | 응답 대상 '맛나샘 안 가는 학생'이 기대 대상 '맛나샘을 이용하지 않는 학생'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| dev-past-019 | auto_failure | auto_failure | true_failure | evaluationTarget '방문 빈도와 음식'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| dev-past-020 | auto_failure | auto_failure | true_failure | evaluationTarget '맛나샘 학생들 맛 서비스 둘다 어떤지 불편도'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| holdout-clarify-001 | auto_failure | auto_failure | true_failure | 응답 대상이나 구체적 조사 대상이 빠진 모호한 입력에 clarification 대신 임의의 설문을 생성해 실제 실패임. |
| holdout-clarify-002 | auto_failure | auto_failure | true_failure | 응답 대상이나 구체적 조사 대상이 빠진 모호한 입력에 clarification 대신 임의의 설문을 생성해 실제 실패임. |
| holdout-complex-001 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| holdout-complex-002 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| holdout-complex-003 | auto_failure | auto_failure | true_failure | 모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임. |
| holdout-complex-004 | auto_failure | auto_failure | true_failure | evaluationTarget '이유와 개선점을 묻기'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| holdout-general-001 | auto_failure | auto_failure | true_failure | evaluationTarget '한울대학교 교양 수업 수강생의 토론'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| holdout-general-002 | auto_failure | auto_failure | true_failure | evaluationTarget '접근 장벽'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| holdout-general-003 | auto_failure | auto_failure | true_failure | evaluationTarget '방문 빈도와 대기'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| holdout-general-004 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| holdout-general-005 | auto_failure | auto_failure | true_failure | evaluationTarget '불참 이유와 관심 주제'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| holdout-general-006 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '회의에 참여하지 못한 프로젝트 팀원'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| holdout-general-007 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '반려동물 가구'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| holdout-general-008 | auto_failure | auto_failure | true_failure | evaluationTarget '주말에 영상 콘텐츠를 보지 않는 성인의 여가 선택 이유'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| holdout-noisy-001 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '늘봄관에 가지 않는 한울대학교 학생'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| holdout-noisy-002 | auto_failure | auto_failure | true_failure | 응답 대상 '관련 경험이 있는 응답자'이 기대 대상 '다온 앱을 최근 사용하지 않는 사람'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임. |
| holdout-past-001 | auto_failure | auto_pass | evaluator_false_positive | 한울대 경영학부 학생과 한울대학교 경영학부 학생은 동등하며 만족도·불편·개선 요구 문항도 모두 존재해 자동 실패가 오탐임. |
| holdout-past-002 | auto_failure | auto_failure | true_failure | evaluationTarget '늘봄관 통학 및'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임. |
| holdout-past-003 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
| holdout-past-004 | auto_failure | auto_failure | true_failure | HTTP 422에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임. |
