# Fronted-purpose v2 before remediation

- 브랜치: codex/fix-survey-regression-root-causes-v1
- 기준 커밋: 4083eacb18794e2771aca80322d058e8f59940bc
- 실행: fronted-purpose-v2-20260819-222801-a1
- 완료: 20/20, 실제 모델 호출: 17, retry: 0
- 경로: clarification 3, deterministic_metadata_normalization 9, request_failure 2, partial_repair 3, hard_fallback 3
- evaluator false positive: 3
- Preview 로그 집계: input 295018, cached 15450, output 52612, total 347630, cost $1.491962
- 모델 quality_check 원문은 API 응답 artifact에 노출되지 않아 `not_exposed_in_response_artifact`로 명시함. 알려진 거절 필드는 같은 requestId의 Preview runtime log 근거만 기록함.
- 비밀값, Preview share token, Authorization, Cookie, 전체 developer prompt를 포함하지 않음.

## fronted-ambiguous-001

- 입력: 별마루 카페 새 메뉴 주민 조사
- requestId: c93d4a4a-d0e1-4751-a79f-0cb39d79a9c6
- HTTP / 응답: 200 / clarification / needs_clarification
- 생성 경로: clarification / clarification
- fallbackReason: null
- model / repair / fallback / retry: 0 / 0 / 0 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: 없음
- respondentGroup: null
- evaluationTarget: null
- 제목: null
- 설명: null
- latency: 262ms

### 최종 문항

- 반환된 최종 문항 없음

## fronted-ambiguous-002

- 입력: 다온 앱 새 기능 대학생 조사
- requestId: dbe984dd-f4ac-433b-ac5a-28698d472062
- HTTP / 응답: 200 / clarification / needs_clarification
- 생성 경로: clarification / clarification
- fallbackReason: null
- model / repair / fallback / retry: 0 / 0 / 0 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: 없음
- respondentGroup: null
- evaluationTarget: null
- 제목: null
- 설명: null
- latency: 236ms

### 최종 문항

- 반환된 최종 문항 없음

## fronted-ambiguous-003

- 입력: 늘봄센터 프로그램 학부모 조사
- requestId: cc19390a-d17b-4bf7-b39f-271f9ff7c3f8
- HTTP / 응답: 200 / clarification / needs_clarification
- 생성 경로: clarification / clarification
- fallbackReason: null
- model / repair / fallback / retry: 0 / 0 / 0 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: 없음
- respondentGroup: null
- evaluationTarget: null
- 제목: null
- 설명: null
- latency: 677ms

### 최종 문항

- 반환된 최종 문항 없음

## fronted-clear-001

- 입력: 최근 한 달 동안 별마루 카페를 이용한 주민을 대상으로 별마루 카페의 새 메뉴 만족도를 조사하고 싶다.
- requestId: 4bcf3e85-1324-4ced-9896-22b9e59674f4
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai / deterministic_metadata_normalization
- fallbackReason: null
- model / repair / fallback / retry: 1 / 0 / 0 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: 없음
- respondentGroup: 최근 한 달 동안 별마루 카페를 이용한 주민
- evaluationTarget: 별마루 카페의 새 메뉴
- 제목: 별마루 카페 새 메뉴 만족도 조사
- 설명: 최근 한 달 동안 별마루 카페를 이용한 주민을 대상으로 새 메뉴에 대한 의견을 듣고자 합니다. 새 메뉴를 먹어 본 경험을 떠올리며 답해주세요. 약 3분 정도 걸립니다.
- latency: 38595ms

### 최종 문항

1. 최근 한 달 동안 별마루 카페의 새 메뉴를 먹어 본 적이 있나요? (single) — 먹어 본 적 있음 / 먹어 본 적 없음 / 잘 기억나지 않음
2. 최근 한 달 동안 새 메뉴를 몇 번 주문했나요? (single) — 1회 / 2~3회 / 4~5회 / 6회 이상 / 먹어 본 적 없음 / 기억나지 않음
3. 새 메뉴를 주문한 이유는 무엇이었나요? (multiple) — 맛이 궁금해서 / 새로운 메뉴를 먹어 보고 싶어서 / 가격이 괜찮다고 느껴서 / 주변 사람의 추천을 받아서 / 기존에 먹던 메뉴가 없어서 또는 품절이어서 / 기타 / 새 메뉴를 먹어 본 적 없음
4. 새 메뉴에 전반적으로 얼마나 만족했나요? (scale)
5. 새 메뉴의 맛은 어땠나요? (single) — 매우 만족 / 만족하는 편 / 보통 / 만족하지 않는 편 / 전혀 만족하지 않음 / 새 메뉴를 먹어 본 적 없음
6. 새 메뉴에서 가장 먼저 개선됐으면 하는 점은 무엇인가요? (multiple) — 맛 / 가격 / 양 / 메뉴 구성 / 주문하거나 받는 과정 / 개선할 점 없음 / 기타 / 새 메뉴를 먹어 본 적 없음
7. 앞으로 별마루 카페의 새 메뉴를 다시 주문할 가능성은 어느 정도인가요? (scale)

## fronted-clear-002

- 입력: 새 기능 만족도는 다온 앱을 최근 3개월 사용한 대학생에게 조사
- requestId: 2159a21f-15be-4587-a8bb-06e450b63583
- HTTP / 응답: 422 / error / error
- 생성 경로: semantic_validation_fallback / request_failure
- fallbackReason: model-output-rejected
- model / repair / fallback / retry: 1 / 1 / 1 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 문항 3가 앞선 문항과 중복됩니다. | SEMANTIC_RELATION_INVALID: 사용자 입력에 없는 제품·서비스가 행동 대상으로 추가됨.
- fatal: REQUEST_FAILURE: 요청 실패: 422 | ELIGIBILITY_CHECK_MISSING: 응답 적격 조건을 확인하는 screening 문항이 없음 | REQUIRED_PURPOSE_MISSING: 필수 조사 목적 누락: 새 기능 만족도 | REQUIRED_QUESTION_CONCEPT_MISSING: 필수 문항 개념 누락: 만족도 | OVERALL_SATISFACTION_MISSING: 만족 요소만 묻고 전반적 만족도를 직접 측정하지 않음 | QUESTION_COUNT_MISMATCH: 문항 수 0/7
- respondentGroup: null
- evaluationTarget: null
- 제목: null
- 설명: null
- latency: 38596ms

### 최종 문항

- 반환된 최종 문항 없음

## fronted-clear-003

- 입력: 프로그램 만족도는 늘봄센터 프로그램에 이번 학기 참여한 학부모에게 조사
- requestId: 675d61b9-f818-421b-bfab-1dd5be47ce09
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai / deterministic_metadata_normalization
- fallbackReason: null
- model / repair / fallback / retry: 1 / 0 / 0 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: 없음
- respondentGroup: 이번 학기 늘봄센터 프로그램에 참여한 학부모
- evaluationTarget: 늘봄센터 프로그램
- 제목: 이번 학기 늘봄센터 프로그램 만족도 조사
- 설명: 이번 학기 늘봄센터 프로그램에 참여한 학부모님의 의견을 듣고자 합니다. 응답 내용은 프로그램 운영을 살피는 데 활용됩니다. 약 3분 정도 걸립니다.
- latency: 32743ms

### 최종 문항

1. 이번 학기에 자녀가 늘봄센터 프로그램에 참여했나요? (single) — 네, 참여했어요 / 아니요, 참여하지 않았어요
2. 이번 학기에 자녀가 늘봄센터 프로그램에 얼마나 자주 참여했나요? (single) — 1~2회 / 3~5회 / 6~10회 / 11회 이상 / 정확히 기억나지 않아요
3. 이번 학기 늘봄센터 프로그램에 전반적으로 얼마나 만족하셨나요? (scale)
4. 자녀가 프로그램에 참여하는 과정은 얼마나 편리했나요? (scale)
5. 프로그램 참여 중 불편했던 점이 있었다면 골라주세요 (multiple) — 참여 신청이나 안내를 확인하기 어려웠어요 / 시간이 맞지 않았어요 / 프로그램 내용이 기대와 달랐어요 / 자녀의 참여 과정에서 어려움이 있었어요 / 기타 / 불편했던 점이 없어요
6. 앞으로 가장 먼저 개선됐으면 하는 점은 무엇인가요? (single) — 프로그램 안내와 신청 방법 / 운영 시간 / 프로그램 내용 / 자녀가 참여하는 환경 / 기타 / 개선이 필요하지 않아요
7. 늘봄센터 프로그램에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-clear-004

- 입력: 신제품 만족도는 해든 매장에서 최근 한 달 구매한 고객에게 조사
- requestId: d7492793-3ee8-423c-9bd4-11773e221357
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai / deterministic_metadata_normalization
- fallbackReason: null
- model / repair / fallback / retry: 1 / 0 / 0 / 0
- evaluator false positive: true
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: OVERALL_SATISFACTION_MISSING: 만족 요소만 묻고 전반적 만족도를 직접 측정하지 않음
- respondentGroup: 최근 한 달 해든 매장에서 구매한 고객
- evaluationTarget: 신제품
- 제목: 해든 매장 신제품 만족도 조사
- 설명: 최근 한 달 안에 해든 매장에서 구매한 경험을 바탕으로 신제품에 대한 의견을 들려주세요. 약 2~3분 정도 걸립니다.
- latency: 37949ms

### 최종 문항

1. 최근 한 달 안에 해든 매장에서 구매한 적이 있나요? (single) — 있음 / 없음 / 기억나지 않음
2. 최근 한 달 동안 해든 매장에서 얼마나 자주 구매했나요? (single) — 1회 / 2~3회 / 4~5회 / 6회 이상 / 구매한 적 없음 / 기억나지 않음
3. 최근 한 달 안에 해든 매장에서 신제품을 구매해 본 적이 있나요? (single) — 구매했음 / 구매하지 않았음 / 기억나지 않음
4. 구매한 신제품에 전반적으로 얼마나 만족했나요? (single) — 매우 만족 / 만족하는 편 / 보통 / 만족하지 않는 편 / 전혀 만족하지 않음 / 구매하지 않아 평가하기 어려움
5. 신제품의 가격은 어떻게 느껴졌나요? (single) — 매우 만족 / 만족하는 편 / 보통 / 만족하지 않는 편 / 전혀 만족하지 않음 / 구매하지 않아 평가하기 어려움
6. 신제품 만족도에 가장 큰 영향을 준 것은 무엇인가요? (single) — 제품 자체의 품질 / 가격 / 제품의 구성이나 포장 / 매장 내 제품 안내 / 기타 / 구매하지 않아 답하기 어려움
7. 신제품에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-clear-005

- 입력: 서비스 비이용 이유는 다온 플랫폼을 사용하지 않는 직장인에게 조사
- requestId: ff621a4e-ff1f-47bf-a71a-095ae7535dfd
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai_partial_repair / partial_repair
- fallbackReason: null
- model / repair / fallback / retry: 1 / 1 / 0 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: 없음
- respondentGroup: 다온 플랫폼을 사용하지 않는 직장인
- evaluationTarget: 다온 플랫폼
- 제목: 다온 플랫폼 비이용 이유 조사
- 설명: 다온 플랫폼을 사용하지 않는 직장인이 사용하지 않는 이유와 이용을 고려할 조건을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다.
- latency: 31758ms

### 최종 문항

1. 현재 직장에 다니고 있나요? (single) — 예 / 아니요
2. 다온 플랫폼을 이용하지 않는 가장 큰 이유는 무엇인가요? (single) — 필요성을 느끼지 못함 / 이용 방법을 모름 / 접근하거나 시작하기 어려움 / 비용이나 조건이 부담됨 / 대체 수단을 이용함 / 신뢰하기 어려움 / 기타
3. 다온 플랫폼에 대해 얼마나 알고 있었나요? (single) — 이름도 들어본 적 없음 / 이름만 들어봄 / 어떤 플랫폼인지 대략 알고 있음 / 기능이나 이용 방법까지 알고 있음
4. 다온 플랫폼을 사용하지 않은 이유를 골라주세요 (multiple) — 다온 플랫폼을 잘 몰라서 / 나에게 필요한지 모르겠어서 / 기존에 쓰는 방법이나 서비스로 충분해서 / 사용 방법이 어려울 것 같아서 / 시간을 들여 시작할 필요성을 느끼지 못해서 / 개인정보나 보안이 걱정돼서 / 직장에서 사용하기 어려울 것 같아서 / 기타
5. 그중 가장 큰 이유는 무엇인가요? (single) — 다온 플랫폼을 잘 몰라서 / 나에게 필요한지 모르겠어서 / 기존에 쓰는 방법이나 서비스로 충분해서 / 사용 방법이 어려울 것 같아서 / 시간을 들여 시작할 필요성을 느끼지 못해서 / 개인정보나 보안이 걱정돼서 / 직장에서 사용하기 어려울 것 같아서 / 기타
6. 어떤 점이 갖춰지면 다온 플랫폼을 써볼 수 있을까요? (multiple) — 무엇을 할 수 있는지 쉽게 알 수 있는 안내 / 내 업무에 어떻게 도움이 되는지 보여주는 사례 / 쉽게 시작할 수 있는 사용 안내 / 개인정보와 보안에 대한 충분한 설명 / 직장에서 사용해도 된다는 확인 / 기존에 쓰는 방식보다 분명한 장점 / 어떤 조건이 있어도 사용하지 않을 것 같음 / 기타
7. 다온 플랫폼을 사용하지 않는 이유나 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-clear-006

- 입력: 시설 인식은 늘빛 체육관을 최근 두 달 이용한 주민에게 조사
- requestId: d9ddee8c-a15f-44e9-bfba-462a8391aec4
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai / deterministic_metadata_normalization
- fallbackReason: null
- model / repair / fallback / retry: 1 / 0 / 0 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: 없음
- respondentGroup: 최근 두 달 늘빛 체육관을 이용한 주민
- evaluationTarget: 늘빛 체육관
- 제목: 늘빛 체육관 이용자 인식 조사
- 설명: 최근 두 달 동안 늘빛 체육관을 이용한 주민의 의견을 듣고자 합니다. 설문은 약 3분 정도 걸립니다.
- latency: 22336ms

### 최종 문항

1. 최근 두 달 동안 늘빛 체육관을 이용해 본 적이 있나요? (single) — 이용한 적 있음 / 이용한 적 없음
2. 최근 두 달 동안 늘빛 체육관을 얼마나 자주 이용했나요? (single) — 1회 / 2~3회 / 월 2~3회 / 주 1회 / 주 2회 이상
3. 늘빛 체육관을 이용한 주된 이유는 무엇인가요? (multiple) — 운동하거나 체력을 관리하려고 / 가까워서 / 비용 부담이 적어서 / 지인과 함께 이용하려고 / 다른 운동 장소를 이용하기 어려워서 / 기타
4. 가장 최근 이용 경험을 기준으로, 늘빛 체육관에 대해 전반적으로 어떻게 느끼셨나요? (scale)
5. 가장 최근 이용하면서 좋게 느낀 점은 무엇인가요? (multiple) — 이용하기 편리했음 / 시설 환경이 쾌적했음 / 원하는 운동을 하기 좋았음 / 이용 비용이 적절했음 / 특별히 좋게 느낀 점은 없었음 / 기타
6. 늘빛 체육관에서 가장 먼저 개선됐으면 하는 점은 무엇인가요? (single) — 시설과 운동기구의 상태 / 청결과 위생 / 혼잡도와 이용 공간 / 이용 시간이나 운영 안내 / 이용 비용 / 특별히 개선할 점이 없음 / 기타
7. 앞으로 늘빛 체육관을 다시 이용할 가능성은 어느 정도인가요? (scale)

## fronted-clear-007

- 입력: 요금제 만족도는 온새미 플랫폼을 지난 6개월 사용한 직장인에게 조사
- requestId: e7f3dbfb-acae-48d9-a087-1c32f78e409b
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai_question_validation_fallback / hard_fallback
- fallbackReason: model-output-rejected
- model / repair / fallback / retry: 1 / 0 / 1 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 모델 self-report respondent_path_simulation_passed=false가 전체 설문 거절을 유발함.
- fatal: HARD_FALLBACK: 명확한 입력이 hard fallback으로 처리됨 | SCHEMA_ISSUES: custom, integrity.0
- respondentGroup: 지난 6개월 온새미 플랫폼을 사용한 직장인
- evaluationTarget: 요금제
- 제목: 요금제 만족도는 온새미 플랫폼을 지난 6개월 사용한 직장인에게 조사
- 설명: 지난 6개월 온새미 플랫폼을 사용한 직장인의 요금제 경험과 만족도, 개선 요구를 파악하기 위한 설문입니다.
- latency: 28838ms

### 최종 문항

1. 지난 6개월 동안 온새미 플랫폼을 사용한 적이 있나요? (single) — 경험 있음 / 경험 없음
2. 요금제에 전반적으로 얼마나 만족하나요? (scale)
3. 요금제에서 만족한 부분을 모두 골라주세요. (multiple) — 내용과 품질 / 이용 편의 / 시간과 일정 / 정보와 안내 / 비용 대비 가치 / 소통과 지원 / 기타
4. 요금제에서 불편했던 점을 모두 골라주세요. (multiple) — 이용 절차 / 시간과 일정 / 정보 부족 / 품질 편차 / 비용 부담 / 소통 부족 / 불편한 점 없음 / 기타
5. 요금제가 기대한 수준에 얼마나 가까웠나요? (scale)
6. 요금제에서 가장 먼저 개선되어야 할 부분은 무엇인가요? (single) — 내용과 품질 / 이용 편의 / 시간과 일정 / 정보와 안내 / 비용 / 소통과 지원
7. 요금제를 주변 사람에게 추천할 의향이 어느 정도인가요? (scale)

## fronted-clear-008

- 입력: 축제 만족도는 봄빛 축제에 지난 주 참여한 청년에게 조사
- requestId: 94c7efdb-bfe7-40e6-96ed-022500b1713c
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai_question_validation_fallback / hard_fallback
- fallbackReason: model-output-rejected
- model / repair / fallback / retry: 1 / 0 / 1 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 모델 self-report double_barreled_questions_removed=false가 전체 설문 거절을 유발함.
- fatal: HARD_FALLBACK: 명확한 입력이 hard fallback으로 처리됨 | SCHEMA_ISSUES: custom, integrity.0
- respondentGroup: 지난 주 봄빛 축제에 참여한 청년
- evaluationTarget: 봄빛 축제
- 제목: 지난 주 봄빛 축제에 참여한 청년의 실제 경험 여부·전반적 만족도 조사
- 설명: 지난 주 봄빛 축제에 참여한 청년의 봄빛 축제 경험과 만족도, 개선 요구를 파악하기 위한 설문입니다.
- latency: 22579ms

### 최종 문항

1. 지난 주 동안 봄빛 축제에 참여한 적이 있나요? (single) — 경험 있음 / 경험 없음
2. 봄빛 축제에 전반적으로 얼마나 만족하나요? (scale)
3. 봄빛 축제에서 만족한 부분을 모두 골라주세요. (multiple) — 내용과 품질 / 이용 편의 / 시간과 일정 / 정보와 안내 / 비용 대비 가치 / 소통과 지원 / 기타
4. 봄빛 축제에서 불편했던 점을 모두 골라주세요. (multiple) — 이용 절차 / 시간과 일정 / 정보 부족 / 품질 편차 / 비용 부담 / 소통 부족 / 불편한 점 없음 / 기타
5. 봄빛 축제가 기대한 수준에 얼마나 가까웠나요? (scale)
6. 봄빛 축제에서 가장 먼저 개선되어야 할 부분은 무엇인가요? (single) — 내용과 품질 / 이용 편의 / 시간과 일정 / 정보와 안내 / 비용 / 소통과 지원
7. 봄빛 축제를 주변 사람에게 추천할 의향이 어느 정도인가요? (scale)

## fronted-control-001

- 입력: 새봄대학교 학생의 별마루 카페 이용 경험과 불편
- requestId: aff0d3ec-49c7-40b1-b8a4-bd0c38cf859a
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: semantic_validation_fallback / hard_fallback
- fallbackReason: model-output-rejected
- model / repair / fallback / retry: 1 / 1 / 1 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 빈도 선택지 '한 학기에 1~2회'와 '한 달에 1~3회'가 서로 겹침.
- fatal: HARD_FALLBACK: 명확한 입력이 hard fallback으로 처리됨
- respondentGroup: 새봄대학교 재학생
- evaluationTarget: 별마루 카페
- 제목: 새봄대학교 학생의 별마루 카페 이용 현황 및 경험 조사
- 설명: 본 조사는 새봄대학교 학생의 별마루 카페 이용 행태와 서비스 경험을 파악하기 위한 조사입니다.
- latency: 36860ms

### 최종 문항

1. 별마루 카페를 이용한 적이 있나요? (single) — 예 / 아니요
2. 평소 별마루 카페를 얼마나 자주 이용하나요? (single) — 이용하지 않음 / 월 1회 / 월 2~3회 / 월 4~7회 / 월 8회 이상
3. 별마루 카페를 주로 어떤 목적으로 이용하나요? (multiple) — 수업·학습 / 과제·업무 / 정보 탐색 / 소통·협업 / 개인적인 용도 / 기타
4. 별마루 카페의 전반적인 이용 경험에 얼마나 만족하시나요? (scale)
5. 별마루 카페를 이용하면서 불편했던 점을 모두 골라주세요. (multiple) — 원하는 내용을 찾기 어려움 / 이용 절차가 복잡함 / 속도가 느리거나 불안정함 / 안내가 부족함 / 비용이 부담됨 / 특별한 불편 없음 / 기타
6. 앞으로도 별마루 카페를 계속 이용할 의향이 어느 정도인가요? (scale)
7. 별마루 카페 이용에서 가장 먼저 개선되었으면 하는 점을 적어주세요. (text)

## fronted-control-002

- 입력: 별마루 카페 이용자의 카페 전체 만족도
- requestId: 4a751b36-ca95-40bd-9f9c-09ebf98cff63
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai_partial_repair / partial_repair
- fallbackReason: null
- model / repair / fallback / retry: 1 / 1 / 0 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: 없음
- respondentGroup: 별마루 카페 이용자
- evaluationTarget: 카페 전체
- 제목: 별마루 카페 전반 만족도 조사
- 설명: 별마루 카페를 이용하며 느낀 점을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다.
- latency: 24107ms

### 최종 문항

1. 최근 한 달 동안 별마루 카페를 얼마나 자주 방문하나요? (single) — 처음 방문했음 / 가끔 방문함 / 한 달에 1~3회 방문함 / 일주일에 1회 방문함 / 일주일에 2회 이상 방문함
2. 별마루 카페에는 주로 어떤 이유로 방문하나요? (multiple) — 음료나 음식을 구매하려고 / 공부하거나 일을 하려고 / 휴식하거나 시간을 보내려고 / 사람을 만나려고 / 이동 중 잠시 들르려고 / 기타
3. 별마루 카페를 전반적으로 얼마나 만족했나요? (scale)
4. 가장 최근 방문에서 좋았던 점은 무엇이었나요? (multiple) — 음료나 음식의 맛 / 가격 수준 / 매장 분위기 / 좌석 이용의 편리함 / 직원의 응대 / 주문하거나 결제하는 과정 / 특별히 좋았던 점이 없었음 / 기타
5. 가장 최근 방문에서 불편했던 점은 무엇이었나요? (multiple) — 음료나 음식의 맛 / 가격 수준 / 매장 분위기 / 좌석 이용의 편리함 / 직원의 응대 / 주문하거나 결제하는 과정 / 특별히 불편했던 점이 없었음 / 기타
6. 별마루 카페에서 가장 먼저 개선됐으면 하는 점은 무엇인가요? (single) — 음료나 음식의 품질 / 가격 수준 / 매장 환경 / 좌석 이용의 편리함 / 주문·결제 과정 / 직원의 응대 / 개선이 필요한 점이 없음 / 기타
7. 앞으로 별마루 카페를 다시 방문할 가능성은 어느 정도인가요? (scale)

## fronted-control-003

- 입력: 별마루 카페 새 메뉴와 기존 메뉴 이용자의 만족도 비교
- requestId: 958f7f44-7fa8-4623-bb0d-4135fe0e6229
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai / deterministic_metadata_normalization
- fallbackReason: null
- model / repair / fallback / retry: 1 / 0 / 0 / 0
- evaluator false positive: true
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: OVERALL_SATISFACTION_MISSING: 만족 요소만 묻고 전반적 만족도를 직접 측정하지 않음
- respondentGroup: 별마루 카페 새 메뉴와 기존 메뉴 이용자
- evaluationTarget: 별마루 카페 새 메뉴·기존 메뉴
- 제목: 별마루 카페 새 메뉴와 기존 메뉴 만족도 조사
- 설명: 별마루 카페 새 메뉴와 기존 메뉴 이용자를 대상으로, 별마루 카페의 새 메뉴와 기존 메뉴에 대한 경험을 비교하기 위한 설문입니다. 약 2분 정도 걸립니다.
- latency: 38775ms

### 최종 문항

1. 별마루 카페에서 어떤 메뉴를 먹어 본 적이 있나요? (single) — 새 메뉴와 기존 메뉴를 모두 먹어 봄 / 새 메뉴만 먹어 봄 / 기존 메뉴만 먹어 봄 / 잘 기억나지 않음
2. 새 메뉴를 고를 때 중요하게 생각한 점을 모두 골라주세요 (multiple) — 맛이 궁금해서 / 새로운 메뉴를 먹어 보고 싶어서 / 가격이 괜찮아서 / 메뉴 구성이 마음에 들어서 / 주변의 추천을 받아서 / 기타 / 새 메뉴를 먹어 본 적 없음
3. 기존 메뉴를 고를 때 중요하게 생각한 점을 모두 골라주세요 (multiple) — 맛이 익숙해서 / 좋아하는 메뉴가 있어서 / 가격이 괜찮아서 / 메뉴 구성이 마음에 들어서 / 주문하기 편해서 / 기타 / 기존 메뉴를 먹어 본 적 없음
4. 별마루 카페 새 메뉴에 전반적으로 얼마나 만족했나요? (single) — 전혀 만족하지 않음 / 만족하지 않는 편 / 보통 / 만족하는 편 / 매우 만족 / 새 메뉴를 먹어 본 적 없음
5. 별마루 카페 기존 메뉴에 전반적으로 얼마나 만족했나요? (single) — 전혀 만족하지 않음 / 만족하지 않는 편 / 보통 / 만족하는 편 / 매우 만족 / 기존 메뉴를 먹어 본 적 없음
6. 새 메뉴와 기존 메뉴를 모두 먹어 봤다면, 어느 쪽이 더 만족스러웠나요? (single) — 새 메뉴가 더 만족스러웠음 / 기존 메뉴가 더 만족스러웠음 / 두 메뉴가 비슷했음 / 둘 다 먹어 보지 않았거나 비교하기 어려움
7. 새 메뉴나 기존 메뉴에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-noisy-001

- 입력: 새 메뉴 만족도는 별마루 카페를 최근 한 달 이용한 주민한테 조사
- requestId: d63fbb2f-92a2-443d-bf92-7b8ca1d2c718
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai_partial_repair / partial_repair
- fallbackReason: null
- model / repair / fallback / retry: 1 / 1 / 0 / 0
- evaluator false positive: true
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: OVERALL_SATISFACTION_MISSING: 만족 요소만 묻고 전반적 만족도를 직접 측정하지 않음
- respondentGroup: 최근 한 달 별마루 카페를 이용한 주민
- evaluationTarget: 별마루 카페의 새 메뉴
- 제목: 별마루 카페 새 메뉴 만족도 조사
- 설명: 최근 한 달 동안 별마루 카페를 이용한 주민을 대상으로 새 메뉴에 대한 의견을 듣고자 합니다. 약 3분 정도 걸립니다.
- latency: 31929ms

### 최종 문항

1. 최근 한 달 동안 별마루 카페를 이용한 적이 있나요? (single) — 있음 / 없음
2. 최근 한 달 동안 별마루 카페를 얼마나 자주 이용했나요? (single) — 1회 / 2~3회 / 4~7회 / 8회 이상 / 이용한 적 없음
3. 최근 한 달 동안 별마루 카페의 새 메뉴를 먹어본 적이 있나요? (single) — 먹어봄 / 새 메뉴가 있는 것은 알았지만 먹어보지는 않음 / 새 메뉴가 있는지 몰랐음
4. 별마루 카페의 새 메뉴에 전반적으로 얼마나 만족했나요? (single) — 전혀 만족하지 않음 / 만족하지 않는 편 / 보통 / 만족하는 편 / 매우 만족 / 먹어보지 않음
5. 새 메뉴의 맛은 어땠나요? (single) — 매우 좋지 않았음 / 좋지 않은 편이었음 / 보통이었음 / 좋은 편이었음 / 매우 좋았음 / 먹어보지 않음
6. 앞으로 별마루 카페의 새 메뉴를 다시 주문할 가능성은 어느 정도인가요? (single) — 전혀 없음 / 낮은 편 / 보통 / 높은 편 / 매우 높음 / 먹어보지 않음
7. 새 메뉴에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-noisy-002

- 입력: 새 기능 만족도는 다온 앱 최근 3개월 쓴 대학생한테 조사
- requestId: 76dfaac8-177c-43a1-afbb-715826e1ca10
- HTTP / 응답: 422 / error / error
- 생성 경로: semantic_validation_fallback / request_failure
- fallbackReason: model-output-rejected
- model / repair / fallback / retry: 1 / 1 / 1 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: SEMANTIC_RELATION_INVALID: 사용자 입력에 없는 제품·서비스가 행동 대상으로 추가됨.
- fatal: REQUEST_FAILURE: 요청 실패: 422 | ELIGIBILITY_CHECK_MISSING: 응답 적격 조건을 확인하는 screening 문항이 없음 | REQUIRED_PURPOSE_MISSING: 필수 조사 목적 누락: 새 기능 만족도 | REQUIRED_QUESTION_CONCEPT_MISSING: 필수 문항 개념 누락: 만족도 | OVERALL_SATISFACTION_MISSING: 만족 요소만 묻고 전반적 만족도를 직접 측정하지 않음 | QUESTION_COUNT_MISMATCH: 문항 수 0/7
- respondentGroup: null
- evaluationTarget: null
- 제목: null
- 설명: null
- latency: 36669ms

### 최종 문항

- 반환된 최종 문항 없음

## fronted-noisy-003

- 입력: 프로그램 만족도는 늘봄센터 프로그램 이번 학기 참여한 학부모한테 조사
- requestId: 9c80a574-e086-4aa7-a248-1f41c365c2b8
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai / deterministic_metadata_normalization
- fallbackReason: null
- model / repair / fallback / retry: 1 / 0 / 0 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: 없음
- respondentGroup: 이번 학기 늘봄센터 프로그램에 참여한 학부모
- evaluationTarget: 늘봄센터 프로그램
- 제목: 이번 학기 늘봄센터 프로그램 만족도 조사
- 설명: 이번 학기 늘봄센터 프로그램에 참여한 자녀의 학부모를 대상으로 프로그램 경험과 만족도를 알아보기 위한 설문입니다. 약 3분 정도 걸립니다.
- latency: 22138ms

### 최종 문항

1. 이번 학기에 자녀가 늘봄센터 프로그램에 참여했나요? (single) — 네, 참여했습니다 / 아니요, 참여하지 않았습니다 / 잘 모르겠습니다
2. 이번 학기에 자녀가 늘봄센터 프로그램에 얼마나 자주 참여했나요? (single) — 1~2회 / 3~5회 / 6~10회 / 11회 이상 / 잘 모르겠습니다
3. 자녀가 늘봄센터 프로그램에 참여한 이유는 무엇인가요? (multiple) — 방과 후 돌봄이 필요해서 / 자녀가 프로그램 활동에 관심이 있어서 / 가정의 일정과 시간을 조율하기 위해서 / 주변의 권유를 받아서 / 기타
4. 이번 학기 늘봄센터 프로그램에 전반적으로 얼마나 만족하셨나요? (scale)
5. 자녀가 프로그램에 참여하는 과정은 얼마나 편리했나요? (scale)
6. 늘봄센터 프로그램에서 가장 먼저 개선됐으면 하는 점은 무엇인가요? (multiple) — 프로그램 내용 / 운영 시간 / 신청 및 안내 방식 / 자녀의 참여 관리 / 담당자와의 소통 / 특별히 개선할 점이 없음 / 기타
7. 늘봄센터 프로그램에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)

## fronted-noisy-004

- 입력: 신제품 만족도는 해든 매장 최근 한 달 구매한 고객한테 조사
- requestId: 94281765-ed9b-4522-82df-dca568c3a82f
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai / deterministic_metadata_normalization
- fallbackReason: null
- model / repair / fallback / retry: 1 / 0 / 0 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: 없음
- respondentGroup: 최근 한 달 해든 매장에서 구매한 고객
- evaluationTarget: 신제품
- 제목: 해든 매장 신제품 만족도 조사
- 설명: 최근 한 달 동안 해든 매장에서 신제품을 구매한 고객의 의견을 듣고자 합니다. 약 2분 정도 걸립니다.
- latency: 20428ms

### 최종 문항

1. 최근 한 달 동안 해든 매장에서 신제품을 구매한 적이 있나요? (single) — 있음 / 없음
2. 최근 한 달 동안 해든 매장에서 신제품을 몇 번 구매했나요? (single) — 1회 / 2~3회 / 4~5회 / 6회 이상 / 구매한 적 없음
3. 구매한 신제품에 전반적으로 얼마나 만족했나요? (scale)
4. 신제품을 구매한 이유는 무엇이었나요? (multiple) — 제품 자체가 궁금해서 / 기존에 구매하던 제품과 다른 것을 원해서 / 가격이나 혜택이 마음에 들어서 / 직원이나 지인의 권유로 / 눈에 잘 띄어서 / 기타
5. 신제품에서 아쉬웠던 점이 있다면 무엇인가요? (multiple) — 가격 / 제품의 품질이나 성능 / 제품 정보가 부족함 / 구매하기 불편함 / 기대와 실제 제품이 다름 / 아쉬운 점 없음 / 기타
6. 신제품에서 가장 먼저 개선됐으면 하는 점은 무엇인가요? (single) — 가격 / 제품의 품질이나 성능 / 제품 정보 제공 / 구매 과정의 편리함 / 개선이 필요하지 않음 / 기타
7. 앞으로 해든 매장에서 이 신제품을 다시 구매할 가능성은 어느 정도인가요? (scale)

## fronted-noisy-005

- 입력: 서비스 안 쓰는 이유는 다온 플랫폼 안 쓰는 직장인한테 조사
- requestId: 05e03b60-fec0-4ecd-b370-06e4d90b803b
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai / deterministic_metadata_normalization
- fallbackReason: null
- model / repair / fallback / retry: 1 / 0 / 0 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: 없음
- respondentGroup: 다온 플랫폼을 안 쓰는 직장인
- evaluationTarget: 다온 플랫폼
- 제목: 다온 플랫폼을 사용하지 않는 직장인의 미이용 이유 조사
- 설명: 다온 플랫폼을 사용하지 않는 직장인을 대상으로, 사용하지 않는 이유와 필요한 조건을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다.
- latency: 46471ms

### 최종 문항

1. 현재 직장에 다니고 있나요? (single) — 네, 현재 직장에 다니고 있습니다. / 아니요, 현재 직장에 다니고 있지 않습니다.
2. 현재 다온 플랫폼을 사용하고 있나요? (single) — 현재 사용하지 않고 있습니다. / 현재 사용하고 있습니다. / 잘 모르겠습니다.
3. 다온 플랫폼에 대해 얼마나 알고 있나요? (scale)
4. 다온 플랫폼을 사용하지 않는 가장 큰 이유는 무엇인가요? (single) — 다온 플랫폼을 잘 몰라서 / 나에게 필요하다고 느끼지 않아서 / 이미 사용 중인 다른 방법이나 서비스로 충분해서 / 가입하거나 시작하는 과정이 번거로울 것 같아서 / 사용할 시간을 내기 어려워서 / 개인정보나 서비스 신뢰가 걱정돼서 / 직장 생활과 관련이 없다고 느껴서 / 기타
5. 다온 플랫폼을 사용한다면 어떤 점이 가장 걱정되나요? (multiple) — 내게 맞는 정보나 기능이 없을 것 같음 / 사용 방법이 어렵거나 복잡할 것 같음 / 개인정보 제공이 걱정됨 / 정보나 서비스의 신뢰성이 걱정됨 / 시간을 들일 만큼 도움이 될지 모르겠음 / 직장에서 사용하기에 부담스럽거나 어색할 것 같음 / 특별히 걱정되는 점은 없음 / 기타
6. 어떤 조건이 갖춰지면 다온 플랫폼에 관심을 가질 수 있나요? (multiple) — 나에게 어떤 도움이 되는지 쉽게 알 수 있을 때 / 가입과 시작 방법이 간단할 때 / 신뢰할 수 있는 정보와 운영 기준이 안내될 때 / 직장인에게 맞는 정보나 혜택이 있을 때 / 주변 사람의 추천이나 실제 후기를 볼 수 있을 때 / 관심을 가질 만한 조건이 없음 / 기타
7. 다온 플랫폼을 사용하지 않는 이유나, 사용을 고려하게 될 조건이 있다면 적어주세요 (text)

## fronted-noisy-006

- 입력: 시설 인식은 늘빛 체육관 최근 두 달 이용한 주민한테 조사
- requestId: 730ea889-e648-4e52-b27c-5b701635cc5a
- HTTP / 응답: 200 / survey / ready_with_caution
- 생성 경로: openai / deterministic_metadata_normalization
- fallbackReason: null
- model / repair / fallback / retry: 1 / 0 / 0 / 0
- evaluator false positive: false
- model quality_check: not_exposed_in_response_artifact
- rejection evidence: 없음
- fatal: 없음
- respondentGroup: 최근 두 달 늘빛 체육관을 이용한 주민
- evaluationTarget: 늘빛 체육관
- 제목: 늘빛 체육관 이용자 인식 조사
- 설명: 최근 두 달 동안 늘빛 체육관을 이용한 주민의 의견을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다.
- latency: 33259ms

### 최종 문항

1. 최근 두 달 동안 늘빛 체육관을 이용해 본 적이 있나요? (single) — 예 / 아니요
2. 최근 두 달 동안 늘빛 체육관을 얼마나 자주 이용했나요? (single) — 1회 / 2~3회 / 4~7회 / 8~15회 / 16회 이상 / 이용한 적 없음
3. 늘빛 체육관을 이용한 주된 이유를 모두 골라주세요 (multiple) — 운동을 하기 위해 / 모임이나 활동에 참여하기 위해 / 행사에 참여하거나 관람하기 위해 / 집이나 일터와 가까워서 / 다른 장소를 이용하기 어려워서 / 기타
4. 가장 최근 이용 경험을 기준으로, 늘빛 체육관에 대해 전반적으로 어떻게 느꼈나요? (scale)
5. 늘빛 체육관을 이용하는 과정은 얼마나 편리했나요? (scale)
6. 늘빛 체육관에서 먼저 개선됐으면 하는 점을 최대 2개 골라주세요 (multiple) — 시설의 청결과 관리 상태 / 시설과 장비의 상태 / 이용 공간의 넓이와 혼잡도 / 운영 시간이나 이용 안내 / 찾아가기 쉬운 정도 / 안전하게 이용할 수 있는 환경 / 개선할 점이 없음 / 기타
7. 늘빛 체육관에서 가장 먼저 바뀌었으면 하는 점이 있다면 적어주세요 (text)
