export type ResearchVariableRole =
  | "predictor"
  | "outcome"
  | "grouping"
  | "control"
  | "descriptive"
  | "derived_metric";

export type VariableScope = "respondent_level" | "aggregate_derived";

export type ResearchMeasurementLevel =
  | "binary"
  | "nominal"
  | "ordinal"
  | "numeric"
  | "scale"
  | "text";

export type ConstructMeasurementMode =
  | "single_item"
  | "multi_item_scale"
  | "behavior_index"
  | "category_profile";

export type ResearchConstructKind =
  | "single_construct"
  | "consumption_behavior"
  | "monetary_resource"
  | "category_set"
  | "multidimensional_construct";

export type ResearchVariableDimension = {
  id: string;
  name: string;
  measurementLevel: ResearchMeasurementLevel;
  required: boolean;
  sourceExpression: string;
};

export type ResearchVariable = {
  id: string;
  name: string;
  role: ResearchVariableRole;
  scope: VariableScope;
  measurementLevel: ResearchMeasurementLevel;
  directlyAskable: boolean;
  sourceExpression: string;
  constructKind: ResearchConstructKind;
  measurementMode: ConstructMeasurementMode;
  dimensions: ResearchVariableDimension[];
};

export type ResearchRelationType =
  | "association"
  | "group_comparison"
  | "effect_hypothesis"
  | "descriptive_breakdown";

export type ResearchRelation = {
  id: string;
  type: ResearchRelationType;
  fromVariableId: string;
  toVariableId: string;
  sourceExpression: string;
};

export type DerivedMetricType =
  | "proportion"
  | "mean"
  | "distribution"
  | "rate"
  | "difference";

export type DerivedMetric = {
  id: string;
  name: string;
  metricType: DerivedMetricType;
  sourceVariableIds: string[];
  groupingVariableIds: string[];
};

export type ResearchAnalysisGoal = {
  id: string;
  type: ResearchRelationType | "cross_tabulation";
  description: string;
  variableIds: string[];
};

export type SurveyResearchIntent = {
  targetPopulation: string | null;
  variables: ResearchVariable[];
  relations: ResearchRelation[];
  derivedMetrics: DerivedMetric[];
  analysisGoals: ResearchAnalysisGoal[];
  explicitTimeframe: string | null;
  needsClarification: boolean;
  ambiguityLevel: "low" | "medium" | "high";
  relationExpression: string | null;
  relationCueDetected: boolean;
  parseFailureCode: "RELATION_EXPRESSION_DETECTED_BUT_NOT_PARSED" | null;
};

export type RelationParts = {
  left: string;
  right: string;
  type: ResearchRelationType;
  expression: string;
};

const normalize = (value: string) =>
  value
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?。]+$/g, "")
    .trim();

const compact = (value: string) =>
  normalize(value).replace(/\s+/g, "").toLocaleLowerCase("ko-KR");

function stableId(prefix: string, value: string) {
  let hash = 2166136261;
  for (const character of `${prefix}:${compact(value)}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function removeRequestWrapper(value: string) {
  return normalize(value)
    .replace(/\s*(?:설문\s*)?(?:조사|연구)(?:\s*설문)?\s*$/, "")
    .replace(
      /(?:에\s*대해(?:서)?|을|를)?\s*(?:분석|조사|파악|확인|알아보)(?:(?:하|해)(?:고|서|는)?|하고)?\s*(?:싶(?:어|어요|습니다)|(?:해\s*)?(?:줘|주세요|봐|보세요)|하라)?\s*$/,
      "",
    )
    .trim();
}

function removePopulationPhrases(value: string, targetPopulation: string | null) {
  let result = value;
  const phrases = [
    targetPopulation,
    "학생",
    "대학생",
    "재학생",
    "직장인",
    "응답자",
    "일반인",
  ].filter((item): item is string => Boolean(item));
  for (const phrase of phrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(`(?:${escaped})(?:들)?(?:의|이|가|은|는|을|를)?\\s*`, "g"),
      "",
    );
  }
  return result.replace(/\s+/g, " ").trim();
}

function cleanVariableLabel(value: string) {
  const cleaned = normalize(value)
    .replace(/^(?:그리고|또한|그에\s*따른|그에\s*따라)\s*/, "")
    .replace(/(?:에\s*대해(?:서)?|에\s*관해(?:서)?|을|를)\s*$/, "")
    .replace(/(?:의)?\s*(?:관계|상관관계|영향|차이)\s*$/, "")
    .replace(/^현재\s+(?=통학|공부|운동|근무|이용|사용)/, "")
    .trim();
  if (/^지역$/.test(cleaned)) return "거주 지역";
  if (/^거주지$/.test(cleaned)) return "거주 지역";
  return cleaned.replace(/배달앱/g, "배달 앱");
}

function withAndParticle(value: string) {
  const last = [...value.trim()].at(-1) ?? "";
  const code = last.charCodeAt(0);
  const hasBatchim =
    code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
  return `${value}${hasBatchim ? "과" : "와"}`;
}

const relationshipNoun = "(?:관계|상관관계|연관성)";
const relationshipBridge = `(?:의\\s*${relationshipNoun}|\\s*(?:간(?:의)?|사이의)\\s*${relationshipNoun}|\\s*${relationshipNoun})`;
const relationCuePattern = new RegExp(
  `(?:과|와).+(?:${relationshipBridge}|(?:에\\s*따른|에\\s*따라|일수록|에\\s*미치는\\s*영향|(?:간\\s*)?차이))`,
);

export function hasResearchRelationCue(value: string) {
  return relationCuePattern.test(removeRequestWrapper(value));
}

export function parseResearchRelationParts(value: string): RelationParts | null {
  const source = removeRequestWrapper(value);
  const patterns: Array<{
    pattern: RegExp;
    type: ResearchRelationType;
  }> = [
    {
      pattern: /^(.+?)(?:과|와)\s*그에\s*따른\s*(.+)$/,
      type: "group_comparison",
    },
    {
      pattern: /^(.+?)에\s*따른\s*(.+)$/,
      type: "group_comparison",
    },
    {
      pattern: /^(.+?)별\s+(.+)$/,
      type: "descriptive_breakdown",
    },
    {
      pattern: new RegExp(
        `^(.+?)(?:과|와)\\s*(.+?)${relationshipBridge}$`,
      ),
      type: "association",
    },
    {
      pattern: /^(.+?)(?:이|가)\s+(.+?)에\s*미치는\s*영향$/,
      type: "effect_hypothesis",
    },
    {
      pattern: /^(.+?)에\s*따라\s*달라지는\s*(.+)$/,
      type: "group_comparison",
    },
    {
      pattern: /^(.+?)일수록\s+(.+)$/,
      type: "association",
    },
    {
      pattern: /^(.+?)(?:을|를)\s*기준으로\s*한\s+(.+)$/,
      type: "descriptive_breakdown",
    },
    {
      pattern: /^(.+?)(?:과|와)\s*(.+?)\s*(?:간\s*)?차이$/,
      type: "group_comparison",
    },
  ];
  for (const item of patterns) {
    const match = source.match(item.pattern);
    if (!match) continue;
    const left = cleanVariableLabel(match[1]);
    const right = cleanVariableLabel(match[2]);
    if (left.length < 2 || right.length < 2) continue;
    return { left, right, type: item.type, expression: match[0] };
  }
  return null;
}

function measurementLevelFor(name: string): ResearchMeasurementLevel {
  if (/여부|유무|했는지|중인지/.test(name)) return "binary";
  if (/만족도|수면의\s*질|스트레스|의향|정도|수준|부담|영향/.test(name)) {
    return "scale";
  }
  if (/시간|거리|금액|지출|소득|횟수|점수/.test(name)) return "numeric";
  if (/빈도|구간|학년|연령대|성적/.test(name)) return "ordinal";
  if (/형태|지역|수단|유형|종류|경로/.test(name)) return "nominal";
  return "ordinal";
}

function directVariableName(metricName: string) {
  const cleaned = cleanVariableLabel(metricName);
  if (/자취\s*비율/.test(cleaned)) return "현재 거주 형태";
  if (/사용률/.test(cleaned)) return cleaned.replace(/사용률/, "사용 여부");
  if (/이용률/.test(cleaned)) return cleaned.replace(/이용률/, "이용 여부");
  if (/참여율|참여\s*비율/.test(cleaned)) {
    return cleaned.replace(/참여율|참여\s*비율/, "참여 여부");
  }
  if (/전환율/.test(cleaned)) return cleaned.replace(/전환율/, "구매 또는 전환 여부");
  if (/이탈률/.test(cleaned)) return cleaned.replace(/이탈률/, "중도 이탈 여부");
  if (/비율/.test(cleaned)) return cleaned.replace(/\s*비율/, " 여부").trim();
  if (/평균/.test(cleaned)) return cleaned.replace(/평균\s*/, "").trim();
  if (/분포/.test(cleaned)) return cleaned.replace(/\s*분포/, "").trim();
  return cleaned;
}

function derivedMetricType(name: string): DerivedMetricType | null {
  if (/평균/.test(name)) return "mean";
  if (/분포/.test(name)) return "distribution";
  if (/사용률|이용률|참여율|전환율|이탈률/.test(name)) return "rate";
  if (/비율|점유율/.test(name)) return "proportion";
  return null;
}

function dimension(
  variableName: string,
  name: string,
  measurementLevel: ResearchMeasurementLevel,
  required: boolean,
  sourceExpression: string,
): ResearchVariableDimension {
  return {
    id: stableId("dimension", `${variableName}:${name}`),
    name,
    measurementLevel,
    required,
    sourceExpression,
  };
}

function constructOperationalization(
  name: string,
  sourceExpression: string,
): Pick<ResearchVariable, "constructKind" | "measurementMode" | "dimensions"> {
  const normalizedName = cleanVariableLabel(name);
  if (
    /(?:소비|구매|지출)(?:\s*(?:습관|행동|행태|패턴))/.test(normalizedName) ||
    /(?:습관|행동|행태|패턴).*(?:소비|구매|지출)/.test(normalizedName)
  ) {
    return {
      constructKind: "consumption_behavior",
      measurementMode: "behavior_index",
      dimensions: [
        dimension(normalizedName, "소비 계획 빈도", "ordinal", true, sourceExpression),
        dimension(normalizedName, "충동 구매 빈도", "ordinal", true, sourceExpression),
        dimension(normalizedName, "가격 비교 빈도", "ordinal", false, sourceExpression),
        dimension(normalizedName, "저축 또는 예산 압박", "ordinal", true, sourceExpression),
        dimension(normalizedName, "주요 지출 항목", "nominal", false, sourceExpression),
        dimension(normalizedName, "월말 생활비 부족 경험", "ordinal", false, sourceExpression),
      ],
    };
  }
  if (/^(?:용돈|생활비|개인\s*가용\s*금액)$/.test(normalizedName)) {
    return {
      constructKind: "monetary_resource",
      measurementMode: "behavior_index",
      dimensions: [
        dimension(normalizedName, "월평균 용돈 금액", "numeric", true, sourceExpression),
        dimension(normalizedName, "용돈 지급 규칙", "nominal", true, sourceExpression),
        dimension(normalizedName, "추가 수입 포함 여부", "binary", false, sourceExpression),
      ],
    };
  }
  if (/음식|메뉴|음료|제품군|품목|종류|범주/.test(normalizedName)) {
    return {
      constructKind: "category_set",
      measurementMode: "category_profile",
      dimensions: [
        dimension(normalizedName, `${normalizedName} 범주`, "nominal", true, sourceExpression),
        dimension(normalizedName, `${normalizedName} 선택 빈도`, "ordinal", true, sourceExpression),
      ],
    };
  }
  return {
    constructKind: "single_construct",
    measurementMode: "single_item",
    dimensions: [],
  };
}

function makeVariable(
  name: string,
  role: ResearchVariableRole,
  sourceExpression: string,
  options: Partial<Pick<ResearchVariable, "scope" | "measurementLevel" | "directlyAskable">> = {},
): ResearchVariable {
  const cleaned = cleanVariableLabel(name);
  const operationalization = constructOperationalization(cleaned, sourceExpression);
  return {
    id: stableId("variable", cleaned),
    name: cleaned,
    role,
    scope: options.scope ?? "respondent_level",
    measurementLevel: options.measurementLevel ?? measurementLevelFor(cleaned),
    directlyAskable: options.directlyAskable ?? true,
    sourceExpression,
    ...operationalization,
  };
}

function uniqueVariables(variables: ResearchVariable[]) {
  return variables.filter(
    (item, index, items) =>
      items.findIndex((other) => compact(other.name) === compact(item.name)) === index,
  );
}

function coordinatedOutcomeLabels(label: string) {
  const labels = label
    .split(/\s*(?:와|과|및)\s*/u)
    .map(cleanVariableLabel)
    .filter((item) => item.length >= 2);
  return labels.length >= 2 ? labels : [cleanVariableLabel(label)];
}

function outcomeVariables(label: string, sourceExpression: string) {
  const groups = coordinatedOutcomeLabels(label).map((outcomeLabel) => {
    const metricType = derivedMetricType(outcomeLabel);
    if (!metricType) {
      return {
        respondentVariables: [
          makeVariable(outcomeLabel, "outcome", sourceExpression),
        ],
        metric: null,
      };
    }
    const directName = directVariableName(outcomeLabel);
    const primary = makeVariable(directName, "outcome", sourceExpression);
    const respondentVariables = [primary];
    if (/자취\s*비율/.test(outcomeLabel)) {
      respondentVariables.push(
        makeVariable("자취 여부", "outcome", sourceExpression, {
          measurementLevel: "binary",
          directlyAskable: false,
        }),
      );
    }
    const metricVariable = makeVariable(
      outcomeLabel,
      "derived_metric",
      sourceExpression,
      {
        scope: "aggregate_derived",
        measurementLevel: "numeric",
        directlyAskable: false,
      },
    );
    return {
      respondentVariables,
      metric: {
        metricType,
        metricVariable,
        sourceVariableIds: respondentVariables.map((item) => item.id),
        primaryVariableId: primary.id,
      },
    };
  });
  return {
    respondentVariables: uniqueVariables(
      groups.flatMap((group) => group.respondentVariables),
    ),
    relationVariables: groups.map((group) => group.respondentVariables[0]),
    metrics: groups
      .map((group) => group.metric)
      .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric)),
  };
}

export type SurveyResearchIntentParseOptions = {
  targetPopulation?: string | null;
  explicitTimeframe?: string | null;
  relationParser?: (value: string) => RelationParts | null;
};

export function parseSurveyResearchIntentCore(
  rawInput: string,
  options: SurveyResearchIntentParseOptions = {},
): SurveyResearchIntent {
  const withoutPopulation = removePopulationPhrases(
    removeRequestWrapper(rawInput),
    options.targetPopulation ?? null,
  );
  const relationCueDetected = hasResearchRelationCue(withoutPopulation);
  const parts = (options.relationParser ?? parseResearchRelationParts)(withoutPopulation);
  if (!parts) {
    return {
      targetPopulation: options.targetPopulation ?? null,
      variables: [],
      relations: [],
      derivedMetrics: [],
      analysisGoals: [],
      explicitTimeframe: options.explicitTimeframe ?? null,
      needsClarification: relationCueDetected,
      ambiguityLevel: relationCueDetected ? "high" : "medium",
      relationExpression: null,
      relationCueDetected,
      parseFailureCode: relationCueDetected
        ? "RELATION_EXPRESSION_DETECTED_BUT_NOT_PARSED"
        : null,
    };
  }

  const predictorRole: ResearchVariableRole =
    parts.type === "descriptive_breakdown" || parts.type === "group_comparison"
      ? "grouping"
      : "predictor";
  const predictor = makeVariable(parts.left, predictorRole, parts.expression);
  const outcome = outcomeVariables(parts.right, parts.expression);
  const respondentVariables = uniqueVariables([
    predictor,
    ...outcome.respondentVariables,
  ]);
  const outcomeRelationVariables = outcome.relationVariables;
  const metricVariables = outcome.metrics.map((item) => item.metricVariable);
  const variables = uniqueVariables([
    ...respondentVariables,
    ...metricVariables,
  ]);
  const relations: ResearchRelation[] = outcomeRelationVariables.map(
    (outcomeVariable) => ({
      id: stableId("relation", `${parts.expression}:${outcomeVariable.name}`),
      type: parts.type,
      fromVariableId: predictor.id,
      toVariableId: outcomeVariable.id,
      sourceExpression: parts.expression,
    }),
  );
  const derivedMetrics: DerivedMetric[] = outcome.metrics.map((metric) => ({
    id: stableId("metric", metric.metricVariable.name),
    name: metric.metricVariable.name,
    metricType: metric.metricType,
    sourceVariableIds: metric.sourceVariableIds,
    groupingVariableIds: [predictor.id],
  }));
  const goals: ResearchAnalysisGoal[] = outcomeRelationVariables.flatMap(
    (outcomeVariable) => {
      const metricDefinition = outcome.metrics.find(
        (item) => item.primaryVariableId === outcomeVariable.id,
      );
      const analysisDescription = metricDefinition
        ? `${predictor.name} 구간별 ${metricDefinition.metricVariable.name} 비교`
        : `${withAndParticle(predictor.name)} ${outcomeVariable.name}의 관계 분석`;
      return [
        {
          id: stableId("goal", analysisDescription),
          type: parts.type,
          description: analysisDescription,
          variableIds: [predictor.id, outcomeVariable.id],
        },
        {
          id: stableId(
            "goal",
            `${predictor.name}-${outcomeVariable.name}-cross-tab`,
          ),
          type: "cross_tabulation" as const,
          description: `${withAndParticle(predictor.name)} ${outcomeVariable.name} 교차 분석`,
          variableIds: [predictor.id, outcomeVariable.id],
        },
      ];
    },
  );

  return {
    targetPopulation: options.targetPopulation ?? null,
    variables,
    relations,
    derivedMetrics,
    analysisGoals: goals,
    explicitTimeframe: options.explicitTimeframe ?? null,
    needsClarification: false,
    ambiguityLevel: "low",
    relationExpression: parts.expression,
    relationCueDetected: true,
    parseFailureCode: null,
  };
}

export function hasRelationalResearchIntent(intent: SurveyResearchIntent) {
  return (
    intent.relations.length > 0 &&
    intent.variables.filter((item) => item.scope === "respondent_level").length >= 2
  );
}

export function compactResearchIntentForPrompt(intent: SurveyResearchIntent) {
  return {
    targetPopulation: intent.targetPopulation,
    variables: intent.variables,
    relations: intent.relations,
    derivedMetrics: intent.derivedMetrics,
    analysisGoals: intent.analysisGoals,
    explicitTimeframe: intent.explicitTimeframe,
    needsClarification: intent.needsClarification,
    ambiguityLevel: intent.ambiguityLevel,
  };
}

export function researchIntentTitle(intent: SurveyResearchIntent) {
  const respondentVariables = intent.variables.filter(
    (item) => item.scope === "respondent_level" && item.directlyAskable,
  );
  const left = respondentVariables.find((item) =>
    ["predictor", "grouping"].includes(item.role),
  );
  const right = respondentVariables.find((item) => item.role === "outcome");
  if (!left || !right) return null;
  const target = intent.targetPopulation ? `${intent.targetPopulation}의 ` : "";
  return `${target}${withAndParticle(left.name)} ${right.name} 조사`;
}

export function researchIntentDescription(intent: SurveyResearchIntent) {
  const respondentVariables = intent.variables.filter(
    (item) => item.scope === "respondent_level" && item.directlyAskable,
  );
  const left = respondentVariables.find((item) =>
    ["predictor", "grouping"].includes(item.role),
  );
  const right = respondentVariables.find((item) => item.role === "outcome");
  if (!left || !right) return null;
  const target = intent.targetPopulation ?? "응답자";
  const goal = intent.analysisGoals[0]?.description ?? `${left.name}과 ${right.name}의 관계 분석`;
  return `${target}의 ${withAndParticle(left.name)} ${right.name}를 파악하고, ${goal}에 활용하기 위한 설문입니다.`;
}
