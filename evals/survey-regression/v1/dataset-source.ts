import type { SurveyRegressionCase } from "./schema";

type Seed = Omit<SurveyRegressionCase, "id" | "split"> & { id: string };

const survey = (
  id: string,
  stratum: SurveyRegressionCase["stratum"],
  category: string,
  input: string,
  target: string[],
  object: string[],
  purpose: string[],
  required: string[],
  terms: string[] = [],
  overrides: Partial<Seed> = {},
): Seed => ({
  id,
  stratum,
  category,
  difficulty: "medium",
  surveyMode: "standard",
  questionCount: 7,
  input,
  expectedOutcome: "survey",
  expectedTargetPopulation: target,
  expectedSurveyObject: object,
  expectedPurposeConcepts: purpose,
  mustPreserveTerms: terms,
  mustPreserveNegation: false,
  requiredQuestionConcepts: required,
  forbiddenTargetExpansions: [],
  forbiddenSurveyObjects: [],
  forbiddenQuestionConcepts: ["generic filler", "무관한 인구통계"],
  clarificationExpected: false,
  expectedIntentModes: ["single"],
  expectedTargetCardinality: "single",
  expectedArchetypes: ["mixed", "attitude", "satisfaction", "service_usage"],
  tags: [],
  notes: "",
  ...overrides,
});

const clarify = (
  id: string,
  input: string,
  object: string,
  notes: string,
): Seed => ({
  ...survey(
    id,
    "clarification",
    "clarification",
    input,
    ["구체화가 필요한 응답 대상"],
    [object],
    ["조사 방향 확인"],
    [],
    input.includes(object) ? [object] : [],
  ),
  difficulty: "hard",
  expectedOutcome: "clarification",
  clarificationExpected: true,
  expectedArchetypes: ["unresolved", "mixed"],
  tags: ["clarification"],
  notes,
});

export const devSeed = "baroform-regression-v1-dev-20260818";
export const holdoutSeed = "baroform-regression-v1-holdout-20260818";
export const datasetGeneratedAt = "2026-08-18T00:00:00.000Z";

const devSeeds: Seed[] = [
  // A. 실제 과거 오류 및 표현 변형 20개
  survey("dev-past-001", "past_error_variant", "academic_satisfaction", "경영대에 대한 연세대 경영대생들 만족도", ["연세대 경영대생"], ["경영대"], ["만족도"], ["만족도", "개선 요구"], ["연세대", "경영대"], { tags: ["complex_order"], expectedArchetypes: ["satisfaction"] }),
  survey("dev-past-002", "past_error_variant", "academic_satisfaction", "최근 한 학기 동안 연세대 경영대생이 느낀 경영대 시설 만족도와 개선점을 조사해줘", ["연세대 경영대생"], ["경영대 시설"], ["만족도", "개선 요구"], ["만족도", "불편", "개선 요구"], ["연세대", "경영대"], { tags: ["timeframe", "single_target_multi_purpose", "complex_order"], expectedArchetypes: ["satisfaction", "facility_usage"] }),
  survey("dev-past-003", "past_error_variant", "academic_satisfaction", "경영대생들 경영대 시설 괜찮았는지랑 불편했던 점 조사", ["경영대생"], ["경영대 시설"], ["만족도", "불편"], ["만족도", "불편"], ["경영대"], { difficulty: "hard", tags: ["noisy_input", "single_target_multi_purpose"] }),
  survey("dev-past-004", "past_error_variant", "academic_satisfaction", "경영대 시설을 이용하지 않는 연세대 경영대생의 비이용 이유와 학교 이미지", ["경영대 시설을 이용하지 않는 연세대 경영대생"], ["경영대 시설"], ["비이용 이유", "이미지"], ["비이용 이유", "인식"], ["연세대", "경영대"], { mustPreserveNegation: true, tags: ["negation", "single_target_multi_purpose", "complex_order"], expectedArchetypes: ["attitude", "facility_usage"], forbiddenQuestionConcepts: ["이용 만족도 강제", "generic filler"] }),
  survey("dev-past-005", "past_error_variant", "facility_mobility", "연세대학교 학생들의 대우관 등하교 경험", ["연세대학교 학생"], ["대우관", "대우관 이동 경험"], ["이동 경험", "불편"], ["이동 빈도", "이동 수단", "소요 시간", "혼잡", "안전", "불편"], ["연세대학교", "대우관"], { expectedArchetypes: ["mobility_experience"] }),
  survey("dev-past-006", "past_error_variant", "facility_mobility", "대우관 오갈 때 학생들 이동수단이랑 얼마나 걸리는지, 뭐가 불편한지", ["대우관을 오가는 학생"], ["대우관 이동"], ["이동 수단", "소요 시간", "불편"], ["이동 수단", "소요 시간", "불편"], ["대우관"], { difficulty: "hard", tags: ["noisy_input", "single_target_multi_purpose"], expectedArchetypes: ["mobility_experience"] }),
  survey("dev-past-007", "past_error_variant", "facility_mobility", "지난달 연세대 재학생이 대우관을 방문한 빈도와 혼잡·안전 경험 조사", ["연세대 재학생"], ["대우관"], ["방문 빈도", "혼잡", "안전"], ["이동 빈도", "혼잡", "안전"], ["연세대", "대우관"], { tags: ["timeframe", "single_target_multi_purpose"], expectedArchetypes: ["mobility_experience", "facility_usage"] }),
  survey("dev-past-008", "past_error_variant", "facility_mobility", "대우관에 가지 않는 연세대 학생이 방문하지 않는 이유", ["대우관에 가지 않는 연세대 학생"], ["대우관"], ["비방문 이유"], ["비이용 이유"], ["연세대", "대우관"], { mustPreserveNegation: true, tags: ["negation", "complex_order"], expectedArchetypes: ["attitude", "mobility_experience"], forbiddenQuestionConcepts: ["방문 만족도 강제", "generic filler"] }),
  survey("dev-past-009", "past_error_variant", "digital_service", "국내 최대 웹툰 플랫폼인 네이버 웹툰의 대학생들의 이용 현황과 경험", ["대학생"], ["네이버 웹툰"], ["이용 현황", "이용 경험"], ["이용 경험", "이용 빈도", "만족도", "불편"], ["네이버 웹툰"], { tags: ["complex_order", "single_target_multi_purpose"], expectedArchetypes: ["service_usage"] }),
  survey("dev-past-010", "past_error_variant", "digital_service", "네웹 안 쓰는 대학생들 왜 안 쓰는지랑 앞으로 쓸 생각 있는지", ["네이버 웹툰을 이용하지 않는 대학생"], ["네이버 웹툰"], ["비이용 이유", "이용 의향"], ["비이용 이유", "이용 의향"], ["네웹"], { difficulty: "hard", mustPreserveNegation: true, tags: ["negation", "noisy_input", "single_target_multi_purpose"], expectedArchetypes: ["attitude", "need_demand"], forbiddenQuestionConcepts: ["현재 이용 만족도", "generic filler"] }),
  survey("dev-past-011", "past_error_variant", "digital_service", "최근 3개월 대학생의 네이버 웹툰 이용 빈도와 이용 시간 조사", ["대학생"], ["네이버 웹툰"], ["이용 빈도", "이용 시간"], ["이용 경험", "이용 빈도", "이용 시간"], ["네이버 웹툰"], { tags: ["timeframe", "single_target_multi_purpose"], expectedArchetypes: ["service_usage"] }),
  survey("dev-past-012", "past_error_variant", "digital_service", "대학생이 네이버 웹툰과 카카오페이지를 이용하는 빈도와 만족도를 비교", ["대학생"], ["네이버 웹툰", "카카오페이지"], ["이용 빈도 비교", "만족도 비교"], ["이용 빈도", "만족도", "대상 비교"], ["네이버 웹툰", "카카오페이지"], { expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["multiple_targets", "single_target_multi_purpose"], expectedArchetypes: ["mixed", "service_usage"] }),
  survey("dev-past-013", "past_error_variant", "food_service", "연세대학교 학생들의 한경관 학식 이용 경험", ["연세대학교 학생"], ["한경관 학식"], ["이용 경험"], ["이용 경험", "이용 빈도", "만족도"], ["연세대학교", "한경관"], { expectedArchetypes: ["service_usage", "facility_usage"] }),
  survey("dev-past-014", "past_error_variant", "food_service", "한경관 학식을 먹지 않는 연세대 학생들의 비이용 이유", ["한경관 학식을 먹지 않는 연세대 학생"], ["한경관 학식"], ["비이용 이유"], ["비이용 이유"], ["연세대", "한경관"], { mustPreserveNegation: true, tags: ["negation", "complex_order"], expectedArchetypes: ["attitude", "service_usage"] }),
  survey("dev-past-015", "past_error_variant", "food_service", "이번 학기 연세대생 한경관 학식 얼마나 자주 먹고 메뉴에는 만족하는지", ["연세대생"], ["한경관 학식"], ["이용 빈도", "메뉴 만족도"], ["이용 빈도", "만족도"], ["연세대", "한경관"], { tags: ["timeframe", "noisy_input", "single_target_multi_purpose"], expectedArchetypes: ["service_usage", "satisfaction"] }),
  survey("dev-past-016", "past_error_variant", "food_service", "연세대 학생이 한경관 학식과 고를샘 식당을 선택하는 이유와 만족도 비교", ["연세대 학생"], ["한경관 학식", "고를샘 식당"], ["선택 이유", "만족도 비교"], ["선택 이유", "만족도", "대상 비교"], ["연세대", "한경관", "고를샘"], { expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["multiple_targets", "complex_order"], expectedArchetypes: ["mixed", "satisfaction"] }),
  survey("dev-past-017", "past_error_variant", "food_service", "맛나샘을 이용하는 학생들의 만족도와 개선 의견", ["맛나샘을 이용하는 학생"], ["맛나샘"], ["만족도", "개선 요구"], ["만족도", "불편", "개선 요구"], ["맛나샘"], { tags: ["single_target_multi_purpose"], expectedArchetypes: ["satisfaction", "service_usage"] }),
  survey("dev-past-018", "past_error_variant", "food_service", "맛나샘 안 가는 학생들 이유 조사해줘", ["맛나샘을 이용하지 않는 학생"], ["맛나샘"], ["비이용 이유"], ["비이용 이유"], ["맛나샘"], { difficulty: "hard", mustPreserveNegation: true, tags: ["negation", "noisy_input"], expectedArchetypes: ["attitude", "service_usage"] }),
  survey("dev-past-019", "past_error_variant", "food_service", "최근 한 달 맛나샘 이용 학생의 방문 빈도와 음식 만족도", ["맛나샘 이용 학생"], ["맛나샘"], ["이용 빈도", "음식 만족도"], ["이용 빈도", "만족도"], ["맛나샘"], { tags: ["timeframe", "single_target_multi_purpose"], expectedArchetypes: ["service_usage", "satisfaction"] }),
  survey("dev-past-020", "past_error_variant", "food_service", "맛나샘 학생들 맛 서비스 둘다 어떤지 불편도", ["맛나샘 이용 학생"], ["맛나샘"], ["음식 만족도", "서비스 만족도", "불편"], ["만족도", "불편"], ["맛나샘"], { difficulty: "hard", tags: ["noisy_input", "single_target_multi_purpose"], expectedArchetypes: ["satisfaction"] }),

  // B. 일반 영역별 입력 32개
  survey("dev-general-001", "general_domain", "academic_course", "새봄대학교 심리학과 1학년의 이번 학기 온라인 강의 만족도", ["새봄대학교 심리학과 1학년"], ["온라인 강의"], ["만족도"], ["만족도", "불편", "개선 요구"], ["새봄대학교", "심리학과"], { tags: ["virtual_entity", "timeframe"], expectedArchetypes: ["learning_experience", "satisfaction"] }),
  survey("dev-general-002", "general_domain", "academic_course", "직장인이 퇴근 후 듣는 야간 강좌의 학습 효과와 어려움", ["야간 강좌를 듣는 직장인"], ["야간 강좌"], ["학습 효과", "어려움"], ["학습 효과", "불편"], ["직장인", "야간 강좌"], { tags: ["non_university", "single_target_multi_purpose", "complex_order"], expectedArchetypes: ["learning_experience"] }),
  survey("dev-general-003", "general_domain", "academic_course", "진로 특강에 참여하지 않은 대학생의 불참 이유와 향후 참여 의향", ["진로 특강에 참여하지 않은 대학생"], ["진로 특강"], ["비참여 이유", "참여 의향"], ["비이용 이유", "참여 의향"], ["진로 특강"], { mustPreserveNegation: true, tags: ["negation", "single_target_multi_purpose"], expectedArchetypes: ["event_program", "need_demand"] }),
  survey("dev-general-004", "general_domain", "academic_course", "통계학 강의와 프로그래밍 강의가 데이터 분석 자신감에 미치는 영향을 비교", ["두 강의를 수강한 학습자"], ["통계학 강의", "프로그래밍 강의"], ["데이터 분석 자신감 영향 비교"], ["수강 경험", "자신감", "대상 비교"], ["통계학", "프로그래밍"], { surveyMode: "research", difficulty: "hard", expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["multiple_targets"], expectedArchetypes: ["relationship_analysis", "mixed"] }),
  survey("dev-general-005", "general_domain", "facility_mobility", "새봄대학교 학생의 솔빛관 접근성과 이동 불편", ["새봄대학교 학생"], ["솔빛관 이동"], ["접근성", "이동 불편"], ["이동 빈도", "이동 수단", "소요 시간", "불편"], ["새봄대학교", "솔빛관"], { tags: ["virtual_entity", "single_target_multi_purpose"], expectedArchetypes: ["mobility_experience"] }),
  survey("dev-general-006", "general_domain", "facility_mobility", "출근하는 직장인의 환승역 혼잡과 이동 안전 체감", ["출근하는 직장인"], ["환승역 이동"], ["혼잡", "안전"], ["이동 수단", "혼잡", "안전"], ["직장인", "환승역"], { tags: ["non_university", "single_target_multi_purpose"], expectedArchetypes: ["mobility_experience"] }),
  survey("dev-general-007", "general_domain", "facility_mobility", "휠체어 이용자가 공공도서관에 방문할 때 겪는 접근성 문제", ["공공도서관을 방문하는 휠체어 이용자"], ["공공도서관"], ["접근성", "불편"], ["방문 경험", "접근성", "불편"], ["휠체어", "공공도서관"], { tags: ["non_university", "complex_order"], expectedArchetypes: ["mobility_experience", "facility_usage"] }),
  survey("dev-general-008", "general_domain", "facility_mobility", "자전거와 전동킥보드로 출퇴근하는 사람들의 이동 시간과 안전 경험 비교", ["자전거 또는 전동킥보드로 출퇴근하는 사람"], ["자전거 출퇴근", "전동킥보드 출퇴근"], ["이동 시간 비교", "안전 경험 비교"], ["소요 시간", "안전", "대상 비교"], ["자전거", "전동킥보드"], { expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["non_university", "multiple_targets", "complex_order"], expectedArchetypes: ["mobility_experience", "mixed"] }),
  survey("dev-general-009", "general_domain", "food_service", "새봄대학교 학생이 별마루 카페를 이용하는 빈도와 메뉴 만족도", ["새봄대학교 학생"], ["별마루 카페"], ["이용 빈도", "메뉴 만족도"], ["이용 빈도", "만족도"], ["새봄대학교", "별마루 카페"], { tags: ["virtual_entity", "single_target_multi_purpose"], expectedArchetypes: ["service_usage", "satisfaction"] }),
  survey("dev-general-010", "general_domain", "food_service", "재택근무자의 배달음식 주문 빈도와 지출 부담", ["재택근무자"], ["배달음식"], ["주문 빈도", "지출 부담"], ["구매 빈도", "비용"], ["재택근무자", "배달음식"], { tags: ["non_university", "single_target_multi_purpose"], expectedArchetypes: ["consumption_behavior"] }),
  survey("dev-general-011", "general_domain", "food_service", "편의점 간편식을 구매하지 않는 20대의 미구매 이유", ["편의점 간편식을 구매하지 않는 20대"], ["편의점 간편식"], ["미구매 이유"], ["비이용 이유"], ["편의점 간편식", "20대"], { mustPreserveNegation: true, tags: ["negation", "non_university"], expectedArchetypes: ["consumption_behavior", "attitude"] }),
  survey("dev-general-012", "general_domain", "food_service", "새봄대학교 별마루 식당과 해오름 식당의 가격·맛·대기시간 비교", ["새봄대학교 식당 이용자"], ["별마루 식당", "해오름 식당"], ["가격 비교", "맛 비교", "대기시간 비교"], ["비용", "만족도", "대기 시간", "대상 비교"], ["새봄대학교", "별마루 식당", "해오름 식당"], { expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["virtual_entity", "multiple_targets"], expectedArchetypes: ["mixed", "satisfaction"] }),
  survey("dev-general-013", "general_domain", "digital_service", "새봄대학교 구성원의 온새미 플랫폼 사용성과 오류 경험", ["새봄대학교 구성원"], ["온새미 플랫폼"], ["사용성", "오류 경험"], ["이용 경험", "사용성", "불편"], ["새봄대학교", "온새미 플랫폼"], { tags: ["virtual_entity", "single_target_multi_purpose"], expectedArchetypes: ["service_usage"] }),
  survey("dev-general-014", "general_domain", "digital_service", "동네 주민의 당근 앱 이용 목적과 거래 만족도", ["당근 앱을 이용하는 동네 주민"], ["당근 앱"], ["이용 목적", "거래 만족도"], ["이용 경험", "이용 목적", "만족도"], ["당근 앱", "동네 주민"], { tags: ["non_university", "single_target_multi_purpose"], expectedArchetypes: ["service_usage", "satisfaction"] }),
  survey("dev-general-015", "general_domain", "digital_service", "모바일 뱅킹을 사용하지 않는 고령층의 디지털 장벽", ["모바일 뱅킹을 사용하지 않는 고령층"], ["모바일 뱅킹"], ["비이용 이유", "디지털 장벽"], ["비이용 이유", "불편"], ["모바일 뱅킹", "고령층"], { mustPreserveNegation: true, tags: ["negation", "non_university"], expectedArchetypes: ["attitude", "need_demand"] }),
  survey("dev-general-016", "general_domain", "digital_service", "iOS용 공부 앱과 안드로이드용 공부 앱의 사용성 및 지속 사용 의향 비교", ["공부 앱 사용자"], ["iOS용 공부 앱", "안드로이드용 공부 앱"], ["사용성 비교", "지속 사용 의향 비교"], ["사용성", "이용 의향", "대상 비교"], ["iOS", "안드로이드"], { expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["non_university", "multiple_targets"], expectedArchetypes: ["mixed", "service_usage"] }),
  survey("dev-general-017", "general_domain", "event_program", "새봄대학교 축제 참가자의 프로그램 만족도와 재참여 의향", ["새봄대학교 축제 참가자"], ["새봄대학교 축제"], ["프로그램 만족도", "재참여 의향"], ["참여 경험", "만족도", "참여 의향"], ["새봄대학교"], { tags: ["virtual_entity", "single_target_multi_purpose"], expectedArchetypes: ["event_program", "satisfaction"] }),
  survey("dev-general-018", "general_domain", "event_program", "동아리에 가입하지 않은 학생의 미가입 이유와 관심 활동", ["동아리에 가입하지 않은 학생"], ["동아리"], ["미가입 이유", "관심 활동"], ["비이용 이유", "선호"], ["동아리"], { mustPreserveNegation: true, tags: ["negation", "single_target_multi_purpose"], expectedArchetypes: ["attitude", "need_demand"] }),
  survey("dev-general-019", "general_domain", "event_program", "지역 주민이 봄꽃 축제에 참여한 경험과 지역 상권 효과에 대한 인식", ["봄꽃 축제에 참여한 지역 주민"], ["봄꽃 축제"], ["참여 경험", "지역 상권 효과 인식"], ["참여 경험", "인식"], ["봄꽃 축제", "지역 주민"], { tags: ["non_university", "single_target_multi_purpose"], expectedArchetypes: ["event_program", "attitude"] }),
  survey("dev-general-020", "general_domain", "event_program", "멘토링 프로그램과 취업 캠프 참가자의 도움 정도 및 만족도 비교", ["두 프로그램 참가자"], ["멘토링 프로그램", "취업 캠프"], ["도움 정도 비교", "만족도 비교"], ["참여 경험", "학습 효과", "만족도", "대상 비교"], ["멘토링", "취업 캠프"], { expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["multiple_targets"], expectedArchetypes: ["mixed", "event_program"] }),
  survey("dev-general-021", "general_domain", "teamwork_school_life", "대학생 팀플에서 역할 분담 공정성과 의사소통 만족도", ["팀플 경험이 있는 대학생"], ["팀플"], ["역할 분담 공정성", "의사소통 만족도"], ["공정성", "의사소통", "만족도"], ["팀플"], { tags: ["single_target_multi_purpose"], expectedArchetypes: ["multidimensional_construct"] }),
  survey("dev-general-022", "general_domain", "teamwork_school_life", "교내 상담센터를 이용하지 않은 학생의 인지도와 이용 장벽", ["교내 상담센터를 이용하지 않은 학생"], ["교내 상담센터"], ["인지도", "비이용 이유"], ["인지", "비이용 이유"], ["상담센터"], { mustPreserveNegation: true, tags: ["negation", "single_target_multi_purpose"], expectedArchetypes: ["attitude", "need_demand"] }),
  survey("dev-general-023", "general_domain", "teamwork_school_life", "원격근무 팀원의 협업 도구 피로와 소속감", ["원격근무 팀원"], ["원격 협업"], ["협업 도구 피로", "소속감"], ["피로", "소속감"], ["원격근무"], { tags: ["non_university", "single_target_multi_purpose"], expectedArchetypes: ["multidimensional_construct"] }),
  survey("dev-general-024", "general_domain", "teamwork_school_life", "새봄대 학생들 학교생활 시간관리랑 스트레스", ["새봄대학교 학생"], ["학교생활"], ["시간 관리", "스트레스"], ["시간 사용", "스트레스"], ["새봄대"], { difficulty: "hard", tags: ["virtual_entity", "noisy_input", "single_target_multi_purpose"], expectedArchetypes: ["multidimensional_construct"] }),
  survey("dev-general-025", "general_domain", "consumer_behavior", "최근 3개월 1인 가구의 장보기 빈도와 물가 부담", ["1인 가구"], ["장보기"], ["구매 빈도", "물가 부담"], ["구매 빈도", "비용"], ["1인 가구"], { tags: ["non_university", "timeframe", "single_target_multi_purpose"], expectedArchetypes: ["consumption_behavior"] }),
  survey("dev-general-026", "general_domain", "consumer_behavior", "친환경 세제를 구매하지 않는 소비자의 미구매 이유와 가격 수용도", ["친환경 세제를 구매하지 않는 소비자"], ["친환경 세제"], ["미구매 이유", "가격 수용도"], ["비이용 이유", "비용"], ["친환경 세제"], { mustPreserveNegation: true, tags: ["negation", "non_university", "single_target_multi_purpose"], expectedArchetypes: ["consumption_behavior", "need_demand"] }),
  survey("dev-general-027", "general_domain", "consumer_behavior", "넷플릭스와 티빙 구독자의 이용 빈도·콘텐츠 만족도 비교", ["OTT 구독자"], ["넷플릭스", "티빙"], ["이용 빈도 비교", "콘텐츠 만족도 비교"], ["이용 빈도", "만족도", "대상 비교"], ["넷플릭스", "티빙"], { expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["non_university", "multiple_targets"], expectedArchetypes: ["mixed", "service_usage"] }),
  survey("dev-general-028", "general_domain", "consumer_behavior", "지역 주민의 공공자전거 이용 경험과 요금 만족도", ["공공자전거를 이용하는 지역 주민"], ["공공자전거"], ["이용 경험", "요금 만족도"], ["이용 경험", "이용 빈도", "만족도"], ["공공자전거", "지역 주민"], { tags: ["non_university", "single_target_multi_purpose"], expectedArchetypes: ["service_usage", "satisfaction"] }),
  survey("dev-general-029", "general_domain", "lifestyle_behavior", "대학생의 평일 수면 시간과 수업 집중도의 관계", ["대학생"], ["수면 시간", "수업 집중도"], ["변수 관계"], ["수면 시간", "집중도"], ["수면 시간", "수업 집중도"], { surveyMode: "research", difficulty: "hard", expectedArchetypes: ["relationship_analysis"], expectedIntentModes: ["composite"], tags: ["single_target_multi_purpose"] }),
  survey("dev-general-030", "general_domain", "lifestyle_behavior", "최근 한 달 직장인의 SNS 하루 이용 시간과 피로감", ["직장인"], ["SNS 이용"], ["이용 시간", "피로감"], ["이용 시간", "피로"], ["직장인", "SNS"], { tags: ["non_university", "timeframe", "single_target_multi_purpose"], expectedArchetypes: ["multidimensional_construct", "relationship_analysis"] }),
  survey("dev-general-031", "general_domain", "lifestyle_behavior", "주 1회도 운동하지 않는 성인의 운동 방해 요인", ["주 1회도 운동하지 않는 성인"], ["운동"], ["비실천 이유"], ["비이용 이유"], ["운동", "성인"], { mustPreserveNegation: true, tags: ["negation", "non_university", "timeframe"], expectedArchetypes: ["attitude", "need_demand"] }),
  survey("dev-general-032", "general_domain", "lifestyle_behavior", "독서와 팟캐스트 청취를 여가로 즐기는 사람들의 시간 사용과 만족도 비교", ["독서 또는 팟캐스트 청취를 즐기는 사람"], ["독서", "팟캐스트 청취"], ["시간 사용 비교", "만족도 비교"], ["시간 사용", "만족도", "대상 비교"], ["독서", "팟캐스트"], { expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["non_university", "multiple_targets", "complex_order"], expectedArchetypes: ["mixed", "behavior_usage"] }),

  // C. 관계가 복잡한 입력 16개
  survey("dev-complex-001", "complex_relation", "single_multi_purpose", "새봄대학교 중앙도서관 한 곳의 좌석 만족도, 혼잡 경험, 예약 기능 수요", ["새봄대학교 중앙도서관 이용자"], ["새봄대학교 중앙도서관"], ["좌석 만족도", "혼잡", "예약 기능 수요"], ["만족도", "혼잡", "서비스 필요성", "이용 의향"], ["새봄대학교", "중앙도서관"], { surveyMode: "research", difficulty: "hard", tags: ["virtual_entity", "single_target_multi_purpose"], expectedArchetypes: ["mixed", "facility_usage"] }),
  survey("dev-complex-002", "complex_relation", "single_multi_purpose", "배달 앱 한 개를 이용하는 1인 가구의 주문 습관과 지출, 구독 혜택 수요", ["배달 앱을 이용하는 1인 가구"], ["배달 앱"], ["주문 습관", "지출", "구독 혜택 수요"], ["구매 빈도", "비용", "서비스 필요성"], ["1인 가구", "배달 앱"], { surveyMode: "research", difficulty: "hard", tags: ["non_university", "single_target_multi_purpose", "complex_order"], expectedArchetypes: ["mixed", "consumption_behavior"] }),
  survey("dev-complex-003", "complex_relation", "single_multi_purpose", "학생상담 프로그램을 모르는 재학생의 인지도, 비이용 이유, 이용 의향", ["학생상담 프로그램을 이용하지 않는 재학생"], ["학생상담 프로그램"], ["인지도", "비이용 이유", "이용 의향"], ["인지", "비이용 이유", "이용 의향"], ["학생상담 프로그램"], { mustPreserveNegation: true, tags: ["negation", "single_target_multi_purpose"], expectedArchetypes: ["mixed", "need_demand"] }),
  survey("dev-complex-004", "complex_relation", "single_multi_purpose", "지역 체육관을 다니는 주민의 이용 패턴, 불편, 재등록 의향", ["지역 체육관을 다니는 주민"], ["지역 체육관"], ["이용 패턴", "불편", "재등록 의향"], ["이용 빈도", "불편", "이용 의향"], ["지역 체육관"], { tags: ["non_university", "single_target_multi_purpose"], expectedArchetypes: ["mixed", "facility_usage"] }),
  survey("dev-complex-005", "complex_relation", "multiple_target_comparison", "새봄대학교 솔빛관과 별마루관의 접근성·혼잡·안전 비교", ["새봄대학교 구성원"], ["솔빛관", "별마루관"], ["접근성 비교", "혼잡 비교", "안전 비교"], ["접근성", "혼잡", "안전", "대상 비교"], ["새봄대학교", "솔빛관", "별마루관"], { surveyMode: "research", difficulty: "hard", expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["virtual_entity", "multiple_targets"], expectedArchetypes: ["mixed", "mobility_experience"] }),
  survey("dev-complex-006", "complex_relation", "multiple_target_comparison", "온새미 플랫폼과 별마루 서비스 사용자의 편의성 및 신뢰도 차이", ["두 디지털 서비스를 사용한 사람"], ["온새미 플랫폼", "별마루 서비스"], ["편의성 비교", "신뢰도 비교"], ["사용성", "신뢰", "대상 비교"], ["온새미 플랫폼", "별마루 서비스"], { surveyMode: "research", difficulty: "hard", expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["virtual_entity", "non_university", "multiple_targets", "complex_order"], expectedArchetypes: ["mixed", "service_usage"] }),
  survey("dev-complex-007", "complex_relation", "multiple_target_comparison", "버스 통근자와 지하철 통근자의 소요 시간·혼잡·피로 비교", ["버스 또는 지하철 통근자"], ["버스 통근", "지하철 통근"], ["소요 시간 비교", "혼잡 비교", "피로 비교"], ["소요 시간", "혼잡", "피로", "대상 비교"], ["버스", "지하철"], { surveyMode: "research", difficulty: "hard", expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["non_university", "multiple_targets", "complex_order"], expectedArchetypes: ["mixed", "mobility_experience"] }),
  survey("dev-complex-008", "complex_relation", "multiple_target_comparison", "온라인 멘토링과 대면 멘토링에 참여한 청년의 도움 정도와 지속 참여 의향 비교", ["온라인 또는 대면 멘토링에 참여한 청년"], ["온라인 멘토링", "대면 멘토링"], ["도움 정도 비교", "지속 참여 의향 비교"], ["학습 효과", "참여 의향", "대상 비교"], ["온라인 멘토링", "대면 멘토링"], { surveyMode: "research", difficulty: "hard", expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["non_university", "multiple_targets", "complex_order"], expectedArchetypes: ["mixed", "event_program"] }),
  survey("dev-complex-009", "complex_relation", "reversed_roles", "새봄대학교 학생에게 솔빛관을 오갈 때 느끼는 혼잡과 안전을 묻고 싶어", ["새봄대학교 학생"], ["솔빛관 이동"], ["혼잡", "안전"], ["혼잡", "안전"], ["새봄대학교", "솔빛관"], { difficulty: "hard", tags: ["virtual_entity", "complex_order", "single_target_multi_purpose"], expectedArchetypes: ["mobility_experience"] }),
  survey("dev-complex-010", "complex_relation", "reversed_roles", "별마루 서비스를 안 쓰는 직장인 대상으로 서비스가 어려운 이유랑 필요한 기능", ["별마루 서비스를 사용하지 않는 직장인"], ["별마루 서비스"], ["비이용 이유", "기능 수요"], ["비이용 이유", "원하는 기능"], ["별마루 서비스", "직장인"], { mustPreserveNegation: true, tags: ["negation", "virtual_entity", "non_university", "complex_order", "single_target_multi_purpose"], expectedArchetypes: ["mixed", "need_demand"] }),
  survey("dev-complex-011", "complex_relation", "reversed_roles", "새 메뉴 만족도는 별마루 카페를 최근 한 달 이용한 주민한테 조사", ["최근 한 달 별마루 카페를 이용한 주민"], ["별마루 카페 새 메뉴"], ["만족도"], ["이용 경험", "만족도"], ["별마루 카페"], { difficulty: "hard", tags: ["virtual_entity", "non_university", "timeframe", "complex_order", "noisy_input"], expectedArchetypes: ["satisfaction", "service_usage"] }),
  survey("dev-complex-012", "complex_relation", "reversed_roles", "동아리 안 한 신입생한테 학교 적응이랑 가입 안 한 이유 물어보기", ["동아리에 가입하지 않은 신입생"], ["동아리"], ["학교 적응", "미가입 이유"], ["학교 적응", "비이용 이유"], ["동아리", "신입생"], { difficulty: "hard", mustPreserveNegation: true, tags: ["negation", "complex_order", "noisy_input", "single_target_multi_purpose"], expectedArchetypes: ["mixed", "attitude"] }),
  survey("dev-complex-013", "complex_relation", "relationship_research", "대학생의 월 용돈 규모가 외식 빈도와 충동구매에 미치는 영향", ["대학생"], ["월 용돈", "외식 빈도", "충동구매"], ["변수 간 영향"], ["비용", "구매 빈도", "충동구매"], ["월 용돈", "외식", "충동구매"], { surveyMode: "research", difficulty: "hard", expectedIntentModes: ["composite"], tags: ["single_target_multi_purpose"], expectedArchetypes: ["relationship_analysis"] }),
  survey("dev-complex-014", "complex_relation", "relationship_research", "직장인의 평일 수면 시간과 지각 빈도의 상관관계", ["직장인"], ["수면 시간", "지각 빈도"], ["상관관계"], ["수면 시간", "빈도"], ["직장인", "수면 시간", "지각"], { surveyMode: "research", difficulty: "hard", expectedIntentModes: ["composite"], tags: ["non_university"], expectedArchetypes: ["relationship_analysis"] }),
  survey("dev-complex-015", "complex_relation", "relationship_research", "통학 시간이 대학생의 학교생활 만족도에 미치는 영향과 교통수단별 차이", ["통학하는 대학생"], ["통학 시간", "학교생활 만족도", "교통수단"], ["영향 분석", "집단 비교"], ["소요 시간", "만족도", "이동 수단"], ["통학 시간", "학교생활 만족도"], { surveyMode: "research", difficulty: "hard", expectedIntentModes: ["composite"], tags: ["single_target_multi_purpose"], expectedArchetypes: ["relationship_analysis"] }),
  survey("dev-complex-016", "complex_relation", "relationship_research", "청소년의 하루 화면 이용 시간이 학습 집중도와 수면 만족도에 미치는 관계", ["청소년"], ["화면 이용 시간", "학습 집중도", "수면 만족도"], ["변수 관계"], ["이용 시간", "집중도", "만족도"], ["청소년", "화면 이용 시간"], { surveyMode: "research", difficulty: "hard", expectedIntentModes: ["composite"], tags: ["non_university", "single_target_multi_purpose"], expectedArchetypes: ["relationship_analysis"] }),

  // D. 실제 사용자형 불완전 문장 6개
  survey("dev-noisy-001", "incomplete_user_input", "noisy_input", "새봄대 솔빛관 이동 불편 뭐가 젤 큰지", ["새봄대학교 구성원"], ["솔빛관 이동"], ["불편"], ["불편"], ["새봄대", "솔빛관"], { difficulty: "hard", tags: ["virtual_entity", "noisy_input"], expectedArchetypes: ["mobility_experience"] }),
  survey("dev-noisy-002", "incomplete_user_input", "noisy_input", "직장인 커피값 얼마나씀... 주에", ["직장인"], ["커피 지출"], ["주간 지출"], ["구매 빈도", "비용"], ["직장인", "커피"], { difficulty: "hard", tags: ["non_university", "timeframe", "noisy_input"], expectedArchetypes: ["consumption_behavior"] }),
  survey("dev-noisy-003", "incomplete_user_input", "noisy_input", "동아리 안함 이유 이유랑 가입생각", ["동아리에 가입하지 않은 사람"], ["동아리"], ["미가입 이유", "가입 의향"], ["비이용 이유", "참여 의향"], ["동아리"], { difficulty: "hard", mustPreserveNegation: true, tags: ["negation", "noisy_input", "single_target_multi_purpose"], expectedArchetypes: ["need_demand", "attitude"] }),
  survey("dev-noisy-004", "incomplete_user_input", "noisy_input", "온새미앱 써본사람 불편 만족", ["온새미 앱 사용자"], ["온새미 앱"], ["불편", "만족도"], ["이용 경험", "불편", "만족도"], ["온새미"], { difficulty: "hard", tags: ["virtual_entity", "noisy_input", "single_target_multi_purpose"], expectedArchetypes: ["service_usage", "satisfaction"] }),
  survey("dev-noisy-005", "incomplete_user_input", "noisy_input", "최근3달 배달 안시킨 1인가구 왜", ["최근 3개월 배달을 주문하지 않은 1인 가구"], ["배달 주문"], ["비주문 이유"], ["비이용 이유"], ["1인가구", "배달"], { difficulty: "hard", mustPreserveNegation: true, tags: ["negation", "timeframe", "non_university", "noisy_input"], expectedArchetypes: ["consumption_behavior", "attitude"] }),
  survey("dev-noisy-006", "incomplete_user_input", "noisy_input", "팀플 팀플 갈등 해결 어케하는지 조사좀", ["팀플 경험자"], ["팀플"], ["갈등", "해결 방식"], ["갈등", "해결 방식"], ["팀플"], { difficulty: "hard", tags: ["noisy_input", "single_target_multi_purpose"], expectedArchetypes: ["multidimensional_construct"] }),

  // E. clarification 필요 6개
  clarify("dev-clarify-001", "학교 만족도", "학교", "학교 전체·시설·수업 중 평가 범위가 불명확함"),
  clarify("dev-clarify-002", "앱 조사", "앱", "앱 이름과 조사 목적이 없음"),
  clarify("dev-clarify-003", "시설 이용", "시설", "시설명과 이용 맥락이 없음"),
  clarify("dev-clarify-004", "학생들 생각", "학생들 생각", "생각을 물을 주제가 없음"),
  clarify("dev-clarify-005", "서비스 개선", "서비스", "서비스명과 개선 범위가 없음"),
  clarify("dev-clarify-006", "두 개 비교", "두 개", "비교 대상 두 항목이 없음"),
];

const holdoutSeeds: Seed[] = [
  // 과거 오류 변형 4개
  survey("holdout-past-001", "past_error_variant", "academic_satisfaction", "한울대 경영학부 학생이 느끼는 경영학관 시설 만족도", ["한울대학교 경영학부 학생"], ["경영학관 시설"], ["만족도"], ["만족도", "불편", "개선 요구"], ["한울대", "경영학부", "경영학관"], { tags: ["virtual_entity", "complex_order"], expectedArchetypes: ["satisfaction", "facility_usage"] }),
  survey("holdout-past-002", "past_error_variant", "facility_mobility", "한울대학교 재학생의 늘봄관 통학 및 이동 경험", ["한울대학교 재학생"], ["늘봄관 이동"], ["이동 경험"], ["이동 빈도", "이동 수단", "소요 시간", "혼잡", "안전", "불편"], ["한울대학교", "늘봄관"], { tags: ["virtual_entity"], expectedArchetypes: ["mobility_experience"] }),
  survey("holdout-past-003", "past_error_variant", "digital_service", "다온 플랫폼을 쓰는 취업준비생의 이용 현황과 경험", ["다온 플랫폼을 쓰는 취업준비생"], ["다온 플랫폼"], ["이용 현황", "이용 경험"], ["이용 경험", "이용 빈도", "만족도", "불편"], ["다온 플랫폼", "취업준비생"], { tags: ["virtual_entity", "non_university", "single_target_multi_purpose"], expectedArchetypes: ["service_usage"] }),
  survey("holdout-past-004", "past_error_variant", "digital_service", "해든 서비스를 이용하지 않는 청년의 비이용 이유와 필요한 지원", ["해든 서비스를 이용하지 않는 청년"], ["해든 서비스"], ["비이용 이유", "지원 수요"], ["비이용 이유", "서비스 필요성"], ["해든 서비스", "청년"], { mustPreserveNegation: true, tags: ["virtual_entity", "non_university", "negation", "single_target_multi_purpose"], expectedArchetypes: ["need_demand", "attitude"] }),

  // 일반 영역 8개
  survey("holdout-general-001", "general_domain", "academic_course", "한울대학교 교양 수업 수강생의 토론 참여 경험과 만족도", ["한울대학교 교양 수업 수강생"], ["교양 수업"], ["토론 참여 경험", "만족도"], ["참여 경험", "만족도"], ["한울대학교"], { tags: ["virtual_entity", "single_target_multi_purpose"], expectedArchetypes: ["learning_experience", "satisfaction"] }),
  survey("holdout-general-002", "general_domain", "facility_mobility", "늘봄관에 방문하지 않는 한울대 학생의 접근 장벽", ["늘봄관에 방문하지 않는 한울대학교 학생"], ["늘봄관"], ["비방문 이유", "접근 장벽"], ["비이용 이유", "접근성"], ["늘봄관", "한울대"], { mustPreserveNegation: true, tags: ["virtual_entity", "negation", "complex_order"], expectedArchetypes: ["mobility_experience", "attitude"] }),
  survey("holdout-general-003", "general_domain", "food_service", "최근 2주 해든 푸드트럭 이용자의 방문 빈도와 대기 만족도", ["해든 푸드트럭 이용자"], ["해든 푸드트럭"], ["방문 빈도", "대기 만족도"], ["이용 빈도", "대기 시간", "만족도"], ["해든 푸드트럭"], { tags: ["virtual_entity", "timeframe", "single_target_multi_purpose"], expectedArchetypes: ["service_usage", "satisfaction"] }),
  survey("holdout-general-004", "general_domain", "digital_service", "다온 플랫폼과 해든 서비스의 고객 지원 만족도 비교", ["두 서비스를 이용한 고객"], ["다온 플랫폼", "해든 서비스"], ["고객 지원 만족도 비교"], ["만족도", "대상 비교"], ["다온 플랫폼", "해든 서비스"], { expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["virtual_entity", "non_university", "multiple_targets"], expectedArchetypes: ["mixed", "satisfaction"] }),
  survey("holdout-general-005", "general_domain", "event_program", "지역 독서모임에 참가하지 않은 주민의 불참 이유와 관심 주제", ["지역 독서모임에 참가하지 않은 주민"], ["지역 독서모임"], ["불참 이유", "관심 주제"], ["비이용 이유", "선호"], ["독서모임", "주민"], { mustPreserveNegation: true, tags: ["non_university", "negation", "single_target_multi_purpose"], expectedArchetypes: ["event_program", "need_demand"] }),
  survey("holdout-general-006", "general_domain", "teamwork_school_life", "프로젝트 팀원이 회의에 참여하지 못한 이유와 비동기 협업 수요", ["회의에 참여하지 못한 프로젝트 팀원"], ["프로젝트 협업"], ["비참여 이유", "비동기 협업 수요"], ["비이용 이유", "서비스 필요성"], ["프로젝트 팀원"], { mustPreserveNegation: true, tags: ["non_university", "negation", "single_target_multi_purpose", "complex_order"], expectedArchetypes: ["mixed", "need_demand"] }),
  survey("holdout-general-007", "general_domain", "consumer_behavior", "지난 6개월 반려동물 가구의 온라인 사료 구매 빈도와 가격 민감도", ["반려동물 가구"], ["온라인 사료 구매"], ["구매 빈도", "가격 민감도"], ["구매 빈도", "비용"], ["반려동물", "온라인 사료"], { tags: ["non_university", "timeframe", "single_target_multi_purpose"], expectedArchetypes: ["consumption_behavior"] }),
  survey("holdout-general-008", "general_domain", "lifestyle_behavior", "주말에 영상 콘텐츠를 보지 않는 성인의 여가 선택 이유", ["주말에 영상 콘텐츠를 보지 않는 성인"], ["영상 콘텐츠 시청"], ["비시청 이유", "여가 선택"], ["비이용 이유", "선호"], ["영상 콘텐츠", "성인"], { mustPreserveNegation: true, tags: ["non_university", "negation", "timeframe"], expectedArchetypes: ["attitude", "behavior_usage"] }),

  // 복잡 관계 4개
  survey("holdout-complex-001", "complex_relation", "single_multi_purpose", "한울대학교 늘봄관 한 곳의 학습 공간 만족도와 예약 좌석 기능 수요", ["한울대학교 늘봄관 이용자"], ["늘봄관 학습 공간"], ["만족도", "예약 좌석 기능 수요"], ["만족도", "서비스 필요성", "이용 의향"], ["한울대학교", "늘봄관"], { surveyMode: "research", difficulty: "hard", tags: ["virtual_entity", "single_target_multi_purpose"], expectedArchetypes: ["mixed", "facility_usage"] }),
  survey("holdout-complex-002", "complex_relation", "multiple_target_comparison", "도보 통근과 자가용 통근의 이동 시간, 비용, 스트레스 차이", ["도보 또는 자가용 통근자"], ["도보 통근", "자가용 통근"], ["이동 시간 비교", "비용 비교", "스트레스 비교"], ["소요 시간", "비용", "스트레스", "대상 비교"], ["도보", "자가용"], { surveyMode: "research", difficulty: "hard", expectedIntentModes: ["composite"], expectedTargetCardinality: "multiple", tags: ["non_university", "multiple_targets", "complex_order"], expectedArchetypes: ["relationship_analysis", "mobility_experience"] }),
  survey("holdout-complex-003", "complex_relation", "relationship_research", "청년의 월세 부담이 외식 횟수와 저축 비율에 미치는 영향", ["월세를 내는 청년"], ["월세 부담", "외식 횟수", "저축 비율"], ["변수 간 영향"], ["비용", "구매 빈도", "저축"], ["청년", "월세", "저축"], { surveyMode: "research", difficulty: "hard", expectedIntentModes: ["composite"], tags: ["non_university", "single_target_multi_purpose"], expectedArchetypes: ["relationship_analysis"] }),
  survey("holdout-complex-004", "complex_relation", "reversed_roles", "최근 한 달 해든 서비스 알림을 받았지만 클릭하지 않은 이용자에게 이유와 개선점을 묻기", ["해든 서비스 알림을 클릭하지 않은 이용자"], ["해든 서비스 알림"], ["비클릭 이유", "개선 요구"], ["비이용 이유", "개선 요구"], ["해든 서비스"], { difficulty: "hard", mustPreserveNegation: true, tags: ["virtual_entity", "non_university", "negation", "timeframe", "complex_order", "single_target_multi_purpose"], expectedArchetypes: ["mixed", "attitude"] }),

  // 불완전 2개
  survey("holdout-noisy-001", "incomplete_user_input", "noisy_input", "한울대 늘봄관 안감 왜 불편", ["늘봄관에 가지 않는 한울대학교 학생"], ["늘봄관"], ["비방문 이유", "불편"], ["비이용 이유", "불편"], ["한울대", "늘봄관"], { difficulty: "hard", mustPreserveNegation: true, tags: ["virtual_entity", "negation", "noisy_input", "complex_order"], expectedArchetypes: ["mobility_experience", "attitude"] }),
  survey("holdout-noisy-002", "incomplete_user_input", "noisy_input", "다온앱 요즘 안씀 이유 다시쓸지", ["다온 앱을 최근 사용하지 않는 사람"], ["다온 앱"], ["비이용 이유", "재사용 의향"], ["비이용 이유", "이용 의향"], ["다온"], { difficulty: "hard", mustPreserveNegation: true, tags: ["virtual_entity", "non_university", "negation", "timeframe", "noisy_input", "single_target_multi_purpose"], expectedArchetypes: ["need_demand", "attitude"] }),

  // clarification 2개
  clarify("holdout-clarify-001", "공간 평가", "공간", "평가할 공간과 응답 대상이 없음"),
  clarify("holdout-clarify-002", "둘 중 뭐가 나은지", "두 대상", "비교할 두 대상과 기준이 없음"),
];

export const devCases: SurveyRegressionCase[] = devSeeds.map((item) => ({
  ...item,
  split: "dev",
}));

export const holdoutCases: SurveyRegressionCase[] = holdoutSeeds.map((item) => ({
  ...item,
  split: "holdout",
}));

export const allCases = [...devCases, ...holdoutCases];
