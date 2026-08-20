import type {
  MeasurementMode,
  SemanticRole,
  SurveyIntent,
  SurveyPurposeBlock,
  TargetCardinality,
  TargetListSource,
} from "./survey-semantic-intent";
import {
  hasRelationalResearchIntent,
  type ResearchMeasurementLevel,
  type ResearchRelation,
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

export type SurveyPlanBlockKind = "measurement" | "analysis" | "instruction";

export type SurveyPlanQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "scale"
  | "short_text"
  | "long_text";

export type SurveyPlanBlock = {
  id: string;
  kind: SurveyPlanBlockKind;
  variable: string;
  variableIds: string[];
  role: SemanticRole;
  variableType: SurveyVariableType;
  questionType?: SurveyPlanQuestionType;
  analysisType?: ResearchRelation["type"] | "cross_tabulation";
  purpose: string;
  questionCount: number;
  sourceEntityIds: string[];
  decisionGoalIds: string[];
  required: boolean;
  researchVariableId?: string;
  variableScope?: ResearchVariable["scope"];
  directlyAskable: boolean;
  analysisUsage?: string;
  relationIds?: string[];
  purposeBlockId?: string;
  measuredEntityIds?: string[];
};

export type SurveyPlanPurposeCoverage = {
  purposeBlockId: string;
  purposeKind: SurveyPurposeBlock["kind"];
  plannedQuestionCount: number;
};

export type SurveyPlan = {
  intentMode: SurveyIntent["intentMode"];
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
  purposeBlocks: SurveyPurposeBlock[];
  purposeCoverage: SurveyPlanPurposeCoverage[];
  blocks: SurveyPlanBlock[];
  requestedQuestionCount: number;
};

export type SurveyPlanCoverageQuestion = {
  id?: string | number;
  type?: string;
  planBlockId?: string;
  measuredVariable?: string;
  measuredConstruct?: string;
  measuredEntityIds?: string[];
  title: string;
  options?: string[];
};

export type FinalQuestionCoverage = {
  questionId: string;
  declaredPlanBlockId: string | null;
  declaredVariable: string | null;
  inferredVariable: string | null;
  roleCompatible: boolean;
};

export type PlanCoverageResult = {
  coveredRequiredBlockIds: string[];
  missingRequiredBlockIds: string[];
  optionalBlockIds: string[];
  questionCoverage: FinalQuestionCoverage[];
  incompatibleQuestionIds: string[];
  semanticDuplicateGroups: string[][];
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
  kind: "measurement",
  variable,
  variableIds: sourceEntityIds,
  role,
  variableType,
  questionType:
    variableType === "open_text"
      ? "long_text"
      : variableType === "scale"
        ? "scale"
        : variableType === "numeric"
          ? "single_choice"
          : "single_choice",
  purpose,
  questionCount: 1,
  sourceEntityIds,
  decisionGoalIds,
  required: true,
  directlyAskable: true,
  ...research,
});

function usageAudienceIsPrequalified(intent: SurveyIntent) {
  const audience = `${intent.targetPopulation ?? ""} ${intent.eligibilityCondition ?? ""}`;
  return /(?:이용|사용|구매|구독|방문|참여)(?:\s*해?\s*본|\s*경험이\s*있는|\s*중인|\s*하고\s*있는)|(?:이용자|사용자|구독자|구매자|방문자|참여자)/.test(
    audience,
  );
}

function usageTarget(intent: SurveyIntent, purposeBlock: SurveyPurposeBlock) {
  const explicitEntity = intent.entities.find((item) =>
    ["product_or_service", "existing_service", "facility"].includes(item.role),
  );
  const candidate =
    explicitEntity?.text ||
    purposeBlock.target ||
    intent.evaluationTargets[0] ||
    intent.surveyObject ||
    intent.semanticContext.primaryEntity;
  return candidate
    .replace(
      /\s+(?:이용|사용|방문|구매)?\s*(?:경험|현황|행태|패턴|빈도|시간대|선호\s*장르)(?:와|과|및|,|\s).*/,
      "",
    )
    .replace(/\s+(?:이용|사용|방문|구매)?\s*(?:경험|현황|행태|패턴|빈도|시간대|선호\s*장르)$/u, "")
    .trim();
}

function usagePlanBlocks(intent: SurveyIntent, decisionGoalIds: string[]) {
  const purposeBlock = intent.purposeBlocks.find(
    (item) => item.kind === "usage_experience" || item.kind === "behavior_usage",
  );
  if (
    !purposeBlock ||
    intent.intentMode !== "single" ||
    intent.objectKind !== "service_product"
  ) {
    return [];
  }

  const corpus = [
    intent.rawInput,
    purposeBlock.text,
    purposeBlock.target,
    ...intent.semanticContext.researchConstructs,
  ].join(" ");
  const target = usageTarget(intent, purposeBlock);
  if (!target) return [];

  const sourceEntityIds = [
    ...purposeBlock.targetEntityIds,
    ...purposeBlock.constructEntityIds,
  ];
  const measuredEntityIds = [...new Set(sourceEntityIds)];
  const withPurpose = (block: SurveyPlanBlock, required: boolean) => ({
    ...block,
    required,
    purposeBlockId: purposeBlock.id,
    measuredEntityIds,
  });
  const blocks: SurveyPlanBlock[] = [];
  const asksStatus =
    !usageAudienceIsPrequalified(intent) &&
    /(?:이용|사용|구매|구독|방문)\s*(?:경험|여부|현황)|(?:이용|사용)해?\s*본/.test(
      corpus,
    );
  const asksFrequency =
    /(?:이용|사용|구매|구독|방문)\s*(?:경험|현황|행태|패턴|빈도)|얼마나\s*자주/.test(
      corpus,
    ) &&
    !/^(?=.*(?:시간대|언제))(?:(?!빈도|현황|경험|패턴|행태).)*$/u.test(
      intent.rawInput,
    );
  const asksTimeContext = /(?:이용|사용|방문)\s*시간대|주로\s*언제/.test(
    intent.rawInput,
  );
  const asksGenre = /(?:선호|이용|콘텐츠)\s*장르/.test(intent.rawInput);

  if (asksStatus) {
    blocks.push(
      withPurpose(
        makeBlock(
          "usage-status",
          `${target} 이용 경험 여부`,
          "behavior",
          "binary",
          "조사 대상 서비스의 실제 이용 경험 여부를 구분함.",
          measuredEntityIds,
          decisionGoalIds,
        ),
        true,
      ),
    );
  }
  if (asksFrequency) {
    blocks.push(
      withPurpose(
        makeBlock(
          "usage-frequency",
          `${target} 이용 빈도`,
          "behavior",
          "frequency",
          "실제 이용 빈도를 횟수 또는 주기 구간으로 측정함.",
          measuredEntityIds,
          decisionGoalIds,
        ),
        true,
      ),
    );
  }
  if (asksTimeContext) {
    blocks.push(
      withPurpose(
        makeBlock(
          "usage-time-context",
          `${target} 이용 시간대`,
          "context",
          "nominal",
          "주로 이용하는 시간대를 구분함.",
          measuredEntityIds,
          decisionGoalIds,
        ),
        true,
      ),
    );
  }
  if (asksGenre) {
    blocks.push(
      withPurpose(
        makeBlock(
          "usage-preferred-genre",
          `${target} 선호 장르`,
          "preference",
          "nominal",
          "이용자가 선호하는 콘텐츠 장르를 구분함.",
          measuredEntityIds,
          decisionGoalIds,
        ),
        true,
      ),
    );
  }

  const inferredBlocks = [
    {
      id: "usage-purpose",
      pattern: /이용\s*목적/,
      variable: `${target} 이용 목적과 상황`,
      role: "context" as const,
      variableType: "nominal" as const,
      purpose: "서비스를 이용하는 주된 목적과 상황을 구분함.",
    },
    {
      id: "usage-satisfaction",
      pattern: /만족/,
      variable: `${target} 이용 만족도`,
      role: "construct" as const,
      variableType: "scale" as const,
      purpose: "서비스 이용 경험의 전반적 만족도를 측정함.",
    },
    {
      id: "usage-pain",
      pattern: /불편|어려움|문제/,
      variable: `${target} 이용 불편`,
      role: "pain_point" as const,
      variableType: "nominal" as const,
      purpose: "서비스 이용 중 경험한 불편을 구분함.",
    },
    {
      id: "usage-improvement",
      pattern: /개선|보완|수요/,
      variable: `${target} 개선 수요`,
      role: "unmet_need" as const,
      variableType: "nominal" as const,
      purpose: "서비스에서 우선 개선할 요구를 파악함.",
    },
  ];
  for (const item of inferredBlocks) {
    if (!item.pattern.test(corpus)) continue;
    blocks.push(
      withPurpose(
        makeBlock(
          item.id,
          item.variable,
          item.role,
          item.variableType,
          item.purpose,
          measuredEntityIds,
          decisionGoalIds,
        ),
        item.pattern.test(intent.rawInput),
      ),
    );
  }
  return blocks;
}

function normalizedCoverageText(question: SurveyPlanCoverageQuestion) {
  return [
    question.title,
    question.measuredVariable ?? "",
    question.measuredConstruct ?? "",
    ...(question.options ?? []),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function directlyMeasuresOverallSatisfaction(
  question: SurveyPlanCoverageQuestion,
  block: SurveyPlanBlock,
) {
  void block;
  const title = question.title.replace(/\s+/g, " ").trim();
  const labels = (question.options ?? []).join(" ");
  const asksSatisfaction =
    /(?:전반적|종합적|전체적)?\s*(?:으로\s*)?(?:얼마나\s*)?만족|만족도(?:는|가|를|을)?\s*(?:어느|얼마나)/u.test(
      title,
    );
  const hasOverallCue = /전반적|종합적|전체적/u.test(title);
  const asksOverallEvaluation =
    /(?:전반적|종합적|전체적).*(?:어땠|어떠셨|평가)|(?:전반적|종합적|전체적).*어떤가/u.test(
      title,
    );
  const balancedSatisfactionOptions =
    /만족/u.test(labels) && /불만족|만족(?:하지|스럽지)\s*않/u.test(labels);
  const orderedNumericOptions =
    (question.options?.length ?? 0) >= 3 &&
    (question.options?.length ?? 0) <= 7 &&
    (question.options ?? []).every((option) =>
      /^(?:\d+|\d+\s*점|매우\s*불만족|불만족|보통|만족|매우\s*만족)$/u.test(
        option.trim(),
      ),
    );
  const supportsSatisfactionResponse =
    question.type === "scale" ||
    balancedSatisfactionOptions ||
    orderedNumericOptions;
  return (
    (asksSatisfaction &&
      supportsSatisfactionResponse &&
      hasOverallCue) ||
    (asksOverallEvaluation &&
      (question.type === "scale" || balancedSatisfactionOptions))
  );
}

function perceptionVariableIsDirectlyMeasured(
  question: SurveyPlanCoverageQuestion,
  block: SurveyPlanBlock,
) {
  const title = question.title.replace(/\s+/g, " ").trim();
  const variable = block.variable.replace(/\s+/g, " ").trim();
  if (!title || !/(?:인식|인상|이미지|태도)/u.test(variable)) return false;

  // Purpose-bound blocks must be supported by respondent-facing wording. Model
  // metadata alone is not evidence that the requested construct was measured.
  if (/(?:개선|좋아지|달라져|바라는\s*점)/u.test(title)) return false;
  return /(?:전반적|전체적).*(?:인식|인상|이미지|태도|어떻게\s*(?:생각|느끼|느껴|느꼈|느낀)|느낌)|(?:어떤|어떻게).*(?:인상|이미지|태도|생각|느끼|느껴|느꼈|느낀)/u.test(
    title,
  );
}

function isCanonicalFallbackPurposeBlock(block: SurveyPlanBlock) {
  return Boolean(
    block.purposeBlockId &&
      /^variable-\d+$/u.test(block.id) &&
      /(?:인식|인상|이미지|태도)/u.test(block.variable),
  );
}

function visibleQuestionText(question: SurveyPlanCoverageQuestion) {
  return [question.title, ...(question.options ?? [])]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const explicitUsageBlockIds = [
  "usage-status",
  "usage-frequency",
  "usage-time-context",
  "usage-preferred-genre",
  "usage-purpose",
  "usage-satisfaction",
  "usage-pain",
  "usage-improvement",
] as const;

type ExplicitUsageBlockId = (typeof explicitUsageBlockIds)[number];

function isExplicitUsageBlockId(value: string | undefined): value is ExplicitUsageBlockId {
  return Boolean(
    value && explicitUsageBlockIds.includes(value as ExplicitUsageBlockId),
  );
}

function hasOrderedFrequencyResponse(question: SurveyPlanCoverageQuestion) {
  const options = question.options ?? [];
  if (options.length < 3) return false;
  const corpus = options.join(" ");
  const intervalCount = options.filter((option) =>
    /(?:매일|거의\s*매일|주\s*\d+\s*(?:회|번)|주\s*1회|월\s*\d+\s*(?:회|번)|한\s*달|드물|가끔|자주|전혀)/.test(
      option,
    ),
  ).length;
  return (
    intervalCount >= Math.min(3, options.length) ||
    /(?:하루|일주일|한\s*주|한\s*달|월).*(?:회|번)/.test(corpus)
  );
}

function hasStatusResponse(question: SurveyPlanCoverageQuestion) {
  const options = question.options ?? [];
  if (options.length < 2 || options.length > 5) return false;
  const corpus = options.join(" ");
  return (
    /(?:예|있음|있다|이용\s*중|현재\s*이용|과거.*이용)/.test(corpus) &&
    /(?:아니요|없음|없다|이용한\s*적\s*없|사용한\s*적\s*없)/.test(corpus)
  );
}

/**
 * Reclassifies what a respondent-facing question actually measures. Model supplied
 * metadata is intentionally excluded: declared metadata is checked against this
 * result, never used to manufacture it.
 */
export function inferExplicitUsageQuestionRole(
  question: SurveyPlanCoverageQuestion,
): ExplicitUsageBlockId | null {
  const text = visibleQuestionText(question);
  const title = question.title.replace(/\s+/g, " ").trim();

  if (/장르/.test(text)) return "usage-preferred-genre";
  if (/만족/.test(text)) return "usage-satisfaction";
  if (/불편|어려움|문제점/.test(text)) return "usage-pain";
  if (/개선|보완|바라는\s*(?:점|기능)|필요한\s*기능/.test(text)) {
    return "usage-improvement";
  }
  if (/이용\s*목적|이용하는\s*이유|보는\s*이유|주로\s*어떤\s*(?:상황|이유)/.test(text)) {
    return "usage-purpose";
  }
  if (
    /주로\s*언제|어느\s*시간대|시간대|요일별|아침|점심|저녁|취침\s*전/.test(
      text,
    ) &&
    !/얼마나\s*자주|빈도|몇\s*(?:회|번)/.test(title)
  ) {
    return "usage-time-context";
  }
  if (
    /얼마나\s*자주|(?:이용|사용|구매|구독|방문|시청|감상)\s*빈도|몇\s*(?:회|번)|주당|월평균/.test(
      title,
    ) ||
    hasOrderedFrequencyResponse(question)
  ) {
    return "usage-frequency";
  }
  if (
    /(?:이용|사용|구매|구독|방문|시청|감상)(?:해?\s*본|한\s*적|\s*경험\s*여부|\s*여부)|(?:본|시청한)\s*적/.test(
      title,
    ) &&
    ((question.options?.length ?? 0) === 0 || hasStatusResponse(question))
  ) {
    return "usage-status";
  }
  return null;
}

function questionId(question: SurveyPlanCoverageQuestion, index: number) {
  return String(question.id ?? index + 1);
}

function usageQuestionRoleIsCompatible(
  question: SurveyPlanCoverageQuestion,
  blockId: ExplicitUsageBlockId,
) {
  return inferExplicitUsageQuestionRole(question) === blockId;
}

function semanticDuplicateGroups(
  plan: SurveyPlan,
  questions: SurveyPlanCoverageQuestion[],
) {
  const groups = new Map<string, string[]>();
  questions.forEach((question, index) => {
    const inferred = inferExplicitUsageQuestionRole(question);
    if (inferred !== "usage-status" && inferred !== "usage-frequency") return;
    const entityKey = (question.measuredEntityIds ?? []).slice().sort().join("|");
    const titleTarget = question.title
      .replace(/^(?:현재|최근(?:\s*\d+\s*(?:일|주|개월))?|평소)\s*/u, "")
      .match(
        /^(.+?)(?:을|를)?\s*(?:이용|사용|구매|구독|방문|시청|감상|보)(?:해?\s*본|한\s*적|\s*경험|\s*여부|\s*빈도|.*얼마나\s*자주)/u,
      )?.[1]
      ?.replace(/[\s?!.,'"“”‘’]/g, "")
      .toLocaleLowerCase("ko-KR");
    // A single-purpose usage survey has one evaluation target. In composite surveys
    // an entity link is required before equal roles are considered duplicates.
    if (plan.intentMode === "composite" && !entityKey) return;
    if (!entityKey && !titleTarget) return;
    const responseKind = question.type ?? "unknown";
    const key = `${inferred}:${entityKey || titleTarget}:${responseKind}`;
    groups.set(key, [...(groups.get(key) ?? []), questionId(question, index)]);
  });
  return [...groups.values()].filter((ids) => ids.length > 1);
}

export function questionCoversSurveyPlanBlock(
  question: SurveyPlanCoverageQuestion,
  block: SurveyPlanBlock,
) {
  if (block.kind !== "measurement" || !block.directlyAskable) return false;
  if (block.id === "overall-satisfaction") {
    return directlyMeasuresOverallSatisfaction(question, block);
  }
  const text = normalizedCoverageText(question);
  const specialMatchers: Record<string, RegExp> = {
    "usage-status":
      /(?:이용|사용|구매|구독|방문)(?:해?\s*본|한\s*적|\s*경험\s*여부|\s*여부)|이용자와\s*비이용자/,
    "usage-frequency":
      /얼마나\s*자주|(?:이용|사용|구매|구독|방문)\s*빈도|(?:하루|주당|한\s*주|월|한\s*달).*\d+\s*회/,
    "usage-time-context": /주로\s*언제|시간대|요일별|시간대별/,
    "usage-preferred-genre": /장르/,
    "usage-purpose": /이용\s*목적|주로\s*어떤\s*(?:상황|이유)|이용하는\s*이유/,
    "usage-satisfaction": /만족/,
    "usage-pain": /불편|어려움|문제점/,
    "usage-improvement": /개선|보완|바라는\s*(?:점|기능)|필요한\s*기능/,
  };
  const matcher = specialMatchers[block.id];
  if (matcher && isExplicitUsageBlockId(block.id)) {
    return usageQuestionRoleIsCompatible(question, block.id);
  }
  if (matcher) return matcher.test(text);
  if (isCanonicalFallbackPurposeBlock(block)) {
    return perceptionVariableIsDirectlyMeasured(question, block);
  }
  if (question.planBlockId === block.id) return true;
  const variable = block.variable.replace(/\s+/g, " ").trim();
  return Boolean(
    variable &&
      (text.includes(variable) ||
        (question.measuredVariable && variable.includes(question.measuredVariable))),
  );
}

export function evaluateSurveyPlanCoverage(
  plan: SurveyPlan,
  questions: SurveyPlanCoverageQuestion[],
): PlanCoverageResult {
  const askableMeasurementBlocks = plan.blocks.filter(
    (block) => block.kind === "measurement" && block.directlyAskable,
  );
  // Legacy, unbound plan blocks predate question-to-plan linking and cannot be
  // enforced safely. Canonical fallback purpose blocks and the explicit usage
  // blocks below have deterministic semantic predicates and repair candidates.
  const requiredBlocks = askableMeasurementBlocks.filter(
    (block) =>
      block.required &&
      (block.id === "overall-satisfaction" ||
        isCanonicalFallbackPurposeBlock(block) ||
        [
          "usage-status",
          "usage-frequency",
          "usage-time-context",
          "usage-preferred-genre",
        ].includes(block.id)),
  );
  const questionCoverage = questions.map((question, index) => {
    const declaredPlanBlockId = question.planBlockId ?? null;
    const inferredVariable = inferExplicitUsageQuestionRole(question);
    const declaredBlock = declaredPlanBlockId
      ? plan.blocks.find((block) => block.id === declaredPlanBlockId)
      : undefined;
    return {
      questionId: questionId(question, index),
      declaredPlanBlockId,
      declaredVariable:
        question.measuredVariable ?? question.measuredConstruct ?? null,
      inferredVariable,
      roleCompatible:
        declaredBlock && isCanonicalFallbackPurposeBlock(declaredBlock)
          ? questionCoversSurveyPlanBlock(question, declaredBlock)
          : !isExplicitUsageBlockId(declaredPlanBlockId ?? undefined) ||
            inferredVariable === declaredPlanBlockId,
    } satisfies FinalQuestionCoverage;
  });
  const coveredRequiredBlockIds = requiredBlocks
    .filter((block) =>
      questions.some((question) => questionCoversSurveyPlanBlock(question, block)),
    )
    .map((block) => block.id);
  return {
    coveredRequiredBlockIds,
    missingRequiredBlockIds: requiredBlocks
      .filter((block) => !coveredRequiredBlockIds.includes(block.id))
      .map((block) => block.id),
    optionalBlockIds: askableMeasurementBlocks
      .filter((block) => !block.required)
      .map((block) => block.id),
    questionCoverage,
    incompatibleQuestionIds: questionCoverage
      .filter((item) => !item.roleCompatible)
      .map((item) => item.questionId),
    semanticDuplicateGroups: semanticDuplicateGroups(plan, questions),
  };
}

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

function createCompositeSurveyPlan(
  intent: SurveyIntent,
  requestedQuestionCount: number,
): SurveyPlan {
  const existing = intent.entities.find((item) =>
    ["existing_context", "existing_service"].includes(item.role),
  );
  const activity = intent.entities.find((item) => item.role === "current_activity");
  const painPoint = intent.entities.find((item) => item.role === "pain_point");
  const proposed = intent.entities.find((item) => item.role === "proposed_solution");
  const demand = intent.entities.find((item) => item.role === "demand_target");
  const firstPurpose = intent.purposeBlocks[0];
  const secondPurpose = intent.purposeBlocks[1];
  const firstEntityIds = [existing?.id, activity?.id, painPoint?.id].filter(
    (item): item is string => Boolean(item),
  );
  const secondEntityIds = [proposed?.id, demand?.id].filter(
    (item): item is string => Boolean(item),
  );
  const withPurpose = (
    block: SurveyPlanBlock,
    purposeBlock: SurveyPurposeBlock,
    measuredEntityIds: string[],
  ) => ({
    ...block,
    purposeBlockId: purposeBlock.id,
    measuredEntityIds,
  });
  const firstBlocks = [
    withPurpose(
      makeBlock(
        "existing-frequency",
        `${existing?.text ?? firstPurpose.target} 이용 빈도`,
        "current_activity",
        "frequency",
        "현재 이용 정도를 측정해 제안 기능의 수요를 해석할 기준을 만듦.",
        firstEntityIds,
        [],
      ),
      firstPurpose,
      firstEntityIds,
    ),
    withPurpose(
      makeBlock(
        firstPurpose.kind === "satisfaction" ? "existing-satisfaction" : "existing-purpose",
        firstPurpose.kind === "satisfaction"
          ? `${existing?.text ?? firstPurpose.target} 전반적 만족도`
          : `${existing?.text ?? firstPurpose.target} 이용 목적과 상황`,
        firstPurpose.kind === "satisfaction" ? "construct" : "current_activity",
        firstPurpose.kind === "satisfaction" ? "scale" : "nominal",
        firstPurpose.kind === "satisfaction"
          ? "현재 경험의 전반적 만족도를 측정함."
          : "현재 이용 목적과 상황을 구분함.",
        firstEntityIds,
        [],
      ),
      firstPurpose,
      firstEntityIds,
    ),
    withPurpose(
      makeBlock(
        "pain-frequency",
        painPoint?.text ?? `${firstPurpose.target} 이용 불편 빈도`,
        "pain_point",
        "frequency",
        "제안 기능이 해결하려는 문제가 실제로 얼마나 자주 발생하는지 측정함.",
        firstEntityIds,
        [],
      ),
      firstPurpose,
      firstEntityIds,
    ),
    withPurpose(
      makeBlock(
        "pain-detail",
        painPoint?.text ?? `${firstPurpose.target} 이용 불편`,
        "pain_point",
        "nominal",
        "현재 이용에서 구체적으로 개선할 문제를 구분함.",
        firstEntityIds,
        [],
      ),
      firstPurpose,
      firstEntityIds,
    ),
  ];
  firstBlocks[3].questionType = "multiple_choice";
  const secondBlocks = [
    withPurpose(
      makeBlock(
        "demand-need",
        demand?.text ?? `${secondPurpose.target} 필요성`,
        "demand_target",
        "scale",
        "현재 문제를 전제로 제안 기능의 필요 수준을 측정함.",
        secondEntityIds,
        [],
      ),
      secondPurpose,
      secondEntityIds,
    ),
    withPurpose(
      makeBlock(
        "demand-intent",
        `${proposed?.text ?? secondPurpose.target} 이용 의향`,
        "proposed_solution",
        "preference",
        "제안 기능이 제공될 때 실제 이용 의향을 측정함.",
        secondEntityIds,
        [],
      ),
      secondPurpose,
      secondEntityIds,
    ),
    withPurpose(
      makeBlock(
        "demand-preferences",
        `${proposed?.text ?? secondPurpose.target} 선호 조건`,
        "proposed_solution",
        "nominal",
        "제안 기능의 구체적인 운영 방식과 선호 조건을 파악함.",
        secondEntityIds,
        [],
      ),
      secondPurpose,
      secondEntityIds,
    ),
  ];
  secondBlocks[2].questionType = "multiple_choice";
  const canonical = [...firstBlocks, ...secondBlocks];
  const count = Math.max(1, requestedQuestionCount);
  const selected =
    count >= canonical.length
      ? canonical
      : count === 1
        ? [canonical[0]]
        : [canonical[0], canonical[4], ...canonical.slice(1, 4), ...canonical.slice(5)].slice(
            0,
            count,
          );

  return {
    intentMode: "composite",
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
    primaryPurpose: intent.purpose,
    decisionGoals: intent.decisionGoals.map((item) => item.text),
    purposeBlocks: intent.purposeBlocks,
    purposeCoverage: intent.purposeBlocks.map((purposeBlock) => ({
      purposeBlockId: purposeBlock.id,
      purposeKind: purposeBlock.kind,
      plannedQuestionCount: selected.filter(
        (block) => block.purposeBlockId === purposeBlock.id,
      ).length,
    })),
    blocks: selected,
    requestedQuestionCount,
  };
}

function createRelationalSurveyPlan(
  intent: SurveyIntent,
  requestedQuestionCount: number,
): SurveyPlan {
  const research = intent.researchIntent;
  const relationIds = research.relations.map((item) => item.id);
  const measurementBlockGroups = research.variables
    .filter(
      (variable) =>
        variable.scope === "respondent_level" && variable.directlyAskable,
    )
    .map((variable) => {
      const analysisUsage = research.analysisGoals
        .filter((goal) => goal.variableIds.includes(variable.id))
        .map((goal) => goal.description)
        .join("; ");
      if (
        variable.measurementMode !== "single_item" &&
        variable.dimensions.length > 0
      ) {
        return variable.dimensions.map((dimension) => {
          const block = makeBlock(
            `measure-${variable.id}-${dimension.id}`,
            dimension.name,
            semanticRoleForResearchVariable(variable),
            planVariableType(dimension.measurementLevel),
            `${variable.name}의 '${dimension.name}' 차원을 응답자 수준에서 측정함.`,
            [variable.id, dimension.id],
            [],
            {
              researchVariableId: variable.id,
              variableScope: variable.scope,
              directlyAskable: true,
              analysisUsage,
              relationIds,
            },
          );
          block.required = dimension.required;
          return block;
        });
      }
      return [
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
            analysisUsage,
            relationIds,
          },
        ),
      ];
    });
  const measurementBlocks = [
    ...measurementBlockGroups.flatMap((group) =>
      group.filter((block) => block.required),
    ),
    ...measurementBlockGroups.flatMap((group) =>
      group.filter((block) => !block.required),
    ),
  ];
  const corpus = research.variables.map((item) => item.name).join(" ");
  if (
    /통학\s*시간/.test(corpus) &&
    research.variables.some((item) => /현재\s*거주\s*형태/.test(item.name))
  ) {
    measurementBlocks.sort((left, right) => {
      const leftOrder = /현재\s*거주\s*형태/.test(left.variable) ? 0 : 1;
      const rightOrder = /현재\s*거주\s*형태/.test(right.variable) ? 0 : 1;
      return leftOrder - rightOrder;
    });
  }
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
    : /수면\s*시간.*지각\s*(?:횟수|빈도)|지각\s*(?:횟수|빈도).*수면\s*시간/.test(corpus)
      ? [
          ["class-days", "주당 수업일 수", "context", "ordinal", "수면 시간과 지각 횟수의 노출 기회를 보정할 수 있도록 수업일 수를 측정함."],
          ["early-class-days", "주당 이른 수업일 수", "context", "ordinal", "이른 수업 일정이 수면과 지각에 미치는 맥락을 구분함."],
          ["commute-duration", "등교 편도 통학 시간", "context", "ordinal", "수면 시간 외에 지각 횟수와 관련될 수 있는 통학 여건을 측정함."],
          ["tardiness-reasons", "지각의 주된 이유", "context", "nominal", "지각 횟수의 차이를 설명할 수 있는 원인을 구분함."],
          ["sleep-schedule-context", "수면·등교 준비의 추가 맥락", "context", "open_text", "선택지에서 놓친 수면 및 등교 상황을 수집함."],
        ] as const
    : [
        ["predictor-context", "선행 변수의 발생 상황", "context", "nominal", "선행 변수가 달라지는 주요 상황을 구분함."],
        ["outcome-driver", "결과 변수에 영향을 주는 요인", "construct", "nominal", "두 변수 관계를 해석할 보조 요인을 수집함."],
        ["measurement-regularity", "측정값의 평소 변동 정도", "context", "ordinal", "일시적 사건과 평소 경향을 구분함."],
        ["barrier-context", "관계 해석에 필요한 제약 조건", "context", "nominal", "집단 차이를 설명할 수 있는 맥락을 구분함."],
        ["open-evidence", "분석에 참고할 추가 상황", "context", "open_text", "정형 문항에서 놓친 응답 맥락을 수집함."],
      ] as const;
  for (const [id, variable, role, variableType, purpose] of supplemental) {
    if (measurementBlocks.length >= requestedQuestionCount) break;
    const block = makeBlock(
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
      );
    if (["predictor-context", "housing-choice-reason", "tardiness-reasons"].includes(id)) {
      block.questionType = "multiple_choice";
    }
    measurementBlocks.push(block);
  }
  const analysisBlocks: SurveyPlanBlock[] = research.relations.map((relation) => ({
    id: `analyze-${relation.id}`,
    kind: "analysis",
    variable: relation.sourceExpression,
    variableIds: [relation.fromVariableId, relation.toVariableId],
    role: "construct",
    variableType: "numeric",
    analysisType: relation.type,
    purpose: `${relation.sourceExpression}은(는) 두 응답자 수준 변수의 응답값을 교차 분석해 계산함. 관계 자체를 응답자에게 직접 묻지 않음.`,
    questionCount: 0,
    sourceEntityIds: [relation.fromVariableId, relation.toVariableId],
    decisionGoalIds: research.analysisGoals
      .filter((goal) =>
        goal.variableIds.includes(relation.fromVariableId) &&
        goal.variableIds.includes(relation.toVariableId),
      )
      .map((goal) => goal.id),
    required: true,
    directlyAskable: false,
    analysisUsage: research.analysisGoals
      .filter((goal) =>
        goal.variableIds.includes(relation.fromVariableId) &&
        goal.variableIds.includes(relation.toVariableId),
      )
      .map((goal) => goal.description)
      .join("; "),
    relationIds: [relation.id],
  }));
  return {
    intentMode: intent.intentMode,
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
    purposeBlocks: intent.purposeBlocks,
    purposeCoverage: intent.purposeBlocks.map((purposeBlock) => ({
      purposeBlockId: purposeBlock.id,
      purposeKind: purposeBlock.kind,
      plannedQuestionCount: measurementBlocks.filter((block) =>
        purposeBlock.constructEntityIds.some((id) => block.sourceEntityIds.includes(id)),
      ).length,
    })),
    blocks: [
      ...measurementBlocks.slice(0, requestedQuestionCount),
      ...analysisBlocks,
    ],
    requestedQuestionCount,
  };
}

export function createSurveyPlan(
  intent: SurveyIntent,
  requestedQuestionCount = 7,
): SurveyPlan {
  if (intent.intentMode === "composite") {
    return createCompositeSurveyPlan(intent, requestedQuestionCount);
  }
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
  const blocks: SurveyPlanBlock[] = usagePlanBlocks(intent, decisionGoalIds);

  const satisfactionPurpose = intent.purposeBlocks.find(
    (item) => item.kind === "satisfaction",
  );
  if (satisfactionPurpose && !blocks.some((item) => item.id === "usage-satisfaction")) {
    const target =
      satisfactionPurpose.target ??
      intent.evaluationTargets[0] ??
      intent.surveyObject ??
      "조사 대상";
    const measuredEntityIds = [
      ...new Set([
        ...satisfactionPurpose.targetEntityIds,
        ...satisfactionPurpose.constructEntityIds,
      ]),
    ];
    const overallSatisfaction = makeBlock(
      "overall-satisfaction",
      `${target} 전반적 만족도`,
      "construct",
      "scale",
      "세부 평가와 구분되는 전체 경험의 전반적 만족도를 직접 측정함.",
      measuredEntityIds,
      decisionGoalIds,
    );
    overallSatisfaction.purposeBlockId = satisfactionPurpose.id;
    overallSatisfaction.measuredEntityIds = measuredEntityIds;
    blocks.push(overallSatisfaction);
  }

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
    const purposeBlock = intent.purposeBlocks.find((candidate) =>
      candidate.constructEntityIds.includes(item.id),
    );
    const block = makeBlock(
      `variable-${blocks.length + 1}`,
      item.text,
      item.role,
      item.role === "behavior" ? "frequency" : "ordinal",
      `${item.text}을(를) 분석 가능한 형태로 측정함.`,
      [item.id],
      decisionGoalIds,
    );
    if (purposeBlock) {
      block.purposeBlockId = purposeBlock.id;
      block.measuredEntityIds = [item.id];
    }
    blocks.push(block);
  }

  if (blocks.length < requestedQuestionCount) {
    const openEvidence = makeBlock(
        "open-evidence",
        "구체적인 경험과 제안",
        "construct",
        "open_text",
        "선택지에 포함되지 않은 근거와 대안을 수집함.",
        [],
        decisionGoalIds,
      );
    openEvidence.required = false;
    blocks.push(openEvidence);
  }

  return {
    intentMode: intent.intentMode,
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
    purposeBlocks: intent.purposeBlocks,
    purposeCoverage: intent.purposeBlocks.map((purposeBlock) => ({
      purposeBlockId: purposeBlock.id,
      purposeKind: purposeBlock.kind,
      plannedQuestionCount: blocks.filter((block) =>
        purposeBlock.constructEntityIds.some((id) => block.sourceEntityIds.includes(id)),
      ).length,
    })),
    blocks: blocks.slice(0, requestedQuestionCount),
    requestedQuestionCount,
  };
}

export function compactSurveyPlanForPrompt(plan: SurveyPlan) {
  return {
    intentMode: plan.intentMode,
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
    purposeBlocks: plan.purposeBlocks,
    purposeCoverage: plan.purposeCoverage,
    requestedQuestionCount: plan.requestedQuestionCount,
    blocks: plan.blocks.map((block) => ({
      id: block.id,
      kind: block.kind,
      variable: block.variable,
      variableIds: block.variableIds,
      role: block.role,
      variableType: block.variableType,
      questionType: block.questionType,
      analysisType: block.analysisType,
      purpose: block.purpose,
      questionCount: block.questionCount,
      required: block.required,
      decisionGoalIds: block.decisionGoalIds,
      researchVariableId: block.researchVariableId,
      variableScope: block.variableScope,
      directlyAskable: block.directlyAskable,
      analysisUsage: block.analysisUsage,
      relationIds: block.relationIds,
      purposeBlockId: block.purposeBlockId,
      measuredEntityIds: block.measuredEntityIds,
    })),
  };
}
