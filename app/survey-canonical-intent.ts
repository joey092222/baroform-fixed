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
    /^(.+?)에\s*대한\s+(.+?(?:대생|학과생|전공생|학생|학부생|재학생))(?:들)?의\s+(?:전반적\s*)?만족도(?:\s*조사)?$/,
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

type ResolvedConsumption = {
  audience: string | null;
  category: CanonicalEntity;
  activity: CanonicalActivity;
};

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
  const academic = resolveAcademicSatisfaction(normalizedInput);
  const consumption = resolveConsumptionActivity(
    normalizedInput,
    initialContext.audience ?? surveyIntent.targetPopulation,
  );

  if (academic) {
    const reconciled = reconcileAcademicIntent(
      surveyIntent,
      academic,
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
      academic?.primaryEntity.candidates ?? [],
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
  const ambiguityCandidates = academic?.ambiguity.candidates ?? [];
  const relationFailure = surveyIntent.researchIntent.parseFailureCode;
  const ambiguity: CanonicalAmbiguity = relationFailure
    ? {
        level: "high",
        requiresClarification: true,
        code: relationFailure,
        candidates: ambiguityCandidates,
      }
    : academic?.ambiguity ?? {
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
