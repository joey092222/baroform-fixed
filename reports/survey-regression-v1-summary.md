# 바로폼 설문 회귀·Holdout 평가 v1

## 1. 기준 환경

- 기준 브랜치: `codex/trace-ai-input-distortion`
- 기준 커밋: `b2c52ca82af1c5c16fae3fb72af20bf34436f8c7`
- 평가 브랜치: `codex/survey-ai-regression-100-v1`
- 평가 HEAD: `b2c52ca82af1c5c16fae3fb72af20bf34436f8c7`
- 실제 호출 수(재시도 포함): 97
- 재시도: 0
- 웹 검색 호출: 0
- 실행 전 예상 비용: $15.6019
- 로그 기반 실제 추정 비용: 미수집 (Vercel 로그 조회 결과 없음)

## 2. 데이터셋 구성

- 개발 세트: 80
- Holdout: 20
- 총 사례: 100
- 일반/정밀·연구: 85/15
- clarification: 8
- 부정 표현: 25
- 실제 복수 대상: 15
- 개발 seed: `baroform-regression-v1-dev-20260818`
- Holdout seed: `baroform-regression-v1-holdout-20260818`
- 중복 및 유사도 0.88 이상: 0건

## 3. 생성 경로 분포

| 경로 | 개발 | Holdout | 전체 | 비율 |
|---|---:|---:|---:|---:|
| clean_model_success | 0 | 0 | 0 | 0.0% |
| deterministic_metadata_normalization | 35 | 11 | 46 | 46.0% |
| partial_repair | 16 | 3 | 19 | 19.0% |
| hard_fallback | 16 | 3 | 19 | 19.0% |
| request_failure | 12 | 3 | 15 | 15.0% |
| clarification | 1 | 0 | 1 | 1.0% |

## 4. 치명적 오류

| case ID | 오류 | 군집 | requestId | 실제 내용 |
|---|---|---|---|---|
| dev-clarify-001 | EXPECTED_CLARIFICATION_MISSING | clarification | reg-v1-dev-clarify-001-cade942f | 모호한 입력에 설문을 억지 생성함 |
| dev-clarify-002 | EXPECTED_CLARIFICATION_MISSING | clarification | reg-v1-dev-clarify-002-d9dad826 | 모호한 입력에 설문을 억지 생성함 |
| dev-clarify-003 | EXPECTED_CLARIFICATION_MISSING | clarification | reg-v1-dev-clarify-003-f15c6a89 | 모호한 입력에 설문을 억지 생성함 |
| dev-clarify-004 | EXPECTED_CLARIFICATION_MISSING | clarification | reg-v1-dev-clarify-004-a1f0c6eb | 모호한 입력에 설문을 억지 생성함 |
| dev-clarify-005 | EXPECTED_CLARIFICATION_MISSING | clarification | reg-v1-dev-clarify-005-1063e3b8 | 모호한 입력에 설문을 억지 생성함 |
| dev-clarify-006 | EXPECTED_CLARIFICATION_MISSING | clarification | reg-v1-dev-clarify-006-500a66e2 | 모호한 입력에 설문을 억지 생성함 |
| dev-complex-001 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-complex-001-3f5b8648 | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 좌석 만족도와 혼잡 경험, 예약 기능에 대한 의견을 알아보는 설문입니다. 응답에는 약 3분이 걸립니다. |
| dev-complex-001 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-001-3f5b8648 | 필수 문항 개념 누락: 서비스 필요성 |
| dev-complex-001 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-001-3f5b8648 | 필수 문항 개념 누락: 이용 의향 |
| dev-complex-002 | HARD_FALLBACK | hard_fallback | reg-v1-dev-complex-002-8abc544b | 명확한 입력이 hard fallback으로 처리됨 |
| dev-complex-002 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-complex-002-8abc544b | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 배달 앱 한 개에 대한 필요 수준과 이용 조건, 수요를 막는 요인을 파악하는 익명 설문입니다. |
| dev-complex-002 | NAMED_TERM_LOST | survey_object | reg-v1-dev-complex-002-8abc544b | 고유명사 또는 핵심어 손실: 1인 가구 |
| dev-complex-002 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-002-8abc544b | 필수 문항 개념 누락: 구매 빈도 |
| dev-complex-002 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-002-8abc544b | 필수 문항 개념 누락: 비용 |
| dev-complex-003 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-003-fd9281dd | 필수 문항 개념 누락: 비이용 이유 |
| dev-complex-003 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-003-fd9281dd | 필수 문항 개념 누락: 이용 의향 |
| dev-complex-004 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-004-f1c2dca7 | 필수 문항 개념 누락: 이용 빈도 |
| dev-complex-004 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-004-f1c2dca7 | 필수 문항 개념 누락: 이용 의향 |
| dev-complex-005 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-complex-005-a262f4d9 | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 솔빛관과 별마루관으로 오가는 과정에서 느낀 접근성, 혼잡, 안전을 비교하기 위한 조사입니다. 직접 경험을 바탕으로 답해 주세요. 응답에는 약 3분이 걸립니다. |
| dev-complex-006 | HARD_FALLBACK | hard_fallback | reg-v1-dev-complex-006-67ccbda3 | 명확한 입력이 hard fallback으로 처리됨 |
| dev-complex-006 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-complex-006-67ccbda3 | 응답 대상 불일치: 온새미 플랫폼과 별마루 서비스 사용자 온새미 플랫폼과 별마루 서비스 사용자 온새미 플랫폼과 별마루 서비스 사용자를 대상으로, 편의성 및 신뢰도 차이에 대한 현재 인지도와 유입 경로, 이미지 및 추가 관심도를 파악하는 익명 설문입니다. |
| dev-complex-007 | HARD_FALLBACK | hard_fallback | reg-v1-dev-complex-007-457c105e | 명확한 입력이 hard fallback으로 처리됨 |
| dev-complex-008 | HARD_FALLBACK | hard_fallback | reg-v1-dev-complex-008-a3d96d77 | 명확한 입력이 hard fallback으로 처리됨 |
| dev-complex-008 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-008-a3d96d77 | 필수 문항 개념 누락: 학습 효과 |
| dev-complex-008 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-008-a3d96d77 | 필수 문항 개념 누락: 참여 의향 |
| dev-complex-008 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-008-a3d96d77 | 필수 문항 개념 누락: 대상 비교 |
| dev-complex-010 | REQUEST_FAILURE | request_transport | reg-v1-dev-complex-010-b63dccad | 요청 실패: 422 |
| dev-complex-010 | SURVEY_OBJECT_MISMATCH | survey_object | reg-v1-dev-complex-010-b63dccad | 조사 대상 불일치: 기능 |
| dev-complex-010 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-010-b63dccad | 필수 문항 개념 누락: 비이용 이유 |
| dev-complex-010 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-010-b63dccad | 필수 문항 개념 누락: 원하는 기능 |
| dev-complex-010 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-dev-complex-010-b63dccad | 문항 수 0/7 |
| dev-complex-011 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-complex-011-85ca4b39 | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 합니다. 응답은 새 메뉴 개선에 활용됩니다. 약 3분 정도 걸립니다. |
| dev-complex-011 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-011-85ca4b39 | 필수 문항 개념 누락: 이용 경험 |
| dev-complex-012 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-012-f552535c | 필수 문항 개념 누락: 비이용 이유 |
| dev-complex-013 | HARD_FALLBACK | hard_fallback | reg-v1-dev-complex-013-b52716ae | 명확한 입력이 hard fallback으로 처리됨 |
| dev-complex-013 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-013-b52716ae | 필수 문항 개념 누락: 비용 |
| dev-complex-013 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-013-b52716ae | 필수 문항 개념 누락: 구매 빈도 |
| dev-complex-014 | REQUEST_FAILURE | request_transport | reg-v1-dev-complex-014-23bedc88 | 요청 실패: 422 |
| dev-complex-014 | REQUIRED_CONCEPT_MISSING | reference_period | reg-v1-dev-complex-014-23bedc88 | 필수 문항 개념 누락: 수면 시간 |
| dev-complex-014 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-complex-014-23bedc88 | 필수 문항 개념 누락: 빈도 |
| dev-complex-014 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-dev-complex-014-23bedc88 | 문항 수 0/7 |
| dev-complex-016 | HARD_FALLBACK | hard_fallback | reg-v1-dev-complex-016-86dcd296 | 명확한 입력이 hard fallback으로 처리됨 |
| dev-general-001 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-general-001-d65228ea | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 이번 학기 온라인 강의를 들으며 느낀 점을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다. |
| dev-general-003 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-003-2992e75c | 필수 문항 개념 누락: 비이용 이유 |
| dev-general-003 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-003-2992e75c | 필수 문항 개념 누락: 참여 의향 |
| dev-general-004 | UNEXPECTED_CLARIFICATION | clarification | reg-v1-dev-general-004-38d0aa06 | 명확한 입력에 불필요한 확인 질문을 반환함 |
| dev-general-005 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-005-cdb1f310 | 필수 문항 개념 누락: 이동 빈도 |
| dev-general-005 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-005-cdb1f310 | 필수 문항 개념 누락: 이동 수단 |
| dev-general-005 | REQUIRED_CONCEPT_MISSING | reference_period | reg-v1-dev-general-005-cdb1f310 | 필수 문항 개념 누락: 소요 시간 |
| dev-general-006 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-006-f4862813 | 필수 문항 개념 누락: 이동 수단 |
| dev-general-007 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-007-f769a3e0 | 필수 문항 개념 누락: 방문 경험 |
| dev-general-008 | REQUIRED_CONCEPT_MISSING | reference_period | reg-v1-dev-general-008-50ca744b | 필수 문항 개념 누락: 소요 시간 |
| dev-general-009 | HARD_FALLBACK | hard_fallback | reg-v1-dev-general-009-e07d5281 | 명확한 입력이 hard fallback으로 처리됨 |
| dev-general-009 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-009-e07d5281 | 필수 문항 개념 누락: 이용 빈도 |
| dev-general-009 | FORBIDDEN_CONCEPT_PRESENT | question_quality | reg-v1-dev-general-009-e07d5281 | 금지 문항 개념 포함: generic filler |
| dev-general-009 | GENERIC_FILLER | question_quality | reg-v1-dev-general-009-e07d5281 | generic filler 문항이 포함됨 |
| dev-general-010 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-general-010-d08f81fa | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 재택근무를 하며 배달음식을 주문해 본 경험에 대해 묻는 설문입니다. 약 3분 정도 걸립니다. |
| dev-general-012 | HARD_FALLBACK | hard_fallback | reg-v1-dev-general-012-d3cc9f0a | 명확한 입력이 hard fallback으로 처리됨 |
| dev-general-012 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-012-d3cc9f0a | 필수 문항 개념 누락: 만족도 |
| dev-general-013 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-013-8bac841b | 필수 문항 개념 누락: 이용 경험 |
| dev-general-013 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-013-8bac841b | 필수 문항 개념 누락: 사용성 |
| dev-general-013 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-013-8bac841b | 필수 문항 개념 누락: 불편 |
| dev-general-014 | HARD_FALLBACK | hard_fallback | reg-v1-dev-general-014-a83c7ff7 | 명확한 입력이 hard fallback으로 처리됨 |
| dev-general-014 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-014-a83c7ff7 | 필수 문항 개념 누락: 이용 경험 |
| dev-general-014 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-014-a83c7ff7 | 필수 문항 개념 누락: 만족도 |
| dev-general-015 | REQUEST_FAILURE | request_transport | reg-v1-dev-general-015-36b03d7b | 요청 실패: 422 |
| dev-general-015 | NAMED_TERM_LOST | survey_object | reg-v1-dev-general-015-36b03d7b | 고유명사 또는 핵심어 손실: 고령층 |
| dev-general-015 | NEGATION_LOST | negation | reg-v1-dev-general-015-36b03d7b | 비이용·비참여·미구매 조건이 최종 설문에서 사라짐 |
| dev-general-015 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-015-36b03d7b | 필수 문항 개념 누락: 비이용 이유 |
| dev-general-015 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-015-36b03d7b | 필수 문항 개념 누락: 불편 |
| dev-general-015 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-dev-general-015-36b03d7b | 문항 수 0/7 |
| dev-general-015 | SCHEMA_ISSUES | schema | reg-v1-dev-general-015-36b03d7b | custom, custom, integrity.0, integrity.1 |
| dev-general-016 | REQUEST_FAILURE | request_transport | reg-v1-dev-general-016-80b93a9e | 요청 실패: 422 |
| dev-general-016 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-016-80b93a9e | 필수 문항 개념 누락: 사용성 |
| dev-general-016 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-016-80b93a9e | 필수 문항 개념 누락: 이용 의향 |
| dev-general-016 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-016-80b93a9e | 필수 문항 개념 누락: 대상 비교 |
| dev-general-016 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-dev-general-016-80b93a9e | 문항 수 0/7 |
| dev-general-016 | SEMANTIC_ISSUES | semantic_validation | reg-v1-dev-general-016-80b93a9e | 1 |
| dev-general-017 | REQUEST_FAILURE | request_transport | reg-v1-dev-general-017-05fed9ac | 요청 실패: 500 |
| dev-general-017 | SURVEY_OBJECT_MISMATCH | survey_object | reg-v1-dev-general-017-05fed9ac | 조사 대상 불일치: 재 |
| dev-general-017 | NAMED_TERM_LOST | survey_object | reg-v1-dev-general-017-05fed9ac | 고유명사 또는 핵심어 손실: 새봄대학교 |
| dev-general-017 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-017-05fed9ac | 필수 문항 개념 누락: 참여 경험 |
| dev-general-017 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-017-05fed9ac | 필수 문항 개념 누락: 만족도 |
| dev-general-017 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-017-05fed9ac | 필수 문항 개념 누락: 참여 의향 |
| dev-general-017 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-dev-general-017-05fed9ac | 문항 수 0/7 |
| dev-general-018 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-018-914518fe | 필수 문항 개념 누락: 비이용 이유 |
| dev-general-018 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-018-914518fe | 필수 문항 개념 누락: 선호 |
| dev-general-019 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-019-f93428c5 | 필수 문항 개념 누락: 참여 경험 |
| dev-general-019 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-019-f93428c5 | 필수 문항 개념 누락: 인식 |
| dev-general-020 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-020-1d2c9de5 | 필수 문항 개념 누락: 참여 경험 |
| dev-general-020 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-020-1d2c9de5 | 필수 문항 개념 누락: 학습 효과 |
| dev-general-020 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-020-1d2c9de5 | 필수 문항 개념 누락: 대상 비교 |
| dev-general-021 | REQUEST_FAILURE | request_transport | reg-v1-dev-general-021-aa502c4c | 요청 실패: 422 |
| dev-general-021 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-021-aa502c4c | 필수 문항 개념 누락: 공정성 |
| dev-general-021 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-021-aa502c4c | 필수 문항 개념 누락: 의사소통 |
| dev-general-021 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-021-aa502c4c | 필수 문항 개념 누락: 만족도 |
| dev-general-021 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-dev-general-021-aa502c4c | 문항 수 0/7 |
| dev-general-022 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-022-dc3ae8a3 | 필수 문항 개념 누락: 비이용 이유 |
| dev-general-023 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-023-31a4a434 | 필수 문항 개념 누락: 피로 |
| dev-general-023 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-023-31a4a434 | 필수 문항 개념 누락: 소속감 |
| dev-general-024 | REQUIRED_CONCEPT_MISSING | reference_period | reg-v1-dev-general-024-ea850f5c | 필수 문항 개념 누락: 시간 사용 |
| dev-general-025 | HARD_FALLBACK | hard_fallback | reg-v1-dev-general-025-5d15d90e | 명확한 입력이 hard fallback으로 처리됨 |
| dev-general-025 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-025-5d15d90e | 필수 문항 개념 누락: 구매 빈도 |
| dev-general-026 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-026-7e28b9b9 | 필수 문항 개념 누락: 비이용 이유 |
| dev-general-026 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-026-7e28b9b9 | 필수 문항 개념 누락: 비용 |
| dev-general-027 | REQUEST_FAILURE | request_transport | reg-v1-dev-general-027-3d29c58c | 요청 실패: 422 |
| dev-general-027 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-027-3d29c58c | 필수 문항 개념 누락: 이용 빈도 |
| dev-general-027 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-027-3d29c58c | 필수 문항 개념 누락: 만족도 |
| dev-general-027 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-027-3d29c58c | 필수 문항 개념 누락: 대상 비교 |
| dev-general-027 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-dev-general-027-3d29c58c | 문항 수 0/7 |
| dev-general-029 | HARD_FALLBACK | hard_fallback | reg-v1-dev-general-029-e91b9736 | 명확한 입력이 hard fallback으로 처리됨 |
| dev-general-030 | HARD_FALLBACK | hard_fallback | reg-v1-dev-general-030-6ddfe5f2 | 명확한 입력이 hard fallback으로 처리됨 |
| dev-general-030 | REQUIRED_CONCEPT_MISSING | reference_period | reg-v1-dev-general-030-6ddfe5f2 | 필수 문항 개념 누락: 이용 시간 |
| dev-general-030 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-030-6ddfe5f2 | 필수 문항 개념 누락: 피로 |
| dev-general-031 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-general-031-7a09bbe2 | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 이 설문은 운동을 하지 못하게 만드는 이유와 필요한 지원을 알아보기 위한 조사입니다. 본인이 생각하는 운동을 기준으로 답해주세요. 약 3분 정도 걸립니다. |
| dev-general-031 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-031-7a09bbe2 | 필수 문항 개념 누락: 비이용 이유 |
| dev-general-032 | REQUEST_FAILURE | request_transport | reg-v1-dev-general-032-da182ff9 | 요청 실패: 422 |
| dev-general-032 | REQUIRED_CONCEPT_MISSING | reference_period | reg-v1-dev-general-032-da182ff9 | 필수 문항 개념 누락: 시간 사용 |
| dev-general-032 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-032-da182ff9 | 필수 문항 개념 누락: 만족도 |
| dev-general-032 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-general-032-da182ff9 | 필수 문항 개념 누락: 대상 비교 |
| dev-general-032 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-dev-general-032-da182ff9 | 문항 수 0/7 |
| dev-noisy-001 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-noisy-001-4a3466e4 | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 솔빛관을 오갈 때 느끼는 불편과 개선이 필요한 점을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다. |
| dev-noisy-002 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-noisy-002-baea3451 | 필수 문항 개념 누락: 구매 빈도 |
| dev-noisy-003 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-noisy-003-2453a6ac | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 동아리 가입에 대한 생각을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다. |
| dev-noisy-003 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-noisy-003-2453a6ac | 필수 문항 개념 누락: 비이용 이유 |
| dev-noisy-003 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-noisy-003-2453a6ac | 필수 문항 개념 누락: 참여 의향 |
| dev-noisy-004 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-noisy-004-04527693 | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 온새미앱을 써본 경험을 바탕으로 답해주세요. 응답은 앱의 불편한 점과 개선 방향을 파악하는 데 활용됩니다. 약 3분 정도 걸립니다. |
| dev-noisy-004 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-noisy-004-04527693 | 필수 문항 개념 누락: 이용 경험 |
| dev-noisy-005 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-noisy-005-4741f131 | 필수 문항 개념 누락: 비이용 이유 |
| dev-noisy-006 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-noisy-006-86e74ec4 | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 팀 프로젝트에서 겪은 갈등과 해결 경험을 알아보기 위한 설문입니다. 가장 최근의 팀 프로젝트를 떠올리며 답해주세요. 약 3분 정도 걸립니다. |
| dev-past-002 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-past-002-bd5092ca | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 최근 한 학기 동안 경영대 시설을 이용하며 느낀 점을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다. |
| dev-past-002 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-002-bd5092ca | 필수 문항 개념 누락: 불편 |
| dev-past-003 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-past-003-ae8732a4 | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 경영대 시설을 이용하며 느낀 점과 불편했던 점을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다. |
| dev-past-005 | HARD_FALLBACK | hard_fallback | reg-v1-dev-past-005-9fab7b76 | 명확한 입력이 hard fallback으로 처리됨 |
| dev-past-005 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-005-9fab7b76 | 필수 문항 개념 누락: 이동 빈도 |
| dev-past-006 | REQUEST_FAILURE | request_transport | reg-v1-dev-past-006-5df1ee3c | 요청 실패: 422 |
| dev-past-006 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-006-5df1ee3c | 필수 문항 개념 누락: 이동 수단 |
| dev-past-006 | REQUIRED_CONCEPT_MISSING | reference_period | reg-v1-dev-past-006-5df1ee3c | 필수 문항 개념 누락: 소요 시간 |
| dev-past-006 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-006-5df1ee3c | 필수 문항 개념 누락: 불편 |
| dev-past-006 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-dev-past-006-5df1ee3c | 문항 수 0/7 |
| dev-past-007 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-007-7db793f3 | 필수 문항 개념 누락: 이동 빈도 |
| dev-past-007 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-007-7db793f3 | 필수 문항 개념 누락: 혼잡 |
| dev-past-008 | REQUEST_FAILURE | request_transport | reg-v1-dev-past-008-88dab304 | 요청 실패: 422 |
| dev-past-008 | NEGATION_LOST | negation | reg-v1-dev-past-008-88dab304 | 비이용·비참여·미구매 조건이 최종 설문에서 사라짐 |
| dev-past-008 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-008-88dab304 | 필수 문항 개념 누락: 비이용 이유 |
| dev-past-008 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-dev-past-008-88dab304 | 문항 수 0/7 |
| dev-past-008 | SCHEMA_ISSUES | schema | reg-v1-dev-past-008-88dab304 | custom, custom, integrity.0, integrity.1 |
| dev-past-010 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-past-010-31b3e850 | 응답 대상 불일치: 네웹 안 쓰는 대학생 네웹을 현재 사용하지 않는 대학생을 대상으로, 사용하지 않는 이유와 앞으로 사용할 가능성을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다. |
| dev-past-010 | SURVEY_OBJECT_MISMATCH | survey_object | reg-v1-dev-past-010-31b3e850 | 조사 대상 불일치: 네웹 안 쓰는 대학생들 왜 안 쓰는지랑 앞으로 쓸 생각 있는지 네웹 안 쓰는 대학생들 왜 안 쓰는지랑 앞으로 쓸 생각 있는지 네웹을 사용하지 않는 대학생의 이유와 향후 사용 의향 조사 ‘네웹 안 쓰는 대학생들 왜 안 쓰는지랑 앞으로 쓸 생각 있는지’과 관련해 평소 가장 자주 겪는 상황은 무엇인가요?
네웹에 대해 어느 정도 알고 있었나요?
네웹을 사용하지 않는 이유를 모두 골라주세요
네웹을 사용하지 않는 데 가장 큰 영향을 준 이유는 무엇인가요?
앞으로 네웹을 사용할 가능성은 어느 정도인가요?
어떤 점이 갖춰지면 네웹을 사용해 볼 생각이 드나요?
네웹을 사용하지 않는 가장 중요한 이유나, 사용해 볼 마음이 들 조건이 있다면 적어주세요 |
| dev-past-011 | HARD_FALLBACK | hard_fallback | reg-v1-dev-past-011-d7f2c483 | 명확한 입력이 hard fallback으로 처리됨 |
| dev-past-011 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-011-d7f2c483 | 필수 문항 개념 누락: 이용 경험 |
| dev-past-012 | REQUEST_FAILURE | request_transport | reg-v1-dev-past-012-71bc437e | 요청 실패: 422 |
| dev-past-012 | NAMED_TERM_LOST | survey_object | reg-v1-dev-past-012-71bc437e | 고유명사 또는 핵심어 손실: 네이버 웹툰 |
| dev-past-012 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-012-71bc437e | 필수 문항 개념 누락: 이용 빈도 |
| dev-past-012 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-012-71bc437e | 필수 문항 개념 누락: 만족도 |
| dev-past-012 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-012-71bc437e | 필수 문항 개념 누락: 대상 비교 |
| dev-past-012 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-dev-past-012-71bc437e | 문항 수 0/7 |
| dev-past-012 | SCHEMA_ISSUES | schema | reg-v1-dev-past-012-71bc437e | custom, custom, integrity.0, integrity.1 |
| dev-past-014 | NEGATION_LOST | negation | reg-v1-dev-past-014-538ad4f2 | 비이용·비참여·미구매 조건이 최종 설문에서 사라짐 |
| dev-past-014 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-014-538ad4f2 | 필수 문항 개념 누락: 비이용 이유 |
| dev-past-015 | HARD_FALLBACK | hard_fallback | reg-v1-dev-past-015-d5259bcb | 명확한 입력이 hard fallback으로 처리됨 |
| dev-past-015 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-015-d5259bcb | 필수 문항 개념 누락: 이용 빈도 |
| dev-past-016 | HARD_FALLBACK | hard_fallback | reg-v1-dev-past-016-ca7bdd0c | 명확한 입력이 hard fallback으로 처리됨 |
| dev-past-016 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-016-ca7bdd0c | 필수 문항 개념 누락: 선택 이유 |
| dev-past-016 | FORBIDDEN_CONCEPT_PRESENT | question_quality | reg-v1-dev-past-016-ca7bdd0c | 금지 문항 개념 포함: generic filler |
| dev-past-016 | GENERIC_FILLER | question_quality | reg-v1-dev-past-016-ca7bdd0c | generic filler 문항이 포함됨 |
| dev-past-018 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-dev-past-018-b5870786 | 응답 대상 불일치: 맛나샘 안 가는 학생 맛나샘 안 가는 학생을 대상으로, 맛나샘을 자주 찾지 않는 이유와 앞으로 이용을 고려하게 할 조건을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다. |
| dev-past-018 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-018-b5870786 | 필수 문항 개념 누락: 비이용 이유 |
| dev-past-019 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-019-f23fe850 | 필수 문항 개념 누락: 이용 빈도 |
| dev-past-020 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-dev-past-020-4729b14f | 필수 문항 개념 누락: 만족도 |
| holdout-clarify-001 | EXPECTED_CLARIFICATION_MISSING | clarification | reg-v1-holdout-clarify-001-7c3e0070 | 모호한 입력에 설문을 억지 생성함 |
| holdout-clarify-002 | EXPECTED_CLARIFICATION_MISSING | clarification | reg-v1-holdout-clarify-002-d22209f1 | 모호한 입력에 설문을 억지 생성함 |
| holdout-complex-001 | HARD_FALLBACK | hard_fallback | reg-v1-holdout-complex-001-16d4b22e | 명확한 입력이 hard fallback으로 처리됨 |
| holdout-complex-001 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-complex-001-16d4b22e | 필수 문항 개념 누락: 이용 의향 |
| holdout-complex-002 | HARD_FALLBACK | hard_fallback | reg-v1-holdout-complex-002-fc353a30 | 명확한 입력이 hard fallback으로 처리됨 |
| holdout-complex-002 | REQUIRED_CONCEPT_MISSING | reference_period | reg-v1-holdout-complex-002-fc353a30 | 필수 문항 개념 누락: 소요 시간 |
| holdout-complex-002 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-complex-002-fc353a30 | 필수 문항 개념 누락: 대상 비교 |
| holdout-complex-003 | HARD_FALLBACK | hard_fallback | reg-v1-holdout-complex-003-198fee5c | 명확한 입력이 hard fallback으로 처리됨 |
| holdout-complex-003 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-complex-003-198fee5c | 필수 문항 개념 누락: 구매 빈도 |
| holdout-complex-004 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-complex-004-0714fa9d | 필수 문항 개념 누락: 비이용 이유 |
| holdout-complex-004 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-complex-004-0714fa9d | 필수 문항 개념 누락: 개선 요구 |
| holdout-general-001 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-general-001-525b1748 | 필수 문항 개념 누락: 참여 경험 |
| holdout-general-002 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-general-002-620a5711 | 필수 문항 개념 누락: 비이용 이유 |
| holdout-general-002 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-general-002-620a5711 | 필수 문항 개념 누락: 접근성 |
| holdout-general-003 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-general-003-58bf5d83 | 필수 문항 개념 누락: 이용 빈도 |
| holdout-general-004 | REQUEST_FAILURE | request_transport | reg-v1-holdout-general-004-946f967e | 요청 실패: 422 |
| holdout-general-004 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-general-004-946f967e | 필수 문항 개념 누락: 만족도 |
| holdout-general-004 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-general-004-946f967e | 필수 문항 개념 누락: 대상 비교 |
| holdout-general-004 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-holdout-general-004-946f967e | 문항 수 0/7 |
| holdout-general-004 | SCHEMA_ISSUES | schema | reg-v1-holdout-general-004-946f967e | custom, custom, integrity.0, integrity.1 |
| holdout-general-005 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-general-005-1bd13a99 | 필수 문항 개념 누락: 비이용 이유 |
| holdout-general-005 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-general-005-1bd13a99 | 필수 문항 개념 누락: 선호 |
| holdout-general-006 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-holdout-general-006-8c312e79 | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 프로젝트 팀 활동 중 회의에 참여하기 어려웠던 경험과 비동기 협업에 대한 의견을 알아보기 위한 설문입니다. 약 3분 정도 걸립니다. |
| holdout-general-006 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-general-006-8c312e79 | 필수 문항 개념 누락: 비이용 이유 |
| holdout-general-007 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-holdout-general-007-2be63681 | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 지난 6개월 동안 반려동물 사료를 온라인으로 구매한 경험을 바탕으로 답해주세요. 예상 소요 시간은 약 3분입니다. |
| holdout-general-007 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-general-007-2be63681 | 필수 문항 개념 누락: 구매 빈도 |
| holdout-general-008 | NEGATION_LOST | negation | reg-v1-holdout-general-008-57c0a7d3 | 비이용·비참여·미구매 조건이 최종 설문에서 사라짐 |
| holdout-general-008 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-general-008-57c0a7d3 | 필수 문항 개념 누락: 비이용 이유 |
| holdout-general-008 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-general-008-57c0a7d3 | 필수 문항 개념 누락: 선호 |
| holdout-noisy-001 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-holdout-noisy-001-f941a838 | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 한울대 늘봄관 안으로 들어가 본 경험을 바탕으로 답해주세요. 응답은 늘봄관 출입 과정에서 느끼는 불편을 파악하고 개선 의견을 정리하는 데 활용됩니다. 약 3분 정도 걸립니다. |
| holdout-noisy-001 | NEGATION_LOST | negation | reg-v1-holdout-noisy-001-f941a838 | 비이용·비참여·미구매 조건이 최종 설문에서 사라짐 |
| holdout-noisy-001 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-noisy-001-f941a838 | 필수 문항 개념 누락: 비이용 이유 |
| holdout-noisy-002 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-holdout-noisy-002-8f9bd652 | 응답 대상 불일치: 관련 경험이 있는 응답자 관련 경험이 있는 응답자를 대상으로, 다온앱을 열어본 경험을 바탕으로 답해주세요. 응답은 다온앱을 다시 사용하게 만들 방법을 살펴보는 데 활용됩니다. 약 3분 정도 걸립니다. |
| holdout-noisy-002 | NEGATION_LOST | negation | reg-v1-holdout-noisy-002-8f9bd652 | 비이용·비참여·미구매 조건이 최종 설문에서 사라짐 |
| holdout-noisy-002 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-noisy-002-8f9bd652 | 필수 문항 개념 누락: 비이용 이유 |
| holdout-noisy-002 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-noisy-002-8f9bd652 | 필수 문항 개념 누락: 이용 의향 |
| holdout-past-001 | TARGET_POPULATION_MISMATCH | target_population | reg-v1-holdout-past-001-8449821a | 응답 대상 불일치: 한울대 경영학부 학생 한울대 경영학부 학생을 대상으로, 경영학관 시설을 이용하거나 방문하면서 느낀 점을 알아보기 위한 설문입니다. 응답에는 약 3분이 걸립니다. |
| holdout-past-001 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-past-001-8449821a | 필수 문항 개념 누락: 개선 요구 |
| holdout-past-002 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-past-002-7e984233 | 필수 문항 개념 누락: 이동 빈도 |
| holdout-past-002 | REQUIRED_CONCEPT_MISSING | reference_period | reg-v1-holdout-past-002-7e984233 | 필수 문항 개념 누락: 소요 시간 |
| holdout-past-002 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-past-002-7e984233 | 필수 문항 개념 누락: 혼잡 |
| holdout-past-003 | REQUEST_FAILURE | request_transport | reg-v1-holdout-past-003-20f84112 | 요청 실패: 422 |
| holdout-past-003 | NAMED_TERM_LOST | survey_object | reg-v1-holdout-past-003-20f84112 | 고유명사 또는 핵심어 손실: 취업준비생 |
| holdout-past-003 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-past-003-20f84112 | 필수 문항 개념 누락: 이용 경험 |
| holdout-past-003 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-past-003-20f84112 | 필수 문항 개념 누락: 이용 빈도 |
| holdout-past-003 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-past-003-20f84112 | 필수 문항 개념 누락: 만족도 |
| holdout-past-003 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-past-003-20f84112 | 필수 문항 개념 누락: 불편 |
| holdout-past-003 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-holdout-past-003-20f84112 | 문항 수 0/7 |
| holdout-past-004 | REQUEST_FAILURE | request_transport | reg-v1-holdout-past-004-c332e5db | 요청 실패: 422 |
| holdout-past-004 | SURVEY_OBJECT_MISMATCH | survey_object | reg-v1-holdout-past-004-c332e5db | 조사 대상 불일치: 지원 |
| holdout-past-004 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-past-004-c332e5db | 필수 문항 개념 누락: 비이용 이유 |
| holdout-past-004 | REQUIRED_CONCEPT_MISSING | purpose_coverage | reg-v1-holdout-past-004-c332e5db | 필수 문항 개념 누락: 서비스 필요성 |
| holdout-past-004 | QUESTION_COUNT_MISMATCH | question_quality | reg-v1-holdout-past-004-c332e5db | 문항 수 0/7 |

## 5. 카테고리별 성공률

| 카테고리 | 사례 | 치명적 오류 없음 | 비율 |
|---|---:|---:|---:|
| academic_course | 5 | 1 | 20.0% |
| academic_satisfaction | 5 | 2 | 40.0% |
| clarification | 8 | 0 | 0.0% |
| consumer_behavior | 5 | 1 | 20.0% |
| digital_service | 11 | 1 | 9.1% |
| event_program | 5 | 0 | 0.0% |
| facility_mobility | 10 | 0 | 0.0% |
| food_service | 13 | 3 | 23.1% |
| lifestyle_behavior | 5 | 0 | 0.0% |
| multiple_target_comparison | 5 | 0 | 0.0% |
| noisy_input | 8 | 0 | 0.0% |
| relationship_research | 5 | 1 | 20.0% |
| reversed_roles | 5 | 1 | 20.0% |
| single_multi_purpose | 5 | 0 | 0.0% |
| teamwork_school_life | 5 | 0 | 0.0% |

## 6. Holdout 결과

- 사례 수: 20
- 치명적 오류: 20
- hard fallback: 3
- request failure: 3

## 7. 비용·속도 기준

- 평균 input tokens: 미수집
- 중앙값 input tokens: 미수집
- p95 input tokens: 미수집
- 최대 input tokens: 미수집
- 평균 output tokens: 미수집
- 평균 total tokens: 미수집
- 평균 latency: 42.50초
- p95 latency: 103.32초
- 최대 latency: 135.93초
- input token 상위 10개: 미수집
- latency 상위 10개: dev-complex-007 (135.9s), dev-complex-002 (125.2s), dev-complex-008 (122.1s), holdout-complex-003 (116.2s), dev-complex-014 (106.7s), dev-complex-016 (103.3s), dev-general-029 (90.4s), dev-complex-013 (88.0s), dev-complex-006 (85.1s), holdout-complex-002 (83.9s)

## 8. 다음 수정 우선순위

| 우선순위 | 실패 군집 | 사례 수 | 대표 case ID | 공통 최초 실패 단계 |
|---:|---|---:|---|---|
| 1 | purpose_coverage | 113 | dev-complex-001, dev-complex-001, dev-complex-002 | 결과 artifact의 최초 실패 단계 확인 필요 |
| 2 | target_population | 21 | dev-complex-001, dev-complex-002, dev-complex-005 | 결과 artifact의 최초 실패 단계 확인 필요 |
| 3 | hard_fallback | 19 | dev-complex-002, dev-complex-006, dev-complex-007 | 결과 artifact의 최초 실패 단계 확인 필요 |
| 4 | question_quality | 18 | dev-complex-010, dev-complex-014, dev-general-009 | 결과 artifact의 최초 실패 단계 확인 필요 |
| 5 | request_transport | 14 | dev-complex-010, dev-complex-014, dev-general-015 | 결과 artifact의 최초 실패 단계 확인 필요 |
| 6 | clarification | 9 | dev-clarify-001, dev-clarify-002, dev-clarify-003 | 결과 artifact의 최초 실패 단계 확인 필요 |
| 7 | survey_object | 9 | dev-complex-002, dev-complex-010, dev-general-015 | 결과 artifact의 최초 실패 단계 확인 필요 |
| 8 | reference_period | 9 | dev-complex-014, dev-general-005, dev-general-008 | 결과 artifact의 최초 실패 단계 확인 필요 |
| 9 | negation | 6 | dev-general-015, dev-past-008, dev-past-014 | 결과 artifact의 최초 실패 단계 확인 필요 |
| 10 | schema | 4 | dev-general-015, dev-past-008, dev-past-012 | 결과 artifact의 최초 실패 단계 확인 필요 |
| 11 | semantic_validation | 1 | dev-general-016 | 결과 artifact의 최초 실패 단계 확인 필요 |

이번 평가 브랜치에서는 위 오류를 수정하지 않는다.

## 9. 수동 감사 범위

- manifest: `.artifacts/survey-regression/v1/preview-100-v1/audit-manifest.json`
- request failure, hard fallback, partial repair, clarification, fatal failure는 전수 감사 대상이다.
- clean model success 20개와 deterministic normalization 10개는 고정 seed 표본이다.

## 10. 토큰 최적화 진입 판정

판정: **NOT_READY_FOR_TOKEN_OPTIMIZATION**

```json
{
  "complete": true,
  "noFatal": false,
  "noClearHardFallback": false,
  "noRequestFailure": false,
  "clarificationPerfect": false,
  "noUnexpectedClarification": false,
  "cleanOrNormalizedAtLeast90": false,
  "partialRepairAtMost10": false,
  "holdoutNoFatal": false,
  "holdoutNoHardFallback": false,
  "holdoutNoRequestFailure": false
}
```
