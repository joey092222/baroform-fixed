import {
  normalizeSurveyRequest,
  parseSurveyGenerationContextCore,
  type ParsedSurveyContext,
  type SurveyArchetype,
  type SurveyContextEntityType,
} from "./survey-context-core";
import {
  parseSurveyIntentFromCanonicalSource,
  type IntentEntity,
  type SemanticRole,
  type SurveyActivityKind,
  type SurveyIntent,
  type SurveyIntentObjectKind,
  type SurveyIntentStudyType,
} from "./survey-semantic-intent-core";
import type {
  ConstructMeasurementMode,
  ResearchConstructKind,
  ResearchVariableDimension,
  SurveyResearchIntent,
} from "./survey-research-intent-core";

export type CanonicalEntityKind =
  | SurveyContextEntityType
  | "category_set"
  | "consumption_behavior"
  | "academic_organization"
  | "multidimensional_construct"
  | "relationship_analysis";

export type CanonicalEntityCandidate = {
  text: string;
  kind: CanonicalEntityKind;
  confidence: number;
  evidence: string[];
};

export type CanonicalEntity = {
  id: string;
  text: string;
  kind: CanonicalEntityKind;
  role:
    | "audience"
    | "primary_entity"
    | "category_set"
    | "academic_organization"
    | "construct"
    | "context";
  confidence: number;
  evidence: string[];
  candidates: CanonicalEntityCandidate[];
};

export type CanonicalActivity = {
  id: string;
  text: string;
  kind: SurveyActivityKind;
  objectEntityIds: string[];
  evidence: string[];
};

export type CanonicalConstruct = {
  id: string;
  name: string;
  kind: ResearchConstructKind;
  measurementMode: ConstructMeasurementMode;
  dimensions: ResearchVariableDimension[];
  evidence: string[];
};

export type CanonicalPurpose = {
  id: string;
  text: string;
  kind: SurveyIntent["purposeBlocks"][number]["kind"];
  targetEntityIds: string[];
  constructIds: string[];
};

export type CanonicalAmbiguity = {
  level: "low" | "medium" | "high";
  requiresClarification: boolean;
  code:
    | "RELATION_EXPRESSION_DETECTED_BUT_NOT_PARSED"
    | "ENTITY_RESOLUTION_AMBIGUOUS"
    | null;
  candidates: CanonicalEntityCandidate[];
};

export type CanonicalOperationalizationItem = {
  constructId: string;
  constructName: string;
  measurementMode: ConstructMeasurementMode;
  requiredDimensions: string[];
  optionalDimensions: string[];
};

export type CanonicalSurveyIntent = {
  rawInput: string;
  normalizedInput: string;
  audience: CanonicalEntity | null;
  entities: CanonicalEntity[];
  activities: CanonicalActivity[];
  constructs: CanonicalConstruct[];
  purposes: CanonicalPurpose[];
  relations: SurveyResearchIntent["relations"];
  unitOfAnalysis: string;
  surveyArchetype: SurveyArchetype;
  objectKind: SurveyIntentObjectKind;
  ambiguity: CanonicalAmbiguity;
  operationalizationPlan: CanonicalOperationalizationItem[];
  generationContext: ParsedSurveyContext;
  researchIntent: SurveyResearchIntent;
  surveyIntent: SurveyIntent;
};

const normalize = (value: string) =>
  value.replace(/[“”"'`]/g, "").replace(/\s+/g, " ").trim();

function stableId(prefix: string, value: string) {
  let hash = 2166136261;
  for (const character of `${prefix}:${normalize(value).toLocaleLowerCase("ko-KR")}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function canonicalEntity(
  text: string,
  kind: CanonicalEntityKind,
  role: CanonicalEntity["role"],
  evidence: string[],
  candidates: CanonicalEntityCandidate[] = [],
): CanonicalEntity {
  return {
    id: stableId(role, text),
    text: normalize(text),
    kind,
    role,
    confidence: candidates.length > 1 ? Math.max(...candidates.map((item) => item.confidence)) : 0.96,
    evidence,
    candidates,
  };
}

function intentEntity(
  value: CanonicalEntity,
  role: SemanticRole,
  activityKind?: SurveyActivityKind,
): IntentEntity {
  return {
    id: value.id,
    text: value.text,
    normalizedText: value.text,
    role,
    source: "explicit",
    confidence: value.confidence,
    ...(activityKind ? { activityKind } : {}),
  };
}

function stripCanonicalRequestMeta(value: string) {
  return normalize(value)
    .replace(
      /\s*(?:에\s*대해(?:서)?|에\s*관해(?:서)?|와\s*관련해|과\s*관련해|관련해?)\s*$/u,
      "",
    )
    .trim();
}

function replaceCanonicalLabel(value: string, previous: string, next: string) {
  if (!previous || previous === next) return value;
  return value.includes(previous) ? value.replace(previous, next) : value;
}

function reconcileCanonicalLabels(
  intent: SurveyIntent,
  context: ParsedSurveyContext,
): { intent: SurveyIntent; context: ParsedSurveyContext } {
  const previous = intent.surveyObject?.trim() ?? "";
  const next = stripCanonicalRequestMeta(previous);
  if (!previous || !next || previous === next) return { intent, context };

  const mapText = (value: string) => replaceCanonicalLabel(value, previous, next);
  const nextContext: ParsedSurveyContext = {
    ...context,
    primaryEntity: next,
    researchGoal: mapText(
      replaceCanonicalLabel(context.researchGoal, context.primaryEntity, next),
    ),
    researchConstructs: context.researchConstructs.map(mapText),
  };
  const mapEntity = (entity: IntentEntity): IntentEntity => ({
    ...entity,
    text: mapText(entity.text),
    normalizedText: mapText(entity.normalizedText),
  });

  const nextIntent: SurveyIntent = {
    ...intent,
    semanticContext: nextContext,
    surveyObject: next,
    legacyEvaluationTarget: intent.legacyEvaluationTarget
      ? mapText(intent.legacyEvaluationTarget)
      : intent.legacyEvaluationTarget,
    evaluationTargets: intent.evaluationTargets.map(mapText),
    unitOfAnalysis: mapText(intent.unitOfAnalysis),
    objects: intent.objects.map(mapEntity),
    constructEntities: intent.constructEntities.map(mapEntity),
    constructs: intent.constructs.map(mapText),
    entities: intent.entities.map(mapEntity),
    purposeBlocks: intent.purposeBlocks.map((purpose) => ({
      ...purpose,
      target: purpose.target ? mapText(purpose.target) : purpose.target,
      text: mapText(purpose.text),
    })),
  };
  return { intent: nextIntent, context: nextContext };
}

type ResolvedAcademicSatisfaction = {
  audience: string;
  primaryEntity: CanonicalEntity;
  entityType: SurveyContextEntityType;
  objectKind: SurveyIntentObjectKind;
  ambiguity: CanonicalAmbiguity;
};

function resolveAcademicSatisfaction(
  normalizedInput: string,
): ResolvedAcademicSatisfaction | null {
  const match = normalizedInput.match(
    /^(.+?)에\s*대한\s+(.+?(?:대생|학과생|전공생|학생|학부생|재학생))(?:들)?(?:의)?\s+(?:전반적\s*)?만족도(?:\s*조사)?$/,
  );
  if (!match) return null;
  const primaryText = normalize(match[1]);
  const audience = normalize(match[2]);
  const facilityCue = /(?:시설|건물|강의동|공간|캠퍼스|관)(?:\s|$)/.test(primaryText);
  const organizationCue = /(?:대학|학부|학과|전공|단과대|대)$/.test(primaryText);
  const audienceOrganization = audience.match(/(?:^|\s)([가-힣A-Za-z0-9·-]+(?:대|학과|전공))생/)?.[1] ?? null;
  const candidates: CanonicalEntityCandidate[] = [];
  if (facilityCue) {
    candidates.push({
      text: primaryText,
      kind: /시설|공간/.test(primaryText) ? "facility" : "university_building",
      confidence: 0.99,
      evidence: ["시설·건물·공간 명시", match[0]],
    });
  } else if (organizationCue) {
    candidates.push({
      text: primaryText,
      kind: "academic_organization",
      confidence:
        audienceOrganization && primaryText.endsWith(audienceOrganization) ? 0.99 : 0.82,
      evidence: [
        "대학·학부·학과·전공 조직 표현",
        ...(audienceOrganization ? [`응답자 소속 표현: ${audienceOrganization}생`] : []),
      ],
    });
    if (!audienceOrganization && /대$/.test(primaryText)) {
      candidates.push({
        text: primaryText,
        kind: "place",
        confidence: 0.52,
        evidence: ["축약 대학명일 가능성"],
      });
    }
  }
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((left, right) => right.confidence - left.confidence);
  const ambiguous = sorted.length > 1 && sorted[0].confidence - sorted[1].confidence < 0.2;
  const winner = sorted[0];
  return {
    audience,
    primaryEntity: canonicalEntity(
      primaryText,
      winner.kind,
      winner.kind === "academic_organization" ? "academic_organization" : "primary_entity",
      winner.evidence,
      sorted,
    ),
    entityType:
      winner.kind === "academic_organization"
        ? "academic_organization"
        : winner.kind === "university_building"
          ? "university_building"
          : "facility",
    objectKind:
      winner.kind === "academic_organization"
        ? "academic_organization"
        : "place_facility",
    ambiguity: {
      level: ambiguous ? "high" : "low",
      requiresClarification: ambiguous,
      code: ambiguous ? "ENTITY_RESOLUTION_AMBIGUOUS" : null,
      candidates: sorted,
    },
  };
}

function resolveUsageAudienceSatisfaction(
  normalizedInput: string,
): ResolvedAcademicSatisfaction | null {
  const match = normalizedInput.match(
    /^(.{1,100}?)(?:을|를)\s*(이용|사용|방문|참여)하는\s+(.*?(?:학부생|대학원생|재학생|휴학생|대학생|학생|일반인|직장인|청년|교직원|교수|교사|이용자|사용자|소비자|고객|주민|학부모))(?:들)?(?:의)?\s+(?:전반적\s*)?만족도(?:\s*(?:와|과|및)\s*개선\s*(?:의견|요구|수요|점))?(?:\s*조사)?$/,
  );
  if (!match) return null;

  const primaryText = normalize(match[1]);
  const verb = match[2];
  const audience = normalize(match[3]);
  const entityType: SurveyContextEntityType =
    /웹툰|플랫폼|사이트|SNS|OTT/.test(primaryText)
      ? "platform"
      : /제품|기기|상품/.test(primaryText)
        ? "product"
        : verb === "방문" || /시설|공간|도서관|식당|카페|건물/.test(primaryText)
          ? "facility"
          : "service";
  const objectKind: SurveyIntentObjectKind =
    entityType === "facility" ? "place_facility" : "service_product";
  const evidence = [
    `이용 대상과 응답자를 분리하는 '${verb}하는' 관형절`,
    match[0],
  ];

  return {
    audience,
    primaryEntity: canonicalEntity(
      primaryText,
      entityType,
      "primary_entity",
      evidence,
    ),
    entityType,
    objectKind,
    ambiguity: {
      level: "low",
      requiresClarification: false,
      code: null,
      candidates: [],
    },
  };
}

type ResolvedConsumption = {
  audience: string | null;
  category: CanonicalEntity;
  activity: CanonicalActivity;
};

type ResolvedRelationalClause = {
  audience: string;
  audienceEvidence: string;
  primaryEntity: CanonicalEntity;
  entityType: SurveyContextEntityType;
  objectKind: SurveyIntentObjectKind;
  activity: string | null;
  activityKind: SurveyActivityKind | null;
  researchGoal: string;
  researchConstructs: string[];
  surveyArchetype: SurveyArchetype;
  isUsageObject: boolean;
  includesNonUsers: boolean;
  purposeKinds: SurveyIntent["purposeBlocks"][number]["kind"][];
};

const relationalAudienceHead =
  "(?:학부생|대학원생|재학생|휴학생|대학생|학생|일반인|직장인|청년|교직원|교수|교사|이용자|사용자|소비자|고객|주민|학부모|대생|학과생|전공생)";

function inferRelationalEntityType(
  value: string,
  usageVerb = "",
): SurveyContextEntityType {
  if (/웹툰|플랫폼|사이트|SNS|OTT/.test(value)) return "platform";
  if (/제품|기기|상품/.test(value)) return "product";
  if (/시설|공간|도서관|식당|카페|건물|강의동/.test(value)) return "facility";
  if (/관$/.test(value)) return "university_building";
  if (/수업|강의|학습|교육/.test(value) && !/서비스/.test(value)) return "learning";
  if (/서비스|앱|어플|프로그램|웹툰/.test(value) || usageVerb) return "service";
  return "unknown";
}

function splitRelationalConstructs(value: string) {
  const cleaned = normalize(value)
    .replace(/(?:에\s*대한|에\s*관한)\s*/g, "")
    .replace(/\s*(?:조사|파악)\s*$/g, "");
  const parts = cleaned
    .split(/(?:\s*[,·]\s*|\s+(?:및|그리고)\s+|(?<=[가-힣])(?:와|과)\s+)/)
    .map(normalize)
    .filter((item) => item.length > 0);
  return [...new Set(parts.length > 0 ? parts : [cleaned])];
}

function withAccusativeParticle(value: string) {
  const normalized = normalize(value);
  const lastCharacter = normalized.at(-1);
  if (!lastCharacter) return normalized;
  const codePoint = lastCharacter.charCodeAt(0);
  if (codePoint < 0xac00 || codePoint > 0xd7a3) {
    return `${normalized}을`;
  }
  const hasFinalConsonant = (codePoint - 0xac00) % 28 !== 0;
  return `${normalized}${hasFinalConsonant ? "을" : "를"}`;
}

function resolveRelationalClause(
  normalizedInput: string,
): ResolvedRelationalClause | null {
  const nonUse = normalizedInput.match(
    new RegExp(
      `^(.{1,100}?)(?:을|를)\\s*(이용|사용|방문|참여)하지\\s*않는\\s+(.*?${relationalAudienceHead})(?:들)?(?:이|가|의)?\\s+(?:이를\\s*)?(?:이용|사용|방문|참여)하지\\s*않는\\s+(이유|원인|장벽|요인)$`,
    ),
  );
  if (nonUse) {
    const object = normalize(nonUse[1]);
    const audienceGroup = normalize(nonUse[3]);
    const entityType = inferRelationalEntityType(object, nonUse[2]);
    const evidence = [nonUse[0], `${nonUse[2]}하지 않는`];
    const activityVerb = nonUse[2];
    return {
      audience: `${withAccusativeParticle(object)} ${activityVerb}하지 않는 ${audienceGroup}`,
      audienceEvidence: normalize(nonUse[0]),
      primaryEntity: canonicalEntity(object, entityType, "primary_entity", evidence),
      entityType,
      objectKind: "attitude_perception",
      activity: null,
      activityKind: null,
      researchGoal: `${object} 비이용 이유와 이용 장벽 파악`,
      researchConstructs: ["비이용 이유", "이용 장벽", "향후 이용 조건"],
      surveyArchetype: "attitude",
      isUsageObject: false,
      includesNonUsers: true,
      purposeKinds: ["attitude_perception", "need_demand"],
    };
  }

  const movement = normalizedInput.match(
    new RegExp(
      `^(.{1,100}?)(?:을|를)\\s*(오가는|왕래하는|이동하는|통학하는)\\s+(.*?${relationalAudienceHead})(?:들)?(?:이|가|의)?\\s+(?:느끼는|경험하는|평가하는)\\s+(.+)$`,
    ),
  );
  if (movement) {
    const object = normalize(movement[1]);
    const audience = normalize(movement[3]);
    const movementVerb = normalize(movement[2]);
    const movementObject = withAccusativeParticle(object);
    const statedConstructs = splitRelationalConstructs(movement[4]);
    const entityType = inferRelationalEntityType(object);
    return {
      audience: `${movementObject} ${movementVerb} ${audience}`,
      audienceEvidence: normalize(`${movementObject} ${movementVerb} ${movement[3]}`),
      primaryEntity: canonicalEntity(
        object,
        entityType === "unknown" ? "place" : entityType,
        "primary_entity",
        [movement[0], movement[2]],
      ),
      entityType: entityType === "unknown" ? "place" : entityType,
      objectKind: "behavior_usage",
      activity: `${movementObject} ${movementVerb.replace(/하는$/, "")} 이동`,
      activityKind: "move",
      researchGoal: `${object} 접근 및 이동 경험의 ${statedConstructs.join(", ")} 파악`,
      researchConstructs: statedConstructs,
      surveyArchetype: "mobility_experience",
      isUsageObject: false,
      includesNonUsers: false,
      purposeKinds: ["behavior_usage", "need_demand"],
    };
  }

  const actorPerspective = normalizedInput.match(
    new RegExp(
      `^(.*?${relationalAudienceHead})(?:들)?(?:이|가)\\s+(바라보는|평가하는|인식하는|생각하는)\\s+(.+?)(?:의)\\s+(.+)$`,
    ),
  );
  if (actorPerspective) {
    const audience = normalize(actorPerspective[1]);
    const object = normalize(actorPerspective[3]);
    const constructs = splitRelationalConstructs(actorPerspective[4]);
    const entityType = inferRelationalEntityType(object);
    const containsUsage = constructs.some((item) => /이용|사용|방문|경험/.test(item));
    return {
      audience,
      audienceEvidence: normalize(actorPerspective[1]),
      primaryEntity: canonicalEntity(
        object,
        entityType === "unknown" ? "construct" : entityType,
        "primary_entity",
        [actorPerspective[0], actorPerspective[2]],
      ),
      entityType: entityType === "unknown" ? "construct" : entityType,
      objectKind: containsUsage ? "composite" : "attitude_perception",
      activity: containsUsage ? `${object} 이용 경험` : null,
      activityKind: containsUsage ? "use" : null,
      researchGoal: `${object}에 대한 ${constructs.join(", ")} 파악`,
      researchConstructs: constructs,
      surveyArchetype: containsUsage ? "mixed" : "attitude",
      isUsageObject: false,
      includesNonUsers: true,
      purposeKinds: containsUsage
        ? ["attitude_perception", "usage_experience"]
        : ["attitude_perception"],
    };
  }

  const positiveUse = normalizedInput.match(
    new RegExp(
      `^(.{1,100}?)(?:을|를)\\s*(이용하는|사용하는|쓰는|방문하는|참여하는)\\s+(.*?${relationalAudienceHead})(?:들)?(?:의|이|가)\\s+(.+)$`,
    ),
  );
  if (positiveUse) {
    const object = normalize(positiveUse[1]);
    const audience = normalize(positiveUse[3]);
    const activityVerb = normalize(positiveUse[2]);
    const usageObject = withAccusativeParticle(object);
    const constructs = splitRelationalConstructs(positiveUse[4]);
    const entityType = inferRelationalEntityType(object, positiveUse[2]);
    const satisfaction = constructs.some((item) => /만족|평가/.test(item));
    return {
      audience: `${usageObject} ${activityVerb} ${audience}`,
      audienceEvidence: normalize(`${usageObject} ${activityVerb} ${positiveUse[3]}`),
      primaryEntity: canonicalEntity(object, entityType, "primary_entity", [
        positiveUse[0],
        positiveUse[2],
      ]),
      entityType,
      objectKind: satisfaction ? "satisfaction_evaluation" : "service_product",
      activity: `${object} 이용`,
      activityKind: "use",
      researchGoal: `${object}의 ${constructs.join(", ")} 파악`,
      researchConstructs: constructs,
      surveyArchetype: satisfaction
        ? "satisfaction"
        : entityType === "platform"
          ? "platform_usage"
          : entityType === "product"
            ? "product_usage"
            : entityType === "facility" || entityType === "university_building"
              ? "facility_usage"
              : "service_usage",
      isUsageObject: !satisfaction,
      includesNonUsers: false,
      purposeKinds: satisfaction ? ["satisfaction"] : ["usage_experience"],
    };
  }

  const audienceEvaluation = normalizedInput.match(
    new RegExp(
      `^(.*?${relationalAudienceHead})(?:들)?(?:의)\\s+(.+?)\\s+((?:전반적\\s*)?만족도(?:\\s*(?:와|과|및)\\s*개선\\s*(?:의견|요구|수요|점))?)$`,
    ),
  );
  if (audienceEvaluation) {
    const audience = normalize(audienceEvaluation[1]);
    const object = normalize(audienceEvaluation[2]);
    const domains = splitRelationalConstructs(object);
    const multidimensional = domains.length > 1;
    // 단일 만족도는 기존 canonical parser가 더 풍부한 도메인 정보를
    // 보존한다. 이 경로는 명시적으로 여러 평가 영역을 나열한 문장만
    // 관계형 다차원 조사로 승격한다.
    if (!multidimensional) return null;
    const entityType = inferRelationalEntityType(object);
    const constructs = multidimensional
      ? [...domains.map((item) => `${item} 만족도`), "개선 수요"]
      : ["전반적 만족도", "세부 경험 평가", "불편", "개선 수요"];
    return {
      audience,
      audienceEvidence: normalize(audienceEvaluation[1]),
      primaryEntity: canonicalEntity(
        object,
        multidimensional
          ? "multidimensional_construct"
          : entityType === "unknown"
            ? "construct"
            : entityType,
        "primary_entity",
        [audienceEvaluation[0], audienceEvaluation[3]],
      ),
      entityType: multidimensional
        ? "construct"
        : entityType === "unknown"
          ? "construct"
          : entityType,
      objectKind: multidimensional
        ? "multidimensional_construct"
        : "satisfaction_evaluation",
      activity: null,
      activityKind: null,
      researchGoal: `${object}의 영역별 만족도와 개선 요구 파악`,
      researchConstructs: constructs,
      surveyArchetype: multidimensional ? "multidimensional_construct" : "satisfaction",
      isUsageObject: false,
      includesNonUsers: false,
      purposeKinds: ["satisfaction", "need_demand"],
    };
  }

  return null;
}

function resolveConsumptionActivity(
  normalizedInput: string,
  fallbackAudience: string | null,
): ResolvedConsumption | null {
  if (/(?:만족도|평가|불만족|개선점)/.test(normalizedInput)) return null;
  const match =
    normalizedInput.match(
      /어떤\s+([가-힣A-Za-z0-9·\s]{1,24}?)(?:을|를)\s*(?:(?:주로|자주|얼마나\s*자주|보통)\s*)?(먹|섭취|마시|구매|주문)(?:는|은|한|하|했|할|고|는지|었는지|하는지)?(?:\s*빈도|\s*횟수|\s*행태|\s*패턴|\s*현황|\s*습관|\s*자주)?/,
    ) ??
    normalizedInput.match(
      /(?:^|\s)([가-힣A-Za-z0-9·\s]{1,24}?)(?:을|를)\s*(?:(?:주로|자주|얼마나\s*자주|보통)\s*)?(먹|섭취|마시|구매|주문)(?:는|은|한|하|했|할|고|는지|었는지|하는지)?(?:\s*빈도|\s*횟수|\s*행태|\s*패턴|\s*현황|\s*습관|\s*자주)?/,
    );
  if (!match) return null;
  const object = normalize(match[1])
    .replace(/^.*?(?:들이|이|가)\s+/, "")
    .replace(/^(?:어떤|주로)\s*/, "");
  if (object.length < 1) return null;
  const verb = match[2];
  const kind: SurveyActivityKind = /먹|섭취/.test(verb)
    ? "consume"
    : verb === "마시"
      ? "drink"
      : verb === "주문"
        ? "order"
        : "purchase";
  const category = canonicalEntity(
    object,
    "category_set",
    "category_set",
    [`범주 선택 표현: ${match[0]}`, `행동 서술어: ${verb}`],
  );
  return {
    audience: fallbackAudience,
    category,
    activity: {
      id: stableId("activity", `${verb}:${object}`),
      text: `${object} ${verb === "먹" ? "섭취" : verb}`,
      kind,
      objectEntityIds: [category.id],
      evidence: [match[0]],
    },
  };
}

function relationshipContext(
  rawInput: string,
  normalizedInput: string,
  audience: string | null,
  researchIntent: SurveyResearchIntent,
): ParsedSurveyContext {
  const respondentVariables = researchIntent.variables.filter(
    (item) => item.scope === "respondent_level",
  );
  const primaryEntity = respondentVariables.map((item) => item.name).join(" 및 ");
  const dimensions = respondentVariables.flatMap((variable) =>
    variable.dimensions.length > 0
      ? variable.dimensions.map((item) => item.name)
      : [variable.name],
  );
  return {
    rawUserInput: rawInput,
    normalizedInput,
    audience,
    primaryEntity,
    entityType: "construct",
    activity: null,
    researchGoal:
      researchIntent.analysisGoals[0]?.description ?? `${primaryEntity}의 관계 분석`,
    researchConstructs: dimensions,
    surveyArchetype: "relationship_analysis",
    isUsageObject: false,
  };
}

function researchConstructs(
  researchIntent: SurveyResearchIntent,
): CanonicalConstruct[] {
  return researchIntent.variables
    .filter((item) => item.scope === "respondent_level")
    .map((variable) => ({
      id: variable.id,
      name: variable.name,
      kind: variable.constructKind,
      measurementMode: variable.measurementMode,
      dimensions: variable.dimensions,
      evidence: [variable.sourceExpression],
    }));
}

function reconcileRelationshipIntent(
  base: SurveyIntent,
  context: ParsedSurveyContext,
): SurveyIntent {
  const variableEntities = base.researchIntent.variables
    .filter((item) => item.scope === "respondent_level")
    .map((variable) => ({
      ...intentEntity(
        canonicalEntity(
          variable.name,
          variable.constructKind === "consumption_behavior"
            ? "consumption_behavior"
            : variable.constructKind === "multidimensional_construct"
              ? "multidimensional_construct"
              : "construct",
          "construct",
          [variable.sourceExpression],
        ),
        variable.constructKind === "consumption_behavior" ? "behavior" : "construct",
      ),
      id: variable.id,
    }));
  const relationTarget = base.researchIntent.variables
    .filter((item) => item.scope === "respondent_level")
    .map((item) => item.name)
    .join(" 및 ");
  const purposeText =
    base.researchIntent.analysisGoals[0]?.description ?? `${relationTarget} 관계 분석`;
  const purpose = {
    id: stableId("study-purpose", relationTarget),
    text: purposeText,
    normalizedText: purposeText,
    role: "study_purpose" as const,
    source: "explicit" as const,
    confidence: 0.98,
  };
  const requiresClarification = Boolean(base.researchIntent.parseFailureCode);
  return {
    ...base,
    semanticContext: context,
    objectKind: "relationship_analysis",
    surveyObject: relationTarget || null,
    legacyEvaluationTarget: null,
    entities: variableEntities,
    objects: variableEntities,
    constructs: context.researchConstructs,
    constructEntities: variableEntities,
    evaluationTargets: base.researchIntent.variables
      .filter((item) => item.scope === "respondent_level")
      .map((item) => item.name),
    unitOfAnalysis: "개별 응답자",
    measurementMode: base.researchIntent.variables.some(
      (item) => item.measurementMode !== "single_item",
    )
      ? "composite"
      : "comparison",
    studyPurpose: purpose,
    studyPurposes: [purpose],
    purpose: purpose.text,
    purposeBlocks: [
      {
        id: "purpose-relationship-analysis",
        text: purpose.text,
        kind: "relationship_analysis",
        target: relationTarget,
        targetEntityIds: variableEntities.map((item) => item.id),
        constructEntityIds: variableEntities.map((item) => item.id),
        order: 1,
        relationToPrevious: null,
      },
    ],
    ambiguityLevel: requiresClarification ? "high" : "low",
    requiresCreatorClarification: requiresClarification,
    missingInformation: requiresClarification
      ? ["관계를 분석할 두 변수를 명확히 구분해주세요."]
      : [],
  };
}

function reconcileConsumptionIntent(
  base: SurveyIntent,
  resolved: ResolvedConsumption,
  rawInput: string,
  normalizedInput: string,
): { intent: SurveyIntent; context: ParsedSurveyContext } {
  const categoryEntity = intentEntity(resolved.category, "category_set");
  const activityEntity: IntentEntity = {
    id: resolved.activity.id,
    text: resolved.activity.text,
    normalizedText: resolved.activity.text,
    role: "behavior",
    source: "explicit",
    confidence: 0.98,
    activityKind: resolved.activity.kind,
  };
  const context: ParsedSurveyContext = {
    rawUserInput: rawInput,
    normalizedInput,
    audience: resolved.audience,
    primaryEntity: resolved.category.text,
    entityType: "category_set",
    activity: resolved.activity.text,
    researchGoal: `${resolved.category.text}의 실제 섭취·선택 범주와 빈도 파악`,
    researchConstructs: [
      `${resolved.category.text} 범주`,
      `${resolved.category.text} 섭취·선택 빈도`,
    ],
    surveyArchetype: "consumption_behavior",
    isUsageObject: false,
  };
  const target = base.targetPopulation ?? resolved.audience;
  const purpose = base.studyPurpose ?? {
    id: stableId("study-purpose", context.researchGoal),
    text: context.researchGoal,
    normalizedText: context.researchGoal,
    role: "study_purpose" as const,
    source: "explicit" as const,
    confidence: 0.98,
  };
  return {
    context,
    intent: {
      ...base,
      targetPopulation: target,
      semanticContext: context,
      objectKind: "consumption_behavior",
      surveyObject: resolved.category.text,
      legacyEvaluationTarget: resolved.category.text,
      entities: [categoryEntity, activityEntity],
      objects: [categoryEntity],
      activities: [activityEntity],
      constructs: context.researchConstructs,
      constructEntities: [categoryEntity, activityEntity],
      evaluationTargets: [resolved.category.text],
      unitOfAnalysis: "개별 응답자",
      measurementMode: "composite",
      studyPurpose: purpose,
      studyPurposes: [purpose],
      purpose: purpose.text,
      purposeBlocks: [
        {
          id: "purpose-consumption-profile",
          text: purpose.text,
          kind: "behavior_usage",
          target: resolved.category.text,
          targetEntityIds: [categoryEntity.id],
          constructEntityIds: [activityEntity.id],
          order: 1,
          relationToPrevious: null,
        },
      ],
      ambiguityLevel: "low",
      requiresCreatorClarification: false,
      missingInformation: [],
    },
  };
}

function reconcileAcademicIntent(
  base: SurveyIntent,
  resolved: ResolvedAcademicSatisfaction,
  rawInput: string,
  normalizedInput: string,
): { intent: SurveyIntent; context: ParsedSurveyContext } {
  const object = intentEntity(
    resolved.primaryEntity,
    resolved.primaryEntity.kind === "academic_organization"
      ? "real_world_object"
      : "concrete_object",
  );
  const audience = intentEntity(
    canonicalEntity(
      resolved.audience,
      "construct",
      "audience",
      ["만족도 요청의 응답자 소속 표현"],
    ),
    "target_population",
  );
  const context: ParsedSurveyContext = {
    rawUserInput: rawInput,
    normalizedInput,
    audience: resolved.audience,
    primaryEntity: resolved.primaryEntity.text,
    entityType: resolved.entityType,
    activity: null,
    researchGoal: `${resolved.primaryEntity.text} 만족도와 개선점 파악`,
    researchConstructs: ["전반적 만족도", "세부 경험 평가", "불편", "개선 수요"],
    surveyArchetype:
      resolved.primaryEntity.kind === "academic_organization"
        ? "academic_organization"
        : "satisfaction",
    isUsageObject: false,
  };
  const constructEntities = context.researchConstructs.map((text) => ({
    id: stableId("construct", text),
    text,
    normalizedText: text,
    role: "construct" as const,
    source: "inferred" as const,
    confidence: 0.9,
  }));
  return {
    context,
    intent: {
      ...base,
      semanticContext: context,
      targetPopulation: resolved.audience,
      targetPopulationEntities: [audience],
      objectKind: resolved.objectKind,
      surveyObject: resolved.primaryEntity.text,
      legacyEvaluationTarget: resolved.primaryEntity.text,
      entities: [audience, object, ...constructEntities],
      objects: [object],
      constructs: context.researchConstructs,
      constructEntities,
      evaluationTargets: [resolved.primaryEntity.text],
      unitOfAnalysis: resolved.primaryEntity.text,
      measurementMode: "single_evaluation",
      ambiguityLevel: resolved.ambiguity.level,
      requiresCreatorClarification: resolved.ambiguity.requiresClarification,
      missingInformation: resolved.ambiguity.requiresClarification
        ? ["조사 대상이 단과대학 조직인지 장소인지 알려주세요."]
        : [],
      purposeBlocks: [
        {
          id: "purpose-satisfaction",
          text: context.researchGoal,
          kind: "satisfaction",
          target: resolved.primaryEntity.text,
          targetEntityIds: [object.id],
          constructEntityIds: constructEntities.map((item) => item.id),
          order: 1,
          relationToPrevious: null,
        },
      ],
    },
  };
}

function reconcileRelationalClauseIntent(
  base: SurveyIntent,
  resolved: ResolvedRelationalClause,
  rawInput: string,
  normalizedInput: string,
): { intent: SurveyIntent; context: ParsedSurveyContext } {
  const audienceEntity = intentEntity(
    canonicalEntity(
      resolved.audience,
      "construct",
      "audience",
      [resolved.audienceEvidence],
    ),
    "target_population",
  );
  const objectEntity = intentEntity(
    resolved.primaryEntity,
    resolved.entityType === "service" ||
      resolved.entityType === "platform" ||
      resolved.entityType === "product"
      ? "product_or_service"
      : resolved.entityType === "construct"
        ? "construct"
        : "concrete_object",
  );
  const activityEntity =
    resolved.activity && resolved.activityKind
      ? {
          id: stableId("activity", resolved.activity),
          text: resolved.activity,
          normalizedText: resolved.activity,
          role: "behavior" as const,
          source: "explicit" as const,
          confidence: 0.96,
          activityKind: resolved.activityKind,
        }
      : null;
  const constructEntities = resolved.researchConstructs.map((text) => ({
    id: stableId("construct", text),
    text,
    normalizedText: text,
    role: "construct" as const,
    source: "explicit" as const,
    confidence: 0.94,
  }));
  const purposeBlocks = resolved.purposeKinds.map((kind, index) => ({
    id: `purpose-${kind}-${index + 1}`,
    text:
      index === 0
        ? resolved.researchGoal
        : `${resolved.primaryEntity.text}의 개선 조건과 후속 수요 파악`,
    kind,
    target: resolved.primaryEntity.text,
    targetEntityIds: [objectEntity.id],
    constructEntityIds: constructEntities.map((item) => item.id),
    order: index + 1,
    relationToPrevious: index === 0 ? null : ("independent" as const),
  }));
  const firstPurpose = {
    id: stableId("study-purpose", resolved.researchGoal),
    text: resolved.researchGoal,
    normalizedText: resolved.researchGoal,
    role: "study_purpose" as const,
    source: "explicit" as const,
    confidence: 0.96,
  };
  const context: ParsedSurveyContext = {
    rawUserInput: rawInput,
    normalizedInput,
    audience: resolved.audience,
    primaryEntity: resolved.primaryEntity.text,
    entityType: resolved.entityType,
    activity: resolved.activity,
    researchGoal: resolved.researchGoal,
    researchConstructs: resolved.researchConstructs,
    surveyArchetype: resolved.surveyArchetype,
    isUsageObject: resolved.isUsageObject,
  };

  return {
    context,
    intent: {
      ...base,
      targetPopulation: resolved.audience,
      targetPopulationEntities: [audienceEntity],
      studyPurpose: firstPurpose,
      studyPurposes: [firstPurpose],
      purpose: resolved.researchGoal,
      purposeBlocks,
      semanticContext: context,
      objectKind: resolved.objectKind,
      surveyObject: resolved.primaryEntity.text,
      legacyEvaluationTarget: resolved.primaryEntity.text,
      entities: [
        audienceEntity,
        objectEntity,
        ...(activityEntity ? [activityEntity] : []),
        ...constructEntities,
      ],
      objects: [objectEntity],
      activities: activityEntity ? [activityEntity] : [],
      constructs: [...resolved.researchConstructs],
      constructEntities,
      evaluationTargets: [resolved.primaryEntity.text],
      targetCardinality: "single",
      targetListSource: "explicit_in_prompt",
      unitOfAnalysis: "개별 응답자",
      measurementMode:
        resolved.objectKind === "multidimensional_construct" ||
        resolved.objectKind === "composite"
          ? "composite"
          : "single_evaluation",
      screeningRequired: false,
      screeningReason: null,
      eligibilityCondition: resolved.audience,
      includesNonUsers: resolved.includesNonUsers,
      ambiguityLevel: "low",
      requiresCreatorClarification: false,
      missingInformation: [],
      intentMode: purposeBlocks.length > 1 ? "composite" : "single",
    },
  };
}

export function parseCanonicalSurveyIntent(
  rawInput: string,
  studyType: SurveyIntentStudyType = "general",
): CanonicalSurveyIntent {
  const normalizedInput = normalizeSurveyRequest(rawInput);
  const initialContext = parseSurveyGenerationContextCore(rawInput);
  let surveyIntent = parseSurveyIntentFromCanonicalSource(rawInput, studyType, {
    semanticContext: initialContext,
  });
  let generationContext = initialContext;
  const satisfaction =
    resolveAcademicSatisfaction(normalizedInput) ??
    resolveUsageAudienceSatisfaction(normalizedInput);
  const relationalClause = resolveRelationalClause(normalizedInput);
  const consumption = resolveConsumptionActivity(
    normalizedInput,
    initialContext.audience ?? surveyIntent.targetPopulation,
  );

  if (relationalClause) {
    const reconciled = reconcileRelationalClauseIntent(
      surveyIntent,
      relationalClause,
      rawInput,
      normalizedInput,
    );
    surveyIntent = reconciled.intent;
    generationContext = reconciled.context;
  } else if (satisfaction) {
    const reconciled = reconcileAcademicIntent(
      surveyIntent,
      satisfaction,
      rawInput,
      normalizedInput,
    );
    surveyIntent = reconciled.intent;
    generationContext = reconciled.context;
  } else if (consumption && !surveyIntent.researchIntent.relationCueDetected) {
    const reconciled = reconcileConsumptionIntent(
      surveyIntent,
      consumption,
      rawInput,
      normalizedInput,
    );
    surveyIntent = reconciled.intent;
    generationContext = reconciled.context;
  } else if (
    !(
      surveyIntent.targetCardinality === "multiple" &&
      surveyIntent.measurementMode === "comparison" &&
      surveyIntent.unitOfAnalysis !== "개별 응답자"
    ) &&
    (surveyIntent.researchIntent.relationCueDetected ||
      surveyIntent.researchIntent.relations.length > 0)
  ) {
    generationContext = relationshipContext(
      rawInput,
      normalizedInput,
      surveyIntent.targetPopulation,
      surveyIntent.researchIntent,
    );
    surveyIntent = reconcileRelationshipIntent(surveyIntent, generationContext);
  }

  if (
    /(?:인지도|인지|인식)\s*(?:과|와|및)\s*(?:사용|이용)\s*(?:경험|현황|행태|실태|패턴|빈도)/.test(
      normalizedInput,
    ) &&
    surveyIntent.surveyObject
  ) {
    const target = surveyIntent.surveyObject;
    const objectEntity: IntentEntity = {
      ...(surveyIntent.objects[0] ?? {
        id: stableId("object", target),
        text: target,
        normalizedText: target,
        source: "explicit" as const,
        confidence: 0.96,
      }),
      role: "product_or_service",
    };
    const activityEntity: IntentEntity = {
      id: stableId("activity", `${target}:use`),
      text: `${target} 이용`,
      normalizedText: `${target} 이용`,
      role: "behavior",
      source: "explicit",
      confidence: 0.98,
      activityKind: "use",
    };
    const targetPopulation =
      surveyIntent.targetPopulation ??
      (/(?:교내|학교\s*내|캠퍼스\s*내)/.test(normalizedInput)
        ? "교내 구성원"
        : null);
    generationContext = {
      ...generationContext,
      audience: targetPopulation,
      primaryEntity: target,
      entityType: "service",
      activity: `${target} 이용`,
      researchGoal: `${target} 인지와 실제 이용 행태 파악`,
      researchConstructs: [
        "인지 수준",
        "이용 여부 및 빈도",
        "이용 목적",
        "만족도",
        "불편",
      ],
      surveyArchetype: "service_usage",
      isUsageObject: true,
    };
    surveyIntent = {
      ...surveyIntent,
      semanticContext: generationContext,
      targetPopulation,
      objectKind: "service_product",
      objects: [objectEntity],
      activities: [activityEntity],
      entities: [objectEntity, activityEntity, ...surveyIntent.constructEntities],
      constructs: generationContext.researchConstructs,
      evaluationTargets: [target],
      purpose: `${target} 인지와 실제 이용 행태 파악`,
      purposeBlocks: [
        {
          id: "purpose-awareness",
          text: `${target} 인지 수준 파악`,
          kind: "attitude_perception",
          target,
          targetEntityIds: [objectEntity.id],
          constructEntityIds: surveyIntent.constructEntities.map((item) => item.id),
          order: 1,
          relationToPrevious: null,
        },
        {
          id: "purpose-usage-behavior",
          text: `${target} 실제 이용 행태 파악`,
          kind: "behavior_usage",
          target,
          targetEntityIds: [objectEntity.id],
          constructEntityIds: [activityEntity.id],
          order: 2,
          relationToPrevious: "evidence_for",
        },
      ],
    };
  } else if (
    surveyIntent.objectKind === "place_facility" &&
    generationContext.surveyArchetype === "facility_usage" &&
    surveyIntent.surveyObject
  ) {
    generationContext = {
      ...generationContext,
      primaryEntity: surveyIntent.surveyObject,
      entityType: /시설|공간/.test(surveyIntent.surveyObject)
        ? "facility"
        : generationContext.entityType,
      activity: `${surveyIntent.surveyObject} 이용`,
      researchGoal: `${surveyIntent.surveyObject} 이용 경험과 행태 및 개선점 파악`,
      isUsageObject: true,
    };
    surveyIntent = {
      ...surveyIntent,
      semanticContext: generationContext,
    };
  } else if (
    surveyIntent.objectKind === "behavior_usage" &&
    /(?:이용|사용)\s*시간/.test(surveyIntent.surveyObject ?? "")
  ) {
    generationContext = {
      ...generationContext,
      primaryEntity: surveyIntent.surveyObject ?? generationContext.primaryEntity,
      activity: surveyIntent.surveyObject ?? generationContext.activity,
      researchGoal: "실제 이용 시간 파악",
      researchConstructs: ["평균 이용 시간", "이용 빈도", "이용 상황"],
      surveyArchetype: "service_usage",
      isUsageObject: false,
    };
    surveyIntent = {
      ...surveyIntent,
      semanticContext: generationContext,
    };
  } else if (
    surveyIntent.objectKind !== "relationship_analysis" &&
    /수면\s*시간/.test(surveyIntent.surveyObject ?? "")
  ) {
    const subject = (surveyIntent.surveyObject ?? generationContext.primaryEntity)
      .replace(/\s+(?:의견|생각|인식)$/u, "")
      .trim();
    generationContext = {
      ...generationContext,
      primaryEntity: subject,
      researchGoal: "실제 수면 시간과 충분함 파악",
      researchConstructs: [
        "평일 수면 시간",
        "주말 수면 시간",
        "수면 충분함",
        "적정 수면 시간",
        "수면 부족 원인",
      ],
      surveyArchetype: "multidimensional_construct",
      isUsageObject: false,
    };
    surveyIntent = {
      ...surveyIntent,
      semanticContext: generationContext,
      surveyObject: subject,
      evaluationTargets: [subject],
    };
  }

  const canonicalObject = surveyIntent.surveyObject?.trim() ?? "";
  const contextStillEchoesRequest =
    generationContext.primaryEntity === normalizedInput ||
    generationContext.primaryEntity === rawInput.trim();
  if (
    canonicalObject &&
    canonicalObject !== normalizedInput &&
    contextStillEchoesRequest
  ) {
    const canonicalActivity =
      surveyIntent.activities[0]?.text ??
      (generationContext.isUsageObject ? `${canonicalObject} 이용` : null);
    generationContext = {
      ...generationContext,
      audience: surveyIntent.targetPopulation ?? generationContext.audience,
      primaryEntity: canonicalObject,
      activity: canonicalActivity,
      researchGoal:
        surveyIntent.studyPurpose?.text ??
        surveyIntent.purpose ??
        generationContext.researchGoal,
      researchConstructs:
        surveyIntent.constructs.length > 0
          ? [...surveyIntent.constructs]
          : generationContext.researchConstructs,
    };
    surveyIntent = {
      ...surveyIntent,
      semanticContext: generationContext,
    };
  }

  const reconciledLabels = reconcileCanonicalLabels(
    surveyIntent,
    generationContext,
  );
  surveyIntent = reconciledLabels.intent;
  generationContext = reconciledLabels.context;

  const audience = surveyIntent.targetPopulation
    ? canonicalEntity(
        surveyIntent.targetPopulation,
        "construct",
        "audience",
        ["응답 대상 표현"],
      )
    : null;
  const canonicalObjects = surveyIntent.objects.map((item) =>
    canonicalEntity(
      item.text,
      item.role === "category_set"
        ? "category_set"
        : generationContext.entityType,
      item.role === "category_set" ? "category_set" : "primary_entity",
      [item.text],
      satisfaction?.primaryEntity.candidates ?? [],
    ),
  );
  const canonicalActivities = surveyIntent.activities.map((item) => ({
    id: item.id,
    text: item.text,
    kind: item.activityKind ?? "use",
    objectEntityIds: canonicalObjects.map((object) => object.id),
    evidence: [item.text],
  }));
  const constructs =
    surveyIntent.researchIntent.variables.length > 0
      ? researchConstructs(surveyIntent.researchIntent)
      : surveyIntent.constructs.map((name) => ({
          id: stableId("construct", name),
          name,
          kind:
            surveyIntent.objectKind === "consumption_behavior"
              ? ("consumption_behavior" as const)
              : ("single_construct" as const),
          measurementMode:
            surveyIntent.objectKind === "consumption_behavior"
              ? ("category_profile" as const)
              : ("single_item" as const),
          dimensions: [],
          evidence: [name],
        }));
  const purposes = surveyIntent.purposeBlocks.map((purpose) => ({
    id: purpose.id,
    text: purpose.text,
    kind: purpose.kind,
    targetEntityIds: purpose.targetEntityIds,
    constructIds: purpose.constructEntityIds,
  }));
  const ambiguityCandidates = satisfaction?.ambiguity.candidates ?? [];
  const relationFailure = surveyIntent.researchIntent.parseFailureCode;
  const ambiguity: CanonicalAmbiguity = relationFailure
    ? {
        level: "high",
        requiresClarification: true,
        code: relationFailure,
        candidates: ambiguityCandidates,
      }
    : satisfaction?.ambiguity ?? {
        level: surveyIntent.ambiguityLevel,
        requiresClarification: surveyIntent.requiresCreatorClarification,
        code: null,
        candidates: ambiguityCandidates,
      };

  return {
    rawInput,
    normalizedInput,
    audience,
    entities: [
      ...(audience ? [audience] : []),
      ...canonicalObjects,
      ...constructs.map((construct) =>
        canonicalEntity(
          construct.name,
          construct.kind === "consumption_behavior"
            ? "consumption_behavior"
            : construct.kind === "multidimensional_construct"
              ? "multidimensional_construct"
              : "construct",
          "construct",
          construct.evidence,
        ),
      ),
    ],
    activities: canonicalActivities,
    constructs,
    purposes,
    relations: surveyIntent.researchIntent.relations,
    unitOfAnalysis: surveyIntent.unitOfAnalysis,
    surveyArchetype: generationContext.surveyArchetype,
    objectKind: surveyIntent.objectKind,
    ambiguity,
    operationalizationPlan: constructs.map((construct) => ({
      constructId: construct.id,
      constructName: construct.name,
      measurementMode: construct.measurementMode,
      requiredDimensions: construct.dimensions
        .filter((item) => item.required)
        .map((item) => item.name),
      optionalDimensions: construct.dimensions
        .filter((item) => !item.required)
        .map((item) => item.name),
    })),
    generationContext,
    researchIntent: surveyIntent.researchIntent,
    surveyIntent,
  };
}
