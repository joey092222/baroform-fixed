import type {
  MeasurementMode,
  SemanticRole,
  SurveyIntent,
  TargetCardinality,
  TargetListSource,
} from "./survey-semantic-intent";
import {
  hasRelationalResearchIntent,
  type ResearchMeasurementLevel,
  type ResearchVariable,
} from "./survey-research-intent";

export type SurveyVariableType =
  | "nominal"
  | "ordinal"
  | "frequency"
  | "amount"
  | "binary"
  | "numeric"
  | "scale"
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
  researchVariableId?: string;
  variableScope?: ResearchVariable["scope"];
  directlyAskable?: boolean;
  analysisUsage?: string;
  relationIds?: string[];
};

export type SurveyPlan = {
  intentKind: SurveyIntent["objectKind"];
  targetPopulation: string | null;
  evaluationTargets: string[];
  targetCardinality: TargetCardinality;
  targetListSource: TargetListSource;
  unitOfAnalysis: string;
  measurementMode: MeasurementMode;
  screeningRequired: boolean;
  screeningReason: string | null;
  missingInformation: string[];
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
  research?: Partial<
    Pick<
      SurveyPlanBlock,
      | "researchVariableId"
      | "variableScope"
      | "directlyAskable"
      | "analysisUsage"
      | "relationIds"
    >
  >,
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
  ...research,
});

function planVariableType(level: ResearchMeasurementLevel): SurveyVariableType {
  switch (level) {
    case "binary":
      return "binary";
    case "numeric":
      return "numeric";
    case "scale":
      return "scale";
    case "nominal":
      return "nominal";
    case "ordinal":
      return "ordinal";
    case "text":
      return "open_text";
  }
}

function semanticRoleForResearchVariable(variable: ResearchVariable): SemanticRole {
  if (variable.role === "grouping") return "context";
  if (variable.role === "predictor") return "behavior";
  if (variable.role === "outcome") {
    if (/만족도|수면의\s*질|스트레스|의향|정도|수준/.test(variable.name)) {
      return "construct";
    }
    return variable.measurementLevel === "binary" ? "behavior" : "construct";
  }
  return "construct";
}

function objectParticle(value: string) {
  const last = [...value.trim()].at(-1) ?? "";
  const code = last.charCodeAt(0);
  const hasBatchim =
    code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
  return hasBatchim ? "을" : "를";
}

function createRelationalSurveyPlan(
  intent: SurveyIntent,
  requestedQuestionCount: number,
): SurveyPlan {
  const research = intent.researchIntent;
  const relationIds = research.relations.map((item) => item.id);
  const blocks = research.variables
    .filter(
      (variable) =>
        variable.scope === "respondent_level" && variable.directlyAskable,
    )
    .map((variable) =>
      makeBlock(
        `measure-${variable.id}`,
        variable.name,
        semanticRoleForResearchVariable(variable),
        planVariableType(variable.measurementLevel),
        `${variable.name}${objectParticle(variable.name)} 응답자 수준에서 직접 측정함.`,
        [variable.id],
        [],
        {
          researchVariableId: variable.id,
          variableScope: variable.scope,
          directlyAskable: variable.directlyAskable,
          analysisUsage: research.analysisGoals
            .filter((goal) => goal.variableIds.includes(variable.id))
            .map((goal) => goal.description)
            .join("; "),
          relationIds,
        },
      ),
    );
  const corpus = research.variables.map((item) => item.name).join(" ");
  const supplemental = /통학\s*시간.*(?:거주\s*형태|자취\s*여부)|(?:거주\s*형태|자취\s*여부).*통학\s*시간/.test(
    corpus,
  )
    ? [
        ["commute-mode", "주된 통학 수단", "context", "nominal", "통학 시간이 형성되는 이동 수단을 구분함."],
        ["home-commute-time", "본가 기준 예상 통학 시간", "behavior", "numeric", "자취 전후 또는 본가 기준 통학 여건을 비교함."],
        ["housing-choice-influence", "통학 시간이 거주 형태 선택에 미친 영향", "construct", "scale", "통학 여건과 주거 선택의 연결 정도를 측정함."],
        ["housing-choice-reason", "현재 거주 형태 선택 이유", "construct", "nominal", "자취·기숙사·본가 통학 선택의 주요 이유를 구분함."],
        ["commute-support", "통학 부담 완화 지원", "unmet_need", "open_text", "관계 분석을 해석할 수 있는 지원 요구를 수집함."],
      ] as const
    : [
        ["predictor-context", "선행 변수의 발생 상황", "context", "nominal", "선행 변수가 달라지는 주요 상황을 구분함."],
        ["outcome-driver", "결과 변수에 영향을 주는 요인", "construct", "nominal", "두 변수 관계를 해석할 보조 요인을 수집함."],
        ["perceived-link", "두 변수의 체감 연결 정도", "construct", "scale", "응답자가 경험한 관계의 방향과 강도를 보조적으로 측정함."],
        ["barrier-context", "관계 해석에 필요한 제약 조건", "context", "nominal", "집단 차이를 설명할 수 있는 맥락을 구분함."],
        ["open-evidence", "관계에 대한 구체적인 경험", "construct", "open_text", "정형 문항에서 놓친 관계의 근거를 수집함."],
      ] as const;
  for (const [id, variable, role, variableType, purpose] of supplemental) {
    if (blocks.length >= requestedQuestionCount) break;
    blocks.push(
      makeBlock(
        id,
        variable,
        role,
        variableType,
        purpose,
        [],
        [],
        {
          variableScope: "respondent_level",
          directlyAskable: true,
          analysisUsage: research.analysisGoals.map((item) => item.description).join("; "),
          relationIds,
        },
      ),
    );
  }
  return {
    intentKind: intent.objectKind,
    targetPopulation: intent.targetPopulation,
    evaluationTargets: intent.evaluationTargets,
    targetCardinality: intent.targetCardinality,
    targetListSource: intent.targetListSource,
    unitOfAnalysis: intent.unitOfAnalysis,
    measurementMode: intent.measurementMode,
    screeningRequired: intent.screeningRequired,
    screeningReason: intent.screeningReason,
    missingInformation: intent.missingInformation,
    primaryPurpose:
      research.analysisGoals[0]?.description ?? intent.studyPurpose?.text ?? intent.purpose,
    decisionGoals: research.analysisGoals.map((item) => item.description),
    blocks: blocks.slice(0, requestedQuestionCount),
    requestedQuestionCount,
  };
}

export function createSurveyPlan(
  intent: SurveyIntent,
  requestedQuestionCount = 7,
): SurveyPlan {
  if (hasRelationalResearchIntent(intent.researchIntent)) {
    return createRelationalSurveyPlan(intent, requestedQuestionCount);
  }
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
    evaluationTargets: intent.evaluationTargets,
    targetCardinality: intent.targetCardinality,
    targetListSource: intent.targetListSource,
    unitOfAnalysis: intent.unitOfAnalysis,
    measurementMode: intent.measurementMode,
    screeningRequired: intent.screeningRequired,
    screeningReason: intent.screeningReason,
    missingInformation: intent.missingInformation,
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
    evaluationTargets: plan.evaluationTargets,
    targetCardinality: plan.targetCardinality,
    targetListSource: plan.targetListSource,
    unitOfAnalysis: plan.unitOfAnalysis,
    measurementMode: plan.measurementMode,
    screeningRequired: plan.screeningRequired,
    screeningReason: plan.screeningReason,
    missingInformation: plan.missingInformation,
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
      researchVariableId: block.researchVariableId,
      variableScope: block.variableScope,
      directlyAskable: block.directlyAskable,
      analysisUsage: block.analysisUsage,
      relationIds: block.relationIds,
    })),
  };
}
