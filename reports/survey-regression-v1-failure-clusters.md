# Survey Regression v1 Failure Clusters

## Method

- Frozen run: `preview-100-v1`
- Application baseline: `b2c52ca82af1c5c16fae3fb72af20bf34436f8c7`
- Manually confirmed failures: 92
- Ambiguous specifications excluded: 3
- OpenAI calls during clustering: 0
- Assignment rule: each actual failure receives exactly one earliest/root cluster; later symptoms remain evaluator codes, not extra root counts.
- Existing holdout status: `regression-v1-seen-holdout` because its outputs have already been inspected.

## Priority summary

Priority score = case count × severity × generalization coefficient.

| Rank | Root cluster | Cases | Dev | Seen holdout | Domains | Severity | Generalization | Score |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | Canonical intent role preservation | 43 | 33 | 10 | 14 | 5 | 1.00 | 215.00 |
| 2 | Model-output rejection and hard fallback | 19 | 16 | 3 | 8 | 5 | 0.95 | 90.25 |
| 3 | Request execution and response contract failure | 15 | 12 | 3 | 9 | 5 | 0.90 | 67.50 |
| 4 | Clarification policy mismatch | 8 | 6 | 2 | 2 | 4 | 0.80 | 25.60 |
| 5 | Question-plan coverage and quality | 7 | 6 | 1 | 4 | 4 | 0.80 | 22.40 |

The top three clusters explain 77/92 actual failures (83.70%), exceeding the required 60% threshold. These are the only production-code candidates to address first; later clusters remain gated behind replay and control tests.

## Canonical intent role preservation

- Cases: 43 (Dev 33, regression-v1-seen-holdout 10)
- Representative cases: `dev-complex-001`, `dev-complex-003`, `dev-complex-004`, `dev-complex-005`, `dev-complex-009`
- Distinct domains: 14 (academic_course, academic_satisfaction, consumer_behavior, digital_service, event_program, facility_mobility, food_service, lifestyle_behavior, multiple_target_comparison, noisy_input, relationship_research, reversed_roles, single_multi_purpose, teamwork_school_life)
- First failure stage: canonical intent parsing and role extraction
- Related files/functions: app/survey-canonical-intent.ts::parseCanonicalSurveyIntent -> app/survey-context-core.ts::parseSurveyGenerationContextCore / app/survey-semantic-intent-core.ts::parseSurveyIntentFromCanonicalSource
- Final generation paths: `{"deterministic_metadata_normalization":31,"partial_repair":12}`
- Severity: 5/5
- Generalization coefficient: 1.00
- Priority score: 215.00
- Expected resolved cases: 43

### Causal hypothesis

응답 대상, 조사 대상, 활동, 부정 조건, 관계 목적을 분리하기 전에 자유 입력의 일부 또는 전체를 targetPopulation/evaluationTarget으로 재사용하여 이후 plan과 model prompt가 이미 왜곡된 의미를 전달함.

### Common trace evidence

- dev-complex-001은 OpenAI 호출 전 canonical surveyObject가 중앙도서관이라는 단일 시설이 아니라 만족도·혼잡·예약 기능까지 합친 긴 목적어로 저장됨.
- dev-complex-009는 canonical evaluationTarget에 '에게 ... 묻고 싶어'라는 요청 문장 조각이 남고 mobility 입력이 attitude로 분류됨.
- dev-general-013은 canonical surveyObject가 실제 플랫폼 온새미가 아니라 기관인 새봄대학교로 축약됨.
- dev-past-004와 dev-past-009는 각각 비이용 조건 또는 전체 대학생 범위가 canonical targetPopulation 단계에서 유실·축소됨.

### General fix principle

사용자 원문을 역할별 구조로 분리하고 canonical respondent, object, activity, purpose, negation을 단일 권한으로 유지하며 하위 parser와 plan은 이를 재해석하지 않고 파생만 함.

### Regression risk

기존 service/facility usage 입력에서 정상적으로 좁혀진 이용자 조건까지 과도하게 넓힐 수 있으므로 이용자·비이용자·전체 집단 control이 필요함.

## Model-output rejection and hard fallback

- Cases: 19 (Dev 16, regression-v1-seen-holdout 3)
- Representative cases: `dev-complex-002`, `dev-complex-006`, `dev-complex-007`, `dev-complex-008`, `dev-complex-013`
- Distinct domains: 8 (consumer_behavior, digital_service, facility_mobility, food_service, lifestyle_behavior, multiple_target_comparison, relationship_research, single_multi_purpose)
- First failure stage: model output parse, semantic/quality validation, and fallback selection
- Related files/functions: app/survey-ai.ts::parseSurveyDraftResponse and app/api/survey-draft/route.ts::respondWithPlanBasedFallback / fallbackResponse / outputRejectionFallbackSource
- Final generation paths: `{"hard_fallback":19}`
- Severity: 5/5
- Generalization coefficient: 0.95
- Priority score: 90.25
- Expected resolved cases: 19

### Causal hypothesis

복구 가능한 모델 출력과 치명적 출력이 같은 거절 경로로 합쳐지고 validator 또는 required-block 복구가 실패하면 정상 질문까지 폐기한 뒤 범용 blueprint 설문으로 교체함.

### Common trace evidence

- 19개 hard fallback 중 17개가 fallbackReason=model-output-rejected 및 generationSource=openai_question_validation_fallback으로 수렴함.
- 같은 경로가 음식, 관계, 디지털 서비스, 이동, 다중 대상 비교 등 서로 다른 도메인에서 반복됨.
- fallback 결과는 질문 수를 채우더라도 원래 목적 coverage와 역할 정보를 잃어 경로 기준과 의미 기준을 모두 실패함.

### General fix principle

parse/semantic/quality issue를 복구 가능성과 치명도로 구분하고, 결정적 metadata만 정규화하며 정상 질문은 보존하고 hard fallback은 최후 수단으로 제한함.

### Regression risk

validator 완화가 실제 의미 오류를 통과시킬 수 있으므로 복구 가능한 metadata와 질문·선택지의 치명적 오류 경계를 회귀 테스트로 고정해야 함.

## Request execution and response contract failure

- Cases: 15 (Dev 12, regression-v1-seen-holdout 3)
- Representative cases: `dev-clarify-002`, `dev-complex-010`, `dev-complex-014`, `dev-general-015`, `dev-general-016`
- Distinct domains: 9 (clarification, consumer_behavior, digital_service, event_program, facility_mobility, lifestyle_behavior, relationship_research, reversed_roles, teamwork_school_life)
- First failure stage: route-level parse/repair/fallback response validation
- Related files/functions: app/api/survey-draft/route.ts::fallbackResponse and POST /api/survey-draft error/contract branches
- Final generation paths: `{"request_failure":15}`
- Severity: 5/5
- Generalization coefficient: 0.90
- Priority score: 67.50
- Expected resolved cases: 15

### Causal hypothesis

Responses API가 completed이고 output_parsed가 존재하는 경우에도 parse·repair·fallback 검증 뒤 422로 종료되며, fallback 자체가 schema/semantic 검사를 통과하지 못하면 구조화된 survey 대신 request failure를 반환함.

### Common trace evidence

- 15개 request failure 중 13개가 HTTP 422이고 2개가 HTTP 500임.
- 대부분의 422 사례에서 upstream response.status=completed이며 output_parsed도 존재해 네트워크나 모델 timeout보다 서버 후처리 계약이 최초 실패 지점임.
- route의 fallbackResponse는 대체 설문 validation issue가 남으면 REPAIR_EXHAUSTED 422를 반환하므로 fallback이 실패를 흡수하지 못하고 요청 전체 실패로 승격됨.

### General fix principle

OpenAI 결과, repair, fallback, 최종 response contract를 같은 SurveyPlan과 검증 계약으로 연결하고 각 실패 stage를 보존하며, 정상 입력은 유효한 survey 또는 명시적 clarification으로만 종료함.

### Regression risk

422를 단순 200으로 바꾸면 불완전 설문을 노출할 수 있으므로 최종 schema·semantic·question-count gate는 유지해야 함.

## Clarification policy mismatch

- Cases: 8 (Dev 6, regression-v1-seen-holdout 2)
- Representative cases: `dev-clarify-001`, `dev-clarify-003`, `dev-clarify-004`, `dev-clarify-005`, `dev-clarify-006`
- Distinct domains: 2 (academic_course, clarification)
- First failure stage: ambiguity detection before generation
- Related files/functions: canonical intent completeness checks and POST /api/survey-draft clarification branch
- Final generation paths: `{"clarification":1,"deterministic_metadata_normalization":7}`
- Severity: 4/5
- Generalization coefficient: 0.80
- Priority score: 25.60
- Expected resolved cases: 8

### Causal hypothesis

대상 또는 목적이 실제로 모호한 입력과 짧지만 충분히 명확한 입력을 같은 완성도 규칙으로 처리하여 불필요한 설문 생성 또는 불필요한 clarification을 만듦.

### Common trace evidence

- dev-clarify-001, dev-clarify-003, holdout-clarify-001처럼 필수 역할이 없는 입력에도 임의 설문이 생성됨.
- dev-clarify-006처럼 생성 가능한 입력에는 반대로 clarification이 반환됨.
- clarification 기대·비기대 사례가 모두 실패해 단일 문장 표현보다 completeness policy 결함을 가리킴.

### General fix principle

canonical role completeness와 후보 신뢰도를 기준으로 clarification을 결정하고, 질문은 실제로 빠진 역할 하나를 해소하도록 만듦.

### Regression risk

threshold 조정으로 명확한 입력을 막거나 모호한 입력을 억지 생성할 수 있으므로 양방향 control이 필요함.

## Question-plan coverage and quality

- Cases: 7 (Dev 6, regression-v1-seen-holdout 1)
- Representative cases: `dev-general-002`, `dev-general-006`, `dev-general-011`, `dev-general-028`, `dev-past-007`
- Distinct domains: 4 (academic_course, consumer_behavior, facility_mobility, food_service)
- First failure stage: SurveyPlan block coverage and final question quality validation
- Related files/functions: app/survey-planning.ts::createSurveyPlan and app/survey-intent.ts::validateSurvey
- Final generation paths: `{"deterministic_metadata_normalization":1,"partial_repair":6}`
- Severity: 4/5
- Generalization coefficient: 0.80
- Priority score: 22.40
- Expected resolved cases: 7

### Causal hypothesis

canonical 역할이 비교적 보존되고 요청이 성공해도 복수 목적의 required block, 직접 만족도, 문항 수, screener 위치와 중복 construct가 최종 질문에 일관되게 연결되지 않음.

### Common trace evidence

- dev-general-017과 dev-past-012 등은 필요한 결과 구조 또는 직접 측정 block이 빠져 request/quality issue로 이어짐.
- dev-general-028은 이용 여부 screener가 경험 문항 뒤에 배치되고 dev-past-017은 불편 construct가 중복되는 반면 전반 만족도는 누락됨.
- 서로 다른 목적·문항 유형에서 required concept와 실제 질문 역할 연결이 끊김.

### General fix principle

SurveyPlan block ID를 최종 질문 역할과 연결하고 문항 수·순서·직접 측정·중복 방지를 동일한 plan-aware validator로 검증함.

### Regression risk

필수 block을 기계적으로 추가하면 문항 수 초과나 중복이 생길 수 있으므로 교체 우선순위와 requestedQuestionCount를 단일 source로 유지해야 함.

## First-root assignment

| Case | Split | Domain | First/root cluster | Final path | Regraded fatal codes |
| --- | --- | --- | --- | --- | --- |
| dev-clarify-001 | dev | clarification | Clarification policy mismatch | deterministic_metadata_normalization | EXPECTED_CLARIFICATION_MISSING |
| dev-clarify-002 | dev | clarification | Request execution and response contract failure | request_failure | EXPECTED_CLARIFICATION_MISSING |
| dev-clarify-003 | dev | clarification | Clarification policy mismatch | deterministic_metadata_normalization | EXPECTED_CLARIFICATION_MISSING |
| dev-clarify-004 | dev | clarification | Clarification policy mismatch | deterministic_metadata_normalization | EXPECTED_CLARIFICATION_MISSING |
| dev-clarify-005 | dev | clarification | Clarification policy mismatch | deterministic_metadata_normalization | EXPECTED_CLARIFICATION_MISSING |
| dev-clarify-006 | dev | clarification | Clarification policy mismatch | deterministic_metadata_normalization | EXPECTED_CLARIFICATION_MISSING |
| dev-complex-001 | dev | single_multi_purpose | Canonical intent role preservation | partial_repair | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| dev-complex-002 | dev | single_multi_purpose | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, TARGET_POPULATION_MISMATCH, NAMED_TERM_LOST, REQUIRED_CONCEPT_MISSING |
| dev-complex-003 | dev | single_multi_purpose | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| dev-complex-004 | dev | single_multi_purpose | Canonical intent role preservation | deterministic_metadata_normalization | SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| dev-complex-005 | dev | multiple_target_comparison | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH |
| dev-complex-006 | dev | multiple_target_comparison | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, TARGET_POPULATION_MISMATCH, SURVEY_OBJECT_MISMATCH |
| dev-complex-007 | dev | multiple_target_comparison | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, TARGET_POPULATION_MISMATCH, GENERIC_FILLER |
| dev-complex-008 | dev | multiple_target_comparison | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| dev-complex-009 | dev | reversed_roles | Canonical intent role preservation | deterministic_metadata_normalization | SURVEY_OBJECT_MISMATCH, MALFORMED_SEMANTIC_PHRASE |
| dev-complex-010 | dev | reversed_roles | Request execution and response contract failure | request_failure | REQUEST_FAILURE, SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH |
| dev-complex-011 | dev | reversed_roles | Canonical intent role preservation | partial_repair | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING |
| dev-complex-012 | dev | reversed_roles | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING |
| dev-complex-013 | dev | relationship_research | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, REQUIRED_CONCEPT_MISSING |
| dev-complex-014 | dev | relationship_research | Request execution and response contract failure | request_failure | REQUEST_FAILURE, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH |
| dev-complex-015 | dev | relationship_research | Canonical intent role preservation | partial_repair | TARGET_POPULATION_MISMATCH, MALFORMED_SEMANTIC_PHRASE |
| dev-complex-016 | dev | relationship_research | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, TARGET_POPULATION_MISMATCH, MALFORMED_SEMANTIC_PHRASE, OVERALL_SATISFACTION_MISSING |
| dev-general-001 | dev | academic_course | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH |
| dev-general-002 | dev | academic_course | Question-plan coverage and quality | partial_repair | GENERIC_FILLER |
| dev-general-003 | dev | academic_course | Canonical intent role preservation | deterministic_metadata_normalization | SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| dev-general-004 | dev | academic_course | Clarification policy mismatch | clarification | UNEXPECTED_CLARIFICATION |
| dev-general-006 | dev | facility_mobility | Question-plan coverage and quality | partial_repair | REQUIRED_CONCEPT_MISSING, GENERIC_FILLER |
| dev-general-007 | dev | facility_mobility | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING |
| dev-general-008 | dev | facility_mobility | Canonical intent role preservation | partial_repair | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING, GENERIC_FILLER |
| dev-general-009 | dev | food_service | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, REQUIRED_CONCEPT_MISSING, FORBIDDEN_CONCEPT_PRESENT, GENERIC_FILLER |
| dev-general-010 | dev | food_service | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH |
| dev-general-011 | dev | food_service | Question-plan coverage and quality | partial_repair | GENERIC_FILLER |
| dev-general-012 | dev | food_service | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING, GENERIC_FILLER, OVERALL_SATISFACTION_MISSING |
| dev-general-013 | dev | digital_service | Canonical intent role preservation | partial_repair | TARGET_POPULATION_MISMATCH, SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| dev-general-014 | dev | digital_service | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, GENERIC_FILLER, OVERALL_SATISFACTION_MISSING |
| dev-general-015 | dev | digital_service | Request execution and response contract failure | request_failure | REQUEST_FAILURE, TARGET_POPULATION_MISMATCH, NAMED_TERM_LOST, NEGATION_LOST, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH, SCHEMA_ISSUES |
| dev-general-016 | dev | digital_service | Request execution and response contract failure | request_failure | REQUEST_FAILURE, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH, SEMANTIC_ISSUES |
| dev-general-017 | dev | event_program | Request execution and response contract failure | request_failure | REQUEST_FAILURE, SURVEY_OBJECT_MISMATCH, NAMED_TERM_LOST, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, OVERALL_SATISFACTION_MISSING, QUESTION_COUNT_MISMATCH |
| dev-general-018 | dev | event_program | Canonical intent role preservation | deterministic_metadata_normalization | SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| dev-general-019 | dev | event_program | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING |
| dev-general-021 | dev | teamwork_school_life | Request execution and response contract failure | request_failure | REQUEST_FAILURE, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, OVERALL_SATISFACTION_MISSING, QUESTION_COUNT_MISMATCH |
| dev-general-022 | dev | teamwork_school_life | Canonical intent role preservation | deterministic_metadata_normalization | SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING |
| dev-general-023 | dev | teamwork_school_life | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| dev-general-025 | dev | consumer_behavior | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING, GENERIC_FILLER |
| dev-general-027 | dev | consumer_behavior | Request execution and response contract failure | request_failure | REQUEST_FAILURE, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, OVERALL_SATISFACTION_MISSING, QUESTION_COUNT_MISMATCH |
| dev-general-028 | dev | consumer_behavior | Question-plan coverage and quality | partial_repair | MISPLACED_SCREENING_QUESTION |
| dev-general-029 | dev | lifestyle_behavior | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK |
| dev-general-030 | dev | lifestyle_behavior | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, GENERIC_FILLER |
| dev-general-031 | dev | lifestyle_behavior | Canonical intent role preservation | partial_repair | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING |
| dev-general-032 | dev | lifestyle_behavior | Request execution and response contract failure | request_failure | REQUEST_FAILURE, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, OVERALL_SATISFACTION_MISSING, QUESTION_COUNT_MISMATCH |
| dev-noisy-001 | dev | noisy_input | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH |
| dev-noisy-003 | dev | noisy_input | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| dev-noisy-004 | dev | noisy_input | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING |
| dev-noisy-005 | dev | noisy_input | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING |
| dev-noisy-006 | dev | noisy_input | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH |
| dev-past-002 | dev | academic_satisfaction | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH |
| dev-past-003 | dev | academic_satisfaction | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH |
| dev-past-004 | dev | academic_satisfaction | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH |
| dev-past-005 | dev | facility_mobility | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING |
| dev-past-006 | dev | facility_mobility | Request execution and response contract failure | request_failure | REQUEST_FAILURE, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH |
| dev-past-007 | dev | facility_mobility | Question-plan coverage and quality | partial_repair | REQUIRED_CONCEPT_MISSING |
| dev-past-008 | dev | facility_mobility | Request execution and response contract failure | request_failure | REQUEST_FAILURE, NEGATION_LOST, REQUIRED_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH, SCHEMA_ISSUES |
| dev-past-009 | dev | digital_service | Canonical intent role preservation | partial_repair | TARGET_POPULATION_MISMATCH |
| dev-past-010 | dev | digital_service | Canonical intent role preservation | partial_repair | TARGET_POPULATION_MISMATCH, SURVEY_OBJECT_MISMATCH, GENERIC_FILLER |
| dev-past-011 | dev | digital_service | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, REQUIRED_CONCEPT_MISSING |
| dev-past-012 | dev | digital_service | Request execution and response contract failure | request_failure | REQUEST_FAILURE, NAMED_TERM_LOST, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, OVERALL_SATISFACTION_MISSING, QUESTION_COUNT_MISMATCH, SCHEMA_ISSUES |
| dev-past-013 | dev | food_service | Canonical intent role preservation | partial_repair | TARGET_POPULATION_MISMATCH |
| dev-past-015 | dev | food_service | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING, GENERIC_FILLER, OVERALL_SATISFACTION_MISSING |
| dev-past-016 | dev | food_service | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, REQUIRED_CONCEPT_MISSING, FORBIDDEN_CONCEPT_PRESENT, GENERIC_FILLER |
| dev-past-017 | dev | food_service | Question-plan coverage and quality | partial_repair | DUPLICATE_CONSTRUCT, OVERALL_SATISFACTION_MISSING |
| dev-past-018 | dev | food_service | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING |
| dev-past-019 | dev | food_service | Canonical intent role preservation | deterministic_metadata_normalization | SURVEY_OBJECT_MISMATCH |
| dev-past-020 | dev | food_service | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING, OVERALL_SATISFACTION_MISSING |
| holdout-clarify-001 | regression-v1-seen-holdout | clarification | Clarification policy mismatch | deterministic_metadata_normalization | EXPECTED_CLARIFICATION_MISSING |
| holdout-clarify-002 | regression-v1-seen-holdout | clarification | Clarification policy mismatch | deterministic_metadata_normalization | EXPECTED_CLARIFICATION_MISSING |
| holdout-complex-001 | regression-v1-seen-holdout | single_multi_purpose | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING |
| holdout-complex-002 | regression-v1-seen-holdout | multiple_target_comparison | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING |
| holdout-complex-003 | regression-v1-seen-holdout | relationship_research | Model-output rejection and hard fallback | hard_fallback | HARD_FALLBACK, REQUIRED_CONCEPT_MISSING |
| holdout-complex-004 | regression-v1-seen-holdout | reversed_roles | Canonical intent role preservation | deterministic_metadata_normalization | SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING |
| holdout-general-001 | regression-v1-seen-holdout | academic_course | Question-plan coverage and quality | deterministic_metadata_normalization | REQUIRED_CONCEPT_MISSING |
| holdout-general-002 | regression-v1-seen-holdout | facility_mobility | Canonical intent role preservation | deterministic_metadata_normalization | SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| holdout-general-003 | regression-v1-seen-holdout | food_service | Canonical intent role preservation | deterministic_metadata_normalization | SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING |
| holdout-general-004 | regression-v1-seen-holdout | digital_service | Request execution and response contract failure | request_failure | REQUEST_FAILURE, TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, OVERALL_SATISFACTION_MISSING, QUESTION_COUNT_MISMATCH, SCHEMA_ISSUES |
| holdout-general-005 | regression-v1-seen-holdout | event_program | Canonical intent role preservation | deterministic_metadata_normalization | SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| holdout-general-006 | regression-v1-seen-holdout | teamwork_school_life | Canonical intent role preservation | partial_repair | TARGET_POPULATION_MISMATCH, SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING |
| holdout-general-007 | regression-v1-seen-holdout | consumer_behavior | Canonical intent role preservation | partial_repair | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING |
| holdout-general-008 | regression-v1-seen-holdout | lifestyle_behavior | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| holdout-noisy-001 | regression-v1-seen-holdout | noisy_input | Canonical intent role preservation | partial_repair | TARGET_POPULATION_MISMATCH, NEGATION_LOST, REQUIRED_CONCEPT_MISSING, GENERIC_FILLER |
| holdout-noisy-002 | regression-v1-seen-holdout | noisy_input | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| holdout-past-002 | regression-v1-seen-holdout | facility_mobility | Canonical intent role preservation | deterministic_metadata_normalization | TARGET_POPULATION_MISMATCH, SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING |
| holdout-past-003 | regression-v1-seen-holdout | digital_service | Request execution and response contract failure | request_failure | REQUEST_FAILURE, NAMED_TERM_LOST, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, OVERALL_SATISFACTION_MISSING, QUESTION_COUNT_MISMATCH |
| holdout-past-004 | regression-v1-seen-holdout | digital_service | Request execution and response contract failure | request_failure | REQUEST_FAILURE, SURVEY_OBJECT_MISMATCH, REQUIRED_CONCEPT_MISSING, REQUIRED_CONCEPT_MISSING, QUESTION_COUNT_MISMATCH |
