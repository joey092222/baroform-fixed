import type {
  SemanticRole,
  SurveyIntent,
} from "./survey-semantic-intent";

export type SurveyVariableType =
  | "nominal"
  | "ordinal"
  | "frequency"
  | "amount"
  | "preference"
  | "open_text";

export type SurveyPlanBlock = {
  id: string;
  variable: string;
  role: SemanticRole;
  variableType: SurveyVariableType;
  purpose: string;
  questionCount: number;
  sourceEntityIds: string[];
  decisionGoalIds: string[];
  required: boolean;
};

export type SurveyPlan = {
  intentKind: SurveyIntent["objectKind"];
  targetPopulation: string | null;
  primaryPurpose: string | null;
  decisionGoals: string[];
  blocks: SurveyPlanBlock[];
  requestedQuestionCount: number;
};

const makeBlock = (
  id: string,
  variable: string,
  role: SemanticRole,
  variableType: SurveyVariableType,
  purpose: string,
  sourceEntityIds: string[],
  decisionGoalIds: string[],
): SurveyPlanBlock => ({
  id,
  variable,
  role,
  variableType,
  purpose,
  questionCount: 1,
  sourceEntityIds,
  decisionGoalIds,
  required: true,
});

export function createSurveyPlan(
  intent: SurveyIntent,
  requestedQuestionCount = 7,
): SurveyPlan {
  const category = intent.entities.find((item) => item.role === "category_set");
  const behavior = intent.entities.find((item) => item.role === "behavior");
  const unmetNeed = intent.entities.find((item) => item.role === "unmet_need");
  const decisionOption = intent.entities.find(
    (item) => item.role === "decision_option",
  );
  const context = intent.contexts[0];
  const decisionGoalIds = intent.decisionGoals.map((item) => item.id);
  const contextPrefix = context ? `${context.text} ` : "";
  const blocks: SurveyPlanBlock[] = [];

  if (category) {
    blocks.push(
      makeBlock(
        "category-selection",
        category.text,
        "category_set",
        "nominal",
        "응답자가 실제로 선택·구매·이용하는 구체적인 범주를 측정함.",
        [category.id],
        decisionGoalIds,
      ),
      makeBlock(
        "category-priority",
        `${category.text} 우선순위`,
        "preference",
        "preference",
        "범주별 상대적 비중과 우선순위를 비교함.",
        [category.id],
        decisionGoalIds,
      ),
    );
  }
  if (behavior) {
    blocks.push(
      makeBlock(
        "behavior-frequency",
        behavior.text,
        "behavior",
        "frequency",
        "실제 행동의 빈도 또는 규모를 측정함.",
        [behavior.id],
        decisionGoalIds,
      ),
    );
  }
  if (intent.objectKind === "decision_support") {
    if (!category) {
      if (behavior) {
        blocks.push(
          makeBlock(
            "behavior-context",
            `${behavior.text} 상황`,
            "context",
            "nominal",
            "현재 행동이 일어나는 상황과 맥락을 구분함.",
            [behavior.id],
            decisionGoalIds,
          ),
        );
      } else {
        blocks.push(
          makeBlock(
            "decision-options",
            decisionOption?.text ?? "필요한 대안",
            "decision_option",
            "nominal",
            "응답자가 원하는 대안의 범위를 확인함.",
            decisionOption ? [decisionOption.id] : [],
            decisionGoalIds,
          ),
          makeBlock(
            "decision-priority",
            `${decisionOption?.text ?? "대안"} 우선순위`,
            "preference",
            "preference",
            "여러 대안 중 최우선 선택지를 측정함.",
            decisionOption ? [decisionOption.id] : [],
            decisionGoalIds,
          ),
        );
      }
      blocks.push(
        makeBlock(
          "unmet-need",
          unmetNeed?.text ?? `${contextPrefix}충족되지 않은 수요`,
          "unmet_need",
          "nominal",
          "현재 선택지로 충족되지 않는 요구를 확인함.",
          unmetNeed ? [unmetNeed.id] : [],
          decisionGoalIds,
        ),
        ...(behavior
          ? [
              makeBlock(
                "decision-options",
                decisionOption?.text ?? "필요한 대안",
                "decision_option",
                "nominal",
                "문제 해결에 필요한 대안의 범위를 확인함.",
                decisionOption ? [decisionOption.id] : [],
                decisionGoalIds,
              ),
              makeBlock(
                "decision-priority",
                `${decisionOption?.text ?? "대안"} 우선순위`,
                "preference",
                "preference",
                "여러 대안 중 최우선 선택지를 측정함.",
                decisionOption ? [decisionOption.id] : [],
                decisionGoalIds,
              ),
            ]
          : [
              makeBlock(
                "decision-purpose",
                `${decisionOption?.text ?? "대안"} 이용 목적`,
                "behavior",
                "nominal",
                "대안이 해결해야 할 실제 이용 목적을 파악함.",
                decisionOption ? [decisionOption.id] : [],
                decisionGoalIds,
              ),
            ]),
        makeBlock(
          "decision-criteria",
          `${decisionOption?.text ?? "대안"} 선택 기준`,
          "preference",
          "preference",
          "대안 선정 기준의 우선순위를 확인함.",
          decisionOption ? [decisionOption.id] : [],
          decisionGoalIds,
        ),
        makeBlock(
          "adoption-intent",
          `${decisionOption?.text ?? "대안"} 이용 의향`,
          "preference",
          "frequency",
          "선호 대안에 대한 실제 이용 가능성을 확인함.",
          decisionOption ? [decisionOption.id] : [],
          decisionGoalIds,
        ),
        ...(!behavior
          ? [
              makeBlock(
                "open-evidence",
                "구체적인 경험과 제안",
                "construct",
                "open_text",
                "선택지에 포함되지 않은 근거와 대안을 수집함.",
                [],
                decisionGoalIds,
              ),
            ]
          : []),
      );
    } else {
      blocks.push(
        makeBlock(
          "purchase-context",
          `${contextPrefix}구매·이용 경로`,
          "context",
          "nominal",
          "현재 수요가 충족되는 경로와 맥락을 파악함.",
          context ? [context.id] : [],
          decisionGoalIds,
        ),
        makeBlock(
          "unmet-need",
          unmetNeed?.text ?? `${contextPrefix}충족되지 않은 수요`,
          "unmet_need",
          "nominal",
          "현재 선택지로 충족되지 않는 요구를 확인함.",
          unmetNeed ? [unmetNeed.id] : [],
          decisionGoalIds,
        ),
        makeBlock(
          "decision-option",
          decisionOption?.text ?? "필요한 대안",
          "decision_option",
          "preference",
          "조사 결과가 지원해야 할 대안의 우선순위를 측정함.",
          decisionOption ? [decisionOption.id] : [],
          decisionGoalIds,
        ),
        makeBlock(
          "adoption-intent",
          `${decisionOption?.text ?? "대안"} 이용 의향`,
          "preference",
          "frequency",
          "선호 대안에 대한 실제 이용 가능성을 확인함.",
          decisionOption ? [decisionOption.id] : [],
          decisionGoalIds,
        ),
      );
    }
  }

  const fallbackEntities = intent.constructEntities.filter(
    (item) => !blocks.some((block) => block.sourceEntityIds.includes(item.id)),
  );
  for (const item of fallbackEntities) {
    if (blocks.length >= Math.max(1, requestedQuestionCount - 1)) break;
    blocks.push(
      makeBlock(
        `variable-${blocks.length + 1}`,
        item.text,
        item.role,
        item.role === "behavior" ? "frequency" : "ordinal",
        `${item.text}을(를) 분석 가능한 형태로 측정함.`,
        [item.id],
        decisionGoalIds,
      ),
    );
  }

  if (blocks.length < requestedQuestionCount) {
    blocks.push(
      makeBlock(
        "open-evidence",
        "구체적인 경험과 제안",
        "construct",
        "open_text",
        "선택지에 포함되지 않은 근거와 대안을 수집함.",
        [],
        decisionGoalIds,
      ),
    );
  }

  return {
    intentKind: intent.objectKind,
    targetPopulation: intent.targetPopulation,
    primaryPurpose: intent.studyPurpose?.text ?? intent.purpose,
    decisionGoals: intent.decisionGoals.map((item) => item.text),
    blocks: blocks.slice(0, requestedQuestionCount),
    requestedQuestionCount,
  };
}

export function compactSurveyPlanForPrompt(plan: SurveyPlan) {
  return {
    intentKind: plan.intentKind,
    targetPopulation: plan.targetPopulation,
    primaryPurpose: plan.primaryPurpose,
    decisionGoals: plan.decisionGoals,
    requestedQuestionCount: plan.requestedQuestionCount,
    blocks: plan.blocks.map((block) => ({
      id: block.id,
      variable: block.variable,
      role: block.role,
      variableType: block.variableType,
      purpose: block.purpose,
      decisionGoalIds: block.decisionGoalIds,
    })),
  };
}
