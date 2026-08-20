# Targeted 18 v1 Blocked Baseline and Manual Audit

## Frozen baseline

- Run ID: `targeted-c235c03-c3-final2-20260820`
- Application commit: `c235c03b4abdab4b2c1a6eb0a1903abc07af926d`
- Cases reviewed: 18/18
- OpenAI calls during audit: 0
- Original artifacts modified: no
- Gate state: `TARGETED_REGRESSION_BLOCKED`

## Manual judgment distribution

```json
{
  "evaluator_false_negative": 3,
  "evaluator_false_positive": 2,
  "true_pass": 12,
  "true_product_failure": 1
}
```

## Partial repair audit

```json
{
  "necessary_partial_repair": 6,
  "not_repaired": 10,
  "repair_created_new_error": 2
}
```

## Original evaluator confusion matrix

| | Actual product failure | Actual pass |
| --- | ---: | ---: |
| Automatic failure | 1 | 2 |
| Automatic pass | 3 | 12 |

- Precision: 33.33%
- Recall: 25.00%
- False-positive rate: 14.29%
- False-negative rate: 75.00%

## Stored-output regrade

| | Actual product failure | Actual pass |
| --- | ---: | ---: |
| Regraded failure | 4 | 0 |
| Regraded pass | 0 | 14 |

- Precision: 100.00%
- Recall: 100.00%
- False-positive rate: 0.00%
- False-negative rate: 0.00%
- OpenAI calls used for regrade: 0

## Case audit

| Case | Original automatic | Regraded automatic | Manual | Repair audit | Rationale |
| --- | --- | --- | --- | --- | --- |
| targeted-clarification-001 | auto_pass | auto_pass | true_pass | not_repaired | 프로그램의 내용과 조사 목적이 빠진 모호한 요청에 clarification을 반환해 적절함. |
| targeted-clarification-002 | auto_pass | auto_pass | true_pass | not_repaired | 비교할 두 교육관이 명시되지 않아 clarification을 반환한 것이 적절함. |
| targeted-clarification-003 | auto_pass | auto_failure | evaluator_false_negative | repair_created_new_error | 통학 불편 조사에서 repair된 Q2가 '관련한 행동은 주로 어떤 상황에서'라는 추상적 filler가 되어 사용자가 요구한 구체적 통학 불편을 직접 측정하지 못했지만 자동 평가가 통과함. |
| targeted-clarification-004 | auto_pass | auto_pass | true_pass | necessary_partial_repair | 별숲앱 비이용 자영업자의 비이용 이유와 향후 사용 의향을 모두 직접 측정함. |
| targeted-expansion-001 | auto_failure | auto_pass | evaluator_false_positive | not_repaired | 방문 목적·이용 빈도·불편·개선 요구를 각각 직접 묻고 있어 필수 조사 목적이 모두 충족되지만 evaluator가 purpose coverage 누락으로 오판함. |
| targeted-expansion-002 | auto_pass | auto_pass | true_pass | not_repaired | 접근성·대기 시간·안내 만족도·불편을 모두 직접 측정함. |
| targeted-expansion-003 | auto_pass | auto_pass | true_pass | not_repaired | 수업 참여 경험·학습 효과·어려움·개선 요구를 모두 측정하고 참여 자격 문항도 선두에 배치함. |
| targeted-flattening-001 | auto_pass | auto_pass | true_pass | not_repaired | 푸른들 돌봄 프로그램 비참여 학부모를 보존하고 불참 이유와 향후 참여 의향을 분리해 측정함. |
| targeted-flattening-002 | auto_pass | auto_pass | true_pass | necessary_partial_repair | 모아온 업무앱 비이용 직장인의 비이용 이유와 향후 사용 의향을 분리해 측정함. |
| targeted-flattening-003 | auto_failure | auto_pass | evaluator_false_positive | not_repaired | 첫 문항이 새결 정수기 미구매 자격을 확인하고 구매 비교 경험 문항은 구매 장벽을 해석하는 실질 문항인데, evaluator가 이를 후행 screening으로 잘못 분류함. |
| targeted-flattening-004 | auto_pass | auto_pass | true_pass | necessary_partial_repair | 해솔 독서 구독 해지 이용자의 해지 이유와 재가입 의향을 직접 측정함. |
| targeted-population-001 | auto_pass | auto_failure | evaluator_false_negative | repair_created_new_error | 환경공학과 학생과 실험실 안전 맥락은 보존했지만 repair가 기존 안전 인식 척도와 의미가 중복되는 전반적 안전 인식 문항을 추가해 중복 construct가 생겼음. |
| targeted-population-002 | auto_pass | auto_pass | true_pass | not_repaired | 최근 6개월 비이용 청년 조건과 꿈담 구직서비스 고유명사를 보존하고 비이용 이유와 향후 사용 의향을 측정함. |
| targeted-repair-001 | auto_failure | auto_failure | true_product_failure | necessary_partial_repair | 기준 기간 메타데이터 불일치 하나로 전체 설문이 hard fallback되며 '선행 값', '결과 값', '앞에서 답한 값들' 같은 내부 추상 placeholder가 응답자 문항에 노출됨. |
| targeted-repair-002 | auto_pass | auto_failure | evaluator_false_negative | not_repaired | 해오름식당과 별하식당을 모두 보존했지만 만족도 측정이 해오름식당에만 있고 별하식당 만족도가 없어 대상별 비교가 불가능한데 자동 평가가 통과함. |
| targeted-satisfaction-001 | auto_pass | auto_pass | true_pass | not_repaired | 맛·주문 편의·직원 응대와 전반적 만족도를 분리해 직접 측정함. |
| targeted-satisfaction-002 | auto_pass | auto_pass | true_pass | necessary_partial_repair | 기능 편의성·오류 경험·앱 전체 만족도를 직접 측정함. |
| targeted-satisfaction-003 | auto_pass | auto_pass | true_pass | necessary_partial_repair | 행사 구성·안내·혼잡과 전반적 만족도를 직접 측정함. |
