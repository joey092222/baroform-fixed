# Fronted-purpose smoke v1 immutable baseline

- 브랜치: codex/fix-survey-regression-root-causes-v1
- 커밋: 8484ee3311d963adfdf118674f8fb56e2182b233
- Preview deployment: dpl_7i69edCDivKd8WCPU9x3rCrmAAxN
- 완료: 20/20, 실제 모델 호출: 17, retry: 0
- 경로: deterministic metadata 7, partial repair 4, hard fallback 3, request failure 3, clarification 3, clean model 0
- 자동 치명 실패: 10, 수동 제품 오류: 8, evaluator false positive: 2
- 보안: API key, Authorization, Cookie, 전체 developer prompt를 포함하지 않음
- 원본 artifact는 읽기 전용으로 보존되며 이 보고서는 별도 snapshot임

## fronted-ambiguous-001

- 입력: 별마루 카페 새 메뉴 주민 조사
- 입력 품질 / 기대 결과: ambiguous / clarification
- 기대 응답 대상: 확인 필요
- 기대 적격 조건: 없음
- 맥락 엔터티: 없음
- 기대 조사 대상: 확인 필요
- 기대 목적 / 필수 문항 개념: 확인 필요 / 
- 실제 respondentGroup: null
- 실제 evaluationTarget: null
- 실제 제목: null
- 실제 설명: null
- 생성 경로: clarification / clarification
- 모델·repair·fallback: 0 / 0 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / 없음
- 자동 판정: pass
- 수동 판정: accepted — 자동 판정과 수동 감사 결과가 일치함.
- requestId: reg-v1-fronted-ambiguous-001-609636c6
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 3419ms

### 최종 문항

- 반환된 최종 문항 없음

## fronted-ambiguous-002

- 입력: 다온 앱 새 기능 대학생 조사
- 입력 품질 / 기대 결과: ambiguous / clarification
- 기대 응답 대상: 확인 필요
- 기대 적격 조건: 없음
- 맥락 엔터티: 없음
- 기대 조사 대상: 확인 필요
- 기대 목적 / 필수 문항 개념: 확인 필요 / 
- 실제 respondentGroup: null
- 실제 evaluationTarget: null
- 실제 제목: null
- 실제 설명: null
- 생성 경로: clarification / clarification
- 모델·repair·fallback: 0 / 0 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / 없음
- 자동 판정: pass
- 수동 판정: accepted — 자동 판정과 수동 감사 결과가 일치함.
- requestId: reg-v1-fronted-ambiguous-002-79897550
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 3405ms

### 최종 문항

- 반환된 최종 문항 없음

## fronted-ambiguous-003

- 입력: 늘봄센터 프로그램 학부모 조사
- 입력 품질 / 기대 결과: ambiguous / clarification
- 기대 응답 대상: 확인 필요
- 기대 적격 조건: 없음
- 맥락 엔터티: 없음
- 기대 조사 대상: 확인 필요
- 기대 목적 / 필수 문항 개념: 확인 필요 / 
- 실제 respondentGroup: null
- 실제 evaluationTarget: null
- 실제 제목: null
- 실제 설명: null
- 생성 경로: clarification / clarification
- 모델·repair·fallback: 0 / 0 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / 없음
- 자동 판정: pass
- 수동 판정: accepted — 자동 판정과 수동 감사 결과가 일치함.
- requestId: reg-v1-fronted-ambiguous-003-9e50fbb7
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 3777ms

### 최종 문항

- 반환된 최종 문항 없음

## fronted-clear-001

- 입력: 최근 한 달 동안 별마루 카페를 이용한 주민을 대상으로 별마루 카페의 새 메뉴 만족도를 조사하고 싶다.
- 입력 품질 / 기대 결과: clear / survey
- 기대 응답 대상: 최근 한 달 동안 별마루 카페를 이용한 주민
- 기대 적격 조건: 최근 한 달 내 별마루 카페 이용
- 맥락 엔터티: 별마루 카페
- 기대 조사 대상: 별마루 카페의 새 메뉴
- 기대 목적 / 필수 문항 개념: 새 메뉴 만족도 / 만족도
- 실제 respondentGroup: 최근 한 달 동안 별마루 카페를 이용한 주민
- 실제 evaluationTarget: 별마루 카페의 새 메뉴
- 실제 제목: 별마루 카페 새 메뉴 만족도 조사
- 실제 설명: 최근 한 달 동안 별마루 카페를 이용한 주민을 대상으로 새 메뉴 경험을 알아보는 설문입니다. 새 메뉴를 먹거나 마셔 본 경험을 떠올리며 답해주세요. 약 3분 정도 걸립니다.
- 생성 경로: openai / deterministic_metadata_normalization
- 모델·repair·fallback: 1 / 0 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / 없음
- 자동 판정: pass
- 수동 판정: accepted — 자동 판정과 수동 감사 결과가 일치함.
- requestId: reg-v1-fronted-clear-001-be2794fa
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 38742ms

### 최종 문항

1. 최근 한 달 동안 별마루 카페의 새 메뉴를 먹거나 마셔 본 적이 있나요? (single) — 있어요 / 없어요
2. 최근 한 달 동안 별마루 카페의 새 메뉴를 얼마나 자주 먹거나 마셨나요? (single) — 1회 / 2~3회 / 4~5회 / 6회 이상 / 먹거나 마신 적 없음
3. 별마루 카페의 새 메뉴를 선택한 이유는 무엇이었나요? (multiple) — 맛이 궁금해서 / 새로 나온 메뉴라서 / 가격이 괜찮아 보여서 / 주변 사람의 추천을 받아서 / 기존 메뉴 대신 먹거나 마셔 보고 싶어서 / 기타
4. 별마루 카페의 새 메뉴에 전반적으로 얼마나 만족했나요? (scale)
5. 새 메뉴를 먹거나 마시면서 아쉬웠던 점이 있었나요? (multiple) — 맛이 기대와 달랐어요 / 가격이 부담스러웠어요 / 양이 적거나 많게 느껴졌어요 / 메뉴를 고르거나 주문하기 어려웠어요 / 기대했던 메뉴와 다르게 느껴졌어요 / 아쉬운 점이 없었어요 / 기타
6. 새 메뉴에서 가장 먼저 개선됐으면 하는 점은 무엇인가요? (single) — 맛 / 가격 / 양 / 메뉴 안내와 주문 과정 / 개선할 점이 없어요 / 기타
7. 앞으로 별마루 카페의 새 메뉴를 다시 선택할 가능성은 어느 정도인가요? (scale)

## fronted-clear-002

- 입력: 새 기능 만족도는 다온 앱을 최근 3개월 사용한 대학생에게 조사
- 입력 품질 / 기대 결과: clear / survey
- 기대 응답 대상: 최근 3개월 다온 앱을 사용한 대학생
- 기대 적격 조건: 최근 3개월 다온 앱 사용
- 맥락 엔터티: 다온 앱
- 기대 조사 대상: 다온 앱의 새 기능
- 기대 목적 / 필수 문항 개념: 새 기능 만족도 / 만족도
- 실제 respondentGroup: null
- 실제 evaluationTarget: null
- 실제 제목: null
- 실제 설명: null
- 생성 경로: semantic_validation_fallback / request_failure
- 모델·repair·fallback: 1 / 1 / 1
- modelOutputRejected: true
- errorCode / errorStage / 최초 실패 단계: REPAIR_EXHAUSTED / repair-validation / repair-validation
- 자동 판정: fail (REQUEST_FAILURE, ELIGIBILITY_CHECK_MISSING, REQUIRED_PURPOSE_MISSING, REQUIRED_QUESTION_CONCEPT_MISSING, OVERALL_SATISFACTION_MISSING, QUESTION_COUNT_MISMATCH)
- 수동 판정: true_product_failure — 응답 대상·적격 조건 표기와 만족도 coverage를 복구하지 못하고 422로 종료됨.
- requestId: reg-v1-fronted-clear-002-1ab93226
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 37974ms

### 최종 문항

- 반환된 최종 문항 없음

## fronted-clear-003

- 입력: 프로그램 만족도는 늘봄센터 프로그램에 이번 학기 참여한 학부모에게 조사
- 입력 품질 / 기대 결과: clear / survey
- 기대 응답 대상: 이번 학기 늘봄센터 프로그램에 참여한 학부모
- 기대 적격 조건: 이번 학기 늘봄센터 프로그램 참여
- 맥락 엔터티: 늘봄센터 프로그램
- 기대 조사 대상: 늘봄센터 프로그램
- 기대 목적 / 필수 문항 개념: 프로그램 만족도 / 만족도
- 실제 respondentGroup: 이번 학기 늘봄센터 프로그램을 참여한 학부모
- 실제 evaluationTarget: 늘봄센터 프로그램
- 실제 제목: 이번 학기 늘봄센터 프로그램을 참여한 학부모의 실제 경험 여부·전반적 만족도 조사
- 실제 설명: 이번 학기 늘봄센터 프로그램을 참여한 학부모의 늘봄센터 프로그램 경험과 만족도, 개선 요구를 파악하기 위한 설문입니다.
- 생성 경로: openai_question_validation_fallback / hard_fallback
- 모델·repair·fallback: 1 / 0 / 1
- modelOutputRejected: true
- errorCode / errorStage / 최초 실패 단계: null / null / question-validation (generationSource 근거, 정확한 code는 artifact에 없음)
- 자동 판정: fail (HARD_FALLBACK, SCHEMA_ISSUES)
- 수동 판정: true_product_failure — hard fallback screener가 프로그램 참여 조건 대신 인구 집단 존재 여부를 물어 비문이 됨.
- requestId: reg-v1-fronted-clear-003-31a0f9cf
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 22627ms

### 최종 문항

1. 이번 학기 늘봄센터 프로그램을 참여한 학부모이 있나요? (single) — 경험 있음 / 경험 없음
2. 늘봄센터 프로그램에 전반적으로 얼마나 만족하나요? (scale)
3. 늘봄센터 프로그램에서 만족한 부분을 모두 골라주세요. (multiple) — 내용과 품질 / 이용 편의 / 시간과 일정 / 정보와 안내 / 비용 대비 가치 / 소통과 지원 / 기타
4. 늘봄센터 프로그램에서 불편했던 점을 모두 골라주세요. (multiple) — 이용 절차 / 시간과 일정 / 정보 부족 / 품질 편차 / 비용 부담 / 소통 부족 / 불편한 점 없음 / 기타
5. 늘봄센터 프로그램이 기대한 수준에 얼마나 가까웠나요? (scale)
6. 늘봄센터 프로그램에서 가장 먼저 개선되어야 할 부분은 무엇인가요? (single) — 내용과 품질 / 이용 편의 / 시간과 일정 / 정보와 안내 / 비용 / 소통과 지원
7. 늘봄센터 프로그램에 대해 추가로 전하고 싶은 의견이 있다면 적어주세요. (text)

## fronted-clear-004

- 입력: 신제품 만족도는 해든 매장에서 최근 한 달 구매한 고객에게 조사
- 입력 품질 / 기대 결과: clear / survey
- 기대 응답 대상: 최근 한 달 해든 매장에서 구매한 고객
- 기대 적격 조건: 최근 한 달 해든 매장 구매
- 맥락 엔터티: 해든 매장
- 기대 조사 대상: 신제품
- 기대 목적 / 필수 문항 개념: 신제품 만족도 / 만족도
- 실제 respondentGroup: 최근 한 달 해든 매장을 구매한 고객
- 실제 evaluationTarget: 신제품
- 실제 제목: 신제품 만족도는 해든 매장에서 최근 한 달 구매한 고객에게 조사
- 실제 설명: 최근 한 달 해든 매장을 구매한 고객의 신제품 경험과 만족도, 개선 요구를 파악하기 위한 설문입니다.
- 생성 경로: openai_question_validation_fallback / hard_fallback
- 모델·repair·fallback: 1 / 0 / 1
- modelOutputRejected: true
- errorCode / errorStage / 최초 실패 단계: null / null / question-validation (generationSource 근거, 정확한 code는 artifact에 없음)
- 자동 판정: fail (HARD_FALLBACK, SCHEMA_ISSUES)
- 수동 판정: true_product_failure — 매장 맥락과 구매 행동을 결합해 ‘매장을 구매한 고객’으로 응답 대상을 왜곡함.
- requestId: reg-v1-fronted-clear-004-646dc71a
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 24988ms

### 최종 문항

1. 해당 신제품을 직접 구매하거나 먹어본 경험이 있나요? (single) — 경험 있음 / 경험 없음
2. 신제품에 전반적으로 얼마나 만족하나요? (scale)
3. 신제품에서 만족한 부분을 모두 골라주세요. (multiple) — 내용과 품질 / 이용 편의 / 시간과 일정 / 정보와 안내 / 비용 대비 가치 / 소통과 지원 / 기타
4. 신제품에서 불편했던 점을 모두 골라주세요. (multiple) — 이용 절차 / 시간과 일정 / 정보 부족 / 품질 편차 / 비용 부담 / 소통 부족 / 불편한 점 없음 / 기타
5. 신제품이 기대한 수준에 얼마나 가까웠나요? (scale)
6. 신제품에서 가장 먼저 개선되어야 할 부분은 무엇인가요? (single) — 내용과 품질 / 이용 편의 / 시간과 일정 / 정보와 안내 / 비용 / 소통과 지원
7. 신제품에 대해 추가로 전하고 싶은 의견이 있다면 적어주세요. (text)

## fronted-clear-005

- 입력: 서비스 비이용 이유는 다온 플랫폼을 사용하지 않는 직장인에게 조사
- 입력 품질 / 기대 결과: clear / survey
- 기대 응답 대상: 다온 플랫폼을 사용하지 않는 직장인
- 기대 적격 조건: 다온 플랫폼 비이용
- 맥락 엔터티: 다온 플랫폼
- 기대 조사 대상: 다온 플랫폼
- 기대 목적 / 필수 문항 개념: 비이용 이유 / 비이용 이유
- 실제 respondentGroup: 다온 플랫폼을 사용하지 않는 직장인
- 실제 evaluationTarget: 다온 플랫폼
- 실제 제목: 다온 플랫폼을 사용하지 않는 직장인의 비이용 이유 조사
- 실제 설명: 다온 플랫폼을 현재 사용하지 않는 직장인을 대상으로, 사용하지 않는 이유와 앞으로 이용을 고려할 조건을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다.
- 생성 경로: openai / deterministic_metadata_normalization
- 모델·repair·fallback: 1 / 0 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / 없음
- 자동 판정: pass
- 수동 판정: accepted — 자동 판정과 수동 감사 결과가 일치함.
- requestId: reg-v1-fronted-clear-005-e08e4f69
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 25859ms

### 최종 문항

1. 현재 직장에 다니고 있으며, 다온 플랫폼을 사용하지 않고 있나요? (single) — 네, 직장에 다니고 있고 사용하지 않습니다 / 아니요, 다온 플랫폼을 사용하고 있습니다 / 아니요, 현재 직장에 다니고 있지 않습니다
2. 다온 플랫폼에 대해 어느 정도 알고 있었나요? (single) — 처음 들어봤습니다 / 이름만 들어봤습니다 / 대략 무엇을 하는 플랫폼인지 알고 있습니다 / 자세히 알고 있습니다
3. 다온 플랫폼을 사용하지 않는 이유를 모두 골라주세요 (multiple) — 플랫폼이 있는지 몰랐습니다 / 어떤 도움을 받을 수 있는지 잘 모르겠습니다 / 지금 사용하는 다른 방법이나 서비스로 충분합니다 / 나에게 필요한 플랫폼인지 확신이 없습니다 / 가입하거나 시작하는 과정이 번거로울 것 같습니다 / 개인정보나 정보 보안이 걱정됩니다 / 사용할 시간이 부족합니다 / 기타
4. 사용하지 않는 데 가장 큰 영향을 준 이유는 무엇인가요? (single) — 플랫폼이 있는지 몰랐습니다 / 어떤 도움을 받을 수 있는지 잘 모르겠습니다 / 지금 사용하는 다른 방법이나 서비스로 충분합니다 / 나에게 필요한 플랫폼인지 확신이 없습니다 / 가입하거나 시작하는 과정이 번거로울 것 같습니다 / 개인정보나 정보 보안이 걱정됩니다 / 사용할 시간이 부족합니다 / 기타
5. 어떤 조건이 갖춰지면 다온 플랫폼을 이용해 볼 수 있나요? (multiple) — 플랫폼이 제공하는 내용과 활용 방법을 쉽게 알 수 있다면 / 나의 업무나 상황에 도움이 된다는 점이 분명하다면 / 가입과 시작 과정이 간단하다면 / 개인정보와 보안이 충분히 신뢰된다면 / 기존에 쓰는 방법이나 서비스보다 더 나은 점이 있다면 / 짧은 시간에도 쉽게 사용할 수 있다면 / 이용할 생각이 없습니다 / 기타
6. 앞으로 다온 플랫폼을 이용해 볼 가능성은 어느 정도인가요? (scale)
7. 다온 플랫폼을 이용하지 않는 이유나, 이용하려면 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-clear-006

- 입력: 시설 인식은 늘빛 체육관을 최근 두 달 이용한 주민에게 조사
- 입력 품질 / 기대 결과: clear / survey
- 기대 응답 대상: 최근 두 달 늘빛 체육관을 이용한 주민
- 기대 적격 조건: 최근 두 달 늘빛 체육관 이용
- 맥락 엔터티: 늘빛 체육관
- 기대 조사 대상: 늘빛 체육관
- 기대 목적 / 필수 문항 개념: 시설 인식 / 인식
- 실제 respondentGroup: null
- 실제 evaluationTarget: null
- 실제 제목: null
- 실제 설명: null
- 생성 경로: semantic_validation_fallback / request_failure
- 모델·repair·fallback: 1 / 1 / 1
- modelOutputRejected: true
- errorCode / errorStage / 최초 실패 단계: REPAIR_EXHAUSTED / repair-validation / repair-validation
- 자동 판정: fail (REQUEST_FAILURE, ELIGIBILITY_CHECK_MISSING, REQUIRED_PURPOSE_MISSING, REQUIRED_QUESTION_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH)
- 수동 판정: true_product_failure — 빈도 문항의 사용자 명시 기간이 repair-validation에서 사라져 422로 종료됨.
- requestId: reg-v1-fronted-clear-006-d5763f89
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 40706ms

### 최종 문항

- 반환된 최종 문항 없음

## fronted-clear-007

- 입력: 요금제 만족도는 온새미 플랫폼을 지난 6개월 사용한 직장인에게 조사
- 입력 품질 / 기대 결과: clear / survey
- 기대 응답 대상: 지난 6개월 온새미 플랫폼을 사용한 직장인
- 기대 적격 조건: 지난 6개월 온새미 플랫폼 사용
- 맥락 엔터티: 온새미 플랫폼
- 기대 조사 대상: 온새미 플랫폼의 요금제
- 기대 목적 / 필수 문항 개념: 요금제 만족도 / 만족도
- 실제 respondentGroup: 지난 6개월 온새미 플랫폼을 사용한 직장인
- 실제 evaluationTarget: 요금제
- 실제 제목: 온새미 플랫폼 요금제 만족도 조사
- 실제 설명: 지난 6개월 동안 온새미 플랫폼을 사용한 직장인을 대상으로 요금제에 대한 의견을 알아보기 위한 설문입니다. 약 2분 정도 걸립니다.
- 생성 경로: openai / deterministic_metadata_normalization
- 모델·repair·fallback: 1 / 0 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / evaluator survey-object coverage
- 자동 판정: fail (SURVEY_OBJECT_MISMATCH)
- 수동 판정: evaluator_false_positive — 질문은 플랫폼·요금제·만족도를 모두 측정하지만 object metadata가 ‘요금제’로 축약되어 evaluator가 오탐함.
- requestId: reg-v1-fronted-clear-007-dbe4853c
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 36547ms

### 최종 문항

1. 지난 6개월 동안 온새미 플랫폼을 사용한 적이 있나요? (single) — 있음 / 없음
2. 온새미 플랫폼을 사용했을 당시 직장인이었나요? (single) — 예 / 아니요
3. 지난 6개월 동안 온새미 플랫폼을 얼마나 자주 사용했나요? (single) — 1회 / 2~5회 / 6~11회 / 12~23회 / 24회 이상
4. 지난 6개월 동안 어떤 요금제를 사용했나요? (single) — 무료 요금제만 사용함 / 유료 요금제만 사용함 / 무료와 유료 요금제를 모두 사용함 / 기억나지 않음
5. 온새미 플랫폼 요금제에 전반적으로 얼마나 만족했나요? (scale)
6. 온새미 플랫폼의 요금 수준에 얼마나 만족했나요? (scale)
7. 온새미 플랫폼 요금제에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-clear-008

- 입력: 축제 만족도는 봄빛 축제에 지난 주 참여한 청년에게 조사
- 입력 품질 / 기대 결과: clear / survey
- 기대 응답 대상: 지난 주 봄빛 축제에 참여한 청년
- 기대 적격 조건: 지난 주 봄빛 축제 참여
- 맥락 엔터티: 봄빛 축제
- 기대 조사 대상: 봄빛 축제
- 기대 목적 / 필수 문항 개념: 축제 만족도 / 만족도
- 실제 respondentGroup: 지난 주 봄빛 축제를 참여한 청년
- 실제 evaluationTarget: 봄빛 축제
- 실제 제목: 지난주 봄빛 축제 참여 청년 만족도 조사
- 실제 설명: 지난주 봄빛 축제에 참여한 청년의 경험을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다.
- 생성 경로: openai / deterministic_metadata_normalization
- 모델·repair·fallback: 1 / 0 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / 없음
- 자동 판정: pass
- 수동 판정: accepted — 자동 판정과 수동 감사 결과가 일치함.
- requestId: reg-v1-fronted-clear-008-964864ba
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 31503ms

### 최종 문항

1. 지난주에 봄빛 축제에 참여했나요? (single) — 참여했음 / 참여하지 않았음
2. 지난주 봄빛 축제에 며칠 참여했나요? (single) — 1일 / 2일 / 3일 이상 / 기억나지 않음
3. 봄빛 축제 전반에 얼마나 만족했나요? (scale)
4. 축제 현장에서 필요한 정보를 찾기 쉬웠나요? (scale)
5. 축제에 참여하는 과정은 얼마나 편리했나요? (scale)
6. 축제에 참여하면서 불편했던 점이 있다면 모두 골라주세요 (multiple) — 행사 정보를 찾기 어려웠음 / 이동하거나 참여하기 불편했음 / 대기 시간이 길었음 / 참여하고 싶은 활동을 찾기 어려웠음 / 기타 / 불편했던 점이 없었음
7. 봄빛 축제에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-control-001

- 입력: 새봄대학교 학생의 별마루 카페 이용 경험과 불편
- 입력 품질 / 기대 결과: clear / survey
- 기대 응답 대상: 새봄대학교 학생
- 기대 적격 조건: 없음
- 맥락 엔터티: 없음
- 기대 조사 대상: 별마루 카페
- 기대 목적 / 필수 문항 개념: 이용 경험 | 불편 / 이용 경험 | 불편
- 실제 respondentGroup: 별마루 카페를 이용하거나 방문한 새봄대학교 재학생
- 실제 evaluationTarget: 별마루 카페
- 실제 제목: 새봄대학교 학생의 별마루 카페 이용 경험 조사
- 실제 설명: 별마루 카페를 이용하거나 방문한 새봄대학교 재학생을 대상으로, 별마루 카페를 이용하거나 방문한 경험을 바탕으로 답해주세요. 응답 결과는 이용 경험과 개선이 필요한 점을 파악하는 데 활용됩니다. 약 3분 정도 걸립니다.
- 생성 경로: openai_partial_repair / partial_repair
- 모델·repair·fallback: 1 / 1 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / partial-repair (generationSource 근거)
- 자동 판정: fail (TARGET_POPULATION_MISMATCH, REQUIRED_QUESTION_CONCEPT_MISSING)
- 수동 판정: true_product_failure — 전체 학생을 카페 이용자로 축소하고 이용 여부 확인 문항을 누락함.
- requestId: reg-v1-fronted-control-001-fe8e7993
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 26914ms

### 최종 문항

1. 현재 대학교 또는 대학원에 재학하거나 휴학 중이신가요? (single) — 재학 중 / 휴학 중 / 졸업 또는 수료 / 해당하지 않음
2. 별마루 카페를 주로 어떤 목적으로 이용하나요? (multiple) — 음료나 음식을 구매하려고 / 공부하거나 과제를 하려고 / 쉬거나 시간을 보내려고 / 친구나 지인과 만나려고 / 수업이나 일정 사이에 잠시 들르려고 / 기타
3. 별마루 카페를 전반적으로 얼마나 만족했나요? (scale)
4. 별마루 카페를 이용하면서 불편했던 점이 있나요? (multiple) — 좌석을 이용하기 어려웠음 / 주문하거나 받는 데 시간이 오래 걸렸음 / 가격이 부담스러웠음 / 매장 환경이 불편했음 / 원하는 메뉴나 상품을 고르기 어려웠음 / 기타 / 불편했던 점이 없었음
5. 별마루 카페에서 가장 먼저 개선됐으면 하는 점은 무엇인가요? (multiple) — 좌석과 공간 이용 환경 / 주문과 수령 과정 / 가격 수준 / 메뉴나 상품 구성 / 매장 청결과 쾌적함 / 기타 / 개선이 필요하지 않음
6. 앞으로 별마루 카페를 다시 이용할 가능성은 어느 정도인가요? (scale)
7. 별마루 카페에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-control-002

- 입력: 별마루 카페 이용자의 카페 전체 만족도
- 입력 품질 / 기대 결과: clear / survey
- 기대 응답 대상: 별마루 카페 이용자
- 기대 적격 조건: 없음
- 맥락 엔터티: 없음
- 기대 조사 대상: 별마루 카페 | 카페 전체
- 기대 목적 / 필수 문항 개념: 카페 전체 만족도 / 만족도
- 실제 respondentGroup: 별마루 카페 이용자
- 실제 evaluationTarget: 카페 전체
- 실제 제목: 별마루 카페 전체 만족도 조사
- 실제 설명: 별마루 카페를 이용해 본 분들의 의견을 듣고자 합니다. 응답은 카페 경험을 살피고 개선 방향을 정하는 데 활용됩니다. 약 3분 정도 걸립니다.
- 생성 경로: openai_partial_repair / partial_repair
- 모델·repair·fallback: 1 / 1 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / 없음
- 자동 판정: pass
- 수동 판정: accepted — 자동 판정과 수동 감사 결과가 일치함.
- requestId: reg-v1-fronted-control-002-46f48b09
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 23996ms

### 최종 문항

1. 최근 한 달 동안 별마루 카페를 얼마나 자주 방문하나요? (single) — 처음 방문했음 / 가끔 방문함 / 한 달에 1~3회 방문함 / 일주일에 1회 방문함 / 일주일에 2회 이상 방문함
2. 별마루 카페에는 주로 어떤 목적으로 방문하나요? (multiple) — 음료나 음식을 먹기 위해 / 혼자 쉬거나 시간을 보내기 위해 / 공부하거나 일을 하기 위해 / 다른 사람을 만나기 위해 / 이동 중 잠시 들르기 위해 / 기타
3. 별마루 카페 전체 경험에 얼마나 만족하나요? (scale)
4. 카페를 이용하는 과정은 얼마나 편리했나요? (scale)
5. 카페 공간에서 머무는 경험은 얼마나 만족스러웠나요? (scale)
6. 별마루 카페에서 가장 먼저 개선됐으면 하는 부분은 무엇인가요? (multiple) — 음료나 음식의 품질 / 가격 수준 / 주문하거나 받는 과정 / 좌석과 공간 환경 / 직원 응대 / 특별히 개선할 부분이 없음 / 기타
7. 별마루 카페에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-control-003

- 입력: 별마루 카페 새 메뉴와 기존 메뉴 이용자의 만족도 비교
- 입력 품질 / 기대 결과: clear / survey
- 기대 응답 대상: 새 메뉴와 기존 메뉴 이용자
- 기대 적격 조건: 없음
- 맥락 엔터티: 없음
- 기대 조사 대상: 별마루 카페 새 메뉴 | 기존 메뉴
- 기대 목적 / 필수 문항 개념: 만족도 비교 / 만족도 | 대상 비교
- 실제 respondentGroup: 별마루 카페 새 메뉴와 기존 메뉴 이용자
- 실제 evaluationTarget: 별마루 카페 새 메뉴·기존 메뉴
- 실제 제목: 별마루 카페 새 메뉴와 기존 메뉴 만족도 조사
- 실제 설명: 별마루 카페 새 메뉴와 기존 메뉴 이용자를 대상으로, 별마루 카페의 새 메뉴와 기존 메뉴를 모두 먹어 본 경험을 바탕으로 답해주세요. 응답은 메뉴 만족도를 비교하고 개선점을 살펴보는 데 활용됩니다. 약 3분 정도 걸립니다.
- 생성 경로: openai_partial_repair / partial_repair
- 모델·repair·fallback: 1 / 1 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / evaluator comparison coverage
- 자동 판정: fail (REQUIRED_QUESTION_CONCEPT_MISSING)
- 수동 판정: evaluator_false_positive — 두 메뉴의 경험·빈도·만족도를 각각 측정하고 더 만족한 메뉴의 이유까지 묻지만 비교 표현 matcher가 이를 놓침.
- requestId: reg-v1-fronted-control-003-6829142b
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 22184ms

### 최종 문항

1. 별마루 카페의 새 메뉴와 기존 메뉴를 모두 먹어 본 적이 있나요? (single) — 새 메뉴와 기존 메뉴를 모두 먹어 봄 / 새 메뉴만 먹어 봄 / 기존 메뉴만 먹어 봄 / 둘 다 먹어 본 적 없음
2. 최근 한 달 동안 새 메뉴를 얼마나 자주 주문하나요? (single) — 처음 주문해 봄 / 가끔 주문함 / 자주 주문함 / 주문한 적 없음
3. 최근 한 달 동안 기존 메뉴를 얼마나 자주 주문하나요? (single) — 처음 주문해 봄 / 가끔 주문함 / 자주 주문함 / 주문한 적 없음
4. 새 메뉴에 전반적으로 얼마나 만족했나요? (scale)
5. 기존 메뉴에 전반적으로 얼마나 만족했나요? (scale)
6. 더 만족한 메뉴 유형을 고른 가장 큰 이유는 무엇인가요? (multiple) — 맛이 더 좋았음 / 가격이 더 적절했음 / 메뉴 구성이 더 마음에 들었음 / 주문하고 받는 과정이 더 편했음 / 특별히 더 만족한 메뉴 유형은 없었음 / 기타
7. 새 메뉴나 기존 메뉴에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-noisy-001

- 입력: 새 메뉴 만족도는 별마루 카페를 최근 한 달 이용한 주민한테 조사
- 입력 품질 / 기대 결과: noisy_recoverable / survey
- 기대 응답 대상: 최근 한 달 별마루 카페를 이용한 주민
- 기대 적격 조건: 최근 한 달 별마루 카페 이용
- 맥락 엔터티: 별마루 카페
- 기대 조사 대상: 별마루 카페의 새 메뉴
- 기대 목적 / 필수 문항 개념: 새 메뉴 만족도 / 만족도
- 실제 respondentGroup: 최근 한 달 별마루 카페를 이용한 주민
- 실제 evaluationTarget: 별마루 카페의 새 메뉴
- 실제 제목: 별마루 카페 새 메뉴 만족도 조사
- 실제 설명: 최근 한 달 별마루 카페를 이용한 주민을 대상으로 새 메뉴에 대한 의견을 듣고자 합니다. 약 3분 정도 걸립니다.
- 생성 경로: openai_partial_repair / partial_repair
- 모델·repair·fallback: 1 / 1 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / partial-repair (generationSource 근거)
- 자동 판정: fail (OVERALL_SATISFACTION_MISSING)
- 수동 판정: true_product_failure — 만족도 측정을 ‘어땠나요’로 약화해 전반적 만족도를 직접 측정하지 않음.
- requestId: reg-v1-fronted-noisy-001-325b1c2b
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 38168ms

### 최종 문항

1. 최근 한 달 안에 별마루 카페를 이용한 적이 있나요? (single) — 있음 / 없음
2. 별마루 카페에 새 메뉴가 나왔다는 것을 알고 있었나요? (single) — 알고 있었음 / 이번에 처음 알았음 / 잘 기억나지 않음
3. 최근 한 달 동안 별마루 카페의 새 메뉴를 먹어 본 적이 있나요? (single) — 있음 / 없음 / 잘 기억나지 않음
4. 최근 한 달 동안 별마루 카페를 얼마나 자주 이용했나요? (single) — 1회 / 2~3회 / 4~7회 / 8회 이상 / 이용하지 않았음
5. 먹어 본 별마루 카페의 새 메뉴는 전반적으로 어땠나요? (single) — 매우 만족스러웠음 / 만족스러운 편이었음 / 보통이었음 / 만족스럽지 않은 편이었음 / 전혀 만족스럽지 않았음 / 새 메뉴를 먹어 보지 않았음 / 잘 기억나지 않음
6. 새 메뉴에서 가장 먼저 개선됐으면 하는 점을 골라주세요 (multiple) — 맛 / 가격 / 양 / 메뉴 구성 / 메뉴 안내 방식 / 기타 / 개선할 점이 없음 / 새 메뉴를 먹어 보지 않았음
7. 새 메뉴에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-noisy-002

- 입력: 새 기능 만족도는 다온 앱 최근 3개월 쓴 대학생한테 조사
- 입력 품질 / 기대 결과: noisy_recoverable / survey
- 기대 응답 대상: 최근 3개월 다온 앱을 쓴 대학생
- 기대 적격 조건: 최근 3개월 다온 앱 사용
- 맥락 엔터티: 다온 앱
- 기대 조사 대상: 다온 앱의 새 기능
- 기대 목적 / 필수 문항 개념: 새 기능 만족도 / 만족도
- 실제 respondentGroup: 최근 3개월 다온 앱을 쓴 대학생
- 실제 evaluationTarget: 다온 앱의 새 기능
- 실제 제목: 새 기능 만족도는 다온 앱 최근 3개월 쓴 대학생한테 조사
- 실제 설명: 최근 3개월 다온 앱을 쓴 대학생의 다온 앱의 새 기능 경험과 만족도, 개선 요구를 파악하기 위한 설문입니다.
- 생성 경로: semantic_validation_fallback / hard_fallback
- 모델·repair·fallback: 1 / 1 / 1
- modelOutputRejected: true
- errorCode / errorStage / 최초 실패 단계: null / null / semantic-validation (generationSource 근거)
- 자동 판정: fail (HARD_FALLBACK)
- 수동 판정: true_product_failure — 최근 앱 사용 조건 대신 ‘대학생이 있나요’ 형태의 잘못된 screener를 생성함.
- requestId: reg-v1-fronted-noisy-002-7964a082
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 38802ms

### 최종 문항

1. 최근 3개월 다온 앱을 쓴 대학생이 있나요? (single) — 경험 있음 / 경험 없음
2. 다온 앱의 새 기능에 전반적으로 얼마나 만족하나요? (scale)
3. 다온 앱의 새 기능에서 만족한 부분을 모두 골라주세요. (multiple) — 내용과 품질 / 이용 편의 / 시간과 일정 / 정보와 안내 / 비용 대비 가치 / 소통과 지원 / 기타
4. 다온 앱의 새 기능에서 불편했던 점을 모두 골라주세요. (multiple) — 이용 절차 / 시간과 일정 / 정보 부족 / 품질 편차 / 비용 부담 / 소통 부족 / 불편한 점 없음 / 기타
5. 다온 앱의 새 기능이 기대한 수준에 얼마나 가까웠나요? (scale)
6. 다온 앱의 새 기능에서 가장 먼저 개선되어야 할 부분은 무엇인가요? (single) — 내용과 품질 / 이용 편의 / 시간과 일정 / 정보와 안내 / 비용 / 소통과 지원
7. 다온 앱의 새 기능에 대해 추가로 전하고 싶은 의견이 있다면 적어주세요. (text)

## fronted-noisy-003

- 입력: 프로그램 만족도는 늘봄센터 프로그램 이번 학기 참여한 학부모한테 조사
- 입력 품질 / 기대 결과: noisy_recoverable / survey
- 기대 응답 대상: 이번 학기 늘봄센터 프로그램에 참여한 학부모
- 기대 적격 조건: 이번 학기 늘봄센터 프로그램 참여
- 맥락 엔터티: 늘봄센터 프로그램
- 기대 조사 대상: 늘봄센터 프로그램
- 기대 목적 / 필수 문항 개념: 프로그램 만족도 / 만족도
- 실제 respondentGroup: 이번 학기 늘봄센터 프로그램을 참여한 학부모
- 실제 evaluationTarget: 늘봄센터 프로그램
- 실제 제목: 늘봄센터 프로그램 만족도 조사
- 실제 설명: 이번 학기 늘봄센터 프로그램에 참여한 학부모님의 의견을 듣기 위한 설문입니다. 약 3분 정도 걸립니다.
- 생성 경로: openai / deterministic_metadata_normalization
- 모델·repair·fallback: 1 / 0 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / 없음
- 자동 판정: pass
- 수동 판정: accepted — 자동 판정과 수동 감사 결과가 일치함.
- requestId: reg-v1-fronted-noisy-003-42c27742
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 22862ms

### 최종 문항

1. 이번 학기에 자녀가 늘봄센터 프로그램에 참여했나요? (single) — 참여했음 / 참여하지 않았음
2. 이번 학기에 자녀가 늘봄센터 프로그램에 얼마나 자주 참여했나요? (single) — 1~2회 / 3~5회 / 6~10회 / 11회 이상 / 잘 기억나지 않음
3. 이번 학기 늘봄센터 프로그램에 전반적으로 얼마나 만족하셨나요? (scale)
4. 프로그램이 자녀에게 도움이 되었다고 느끼시나요? (scale)
5. 프로그램 안내를 확인하고 참여를 준비하는 과정은 어땠나요? (scale)
6. 늘봄센터 프로그램에서 가장 먼저 개선됐으면 하는 점을 골라주세요 (multiple) — 프로그램 내용 / 운영 시간 / 신청과 안내 방법 / 자녀별 프로그램 선택 폭 / 기타 / 개선할 점이 없음
7. 늘봄센터 프로그램에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-noisy-004

- 입력: 신제품 만족도는 해든 매장 최근 한 달 구매한 고객한테 조사
- 입력 품질 / 기대 결과: noisy_recoverable / survey
- 기대 응답 대상: 최근 한 달 해든 매장에서 구매한 고객
- 기대 적격 조건: 최근 한 달 해든 매장 구매
- 맥락 엔터티: 해든 매장
- 기대 조사 대상: 신제품
- 기대 목적 / 필수 문항 개념: 신제품 만족도 / 만족도
- 실제 respondentGroup: 최근 한 달 해든 매장을 구매한 고객
- 실제 evaluationTarget: 신제품
- 실제 제목: 해든 매장 신제품 만족도 조사
- 실제 설명: 최근 한 달 동안 해든 매장에서 신제품을 구매한 고객을 대상으로 구매 경험을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다.
- 생성 경로: openai / deterministic_metadata_normalization
- 모델·repair·fallback: 1 / 0 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / 없음
- 자동 판정: pass
- 수동 판정: accepted — 자동 판정과 수동 감사 결과가 일치함.
- requestId: reg-v1-fronted-noisy-004-f0851de6
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 27228ms

### 최종 문항

1. 최근 한 달 동안 해든 매장에서 신제품을 구매한 적이 있나요? (single) — 있음 / 없음 / 기억나지 않음
2. 최근 한 달 동안 해든 매장에서 신제품을 몇 번 구매했나요? (single) — 1회 / 2~3회 / 4~5회 / 6회 이상 / 구매한 적 없음 / 기억나지 않음
3. 신제품을 구매한 이유를 모두 골라주세요 (multiple) — 신제품이라 궁금해서 / 평소 구매하던 제품과 달라서 / 가격이나 혜택이 마음에 들어서 / 다른 사람의 추천을 받아서 / 매장에서 눈에 띄어서 / 기타 / 구매한 적 없음
4. 구매한 신제품에 전반적으로 얼마나 만족했나요? (scale)
5. 신제품을 구매하거나 사용하면서 불편했던 점이 있었다면 모두 골라주세요 (multiple) — 제품 정보를 이해하기 어려웠음 / 가격이 기대와 달랐음 / 제품 자체가 기대와 달랐음 / 구매 과정이 불편했음 / 기타 / 불편했던 점 없음 / 구매한 적 없음
6. 신제품에서 가장 먼저 개선됐으면 하는 점은 무엇인가요? (single) — 제품의 품질이나 구성 / 가격 / 제품 정보 안내 / 매장에서 구매하는 과정 / 개선할 점 없음 / 기타 / 구매한 적 없음
7. 앞으로 해든 매장에서 이 신제품을 다시 구매할 가능성은 어느 정도인가요? (scale)

## fronted-noisy-005

- 입력: 서비스 안 쓰는 이유는 다온 플랫폼 안 쓰는 직장인한테 조사
- 입력 품질 / 기대 결과: noisy_recoverable / survey
- 기대 응답 대상: 다온 플랫폼을 사용하지 않는 직장인 | 다온 플랫폼을 안 쓰는 직장인
- 기대 적격 조건: 다온 플랫폼 비이용
- 맥락 엔터티: 다온 플랫폼
- 기대 조사 대상: 다온 플랫폼
- 기대 목적 / 필수 문항 개념: 비이용 이유 / 비이용 이유
- 실제 respondentGroup: 다온 플랫폼을 안 쓰는 직장인
- 실제 evaluationTarget: 다온 플랫폼
- 실제 제목: 다온 플랫폼을 사용하지 않는 직장인 조사
- 실제 설명: 다온 플랫폼을 안 쓰는 직장인을 대상으로, 다온 플랫폼을 사용하지 않는 이유와 앞으로 이용을 고려하게 될 조건을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다.
- 생성 경로: openai / deterministic_metadata_normalization
- 모델·repair·fallback: 1 / 0 / 0
- modelOutputRejected: false
- errorCode / errorStage / 최초 실패 단계: null / null / 없음
- 자동 판정: pass
- 수동 판정: accepted — 자동 판정과 수동 감사 결과가 일치함.
- requestId: reg-v1-fronted-noisy-005-a9b28021
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 35819ms

### 최종 문항

1. 현재 직장에 다니고 있나요? (single) — 네, 현재 직장에 다니고 있습니다 / 아니요
2. 다온 플랫폼을 얼마나 알고 있었나요? (single) — 이름과 어떤 서비스인지 알고 있었습니다 / 이름만 들어봤습니다 / 이번 설문을 통해 처음 알았습니다
3. 다온 플랫폼을 사용하지 않는 이유를 모두 골라주세요 (multiple) — 나에게 필요한 서비스인지 잘 모르겠습니다 / 어떻게 시작해야 할지 모르겠습니다 / 기존에 쓰는 서비스로 충분합니다 / 사용할 시간이 부족합니다 / 개인정보나 보안이 걱정됩니다 / 서비스 품질이나 신뢰성이 확신되지 않습니다 / 사용할 필요를 느끼지 못합니다 / 기타
4. 가장 큰 이유 하나만 고른다면 무엇인가요? (single) — 나에게 필요한 서비스인지 잘 모르겠습니다 / 어떻게 시작해야 할지 모르겠습니다 / 기존에 쓰는 서비스로 충분합니다 / 사용할 시간이 부족합니다 / 개인정보나 보안이 걱정됩니다 / 서비스 품질이나 신뢰성이 확신되지 않습니다 / 사용할 필요를 느끼지 못합니다 / 기타
5. 어떤 점이 갖춰지면 다온 플랫폼을 써볼 만하다고 느낄까요? (multiple) — 나에게 어떤 도움이 되는지 쉽게 알 수 있는 안내 / 처음 시작하는 방법을 알려주는 안내 / 신뢰할 수 있는 정보와 운영 기준 / 개인정보 보호에 대한 분명한 설명 / 기존 서비스보다 분명한 장점 / 짧은 시간에도 쉽게 쓸 수 있는 구성 / 없습니다 / 기타
6. 앞으로 다온 플랫폼을 써볼 가능성은 어느 정도인가요? (scale)
7. 다온 플랫폼을 쓰지 않는 이유나 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-noisy-006

- 입력: 시설 인식은 늘빛 체육관 최근 두 달 이용한 주민한테 조사
- 입력 품질 / 기대 결과: noisy_recoverable / survey
- 기대 응답 대상: 최근 두 달 늘빛 체육관을 이용한 주민
- 기대 적격 조건: 최근 두 달 늘빛 체육관 이용
- 맥락 엔터티: 늘빛 체육관
- 기대 조사 대상: 늘빛 체육관
- 기대 목적 / 필수 문항 개념: 시설 인식 / 인식
- 실제 respondentGroup: null
- 실제 evaluationTarget: null
- 실제 제목: null
- 실제 설명: null
- 생성 경로: semantic_validation_fallback / request_failure
- 모델·repair·fallback: 1 / 1 / 1
- modelOutputRejected: true
- errorCode / errorStage / 최초 실패 단계: REPAIR_EXHAUSTED / repair-validation / repair-validation
- 자동 판정: fail (REQUEST_FAILURE, ELIGIBILITY_CHECK_MISSING, REQUIRED_PURPOSE_MISSING, REQUIRED_QUESTION_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH)
- 수동 판정: true_product_failure — 빈도 문항의 사용자 명시 기간이 repair-validation에서 사라져 422로 종료됨.
- requestId: reg-v1-fronted-noisy-006-c515a4be
- token usage (artifact): in 0, cached 0, out 0, total 0
- latency: 31787ms

### 최종 문항

- 반환된 최종 문항 없음
