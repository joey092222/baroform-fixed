export type ManualAuditJudgment =
  | "true_pass"
  | "true_failure"
  | "evaluator_false_positive"
  | "evaluator_false_negative"
  | "ambiguous_specification";

export type ManualAuditDecision = {
  judgment: ManualAuditJudgment;
  rationale: string;
};

const truePass = new Set(["dev-past-001"]);

const falsePositiveRationales: Record<string, string> = {
  "dev-general-020":
    "참여 프로그램을 먼저 구분한 뒤 도움 정도와 만족도를 같은 척도로 측정해 집단 비교가 가능하므로 목적 coverage 실패 판정이 오탐임.",
  "dev-general-026":
    "미구매 이유와 최대 추가 지불 의향을 명시적으로 묻고 있어 비이용 이유와 비용 개념 누락 판정이 오탐임.",
  "dev-past-014":
    "응답 대상·제목·설명·모든 핵심 문항이 한경관 학식을 먹지 않는 조건을 보존하므로 부정 표현 손실과 비이용 이유 누락 판정이 오탐임.",
  "holdout-past-001":
    "한울대 경영학부 학생과 한울대학교 경영학부 학생은 동등하며 만족도·불편·개선 요구 문항도 모두 존재해 자동 실패가 오탐임.",
};

const ambiguousSpecificationRationales: Record<string, string> = {
  "dev-general-005":
    "원문은 접근성과 이동 불편만 요구하지만 fixture가 소요 시간을 필수로 지정해 자동 실패의 일부가 평가 specification 과잉에서 발생함.",
  "dev-general-024":
    "원문은 시간관리와 스트레스를 요구하지만 fixture가 실제 시간 사용량까지 필수로 지정해 기대값이 원문보다 과도하게 구체적임.",
  "dev-noisy-002":
    "원문은 주간 커피 지출만 명시하지만 fixture가 구매 빈도까지 필수로 요구해 통과 여부를 단정할 수 없는 specification 문제임.",
};

const falseNegativeRationales: Record<string, string> = {
  "dev-complex-009":
    "문항은 이동 경험을 측정하지만 evaluationTarget이 '에게 ... 묻고 싶어'라는 요청 문장을 그대로 포함해 조사 대상 metadata가 손상됐는데 자동 통과함.",
  "dev-complex-015":
    "'학교생활 만족도에 미치는은'과 '교통수단별에'처럼 핵심 관계 문항이 문법·의미상 깨졌는데 자동 통과함.",
  "dev-general-002":
    "대상을 야간 강좌 수강 직장인에서 전체 직장인으로 넓히고 첫 문항에 조사 목적 전체를 삽입했는데 자동 통과함.",
  "dev-general-011":
    "비구매자 대상 설문에서 구매 여부를 다시 묻고 일반 상황 filler를 추가해 대상 조건과 문항 효율이 훼손됐는데 자동 통과함.",
  "dev-general-028":
    "공공자전거 이용 여부 스크리너가 마지막에 배치되어 앞선 경험 문항의 응답 적격성을 보장하지 못하는데 자동 통과함.",
  "dev-past-004":
    "비이용 경영대생이라는 핵심 응답 대상을 '관련 경험이 있는 응답자'로 일반화해 metadata 계약을 잃었는데 자동 통과함.",
  "dev-past-009":
    "전체 대학생 대상 입력을 네이버 웹툰 이용자로 축소하여 비이용자의 현황을 수집할 수 없는데 자동 통과함.",
  "dev-past-013":
    "전체 연세대학교 학생 대상 입력을 한경관 학식 이용자로 축소하여 비이용 경험 경로를 배제했는데 자동 통과함.",
  "dev-past-017":
    "전반적 만족도를 직접 측정하지 않고 불편 문항을 중복 배치해 핵심 목적 coverage와 문항 품질이 부족한데 자동 통과함.",
};

const allCaseIds = [
  "dev-clarify-001", "dev-clarify-002", "dev-clarify-003", "dev-clarify-004", "dev-clarify-005", "dev-clarify-006",
  "dev-complex-001", "dev-complex-002", "dev-complex-003", "dev-complex-004", "dev-complex-005", "dev-complex-006", "dev-complex-007", "dev-complex-008", "dev-complex-009", "dev-complex-010", "dev-complex-011", "dev-complex-012", "dev-complex-013", "dev-complex-014", "dev-complex-015", "dev-complex-016",
  "dev-general-001", "dev-general-002", "dev-general-003", "dev-general-004", "dev-general-005", "dev-general-006", "dev-general-007", "dev-general-008", "dev-general-009", "dev-general-010", "dev-general-011", "dev-general-012", "dev-general-013", "dev-general-014", "dev-general-015", "dev-general-016", "dev-general-017", "dev-general-018", "dev-general-019", "dev-general-020", "dev-general-021", "dev-general-022", "dev-general-023", "dev-general-024", "dev-general-025", "dev-general-026", "dev-general-027", "dev-general-028", "dev-general-029", "dev-general-030", "dev-general-031", "dev-general-032",
  "dev-noisy-001", "dev-noisy-002", "dev-noisy-003", "dev-noisy-004", "dev-noisy-005", "dev-noisy-006",
  "dev-past-001", "dev-past-002", "dev-past-003", "dev-past-004", "dev-past-005", "dev-past-006", "dev-past-007", "dev-past-008", "dev-past-009", "dev-past-010", "dev-past-011", "dev-past-012", "dev-past-013", "dev-past-014", "dev-past-015", "dev-past-016", "dev-past-017", "dev-past-018", "dev-past-019", "dev-past-020",
  "holdout-clarify-001", "holdout-clarify-002",
  "holdout-complex-001", "holdout-complex-002", "holdout-complex-003", "holdout-complex-004",
  "holdout-general-001", "holdout-general-002", "holdout-general-003", "holdout-general-004", "holdout-general-005", "holdout-general-006", "holdout-general-007", "holdout-general-008",
  "holdout-noisy-001", "holdout-noisy-002",
  "holdout-past-001", "holdout-past-002", "holdout-past-003", "holdout-past-004",
] as const;

const trueFailureIds = new Set<string>(
  allCaseIds.filter(
    (caseId) =>
      !truePass.has(caseId) &&
      !(caseId in falsePositiveRationales) &&
      !(caseId in ambiguousSpecificationRationales) &&
      !(caseId in falseNegativeRationales),
  ),
);

export const createManualAuditDecision = (input: {
  caseId: string;
  expectedOutcome: string;
  expectedTargetPopulation: string[];
  actualRespondentGroup: string | null;
  actualEvaluationTarget: string | null;
  classification: string;
  httpStatus: number;
  firstFatalCode: string | null;
}): ManualAuditDecision => {
  const { caseId } = input;
  if (!allCaseIds.includes(caseId as (typeof allCaseIds)[number])) {
    throw new Error(`MANUAL_AUDIT_UNKNOWN_CASE:${caseId}`);
  }
  if (truePass.has(caseId)) {
    return {
      judgment: "true_pass",
      rationale:
        "응답 대상과 경영대라는 조사 대상이 정확하고 만족도·불편·개선 요구를 자연스러운 7개 문항으로 측정해 자동 통과가 타당함.",
    };
  }
  if (caseId in falsePositiveRationales) {
    return {
      judgment: "evaluator_false_positive",
      rationale: falsePositiveRationales[caseId],
    };
  }
  if (caseId in falseNegativeRationales) {
    return {
      judgment: "evaluator_false_negative",
      rationale: falseNegativeRationales[caseId],
    };
  }
  if (caseId in ambiguousSpecificationRationales) {
    return {
      judgment: "ambiguous_specification",
      rationale: ambiguousSpecificationRationales[caseId],
    };
  }
  if (!trueFailureIds.has(caseId)) {
    throw new Error(`MANUAL_AUDIT_UNCLASSIFIED_CASE:${caseId}`);
  }
  if (input.expectedOutcome === "clarification") {
    return {
      judgment: "true_failure",
      rationale:
        input.classification === "clarification"
          ? "비교 대상과 조사 조건이 명확한 입력에 불필요한 clarification을 반환해 실제 실패임."
          : "응답 대상이나 구체적 조사 대상이 빠진 모호한 입력에 clarification 대신 임의의 설문을 생성해 실제 실패임.",
    };
  }
  if (input.classification === "request_failure") {
    return {
      judgment: "true_failure",
      rationale: `HTTP ${input.httpStatus}에서 설문 7문항을 반환하지 못해 의미 품질과 무관하게 실제 요청 실패임.`,
    };
  }
  if (input.classification === "hard_fallback") {
    return {
      judgment: "true_failure",
      rationale:
        "모델 출력을 폐기하고 일반 로컬 blueprint로 대체했으며 최종 문항에도 조사 목적 전체 삽입 또는 필수 목적 누락이 남아 실제 실패임.",
    };
  }
  if (input.firstFatalCode === "TARGET_POPULATION_MISMATCH") {
    return {
      judgment: "true_failure",
      rationale: `응답 대상 '${input.actualRespondentGroup ?? "없음"}'이 기대 대상 '${input.expectedTargetPopulation.join(" / ")}'의 소속·이용·비이용 조건을 보존하지 못해 실제 실패임.`,
    };
  }
  if (!input.actualEvaluationTarget) {
    return {
      judgment: "true_failure",
      rationale:
        "최종 evaluationTarget이 비어 있어 설문이 무엇을 측정하는지 공개 metadata와 후속 분석 단계에서 보존되지 않는 실제 실패임.",
    };
  }
  return {
    judgment: "true_failure",
    rationale: `evaluationTarget '${input.actualEvaluationTarget}'가 실제 조사 대상 대신 목적어 조각·요청 문장·측정 항목을 담아 의미 역할이 최초부터 어긋난 실제 실패임.`,
  };
};

export const manualAuditCaseIds = [...allCaseIds];
