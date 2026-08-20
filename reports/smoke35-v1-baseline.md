# Smoke 35 v1 Manual Semantic Audit

## Frozen baseline

- Run ID: `smoke35-v1-cfc2162-20260820`
- Application commit: `cfc21622d93459357dd3c8f98bda7d0a0bdb9bf0`
- Cases reviewed: 35/35
- OpenAI calls during audit: 0
- Original artifacts modified: no

## Manual judgment distribution

```json
{
  "dataset_specification_error": 3,
  "evaluator_false_negative": 3,
  "evaluator_false_positive": 6,
  "true_pass": 7,
  "true_product_failure": 16
}
```

Dataset specification errors are excluded from the confusion matrix.

## Original evaluator confusion matrix

| | Actual product failure | Actual pass |
| --- | ---: | ---: |
| Automatic failure | 16 | 6 |
| Automatic pass | 3 | 7 |

- Precision: 72.73%
- Recall: 84.21%
- False-positive rate: 46.15%
- False-negative rate: 15.79%

## Stored-output regrade

| | Actual product failure | Actual pass |
| --- | ---: | ---: |
| Regraded failure | 19 | 0 |
| Regraded pass | 0 | 13 |

- Precision: 100.00%
- Recall: 100.00%
- False-positive rate: 0.00%
- False-negative rate: 0.00%
- OpenAI calls used for regrade: 0

## Case audit

| Case | Original automatic | Regraded automatic | Manual | Rationale |
| --- | --- | --- | --- | --- |
| dev-clarify-002 | auto_pass | auto_pass | true_pass | 응답 대상·앱 종류·조사 목적이 모두 빠진 '앱 조사'에 조사 방향을 묻는 clarification을 반환해 적절함. |
| dev-clarify-003 | auto_failure | auto_failure | true_product_failure | 시설 종류·응답 대상·조사 목적이 모두 불명확한데 임의의 시설 이용 만족도 설문을 생성해 material ambiguity를 해소하지 못함. |
| dev-clarify-004 | auto_failure | auto_failure | true_product_failure | 무엇에 대한 학생들의 생각인지 주제가 없는데 의견 표현 일반 설문을 임의 생성해 사용자 의도를 발명함. |
| dev-clarify-006 | auto_failure | auto_failure | true_product_failure | 비교할 두 대상이 없는데 응답자에게 대상 이름을 적게 하는 설문을 생성해 설계 전에 필요한 clarification을 생략함. |
| dev-complex-002 | auto_pass | auto_pass | true_pass | 배달 앱 이용 1인 가구를 보존하고 주문 빈도·월 지출·구독 혜택과 지불 의향을 7문항으로 직접 측정함. |
| dev-complex-004 | auto_failure | auto_pass | evaluator_false_positive | 이용 빈도·활동·시간대가 이용 패턴을 이루고 마지막 척도가 재등록 가능성을 직접 측정하므로 두 coverage 실패는 오탐임. |
| dev-complex-005 | auto_failure | auto_failure | dataset_specification_error | 원문에 응답자 범위가 없어 '새봄대학교 구성원'을 필수 대상으로 단정한 기대값은 과도하며, 찾아가기 쉬움을 같은 척도로 병렬 측정해 접근성 누락 판정도 오탐임. |
| dev-complex-007 | auto_failure | auto_failure | true_product_failure | Q1이 주 통근수단이 아니라 더 오래 걸리는 수단을 물어 이후 시간·혼잡·피로 응답을 버스·지하철 집단별로 비교할 기준 변수를 만들지 못함. |
| dev-complex-008 | auto_failure | auto_pass | evaluator_false_positive | 온라인·대면 멘토링의 도움 정도와 지속 참여 가능성을 동일한 척도로 각각 측정해 참여 의향과 비교 목적을 충족함. |
| dev-complex-012 | auto_failure | auto_failure | true_product_failure | 응답 대상과 목적을 포함한 사용자 요청 전체가 evaluationTarget으로 평탄화돼 Q1에 generic 상황 문항이 삽입됨. |
| dev-complex-013 | auto_failure | auto_failure | true_product_failure | 월 용돈을 실제 금액이 아닌 막연한 높고 낮음으로 묻고 외식 빈도와 충동구매를 한 문항에 합쳐 변수 간 관계 분석에 필요한 독립 측정을 훼손함. |
| dev-general-001 | auto_pass | auto_failure | evaluator_false_negative | 기대 응답 대상의 1학년 조건이 최종 respondentGroup에서 사라지고 '심리학과 의'라는 깨진 표현도 남았지만 자동 평가가 통과시킴. |
| dev-general-003 | auto_failure | auto_pass | evaluator_false_positive | 불참 이유를 직접 묻고 향후 참여 가능성을 척도로 측정하므로 비참여 이유와 참여 의향 누락 판정은 오탐임. |
| dev-general-004 | auto_failure | auto_failure | true_product_failure | 두 강의와 비교할 결과변수인 데이터 분석 자신감이 모두 명시된 입력에 불필요한 clarification을 반환함. |
| dev-general-005 | auto_failure | auto_pass | evaluator_false_positive | 솔빛관 방문 빈도·이동수단·분 단위 이동시간·접근 편의·불편을 직접 측정하므로 소요 시간 누락 판정은 오탐임. |
| dev-general-008 | auto_failure | auto_failure | true_product_failure | 최종 문항은 비교 가능하지만 evaluationTarget에 응답자와 비교 목적을 포함한 요청 문장 전체가 남아 canonical survey object 계약을 위반함. |
| dev-general-012 | auto_failure | auto_failure | true_product_failure | respondentGroup이 '관련 경험이 있는 응답자'로 일반화되고 evaluationTarget도 요청 전체로 평탄화돼 공개 메타데이터의 대상·조사 대상이 손상됨. |
| dev-general-014 | auto_failure | auto_failure | dataset_specification_error | 원문은 전체 동네 주민의 이용 목적과 거래 만족도를 묻고 Q1로 이용 경험을 구분하므로 이용자로만 제한한 기대 대상과 이용 경험 누락 판정이 과도함. |
| dev-general-015 | auto_pass | auto_pass | true_pass | 모바일 뱅킹 비이용 고령층과 부정 조건을 보존하고 인지도·비이용 장벽·지원·향후 사용 의향을 구체적으로 측정함. |
| dev-general-016 | auto_failure | auto_failure | true_product_failure | 가장 자주 쓰는 한 앱만 평가해 iOS용과 안드로이드용 공부 앱의 사용성과 지속 의향을 대상별로 비교하지 못함. |
| dev-general-021 | auto_pass | auto_pass | true_pass | 팀플 경험 대학생을 대상으로 역할 분담 공정성과 의사소통 만족도를 가장 최근 경험 기준으로 직접 측정함. |
| dev-general-023 | auto_pass | auto_failure | evaluator_false_negative | Q1에 한국어가 아닌 'नियमित적으로'가 섞여 응답자 문항이 깨졌지만 자동 품질 평가가 이를 잡지 못함. |
| dev-general-027 | auto_failure | auto_pass | evaluator_false_positive | 넷플릭스와 티빙의 이용 빈도와 콘텐츠 만족도를 같은 척도로 각각 측정해 두 대상 비교가 가능하며 대상 표현도 실질적으로 일치함. |
| dev-general-028 | auto_failure | auto_failure | dataset_specification_error | 원문은 지역 주민 전체의 이용 경험을 요구하고 Q1로 이용·비이용을 구분하므로 공공자전거 이용자로만 제한한 기대 대상이 원문보다 좁음. |
| dev-general-031 | auto_failure | auto_failure | true_product_failure | 부정 술어를 잘못 잘라 '않는 성인의 운동 방해 요인'을 object로 만들고 Q1~Q3에 선택·구매 generic 문항을 삽입함. |
| dev-noisy-006 | auto_failure | auto_pass | evaluator_false_positive | 팀플 경험자와 팀 프로젝트 경험 응답자는 동등하며 갈등 발생·원인·해결 방식을 직접 측정해 target mismatch가 아님. |
| dev-past-003 | auto_failure | auto_failure | true_product_failure | 경영대생·경영대 시설·만족과 불편이 모두 명시된 짧은 입력에 불필요한 clarification을 반환함. |
| dev-past-005 | auto_failure | auto_failure | true_product_failure | 전체 연세대학교 학생 입력을 대우관 방문자로 축소하고 모든 빈도 선택지에서 미방문 경로를 제거해 비방문 학생을 배제함. |
| dev-past-007 | auto_pass | auto_failure | evaluator_false_negative | 질문은 정상이나 evaluationTarget이 '지난달 연세대 재학생이 대우관'으로 남아 respondent phrase가 survey object에 섞였는데 자동 통과함. |
| dev-past-009 | auto_pass | auto_pass | true_pass | 대학생 전체를 유지하고 이용·과거 이용·비이용을 구분하며 빈도·만족·불편과 향후 이용 가능성을 측정함. |
| dev-past-010 | auto_failure | auto_failure | true_product_failure | 네이버 웹툰 비이용 대학생과 비이용 이유·향후 의향을 분리하지 못하고 요청 전체를 object와 generic Q1에 삽입함. |
| dev-past-013 | auto_pass | auto_pass | true_pass | 연세대학교 학생 전체를 유지하고 한경관 학식 이용·비이용을 구분해 빈도·만족·불편을 자연스럽게 측정함. |
| dev-past-016 | auto_failure | auto_failure | true_product_failure | repair된 Q4가 요청 문장 전체를 만족도 대상으로 사용하고 한경관 만족도를 직접 측정하지 않아 비교 목적을 충족하지 못함. |
| dev-past-017 | auto_pass | auto_pass | true_pass | 맛나샘 이용 학생을 보존하고 전반적 만족도·맛·가격·불편·개선 요구를 직접 측정함. |
| dev-past-020 | auto_failure | auto_failure | true_product_failure | 맛·주문 과정·직원 응대의 세부 평가는 있지만 음식과 서비스 경험 전반의 만족도를 직접 묻는 문항이 없음. |
