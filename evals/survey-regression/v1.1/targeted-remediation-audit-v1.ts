export type TargetedRemediationAuditJudgment =
  | "true_pass"
  | "true_product_failure"
  | "evaluator_false_positive"
  | "evaluator_false_negative"
  | "dataset_specification_error"
  | "ambiguous_specification";

export type TargetedRemediationRepairJudgment =
  | "not_repaired"
  | "necessary_partial_repair"
  | "repair_created_new_error";

export type TargetedRemediationAuditDecision = {
  judgment: TargetedRemediationAuditJudgment;
  rationale: string;
  repairJudgment: TargetedRemediationRepairJudgment;
  repairRationale: string;
};

export const targetedRemediationAuditDecisions = {
  "targeted-clarification-001": {
    judgment: "true_pass",
    rationale: "프로그램의 내용과 조사 목적이 빠진 모호한 요청에 clarification을 반환해 적절함.",
    repairJudgment: "not_repaired",
    repairRationale: "clarification 응답이므로 문항 repair가 없음.",
  },
  "targeted-clarification-002": {
    judgment: "true_pass",
    rationale: "비교할 두 교육관이 명시되지 않아 clarification을 반환한 것이 적절함.",
    repairJudgment: "not_repaired",
    repairRationale: "clarification 응답이므로 문항 repair가 없음.",
  },
  "targeted-clarification-003": {
    judgment: "evaluator_false_negative",
    rationale: "통학 불편 조사에서 repair된 Q2가 '관련한 행동은 주로 어떤 상황에서'라는 추상적 filler가 되어 사용자가 요구한 구체적 통학 불편을 직접 측정하지 못했지만 자동 평가가 통과함.",
    repairJudgment: "repair_created_new_error",
    repairRationale: "Q2의 모든 응답자 노출 필드가 교체되면서 구체적인 통학 맥락을 잃은 generic 문항이 생김.",
  },
  "targeted-clarification-004": {
    judgment: "true_pass",
    rationale: "별숲앱 비이용 자영업자의 비이용 이유와 향후 사용 의향을 모두 직접 측정함.",
    repairJudgment: "necessary_partial_repair",
    repairRationale: "Q7 repair 후 향후 사용 의향 coverage가 보존된 정상 설문이 됨.",
  },
  "targeted-expansion-001": {
    judgment: "evaluator_false_positive",
    rationale: "방문 목적·이용 빈도·불편·개선 요구를 각각 직접 묻고 있어 필수 조사 목적이 모두 충족되지만 evaluator가 purpose coverage 누락으로 오판함.",
    repairJudgment: "not_repaired",
    repairRationale: "repair 없이 모델 출력이 목적 전체를 충족함.",
  },
  "targeted-expansion-002": {
    judgment: "true_pass",
    rationale: "접근성·대기 시간·안내 만족도·불편을 모두 직접 측정함.",
    repairJudgment: "not_repaired",
    repairRationale: "repair 없이 정상 출력임.",
  },
  "targeted-expansion-003": {
    judgment: "true_pass",
    rationale: "수업 참여 경험·학습 효과·어려움·개선 요구를 모두 측정하고 참여 자격 문항도 선두에 배치함.",
    repairJudgment: "not_repaired",
    repairRationale: "repair 없이 정상 출력임.",
  },
  "targeted-flattening-001": {
    judgment: "true_pass",
    rationale: "푸른들 돌봄 프로그램 비참여 학부모를 보존하고 불참 이유와 향후 참여 의향을 분리해 측정함.",
    repairJudgment: "not_repaired",
    repairRationale: "repair 없이 정상 출력임.",
  },
  "targeted-flattening-002": {
    judgment: "true_pass",
    rationale: "모아온 업무앱 비이용 직장인의 비이용 이유와 향후 사용 의향을 분리해 측정함.",
    repairJudgment: "necessary_partial_repair",
    repairRationale: "Q6 repair 후 향후 사용 의향 coverage가 보존된 정상 설문이 됨.",
  },
  "targeted-flattening-003": {
    judgment: "evaluator_false_positive",
    rationale: "첫 문항이 새결 정수기 미구매 자격을 확인하고 구매 비교 경험 문항은 구매 장벽을 해석하는 실질 문항인데, evaluator가 이를 후행 screening으로 잘못 분류함.",
    repairJudgment: "not_repaired",
    repairRationale: "repair 없이 자격·구매 장벽·향후 구매 가능성을 올바르게 구성함.",
  },
  "targeted-flattening-004": {
    judgment: "true_pass",
    rationale: "해솔 독서 구독 해지 이용자의 해지 이유와 재가입 의향을 직접 측정함.",
    repairJudgment: "necessary_partial_repair",
    repairRationale: "Q7 repair 후 재가입 의향 coverage가 보존된 정상 설문이 됨.",
  },
  "targeted-population-001": {
    judgment: "evaluator_false_negative",
    rationale: "환경공학과 학생과 실험실 안전 맥락은 보존했지만 repair가 기존 안전 인식 척도와 의미가 중복되는 전반적 안전 인식 문항을 추가해 중복 construct가 생겼음.",
    repairJudgment: "repair_created_new_error",
    repairRationale: "Q1 전체 교체가 이미 존재하는 안전 인식 측정과 중복되는 문항을 생성함.",
  },
  "targeted-population-002": {
    judgment: "true_pass",
    rationale: "최근 6개월 비이용 청년 조건과 꿈담 구직서비스 고유명사를 보존하고 비이용 이유와 향후 사용 의향을 측정함.",
    repairJudgment: "not_repaired",
    repairRationale: "repair 없이 정상 출력임.",
  },
  "targeted-repair-001": {
    judgment: "true_product_failure",
    rationale: "기준 기간 메타데이터 불일치 하나로 전체 설문이 hard fallback되며 '선행 값', '결과 값', '앞에서 답한 값들' 같은 내부 추상 placeholder가 응답자 문항에 노출됨.",
    repairJudgment: "necessary_partial_repair",
    repairRationale: "국소적인 기준 기간 정합성 repair는 필요했지만 실패 후 전체 generic fallback으로 확대된 것이 실제 제품 결함임.",
  },
  "targeted-repair-002": {
    judgment: "evaluator_false_negative",
    rationale: "해오름식당과 별하식당을 모두 보존했지만 만족도 측정이 해오름식당에만 있고 별하식당 만족도가 없어 대상별 비교가 불가능한데 자동 평가가 통과함.",
    repairJudgment: "not_repaired",
    repairRationale: "repair 없이 통과했으나 필수 병렬 만족도 측정이 누락됨.",
  },
  "targeted-satisfaction-001": {
    judgment: "true_pass",
    rationale: "맛·주문 편의·직원 응대와 전반적 만족도를 분리해 직접 측정함.",
    repairJudgment: "not_repaired",
    repairRationale: "repair 없이 정상 출력임.",
  },
  "targeted-satisfaction-002": {
    judgment: "true_pass",
    rationale: "기능 편의성·오류 경험·앱 전체 만족도를 직접 측정함.",
    repairJudgment: "necessary_partial_repair",
    repairRationale: "Q4 제목과 Q6을 국소적으로 repair해 기준 기간과 전반적 만족도 coverage를 보완함.",
  },
  "targeted-satisfaction-003": {
    judgment: "true_pass",
    rationale: "행사 구성·안내·혼잡과 전반적 만족도를 직접 측정함.",
    repairJudgment: "necessary_partial_repair",
    repairRationale: "Q2 repair로 전반적 만족도 coverage를 보완한 뒤 나머지 목적을 훼손하지 않음.",
  },
} as const satisfies Record<string, TargetedRemediationAuditDecision>;

export const targetedRemediationAuditCaseIds = Object.keys(
  targetedRemediationAuditDecisions,
);

export function getTargetedRemediationAuditDecision(
  caseId: string,
): TargetedRemediationAuditDecision {
  const decision = targetedRemediationAuditDecisions[
    caseId as keyof typeof targetedRemediationAuditDecisions
  ];
  if (!decision) throw new Error(`TARGETED_REMEDIATION_AUDIT_UNKNOWN_CASE:${caseId}`);
  return decision;
}
