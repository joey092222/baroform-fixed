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

export type ResearchVariable = {
  id: string;
  name: string;
  role: ResearchVariableRole;
  scope: VariableScope;
  measurementLevel: ResearchMeasurementLevel;
  directlyAskable: boolean;
  sourceExpression: string;
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
};

type RelationParts = {
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
    .replace(
      /(?:에\s*대해(?:서)?|을|를)?\s*(?:분석|조사|파악|확인|알아보)(?:(?:하|해)(?:고|서)?|하고)?\s*(?:싶(?:어|어요|습니다)|(?:해\s*)?(?:줘|주세요|봐|보세요)|하라)?\s*$/,
      "",
    )
    .replace(/\s*(?:설문\s*)?(?:조사|연구)\s*$/, "")
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

// 변수명에서 벗겨내야 할 껍데기들. 순서에 의존하지 않는다 (아래 fixpoint 참고).
const variableLabelStrips: RegExp[] = [
  // removePopulationPhrases는 "대학생들의"는 지우지만 이를 되받는 대명사는
  // 남긴다. 그대로 두면 변수명·제목·설명에 "그들의 지각 빈도"처럼 노출된다.
  /^(?:그리고|또한|그에\s*따른|그에\s*따라|그들의|이들의|그\s|이\s|해당|위\s*집단의)\s*/,
  // 부사형(에 대해)만 알고 관형사형(에 대한)을 모르면 "지각 비율에 대한 관계"에서
  // "관계"를 뗀 뒤 "에 대한"이 그대로 남는다.
  /(?:에\s*대해(?:서)?|에\s*관해(?:서)?|에\s*대한|에\s*관한|에\s*있어서|관련(?:한|된)?|을|를)\s*$/,
  /(?:의)?\s*(?:관계|상관관계|영향|차이)\s*$/,
  /^현재\s+(?=통학|공부|운동|근무|이용|사용)/,
];

function cleanVariableLabel(value: string) {
  // 한 번만 훑으면 뒤쪽 규칙이 앞쪽 규칙의 대상을 새로 노출시켜도 놓친다.
  // ("지각 비율에 대한 관계" → 관계 제거 → "에 대한"이 드러나지만 이미 지나감)
  // 더 이상 줄어들지 않을 때까지 반복해 규칙 순서에 대한 의존을 없앤다.
  // 모든 규칙이 문자열을 짧게만 만들므로 반드시 수렴한다. 상한은 안전핀이다.
  let cleaned = normalize(value);
  for (let pass = 0; pass < 8; pass += 1) {
    const previous = cleaned;
    for (const strip of variableLabelStrips) {
      cleaned = cleaned.replace(strip, "");
    }
    cleaned = cleaned.trim();
    if (cleaned === previous) break;
  }
  if (/^지역$/.test(cleaned)) return "거주 지역";
  if (/^거주지$/.test(cleaned)) return "거주 지역";
  return cleaned.replace(/배달앱/g, "배달 앱");
}

function hasBatchim(value: string) {
  const last = [...value.trim()].at(-1) ?? "";
  const code = last.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 !== 0 : false;
}

function withAndParticle(value: string) {
  return `${value}${hasBatchim(value) ? "과" : "와"}`;
}

function withObjectParticle(value: string) {
  return `${value}${hasBatchim(value) ? "을" : "를"}`;
}

function relationParts(value: string): RelationParts | null {
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
      pattern: /^(.+?)(?:과|와)\s*(.+?)(?:의\s*관계|\s*간\s*(?:관계|상관관계)|\s*상관관계)$/,
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

function makeVariable(
  name: string,
  role: ResearchVariableRole,
  sourceExpression: string,
  options: Partial<Pick<ResearchVariable, "scope" | "measurementLevel" | "directlyAskable">> = {},
): ResearchVariable {
  const cleaned = cleanVariableLabel(name);
  return {
    id: stableId("variable", cleaned),
    name: cleaned,
    role,
    scope: options.scope ?? "respondent_level",
    measurementLevel: options.measurementLevel ?? measurementLevelFor(cleaned),
    directlyAskable: options.directlyAskable ?? true,
    sourceExpression,
  };
}

function uniqueVariables(variables: ResearchVariable[]) {
  return variables.filter(
    (item, index, items) =>
      items.findIndex((other) => compact(other.name) === compact(item.name)) === index,
  );
}

function outcomeVariables(label: string, sourceExpression: string) {
  const metricType = derivedMetricType(label);
  if (!metricType) {
    return {
      respondentVariables: [makeVariable(label, "outcome", sourceExpression)],
      metric: null,
    };
  }
  const directName = directVariableName(label);
  const primary = makeVariable(directName, "outcome", sourceExpression);
  const respondentVariables = [primary];
  if (/자취\s*비율/.test(label)) {
    respondentVariables.push(
      makeVariable("자취 여부", "outcome", sourceExpression, {
        measurementLevel: "binary",
        directlyAskable: false,
      }),
    );
  }
  const metricVariable = makeVariable(label, "derived_metric", sourceExpression, {
    scope: "aggregate_derived",
    measurementLevel: metricType === "mean" ? "numeric" : "numeric",
    directlyAskable: false,
  });
  return {
    respondentVariables,
    metric: { metricType, metricVariable },
  };
}

export function parseSurveyResearchIntent(
  rawInput: string,
  options: {
    targetPopulation?: string | null;
    explicitTimeframe?: string | null;
  } = {},
): SurveyResearchIntent {
  const withoutPopulation = removePopulationPhrases(
    removeRequestWrapper(rawInput),
    options.targetPopulation ?? null,
  );
  const parts = relationParts(withoutPopulation);
  if (!parts) {
    return {
      targetPopulation: options.targetPopulation ?? null,
      variables: [],
      relations: [],
      derivedMetrics: [],
      analysisGoals: [],
      explicitTimeframe: options.explicitTimeframe ?? null,
      needsClarification: false,
      ambiguityLevel: "medium",
      relationExpression: null,
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
  const primaryOutcome = outcome.respondentVariables[0];
  const metricVariable = outcome.metric?.metricVariable ?? null;
  const variables = uniqueVariables([
    ...respondentVariables,
    ...(metricVariable ? [metricVariable] : []),
  ]);
  const relation: ResearchRelation = {
    id: stableId("relation", parts.expression),
    type: parts.type,
    fromVariableId: predictor.id,
    toVariableId: primaryOutcome.id,
    sourceExpression: parts.expression,
  };
  const derivedMetrics: DerivedMetric[] = outcome.metric && metricVariable
    ? [
        {
          id: stableId("metric", metricVariable.name),
          name: metricVariable.name,
          metricType: outcome.metric.metricType,
          sourceVariableIds: outcome.respondentVariables.map((item) => item.id),
          groupingVariableIds: [predictor.id],
        },
      ]
    : [];
  const analysisDescription = derivedMetrics[0]
    ? `${predictor.name} 구간별 ${derivedMetrics[0].name} 비교`
    : `${withAndParticle(predictor.name)} ${primaryOutcome.name}의 관계 분석`;
  const goals: ResearchAnalysisGoal[] = [
    {
      id: stableId("goal", analysisDescription),
      type: parts.type,
      description: analysisDescription,
      variableIds: [predictor.id, primaryOutcome.id],
    },
    {
      id: stableId("goal", `${predictor.name}-${primaryOutcome.name}-cross-tab`),
      type: "cross_tabulation",
      description: `${withAndParticle(predictor.name)} ${primaryOutcome.name} 교차 분석`,
      variableIds: [predictor.id, primaryOutcome.id],
    },
  ];

  return {
    targetPopulation: options.targetPopulation ?? null,
    variables,
    relations: [relation],
    derivedMetrics,
    analysisGoals: goals,
    explicitTimeframe: options.explicitTimeframe ?? null,
    needsClarification: false,
    ambiguityLevel: "low",
    relationExpression: parts.expression,
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
  // 바로 옆 withAndParticle은 받침을 판정하는데 "를"만 하드코딩되어 있었다.
  // 받침으로 끝나는 변수명이면 "성적를 파악하고"처럼 틀린 조사가 나간다.
  const goal =
    intent.analysisGoals[0]?.description ??
    `${withAndParticle(left.name)} ${right.name}의 관계 분석`;
  return `${target}의 ${withAndParticle(left.name)} ${withObjectParticle(right.name)} 파악하고, ${goal}에 활용하기 위한 설문입니다.`;
}
