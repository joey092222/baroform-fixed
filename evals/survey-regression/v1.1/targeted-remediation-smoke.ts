import {
  surveyRegressionCaseSchema,
  type SurveyRegressionCase,
} from "../v1/schema";

type TargetedCluster =
  | "request_flattening"
  | "clarification_boundary"
  | "overall_satisfaction"
  | "plan_aware_expansion"
  | "target_population"
  | "repair_regression";

type Fixture = {
  id: string;
  cluster: TargetedCluster;
  input: string;
  inputQuality?: "clear" | "noisy_recoverable" | "ambiguous";
  target: string[];
  object: string[];
  purpose: string[];
  required: string[];
  eligibility?: string[];
  contexts?: string[];
  screening?: boolean;
  negation?: boolean;
  terms?: string[];
  outcome?: "survey" | "clarification";
  cardinality?: "single" | "multiple";
  intentModes?: Array<"single" | "composite">;
  archetypes?: string[];
  mode?: "standard" | "research";
};

function fixture(input: Fixture): SurveyRegressionCase {
  const outcome = input.outcome ?? "survey";
  const inputQuality = input.inputQuality ?? "clear";
  return surveyRegressionCaseSchema.parse({
    id: input.id,
    split: "dev",
    stratum: outcome === "clarification" ? "clarification" : "complex_relation",
    category: `targeted_${input.cluster}`,
    difficulty: inputQuality === "clear" ? "medium" : "hard",
    surveyMode: input.mode ?? "standard",
    questionCount: 7,
    input: input.input,
    expectedOutcome: outcome,
    inputQuality,
    expectedTargetPopulation: input.target,
    expectedEligibilityConditions: input.eligibility ?? [],
    contextEntities: input.contexts ?? [],
    screeningExpected: input.screening ?? false,
    expectedSurveyObject: input.object,
    expectedPurposeConcepts: input.purpose,
    requiredQuestionConcepts: input.required,
    forbiddenPurposeConcepts: [],
    mustPreserveTerms: input.terms ?? [],
    mustPreserveNegation: input.negation ?? false,
    forbiddenTargetExpansions: [],
    forbiddenSurveyObjects: [],
    forbiddenQuestionConcepts: [
      "generic filler",
      "무관한 인구통계",
      ...(input.negation ? ["이용 만족도 강제", "방문 만족도 강제"] : []),
    ],
    clarificationExpected: outcome === "clarification",
    expectedIntentModes: input.intentModes ?? ["single"],
    expectedTargetCardinality: input.cardinality ?? "single",
    expectedArchetypes: input.archetypes ?? ["satisfaction"],
    tags: [
      ...(inputQuality === "noisy_recoverable" ? ["noisy_input" as const] : []),
      ...((input.eligibility?.length ?? 0) > 0 ? ["timeframe" as const] : []),
      ...(input.negation ? ["negation" as const] : []),
      ...(outcome === "clarification" ? ["clarification" as const] : []),
      ...(input.cardinality === "multiple" ? ["multiple_targets" as const] : []),
      ...((input.purpose.length > 1 && input.cardinality !== "multiple")
        ? ["single_target_multi_purpose" as const]
        : []),
    ],
    notes: `v1.1 ${input.cluster} 공통 근본 원인 targeted smoke fixture`,
  });
}

export const targetedRemediationSmokeCases = [
  fixture({
    id: "targeted-flattening-001",
    cluster: "request_flattening",
    input: "푸른들 돌봄 프로그램에 참여하지 않은 학부모에게 불참 이유와 앞으로 참여할 생각을 묻고 싶다.",
    target: ["푸른들 돌봄 프로그램에 참여하지 않은 학부모"],
    eligibility: ["푸른들 돌봄 프로그램 비참여"],
    contexts: ["푸른들 돌봄 프로그램"],
    object: ["푸른들 돌봄 프로그램"],
    purpose: ["비참여 이유", "참여 의향"],
    required: ["비참여 이유", "참여 의향"],
    screening: true,
    negation: true,
    terms: ["푸른들 돌봄 프로그램"],
    archetypes: ["attitude", "event_program"],
  }),
  fixture({
    id: "targeted-flattening-002",
    cluster: "request_flattening",
    input: "모아온 업무앱 안 쓰는 직장인들 왜 안 쓰는지랑 나중에 쓸 생각 있는지 조사",
    inputQuality: "noisy_recoverable",
    target: ["모아온 업무앱을 사용하지 않는 직장인", "모아온 업무앱 안 쓰는 직장인"],
    eligibility: ["모아온 업무앱 비이용"],
    contexts: ["모아온 업무앱"],
    object: ["모아온 업무앱"],
    purpose: ["비이용 이유", "이용 의향"],
    required: ["비이용 이유", "이용 의향"],
    screening: true,
    negation: true,
    terms: ["모아온 업무앱"],
    archetypes: ["attitude", "service_usage"],
  }),
  fixture({
    id: "targeted-flattening-003",
    cluster: "request_flattening",
    input: "새결 정수기를 구매하지 않은 소비자의 구매 장벽과 향후 구매 가능성을 알아보고 싶어요.",
    target: ["새결 정수기를 구매하지 않은 소비자"],
    eligibility: ["새결 정수기 미구매"],
    contexts: ["새결 정수기"],
    object: ["새결 정수기"],
    purpose: ["미구매 이유", "이용 의향"],
    required: ["미구매 이유", "이용 의향"],
    screening: true,
    negation: true,
    terms: ["새결 정수기"],
    archetypes: ["attitude", "product_usage"],
  }),
  fixture({
    id: "targeted-flattening-004",
    cluster: "request_flattening",
    input: "해솔 독서 구독을 해지한 이용자한테 해지 이유하고 다시 가입할 의향 물어보기",
    inputQuality: "noisy_recoverable",
    target: ["해솔 독서 구독을 해지한 이용자"],
    eligibility: ["해솔 독서 구독 해지"],
    contexts: ["해솔 독서 구독"],
    object: ["해솔 독서 구독"],
    purpose: ["해지 이유", "이용 의향"],
    required: ["비이용 이유", "이용 의향"],
    screening: true,
    negation: true,
    terms: ["해솔 독서 구독"],
    archetypes: ["attitude", "service_usage"],
  }),
  fixture({
    id: "targeted-clarification-001",
    cluster: "clarification_boundary",
    input: "온길센터 새 프로그램 주민 조사",
    inputQuality: "ambiguous",
    target: ["확인 필요"],
    object: ["확인 필요"],
    purpose: ["확인 필요"],
    required: [],
    outcome: "clarification",
    archetypes: ["attitude"],
  }),
  fixture({
    id: "targeted-clarification-002",
    cluster: "clarification_boundary",
    input: "두 교육관 통학 만족도 비교",
    inputQuality: "ambiguous",
    target: ["확인 필요"],
    object: ["확인 필요"],
    purpose: ["만족도 비교"],
    required: [],
    outcome: "clarification",
    cardinality: "multiple",
    archetypes: ["satisfaction", "mixed"],
  }),
  fixture({
    id: "targeted-clarification-003",
    cluster: "clarification_boundary",
    input: "다온대학교 학생의 통학 불편 조사",
    target: ["다온대학교 학생"],
    object: ["통학"],
    purpose: ["불편"],
    required: ["불편"],
    terms: ["다온대학교"],
    archetypes: ["mobility_experience"],
  }),
  fixture({
    id: "targeted-clarification-004",
    cluster: "clarification_boundary",
    input: "별숲앱 안쓰는 자영업자 왜안씀 앞으로쓸지 조사",
    inputQuality: "noisy_recoverable",
    target: ["별숲앱을 사용하지 않는 자영업자", "별숲앱 안 쓰는 자영업자"],
    eligibility: ["별숲앱 비이용"],
    contexts: ["별숲앱"],
    object: ["별숲앱"],
    purpose: ["비이용 이유", "이용 의향"],
    required: ["비이용 이유", "이용 의향"],
    screening: true,
    negation: true,
    terms: ["별숲앱"],
    archetypes: ["attitude", "service_usage"],
  }),
  fixture({
    id: "targeted-satisfaction-001",
    cluster: "overall_satisfaction",
    input: "한들식당 이용자의 맛, 주문 편의, 직원 응대와 전반적 만족도를 조사하고 싶다.",
    target: ["한들식당 이용자"],
    object: ["한들식당"],
    purpose: ["맛", "주문 편의", "직원 응대", "전반적 만족도"],
    required: ["만족도"],
    terms: ["한들식당"],
    archetypes: ["satisfaction"],
  }),
  fixture({
    id: "targeted-satisfaction-002",
    cluster: "overall_satisfaction",
    input: "누리길 앱 사용자의 기능 편의성과 오류 경험, 앱 전체 만족도를 알아보고 싶어요.",
    target: ["누리길 앱 사용자"],
    object: ["누리길 앱"],
    purpose: ["기능 편의성", "오류 경험", "전반적 만족도"],
    required: ["만족도", "불편"],
    terms: ["누리길 앱"],
    archetypes: ["satisfaction", "service_usage"],
  }),
  fixture({
    id: "targeted-satisfaction-003",
    cluster: "overall_satisfaction",
    input: "달빛장터 방문객의 행사 구성, 안내, 혼잡과 전반적인 만족도 조사",
    target: ["달빛장터 방문객"],
    object: ["달빛장터"],
    purpose: ["행사 구성", "안내", "혼잡", "전반적 만족도"],
    required: ["혼잡", "만족도"],
    terms: ["달빛장터"],
    archetypes: ["satisfaction", "event_program"],
  }),
  fixture({
    id: "targeted-expansion-001",
    cluster: "plan_aware_expansion",
    input: "솔샘 공공도서관 이용자의 방문 목적, 이용 빈도, 불편과 개선 요구 조사",
    target: ["솔샘 공공도서관 이용자"],
    object: ["솔샘 공공도서관"],
    purpose: ["이용 목적", "이용 빈도", "불편", "개선 요구"],
    required: ["이용 목적", "이용 빈도", "불편", "개선 요구"],
    terms: ["솔샘 공공도서관"],
    archetypes: ["facility_usage", "mixed"],
  }),
  fixture({
    id: "targeted-expansion-002",
    cluster: "plan_aware_expansion",
    input: "늘해랑 보건소 방문자의 접근성, 대기 시간, 안내 만족도, 불편한 점을 알아보고 싶다.",
    target: ["늘해랑 보건소 방문자"],
    object: ["늘해랑 보건소"],
    purpose: ["접근성", "대기 시간", "만족도", "불편"],
    required: ["접근성", "대기 시간", "만족도", "불편"],
    terms: ["늘해랑 보건소"],
    archetypes: ["facility_usage", "satisfaction"],
  }),
  fixture({
    id: "targeted-expansion-003",
    cluster: "plan_aware_expansion",
    input: "바다온 원격수업에 참여한 성인의 수업 참여 경험, 학습 효과, 어려움과 개선 요구 조사",
    target: ["바다온 원격수업에 참여한 성인"],
    eligibility: ["바다온 원격수업 참여"],
    contexts: ["바다온 원격수업"],
    object: ["바다온 원격수업"],
    purpose: ["참여 경험", "학습 효과", "불편", "개선 요구"],
    required: ["참여 경험", "학습 효과", "불편", "개선 요구"],
    screening: true,
    terms: ["바다온 원격수업"],
    archetypes: ["learning_experience", "event_program"],
  }),
  fixture({
    id: "targeted-population-001",
    cluster: "target_population",
    input: "새빛대학교 환경공학과 학생의 실험실 안전 인식과 개선 요구 조사",
    target: ["새빛대학교 환경공학과 학생"],
    object: ["실험실 안전"],
    purpose: ["안전 인식", "개선 요구"],
    required: ["안전", "개선 요구"],
    terms: ["새빛대학교", "환경공학과"],
    archetypes: ["attitude", "need_demand"],
  }),
  fixture({
    id: "targeted-population-002",
    cluster: "target_population",
    input: "최근 6개월 동안 꿈담 구직서비스를 이용하지 않은 청년의 비이용 이유와 향후 사용 의향 조사",
    target: ["최근 6개월 동안 꿈담 구직서비스를 이용하지 않은 청년"],
    eligibility: ["최근 6개월 꿈담 구직서비스 비이용"],
    contexts: ["꿈담 구직서비스"],
    object: ["꿈담 구직서비스"],
    purpose: ["비이용 이유", "이용 의향"],
    required: ["비이용 이유", "이용 의향"],
    screening: true,
    negation: true,
    terms: ["꿈담 구직서비스"],
    archetypes: ["attitude", "service_usage"],
  }),
  fixture({
    id: "targeted-repair-001",
    cluster: "repair_regression",
    input: "직장인의 월 여가비와 문화생활 빈도 및 충동구매의 관계 조사",
    target: ["직장인"],
    object: ["월 여가비", "문화생활 빈도", "충동구매"],
    purpose: ["월 여가비와 문화생활 빈도의 관계", "월 여가비와 충동구매의 관계"],
    required: ["비용", "빈도", "충동구매"],
    cardinality: "multiple",
    intentModes: ["composite"],
    archetypes: ["academic_construct", "mixed"],
  }),
  fixture({
    id: "targeted-repair-002",
    cluster: "repair_regression",
    input: "새봄대학교 학생이 해오름식당과 별하식당을 선택하는 이유와 각 식당 만족도 비교",
    target: ["새봄대학교 학생"],
    object: ["해오름식당", "별하식당"],
    purpose: ["선택 이유", "만족도 비교"],
    required: ["선택 이유", "만족도", "대상 비교"],
    terms: ["새봄대학교", "해오름식당", "별하식당"],
    cardinality: "multiple",
    intentModes: ["composite"],
    archetypes: ["satisfaction", "mixed"],
  }),
] as const;

const expectedClusterCounts: Record<TargetedCluster, number> = {
  request_flattening: 4,
  clarification_boundary: 4,
  overall_satisfaction: 3,
  plan_aware_expansion: 3,
  target_population: 2,
  repair_regression: 2,
};

if (targetedRemediationSmokeCases.length !== 18) {
  throw new Error(
    `TARGETED_REMEDIATION_SMOKE_CARDINALITY:${targetedRemediationSmokeCases.length}`,
  );
}

for (const [cluster, expected] of Object.entries(expectedClusterCounts)) {
  const actual = targetedRemediationSmokeCases.filter(
    (item) => item.category === `targeted_${cluster}`,
  ).length;
  if (actual !== expected) {
    throw new Error(`TARGETED_REMEDIATION_CLUSTER_CARDINALITY:${cluster}:${actual}`);
  }
}
