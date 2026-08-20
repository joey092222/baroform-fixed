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
  const next = stripCanonicalRequestMeta(
    stripRelationalEntityDescriptor(previous.replace(/^현재\s+/, "")),
  );
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
  const aboutMatch = normalizedInput.match(
    /^(.+?)에\s*대한\s+(.+?(?:대생|학과생|전공생|학생|학부생|재학생))(?:들)?(?:의)?\s+(?:전반적\s*)?만족도(?:\s*조사)?$/,
  );
  const possessiveMatch = normalizedInput.match(
    /^(.+?(?:대생|학과생|전공생|학생|학부생|재학생))(?:들)?의\s+(.+?)\s+(?:전반적\s*)?만족도(?:\s*조사)?$/,
  );
  if (!aboutMatch && !possessiveMatch) return null;
  const primaryText = normalize(
    aboutMatch?.[1] ?? possessiveMatch?.[2] ?? "",
  );
  const audience = normalize(
    aboutMatch?.[2] ?? possessiveMatch?.[1] ?? "",
  );
  const matchedExpression = aboutMatch?.[0] ?? possessiveMatch?.[0] ?? "";
  const facilityCue = /(?:시설|건물|강의동|공간|캠퍼스|관)(?:\s|$)/.test(primaryText);
  const organizationCue = /(?:대학|학부|학과|전공|단과대|대)$/.test(primaryText);
  const audienceOrganization = audience.match(/(?:^|\s)([가-힣A-Za-z0-9·-]+(?:대|학과|전공))생/)?.[1] ?? null;
  const candidates: CanonicalEntityCandidate[] = [];
  if (facilityCue) {
    candidates.push({
      text: primaryText,
      kind: /시설|공간/.test(primaryText) ? "facility" : "university_building",
      confidence: 0.99,
      evidence: ["시설·건물·공간 명시", matchedExpression],
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
  contextEntity?: CanonicalEntity | null;
  eligibilityCondition?: string | null;
  screeningRequired?: boolean;
  screeningReason?: string | null;
  explicitTimeframe?: string | null;
  semanticFrame?: FrontedPurposeSemanticFrame | null;
};

type ResolvedComparisonClause = {
  audience: string;
  audienceEvidence: string;
  targets: CanonicalEntity[];
  researchConstructs: string[];
  activityVerb: string | null;
};

const relationalAudienceHead =
  "(?:신입생|졸업생|학부생|대학원생|재학생|휴학생|대학생|학생|일반인|직장인|취업준비생|구직자|고령층|청년층|청소년|청년|성인|사람|교직원|교수|교사|이용자|사용자|소비자|고객|주민|구성원|팀원|참가자|참여자|가입자|보호자|가구|학부모|대생|학과생|전공생)";

const relationalTimeframePattern =
  "(?:(?:최근|지난)\\s+(?:\\d+|한|두|세|네)\\s*(?:일|주|주일|개월|달|학기|년)|(?:이번|지난)\\s*(?:주|달|월|학기|학년도|연도))(?:\\s*(?:간|동안))?";

const frontedPurposePattern =
  "(?:만족도|평가|인지도|인지|인식|이미지|비이용\\s*이유|미사용\\s*이유|미구매\\s*이유|불참\\s*이유|안\\s*(?:쓰는|사용하는|이용하는)\\s*이유|이용\\s*의향|참여\\s*의향|구매\\s*의향|수요|필요성|개선(?:점|의견|요구)?)";

type QualifiedRespondent = {
  audience: string;
  audienceHead: string;
  contextText: string;
  contextParticle: "을" | "를" | "에" | "에서";
  activityPhrase: string;
  eligibilityActivity: string;
  canonicalActivity: string;
  activityKind: SurveyActivityKind | null;
  negative: boolean;
  timeframe: string | null;
  evidence: string;
};

type FrontedPurposeSemanticFrame = {
  frontedPurpose: string;
  contextEntity: string;
  surveyObject: string;
  eligibilityActivity: string;
  eligibilityTimeframe: string | null;
  targetPopulationHead: string;
  targetPopulation: string;
  screeningRequired: boolean;
  negation: boolean;
};

function stripPurposeMetric(value: string) {
  const normalized = normalize(value);
  const match = normalized.match(
    new RegExp(`^(.+?)\\s+(${frontedPurposePattern})$`),
  );
  return {
    subject: normalize(match?.[1] ?? normalized),
    construct: normalize(match?.[2] ?? normalized),
  };
}

function activityKindFromQualifier(value: string): SurveyActivityKind | null {
  if (/참여|참가|가입|등록|신청|수강/.test(value)) return "attend";
  if (/구매/.test(value)) return "purchase";
  if (/방문/.test(value)) return "use";
  if (/이용|사용|쓰|쓴|써|구독|시청|탈퇴|해지/.test(value)) return "use";
  return null;
}

function activityKindFromContext(value: string): SurveyActivityKind {
  if (/(?:프로그램|행사|축제|모임|클럽|동호회|동아리|수업|강의|교육|과정)$/u.test(value)) {
    return "attend";
  }
  if (/(?:제품|상품|물품)$/u.test(value)) return "purchase";
  return "use";
}

function inferredContextParticle(
  contextText: string,
  qualifier: string,
  activityKind: SurveyActivityKind | null,
): QualifiedRespondent["contextParticle"] {
  if (activityKind === "attend") return "에";
  if (
    activityKind === "purchase" &&
    /(?:매장|상점|가게|마트|몰|식당|카페|시장)$/.test(contextText)
  ) {
    return "에서";
  }
  if (/참여|참가/.test(qualifier)) return "에";
  return withAccusativeParticle(contextText).endsWith("을") ? "을" : "를";
}

function activityPredicate(
  qualifier: string,
  activityKind: SurveyActivityKind | null,
) {
  if (/탈퇴/.test(qualifier)) return "탈퇴";
  if (/해지/.test(qualifier)) return "해지";
  if (/가입/.test(qualifier)) return "가입";
  if (/등록/.test(qualifier)) return "등록";
  if (/신청/.test(qualifier)) return "신청";
  if (/수강/.test(qualifier)) return "수강";
  if (/구독/.test(qualifier)) return "구독";
  if (/시청/.test(qualifier)) return "시청";
  if (activityKind === "attend") return /참가/.test(qualifier) ? "참가" : "참여";
  if (activityKind === "purchase") return "구매";
  if (/방문/.test(qualifier)) return "방문";
  if (/사용|쓰|쓴|써/.test(qualifier)) return "사용";
  if (activityKind === "use") return "이용";
  return qualifier.replace(/(?:한|하는|않는)$/, "");
}

function resolveQualifiedRespondent(value: string): QualifiedRespondent | null {
  const normalized = normalize(value)
    .replace(/^(?:은|는)\s+/, "")
    .replace(/\s*(?:을|를)?\s*대상(?:으로)?\s*$/u, "")
    .trim();
  const match = normalized.match(
    new RegExp(
      `^(${relationalTimeframePattern})?\\s*(.{1,100}?)(을|를|에|에서)?\\s*(${relationalTimeframePattern})?\\s*(이용한|사용한|쓴|써본|방문한|참여한|참가한|구매한|가입한|등록한|신청한|구독한|시청한|수강한|탈퇴한|해지한|(?:이용|사용|방문|참여|참가|구매|가입|등록|신청|구독|시청|수강)하지\\s*않(?:는|은)|쓰지\\s*않(?:는|은)|안\\s*(?:쓰는|사용하는|이용하는|방문하는|참여하는|참가하는|구매하는|가입하는|등록하는|신청하는|구독하는|시청하는|수강하는|한|하는))\\s+(.*?${relationalAudienceHead})(?:들)?$`,
    ),
  );
  if (!match) return null;
  let contextText = normalize(match[2]);
  let explicitParticle = normalize(match[3] ?? "");
  if (!explicitParticle) {
    const swallowedParticle = contextText.match(/^(.+?)(에서|에|을|를)$/u);
    if (swallowedParticle) {
      contextText = normalize(swallowedParticle[1]);
      explicitParticle = swallowedParticle[2];
    }
  }
  const timeframe = normalize(match[1] ?? match[4] ?? "") || null;
  const qualifier = normalize(match[5]);
  const audienceHead = normalize(match[6]);
  const activityKind =
    activityKindFromQualifier(qualifier) ?? activityKindFromContext(contextText);
  const contextParticle = (explicitParticle ||
    inferredContextParticle(contextText, qualifier, activityKind)) as QualifiedRespondent["contextParticle"];
  const eligibilityActivity = normalize(
    `${contextText}${contextParticle} ${activityPredicate(qualifier, activityKind)}`,
  );
  const canonicalActivity = ["을", "를"].includes(contextParticle)
    ? normalize(`${contextText} ${activityPredicate(qualifier, activityKind)}`)
    : eligibilityActivity;
  const negative = /지\s*않|^안\s*|탈퇴|해지/.test(qualifier);
  const canonicalQualifier = /^안\s*(?:한|하는)$/u.test(qualifier)
    ? `${activityPredicate(qualifier, activityKind)}하지 ${/하는$/u.test(qualifier) ? "않는" : "않은"}`
    : /^안\s*/u.test(qualifier)
      ? `${/쓰/u.test(qualifier) ? "이용" : activityPredicate(qualifier, activityKind)}하지 않는`
      : qualifier;
  const qualifiedAudience = normalize(
    `${timeframe ? `${timeframe} ` : ""}${contextText}${contextParticle} ${canonicalQualifier} ${audienceHead}`,
  );
  return {
    audience: qualifiedAudience,
    audienceHead,
    contextText,
    contextParticle,
    activityPhrase: qualifier,
    eligibilityActivity,
    canonicalActivity,
    activityKind,
    negative,
    timeframe,
    evidence: normalized,
  };
}

function normalizedPurposeConstruct(value: string) {
  const cleaned = normalize(value)
    .replace(/\s*(?:물어보기|물어보고\s*싶다|알아보기|조사하고\s*싶다|조사|파악)\s*$/u, "")
    .replace(/^(?:왜|어째서)\s+/u, "")
    .trim();
  if (/^(?:이용|사용|구독|시청)하지\s*않(?:는|은)\s*이유$/u.test(cleaned)) {
    return "비이용 이유";
  }
  if (/^(?:참여|참가)하지\s*않(?:는|은)\s*이유$/u.test(cleaned)) {
    return "비참여 이유";
  }
  if (/^구매하지\s*않(?:는|은)\s*이유$/u.test(cleaned)) return "미구매 이유";
  if (/^(?:가입|등록|신청)하지\s*않(?:는|은)\s*이유$/u.test(cleaned)) {
    return "미가입 이유";
  }
  const negativeReason = cleaned.match(
    /^(?:왜\s*)?(?:안|못)\s*(쓰|사용|이용|방문|참여|참가|구매|가입|등록|신청|구독|시청|수강)(?:는지|하는지)?$/u,
  );
  if (negativeReason) {
    const predicate = negativeReason[1];
    if (/쓰|사용|이용|구독|시청/.test(predicate)) return "비이용 이유";
    if (/참여|참가/.test(predicate)) return "비참여 이유";
    if (/구매/.test(predicate)) return "미구매 이유";
    if (/가입|등록|신청/.test(predicate)) return "미가입 이유";
    if (/방문/.test(predicate)) return "비방문 이유";
    return "비이용 이유";
  }
  if (/^(?:가입|등록|신청)\s*안\s*한\s*이유$/u.test(cleaned)) return "미가입 이유";
  if (/^(?:참여|참가)\s*안\s*한\s*이유$/u.test(cleaned)) return "비참여 이유";
  if (/^(?:구매)\s*안\s*한\s*이유$/u.test(cleaned)) return "미구매 이유";
  if (/^(?:사용|이용|구독|시청)\s*안\s*한\s*이유$/u.test(cleaned)) return "비이용 이유";

  const futureIntention = cleaned.match(
    /^(?:앞으로|향후)\s*(쓰|쓸|사용|이용|방문|참여|참가|구매|가입|등록|신청|구독|시청|수강|재가입|재등록|재방문)(?:할|할지)?\s*(?:생각|의향|가능성)(?:이\s*있는지|이\s*있는가|\s*있는지|\s*여부)?$/u,
  );
  if (futureIntention) {
    const predicate = futureIntention[1]
      .replace(/^(?:쓰|쓸)$/u, "사용")
      .replace(/^(재가입|재등록|재방문)$/u, "$1");
    return `향후 ${predicate} 의향`;
  }
  return cleaned;
}

function resolveQualifiedRespondentPurposeTail(
  normalizedInput: string,
): ResolvedRelationalClause | null {
  const match = normalizedInput.match(
    new RegExp(
      `^(.+?${relationalAudienceHead})(?:들)?(?:에게|한테|의|이|가)?\\s+(.+)$`,
    ),
  );
  if (!match) return null;
  const qualified = resolveQualifiedRespondent(match[1]);
  if (!qualified) return null;
  const purposeTail = normalize(match[2]);
  if (
    !/(?:왜|이유|원인|장벽|만족|적응|의향|생각|가능성|인식|개선|수요|필요|문제|어려움|불편|경험|평가)/u.test(
      purposeTail,
    )
  ) {
    return null;
  }

  const researchConstructs = [
    ...new Set(
      splitRelationalConstructs(purposeTail)
        .map(normalizedPurposeConstruct)
        .filter(Boolean),
    ),
  ];
  if (researchConstructs.length === 0) return null;
  const entityType = inferRelationalEntityType(
    qualified.contextText,
    qualified.activityPhrase,
  );
  const resolvedEntityType = entityType === "unknown" ? "service" : entityType;
  const purposeKinds = researchConstructs.map(purposeKindFromConstruct);
  const hasSatisfaction = purposeKinds.includes("satisfaction");
  const multiplePurposes = researchConstructs.length > 1;
  const evidence = [
    normalizedInput,
    "응답자 관형절과 후행 조사 목적을 별도 의미 역할로 분리",
  ];

  return {
    audience: qualified.audience,
    audienceEvidence: qualified.evidence,
    primaryEntity: canonicalEntity(
      qualified.contextText,
      resolvedEntityType,
      "primary_entity",
      evidence,
    ),
    entityType: resolvedEntityType,
    objectKind: hasSatisfaction
      ? "satisfaction_evaluation"
      : multiplePurposes
        ? "composite"
        : qualified.negative
          ? "attitude_perception"
          : relationalObjectKind(resolvedEntityType),
    activity:
      qualified.activityKind && !qualified.negative
        ? qualified.canonicalActivity
        : null,
    activityKind: qualified.negative ? null : qualified.activityKind,
    researchGoal: `${qualified.contextText}의 ${researchConstructs.join(", ")} 파악`,
    researchConstructs,
    surveyArchetype: multiplePurposes
      ? "mixed"
      : hasSatisfaction
        ? "satisfaction"
        : qualified.negative
          ? "attitude"
          : usageArchetype(resolvedEntityType),
    isUsageObject: !qualified.negative && !hasSatisfaction,
    includesNonUsers: qualified.negative,
    purposeKinds,
    eligibilityCondition: qualified.audience,
    screeningRequired: true,
    screeningReason: `${qualified.audience}에 해당하는지 확인해야 함`,
    explicitTimeframe: qualified.timeframe,
  };
}

function shouldJoinContextAndSubject(input: {
  context: string;
  subject: string;
  activityKind: SurveyActivityKind | null;
}) {
  if (!input.subject || input.subject === input.context) return false;
  if (input.activityKind === "purchase" && /매장|상점|가게|마트|몰$/.test(input.context)) {
    return false;
  }
  if (input.context.endsWith(input.subject)) return false;
  return /(?:기능|메뉴|공간|좌석|시설|프로그램|서비스|제품|상품|콘텐츠|강의|수업)$/u.test(
    input.subject,
  );
}

function purposeKindFromConstruct(
  construct: string,
): SurveyIntent["purposeBlocks"][number]["kind"] {
  if (/만족|평가/.test(construct)) return "satisfaction";
  if (/수요|필요|의향|개선/.test(construct)) return "need_demand";
  if (/이유|원인|장벽|인지|인식|이미지/.test(construct)) {
    return "attitude_perception";
  }
  return "attitude_perception";
}

function resolveFrontedPurposeRespondentClause(
  normalizedInput: string,
): ResolvedRelationalClause | null {
  const match = normalizedInput.match(
    new RegExp(
      `^(.{1,80}?${frontedPurposePattern})(?:은|는)\\s+(.+?)(?:에게|한테|대상(?:으로)?)(?:\\s*(?:조사|질문|물어).*)?$`,
    ),
  );
  if (!match) return null;
  const purposePhrase = normalize(match[1]);
  const qualified = resolveQualifiedRespondent(match[2]);
  if (!qualified) return null;

  const { subject, construct } = stripPurposeMetric(purposePhrase);
  const contextType = inferRelationalEntityType(
    qualified.contextText,
    qualified.activityPhrase,
  );
  const resolvedContextType = contextType === "unknown" ? "service" : contextType;
  const genericSubject = /^(?:서비스|프로그램|플랫폼|앱|어플|제품|상품|시설|공간)$/.test(
    subject,
  );
  const objectText = genericSubject || qualified.contextText.endsWith(subject)
    ? qualified.contextText
    : shouldJoinContextAndSubject({
          context: qualified.contextText,
          subject,
          activityKind: qualified.activityKind,
        })
      ? `${qualified.contextText}의 ${subject}`
      : subject;
  const objectType = objectText === qualified.contextText
    ? resolvedContextType
    : inferRelationalEntityType(objectText);
  const resolvedObjectType = objectType === "unknown" ? "construct" : objectType;
  const purposeKind = purposeKindFromConstruct(construct);
  const negativePurpose =
    qualified.negative || /비이용|미사용|미구매|불참|안\s*(?:쓰|사용|이용)/.test(construct);
  const semanticFrame: FrontedPurposeSemanticFrame = {
    frontedPurpose: purposePhrase,
    contextEntity: qualified.contextText,
    surveyObject: objectText,
    eligibilityActivity: qualified.eligibilityActivity,
    eligibilityTimeframe: qualified.timeframe,
    targetPopulationHead: qualified.audienceHead,
    targetPopulation: qualified.audience,
    screeningRequired: true,
    negation: negativePurpose,
  };

  return {
    audience: qualified.audience,
    audienceEvidence: qualified.evidence,
    primaryEntity: canonicalEntity(
      objectText,
      resolvedObjectType,
      "primary_entity",
      [normalizedInput, "목적 선행 표현과 응답자 관형절을 역할별로 분리"],
    ),
    contextEntity: canonicalEntity(
      qualified.contextText,
      resolvedContextType,
      "context",
      [qualified.evidence],
    ),
    entityType: resolvedObjectType,
    objectKind: purposeKind === "satisfaction"
      ? "satisfaction_evaluation"
      : negativePurpose
        ? "attitude_perception"
        : relationalObjectKind(resolvedObjectType),
    activity: qualified.activityKind && !qualified.negative
      ? qualified.canonicalActivity
      : null,
    activityKind: qualified.negative ? null : qualified.activityKind,
    researchGoal: `${objectText}의 ${construct} 파악`,
    researchConstructs: [construct],
    surveyArchetype: purposeKind === "satisfaction"
      ? "satisfaction"
      : negativePurpose
        ? "attitude"
        : usageArchetype(resolvedObjectType),
    isUsageObject: false,
    includesNonUsers: negativePurpose,
    purposeKinds: [purposeKind],
    eligibilityCondition: qualified.audience,
    screeningRequired: true,
    screeningReason: `${qualified.audience}에 해당하는지 확인해야 함`,
    explicitTimeframe: qualified.timeframe,
    semanticFrame,
  };
}

function resolvePrequalifiedPurposeClause(
  normalizedInput: string,
): ResolvedRelationalClause | null {
  const prefiltered = normalizedInput.match(
    /^(?:이미\s*)?사전\s*선별된\s+(.+?)(?:에게|을\s*대상(?:으로)?)\s+(.+)$/u,
  );
  const match = normalizedInput.match(
    /^(.+?)(?:을|를)\s*대상(?:으로)?\s+(.+?)\s*(?:조사|파악)?$/u,
  );
  if (!match && !prefiltered) return null;
  const rawQualified = normalize(prefiltered?.[1] ?? match?.[1] ?? "");
  const normalizedQualified = prefiltered
    ? rawQualified.replace(
        new RegExp(
          `^(${relationalTimeframePattern})?\\s*(.{1,100}?)\\s+(이용|사용|방문|참여|참가|구매)\\s+(.*?${relationalAudienceHead})(?:들)?$`,
        ),
        (_all, timeframe: string | undefined, context: string, activity: string, audience: string) =>
          normalize(
            `${timeframe ? `${timeframe} ` : ""}${withAccusativeParticle(context)} ${activity}한 ${audience}`,
          ),
      )
    : rawQualified;
  const qualified = resolveQualifiedRespondent(normalizedQualified);
  if (!qualified) return null;
  const purposePhrase = normalize(prefiltered?.[2] ?? match?.[2] ?? "")
    .replace(/\s*(?:조사|파악)\s*$/u, "")
    .replace(/(?:을|를)$/u, "");
  if (!new RegExp(`${frontedPurposePattern}$`).test(purposePhrase)) return null;
  const { subject, construct } = stripPurposeMetric(purposePhrase);
  const contextType = inferRelationalEntityType(
    qualified.contextText,
    qualified.activityPhrase,
  );
  const resolvedContextType = contextType === "unknown" ? "service" : contextType;
  const objectText = subject || qualified.contextText;
  const objectType = inferRelationalEntityType(objectText);
  const resolvedObjectType = objectType === "unknown" ? "construct" : objectType;
  const purposeKind = purposeKindFromConstruct(construct);
  const semanticFrame: FrontedPurposeSemanticFrame = {
    frontedPurpose: purposePhrase,
    contextEntity: qualified.contextText,
    surveyObject: objectText,
    eligibilityActivity: qualified.eligibilityActivity,
    eligibilityTimeframe: qualified.timeframe,
    targetPopulationHead: qualified.audienceHead,
    targetPopulation: qualified.audience,
    screeningRequired: !prefiltered,
    negation: qualified.negative,
  };

  return {
    audience: qualified.audience,
    audienceEvidence: qualified.evidence,
    primaryEntity: canonicalEntity(
      objectText,
      resolvedObjectType,
      "primary_entity",
      [normalizedInput, "사전 적격 응답자와 후행 조사 목적을 분리"],
    ),
    contextEntity: canonicalEntity(
      qualified.contextText,
      resolvedContextType,
      "context",
      [qualified.evidence],
    ),
    entityType: resolvedObjectType,
    objectKind: purposeKind === "satisfaction"
      ? "satisfaction_evaluation"
      : relationalObjectKind(resolvedObjectType),
    activity: qualified.activityKind && !qualified.negative
      ? qualified.canonicalActivity
      : null,
    activityKind: qualified.negative ? null : qualified.activityKind,
    researchGoal: `${objectText}의 ${construct} 파악`,
    researchConstructs: [construct],
    surveyArchetype: purposeKind === "satisfaction" ? "satisfaction" : "attitude",
    isUsageObject: false,
    includesNonUsers: qualified.negative,
    purposeKinds: [purposeKind],
    eligibilityCondition: qualified.audience,
    screeningRequired: !prefiltered,
    screeningReason: prefiltered
      ? null
      : `${qualified.audience}에 해당하는지 확인해야 함`,
    explicitTimeframe: qualified.timeframe,
    semanticFrame,
  };
}

function isBareRoleAmbiguousRequest(normalizedInput: string) {
  const hasAudienceNoun = new RegExp(relationalAudienceHead).test(normalizedInput);
  const hasSurveyMeta = /(?:설문\s*)?조사$/u.test(normalizedInput);
  const hasRoleConnector =
    /(?:을|를)\s*대상|(?:에게|한테)|(?:이|가|은|는|의)\s+|(?:이용|사용|방문|참여|구매)(?:한|하는|하지)/u.test(
      normalizedInput,
    );
  const hasMeasurementCue =
    /(?:만족도|평가|인지도|인식|이미지|빈도|경험|이유|수요|필요성|의향|개선|비교|관계|시간|행태|현황|실태)/u.test(
      normalizedInput,
    );
  return hasAudienceNoun && hasSurveyMeta && !hasRoleConnector && !hasMeasurementCue;
}

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
    .replace(/^대상으로\s+/, "")
    .replace(/\s*(?:비교|조사|파악)\s*$/g, "")
    .replace(/\s*(?:조사|파악)\s*$/g, "")
    .replace(/((?:는지|하는지))\s+(?=(?:앞으로|향후)\s+)/gu, "$1, ");
  const parts = cleaned
    .split(/(?:\s*[,·]\s*|\s+(?:및|그리고)\s+|(?<=[가-힣])(?:이랑|랑|와|과)\s*)/)
    .map((item) => normalize(item).replace(/(?:을|를)$/g, ""))
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

function stripRelationalEntityDescriptor(value: string) {
  const normalized = normalize(value);
  const descriptor = normalized.match(/^(.{2,80})인\s+(.+)$/);
  if (!descriptor) return normalized;
  const descriptorHead = normalize(descriptor[1]);
  const isGrammaticalDescriptor =
    /(?:대상|항목|요인|기능|조건|서비스|제품|상품|시설|건물|공간|장소|플랫폼|프로그램|앱|어플|수업|강의|행사|도구|방법|방식|선택지|후보|객체|주제)$/.test(
      descriptorHead,
    );
  return isGrammaticalDescriptor ? normalize(descriptor[2]) : normalized;
}

function stripLeadingRelationalTimeframe(value: string) {
  return normalize(value).replace(
    /^(?:(?:최근|지난)\s+(?:\d+|한|두|세|네)\s*(?:일|주|주일|개월|달|학기|년)|(?:이번|지난)\s*(?:주|달|월|학기|학년도|연도))(?:\s*(?:간|동안))?\s+/,
    "",
  );
}

function relationalObjectKind(
  entityType: SurveyContextEntityType,
): SurveyIntentObjectKind {
  return entityType === "facility" ||
    entityType === "university_building" ||
    entityType === "place"
    ? "place_facility"
    : "service_product";
}

function usageArchetype(entityType: SurveyContextEntityType): SurveyArchetype {
  if (entityType === "platform") return "platform_usage";
  if (entityType === "product") return "product_usage";
  if (
    entityType === "facility" ||
    entityType === "university_building" ||
    entityType === "place"
  ) {
    return "facility_usage";
  }
  return "service_usage";
}

function resolveComparisonClause(
  normalizedInput: string,
): ResolvedComparisonClause | null {
  const actorComparison = normalizedInput.match(
    new RegExp(
      `^(.*?${relationalAudienceHead})(?:들)?(?:이|가)\\s+(.{1,80}?)(?:와|과)\\s+(.{1,80}?)(?:을|를)\\s+(이용|사용|구독|방문|구매)하는\\s+(.+?)\\s*비교$`,
    ),
  );
  const qualifiedComparison = normalizedInput.match(
    /^(.{1,80}?)(?:와|과)\s+(.{1,80}?)\s+(이용자|사용자|구독자|방문자|참여자|가입자|고객)(?:들)?(?:의|이|가)\s+(.+?)\s*비교$/,
  );
  const activityAudienceComparison = normalizedInput.match(
    new RegExp(
      `^(.{1,80}?)(?:와|과)\\s+(.{1,80}?)(?:을|를)\\s+(.{1,50}?)(?:는|은)\\s+(.*?${relationalAudienceHead})(?:들)?(?:의)\\s+(.+?)\\s*비교$`,
    ),
  );
  const nominalComparison = normalizedInput.match(
    /^(.{1,80}?)(?:와|과)\s+(.{1,80}?)(?:의)\s+(.+?)\s*비교$/,
  );
  if (
    !actorComparison &&
    !qualifiedComparison &&
    !activityAudienceComparison &&
    !nominalComparison
  ) {
    return null;
  }

  const firstTarget = stripRelationalEntityDescriptor(
    actorComparison?.[2] ??
      qualifiedComparison?.[1] ??
      activityAudienceComparison?.[1] ??
      nominalComparison?.[1] ??
      "",
  );
  const secondTarget = stripRelationalEntityDescriptor(
    actorComparison?.[3] ??
      qualifiedComparison?.[2] ??
      activityAudienceComparison?.[2] ??
      nominalComparison?.[2] ??
      "",
  );
  if (!firstTarget || !secondTarget || firstTarget === secondTarget) return null;

  const activityVerb = normalize(
    actorComparison?.[4] ?? activityAudienceComparison?.[3] ?? "",
  );
  const audienceHead = normalize(qualifiedComparison?.[3] ?? "");
  const constructs = splitRelationalConstructs(
    actorComparison?.[5] ??
      qualifiedComparison?.[4] ??
      activityAudienceComparison?.[5] ??
      nominalComparison?.[3] ??
      "만족도",
  );
  const targetValues = [firstTarget, secondTarget];
  const inferredTargetTypes = targetValues.map((target) =>
    inferRelationalEntityType(
      target,
      /^(?:이용|사용|구독|방문|구매)$/.test(activityVerb) ? activityVerb : "",
    ),
  );
  if (
    nominalComparison &&
    !actorComparison &&
    !qualifiedComparison &&
    !activityAudienceComparison &&
    inferredTargetTypes.some((entityType) => entityType === "unknown")
  ) {
    return null;
  }
  const targets = targetValues.map((target) => {
    const usageCue = /^(?:이용|사용|구독|방문|구매)$/.test(activityVerb)
      ? activityVerb
      : audienceHead;
    const inferredType = inferRelationalEntityType(target, usageCue);
    const entityType =
      inferredType === "unknown"
        ? activityAudienceComparison
          ? "construct"
          : "service"
        : inferredType;
    return canonicalEntity(target, entityType, "primary_entity", [normalizedInput]);
  });
  const audience = actorComparison
    ? normalize(actorComparison[1])
    : activityAudienceComparison
      ? normalize(
          `${firstTarget}와 ${withAccusativeParticle(secondTarget)} ${activityAudienceComparison[3]}는 ${activityAudienceComparison[4]}`,
        )
      : qualifiedComparison
        ? `${firstTarget}와 ${secondTarget} ${audienceHead}`
        : "관련 경험이 있는 응답자";

  return {
    audience,
    audienceEvidence: actorComparison
      ? normalize(actorComparison[1])
      : activityAudienceComparison
        ? normalize(activityAudienceComparison[0])
        : qualifiedComparison
          ? normalize(`${qualifiedComparison[1]}와 ${qualifiedComparison[2]} ${audienceHead}`)
          : "비교 대상만 명시됨",
    targets,
    researchConstructs: constructs,
    activityVerb: activityVerb || null,
  };
}

function movementConstructs(value: string) {
  return splitRelationalConstructs(value).map((construct) => {
    if (/이동\s*수단|교통\s*수단/.test(construct)) return "이동 수단";
    if (/얼마나\s*(?:걸리|소요)|소요\s*시간|이동\s*시간/.test(construct)) {
      return "이동 소요 시간";
    }
    if (/불편/.test(construct)) return "이동 불편";
    if (/혼잡/.test(construct)) return "이동 혼잡";
    if (/안전/.test(construct)) return "이동 안전";
    return construct;
  });
}

function resolveColloquialMovementClause(
  normalizedInput: string,
): ResolvedRelationalClause | null {
  const objectFirst = normalizedInput.match(
    new RegExp(
      `^(.{1,60}?)\\s+(오갈|다닐|이동할|통학할|출퇴근할)\\s*때\\s+(.*?${relationalAudienceHead})(?:들)?(?:이|가)?\\s+(.+)$`,
    ),
  );
  const audienceFirst = normalizedInput.match(
    new RegExp(
      `^(.*?${relationalAudienceHead})(?:들)?(?:이|가)\\s+(.{1,60}?)\\s+(오갈|다닐|이동할|통학할|출퇴근할)\\s*때\\s+(.+)$`,
    ),
  );
  if (!objectFirst && !audienceFirst) return null;

  const object = normalize(objectFirst?.[1] ?? audienceFirst?.[2] ?? "");
  const movementVerb = normalize(objectFirst?.[2] ?? audienceFirst?.[3] ?? "이동할");
  const audience = normalize(objectFirst?.[3] ?? audienceFirst?.[1] ?? "");
  const constructPhrase = normalize(objectFirst?.[4] ?? audienceFirst?.[4] ?? "");
  if (!object || !audience || !constructPhrase) return null;

  const entityType = inferRelationalEntityType(object);
  const resolvedEntityType = entityType === "unknown" ? "place" : entityType;
  const constructs = movementConstructs(constructPhrase);
  return {
    audience,
    audienceEvidence: audience,
    primaryEntity: canonicalEntity(
      object,
      resolvedEntityType,
      "primary_entity",
      [normalizedInput, movementVerb],
    ),
    entityType: resolvedEntityType,
    objectKind: "behavior_usage",
    activity: `${withAccusativeParticle(object)} 오가는 이동`,
    activityKind: "move",
    researchGoal: `${object} 이동 경험의 ${constructs.join(", ")} 파악`,
    researchConstructs: constructs,
    surveyArchetype: "mobility_experience",
    isUsageObject: false,
    includesNonUsers: false,
    purposeKinds: ["behavior_usage", "need_demand"],
  };
}

function resolveQualifiedAudienceClause(
  normalizedInput: string,
): ResolvedRelationalClause | null {
  const qualified = normalizedInput.match(
    new RegExp(
      `^(.{1,100}?)(을|를|에)\\s*(모르는|알지\\s*못하는|이용하지\\s*않(?:는|은)|사용하지\\s*않(?:는|은)|쓰지\\s*않(?:는|은)|안\\s*(?:쓰는|사용하는|이용하는|방문하는|참여하는)|방문하지\\s*않(?:는|은)|가지\\s*않(?:는|은)|참여하지\\s*않(?:는|은)|가입하지\\s*않(?:는|은)|참가하지\\s*않(?:는|은)|다니지\\s*않(?:는|은)|이용하는|사용하는|쓰는|방문하는|참여하는|참가하는|가입하는|다니는|이용한|사용한|방문한|참여한|참가한|가입한|써본|먹어본|구매한)\\s+(.*?${relationalAudienceHead})(?:들)?(?:의|이|가)?\\s+(.+)$`,
    ),
  );
  if (!qualified) return null;

  const qualifiedObject = normalize(qualified[1]);
  const object = stripLeadingRelationalTimeframe(qualifiedObject);
  const particle = normalize(qualified[2]);
  const qualifier = normalize(qualified[3]);
  const audienceGroup = normalize(qualified[4]);
  const negative = /(?:모르|알지\s*못하|지\s*않|안\s*(?:쓰|사용|이용|방문|참여))/.test(qualifier);
  const constructPhrase = normalize(qualified[5])
    .replace(/^대상(?:으로)?\s+/, "")
    .replace(new RegExp(`^(?:${object.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|서비스|제품|플랫폼|시설)(?:이|가|은|는)?\\s*`), "");
  const constructs = splitRelationalConstructs(constructPhrase).map((construct) =>
    negative && /(?:이용|사용|방문|참여)하지\s*않는\s*(?:이유|원인|장벽|요인)|비사용\s*이유/.test(construct)
      ? "비이용 이유"
      : construct,
  );
  const entityType = inferRelationalEntityType(object, qualifier);
  const resolvedEntityType = entityType === "unknown" ? "service" : entityType;
  const qualifiedAudience = `${qualifiedObject}${particle} ${qualifier} ${audienceGroup}`;
  const satisfaction = constructs.some((item) => /만족|평가/.test(item));

  return {
    audience: qualifiedAudience,
    audienceEvidence: normalize(`${qualified[1]}${particle} ${qualifier} ${qualified[4]}`),
    primaryEntity: canonicalEntity(
      object,
      resolvedEntityType,
      "primary_entity",
      [qualified[0], qualifier],
    ),
    entityType: resolvedEntityType,
    objectKind: satisfaction
      ? "satisfaction_evaluation"
      : negative
        ? "attitude_perception"
        : relationalObjectKind(resolvedEntityType),
    activity: negative ? null : `${object} 이용`,
    activityKind: negative ? null : "use",
    researchGoal: `${object}의 ${constructs.join(", ")} 파악`,
    researchConstructs: constructs,
    surveyArchetype: negative
      ? "attitude"
      : satisfaction
        ? "satisfaction"
        : usageArchetype(resolvedEntityType),
    isUsageObject: !negative && !satisfaction,
    includesNonUsers: negative,
    purposeKinds: negative
      ? ["attitude_perception", "need_demand"]
      : satisfaction
        ? ["satisfaction", "need_demand"]
        : ["usage_experience", "need_demand"],
  };
}

function objectFromQualifiedAudience(audience: string) {
  const normalizedAudience = normalize(audience);
  const withoutTimeframe = normalizedAudience.replace(
    /^최근\s+(?:\d+|한|두|세|네)\s*(?:일|주|주일|개월|달|학기|년)\s+/,
    "",
  );
  const actionQualified = withoutTimeframe.match(
    /^(.{1,80}?)\s+(?:이용|사용|방문|참여|참가|가입)\s*(?:학생|이용자|사용자|방문자|참여자|참가자|가입자|고객)$/,
  );
  const roleQualified = withoutTimeframe.match(
    /^(.{1,80}?)\s+(?:이용자|사용자|방문자|참여자|참가자|가입자|고객)$/,
  );
  return normalize(actionQualified?.[1] ?? roleQualified?.[1] ?? "");
}

function resolveAudiencePossessiveClause(
  normalizedInput: string,
): ResolvedRelationalClause | null {
  const match = normalizedInput.match(
    new RegExp(
      `^(.*?${relationalAudienceHead})(?:들)?(?:의)\\s+(.+?)\\s+((?:이용|사용|방문|참여|구매|주문)?\\s*(?:빈도|패턴|현황|경험|만족도|사용성|오류\\s*경험|편의성|신뢰도|불편|장벽|인지도|의향|이유|개선).*)$`,
    ),
  );
  if (!match) return null;

  const audience = normalize(match[1]);
  const embeddedObject = objectFromQualifiedAudience(audience);
  const statedObject = normalize(match[2]);
  const awarenessConnector = statedObject.match(
    /^(.+?)\s+(인지|인지도|인식)(?:과|와)$/,
  );
  const normalizedStatedObject = normalize(
    awarenessConnector?.[1] ?? statedObject,
  );
  const constructs = [
    ...(awarenessConnector ? [awarenessConnector[2]] : []),
    ...splitRelationalConstructs(match[3]),
  ];
  const satisfaction = constructs.some((item) => /만족|평가/.test(item));
  const explicitImprovementDemand = constructs.some((item) =>
    /개선|수요|필요|요구|도입|의향/.test(item),
  );
  const genericEvaluationObject = /^(?:서비스|제품|상품|시설|공간|플랫폼|프로그램|앱|이용|사용|방문)$/.test(
    statedObject,
  );
  const object =
    satisfaction && !genericEvaluationObject
      ? normalizedStatedObject
      : embeddedObject || normalizedStatedObject;
  const hasExplicitUsagePredicate = /이용|사용|방문|참여|구매|주문/.test(match[3]);
  const entityType = inferRelationalEntityType(
    object,
    hasExplicitUsagePredicate ? "이용" : "",
  );
  const resolvedEntityType = entityType === "unknown" ? "construct" : entityType;

  // A possessive audience phrase does not by itself make the following noun
  // an independently usable object. For example, in "대학생의 카공 빈도"
  // the measured behavior is 카공 and "빈도" is its metric. Let the general
  // behavior parser handle these construct-like phrases instead of promoting
  // them to a service-usage intent. Concrete entities and explicit usage
  // predicates still take this relational path.
  if (
    !embeddedObject &&
    resolvedEntityType === "construct" &&
    !satisfaction &&
    !hasExplicitUsagePredicate
  ) {
    return null;
  }

  return {
    audience,
    audienceEvidence: normalize(match[1]),
    primaryEntity: canonicalEntity(
      object,
      resolvedEntityType,
      "primary_entity",
      [match[0], embeddedObject ? "응답자 조건에 명시된 이용 대상" : "응답자 소유격 뒤 조사 대상"],
    ),
    entityType: resolvedEntityType,
    objectKind: satisfaction
      ? "satisfaction_evaluation"
      : relationalObjectKind(resolvedEntityType),
    activity: hasExplicitUsagePredicate
      ? `${object} 이용`
      : null,
    activityKind: hasExplicitUsagePredicate
      ? "use"
      : null,
    researchGoal: `${object}의 ${constructs.join(", ")} 파악`,
    researchConstructs: constructs,
    surveyArchetype: satisfaction
      ? "satisfaction"
      : resolvedEntityType === "construct"
        ? "attitude"
        : usageArchetype(resolvedEntityType),
    isUsageObject: !satisfaction && resolvedEntityType !== "construct",
    includesNonUsers: false,
    purposeKinds: satisfaction
      ? explicitImprovementDemand
        ? ["satisfaction", "need_demand"]
        : ["satisfaction"]
      : ["usage_experience", "need_demand"],
  };
}

function resolveVisitExperienceClause(
  normalizedInput: string,
): ResolvedRelationalClause | null {
  const match = normalizedInput.match(
    new RegExp(
      `^(.*?${relationalAudienceHead})(?:들)?(?:이|가)\\s+(.{1,80}?)(에|을|를)\\s*(방문|이용|사용|참여)할\\s*때\\s*(?:겪는|느끼는|경험하는)\\s+(.+)$`,
    ),
  );
  if (!match) return null;

  const statedAudience = normalize(match[1]);
  const object = normalize(match[2]);
  const verb = normalize(match[4]);
  const constructs = splitRelationalConstructs(match[5]);
  const entityType = inferRelationalEntityType(object, verb);
  const resolvedEntityType = entityType === "unknown" ? "place" : entityType;
  const activity = verb === "방문" ? `${object} 방문` : `${object} 이용`;

  return {
    audience: `${withAccusativeParticle(object)} ${verb}하는 ${statedAudience}`,
    audienceEvidence: normalize(`${match[1]}이 ${match[2]}${match[3]} ${verb}할 때`),
    primaryEntity: canonicalEntity(
      object,
      resolvedEntityType,
      "primary_entity",
      [match[0], `${verb}할 때`],
    ),
    entityType: resolvedEntityType,
    objectKind: relationalObjectKind(resolvedEntityType),
    activity,
    activityKind: verb === "참여" ? "attend" : "use",
    researchGoal: `${object} ${activity}의 ${constructs.join(", ")} 파악`,
    researchConstructs: constructs,
    surveyArchetype: usageArchetype(resolvedEntityType),
    isUsageObject: true,
    includesNonUsers: false,
    purposeKinds: ["usage_experience", "need_demand"],
  };
}

function resolveRecipientMovementClause(
  normalizedInput: string,
): ResolvedRelationalClause | null {
  const match = normalizedInput.match(
    new RegExp(
      `^(.*?${relationalAudienceHead})(?:들)?에게\\s+(.{1,80}?)(?:을|를)\\s*(오갈|이동할|통학할)\\s*때\\s*(?:느끼는|겪는|경험하는)\\s+(.+)$`,
    ),
  );
  if (!match) return null;

  const audience = normalize(match[1]);
  const object = normalize(match[2]);
  const constructs = splitRelationalConstructs(match[4]);
  const entityType = inferRelationalEntityType(object);
  const resolvedEntityType = entityType === "unknown" ? "place" : entityType;

  return {
    audience,
    audienceEvidence: normalize(match[1]),
    primaryEntity: canonicalEntity(
      object,
      resolvedEntityType,
      "primary_entity",
      [match[0], match[3]],
    ),
    entityType: resolvedEntityType,
    objectKind: "behavior_usage",
    activity: `${object}을 오가는 이동`,
    activityKind: "move",
    researchGoal: `${object} 이동 경험의 ${constructs.join(", ")} 파악`,
    researchConstructs: constructs,
    surveyArchetype: "mobility_experience",
    isUsageObject: false,
    includesNonUsers: false,
    purposeKinds: ["behavior_usage", "need_demand"],
  };
}

function resolveObjectAudienceClause(
  normalizedInput: string,
): ResolvedRelationalClause | null {
  const objectAudience = normalizedInput.match(
    /^(.{1,100}?)\s+(이용자|사용자|방문자|참여자|고객)(?:들)?(?:의|이|가)\s+(.+)$/,
  );
  if (!objectAudience) return null;

  const qualifiedObject = normalize(objectAudience[1]);
  if (
    /(?:을|를)\s*(?:오가는|왕래하는|이동하는|통학하는|이용하는|사용하는|방문하는|참여하는)$/.test(
      qualifiedObject,
    )
  ) {
    return null;
  }
  const audienceHead = normalize(objectAudience[2]);
  const constructs = splitRelationalConstructs(objectAudience[3]);
  const satisfaction = constructs.some((item) => /만족|평가/.test(item));
  const evaluationSubject = normalize(
    constructs.find((item) => /(?:만족도|평가)/.test(item))?.replace(
      /\s*(?:만족도|평가).*$/,
      "",
    ) ?? "",
  );
  const independentConstructSubject = normalize(objectAudience[3])
    .replace(/(?:을|를)\s*$/, "")
    .replace(
      /\s*(?:현황\s*파악|빈도\s*조사|만족도\s*분석|불편\s*조사|미충족\s*수요\s*파악|선호\s*비교|신규\s*서비스\s*결정|시설\s*개설\s*결정)\s*$/,
      "",
    )
    .trim();
  const genericAudienceObject = /^(?:앱|서비스|플랫폼|제품|시설)$/.test(
    qualifiedObject,
  );
  const object =
    satisfaction &&
    evaluationSubject &&
    !/^(?:서비스|제품|상품|시설|공간|플랫폼|프로그램|앱|이용|사용|방문)$/.test(
      evaluationSubject,
    )
      ? evaluationSubject
      : genericAudienceObject &&
          independentConstructSubject.length >= 2 &&
          !/^(?:이용|사용|방문|참여|구매|주문)\s*(?:여부|현황|빈도|시간|경험|만족|불편)/.test(
            independentConstructSubject,
          )
        ? independentConstructSubject
        : qualifiedObject;
  const entityType = inferRelationalEntityType(
    object,
    object === qualifiedObject ? audienceHead : "",
  );
  const resolvedEntityType =
    entityType === "unknown"
      ? object === qualifiedObject
        ? "service"
        : "construct"
      : entityType;
  const resolvedConstructs = constructs.map((item) =>
    satisfaction && evaluationSubject === object && item.startsWith(object)
      ? normalize(item.slice(object.length)) || "전반적 만족도"
      : item,
  );

  return {
    audience: `${qualifiedObject} ${audienceHead}`,
    audienceEvidence: normalize(`${objectAudience[1]} ${objectAudience[2]}`),
    primaryEntity: canonicalEntity(
      object,
      resolvedEntityType,
      "primary_entity",
      [objectAudience[0], audienceHead],
    ),
    entityType: resolvedEntityType,
    objectKind: satisfaction
      ? "satisfaction_evaluation"
      : relationalObjectKind(resolvedEntityType),
    activity: satisfaction ? null : `${object} 이용`,
    activityKind: satisfaction ? null : "use",
    researchGoal: `${object}의 ${resolvedConstructs.join(", ")} 파악`,
    researchConstructs: resolvedConstructs,
    surveyArchetype: satisfaction
      ? "satisfaction"
      : usageArchetype(resolvedEntityType),
    isUsageObject: !satisfaction,
    includesNonUsers: false,
    purposeKinds: satisfaction
      ? ["satisfaction", "need_demand"]
      : ["usage_experience", "need_demand"],
  };
}

function resolveConcretePossessiveClause(
  normalizedInput: string,
): ResolvedRelationalClause | null {
  if (
    new RegExp(
      `${relationalAudienceHead}(?:들)?(?:이|가)\\s+(?:바라보는|평가하는|인식하는|생각하는)`,
    ).test(normalizedInput)
  ) {
    return null;
  }
  const possessive = normalizedInput.match(
    /^(.{2,100}?(?:대학교\s+)?(?:도서관|체육관|상담센터|식당|카페|건물|강의동|시설|공간|플랫폼|서비스|프로그램|앱))(?:\s+한\s+곳)?(?:의)\s+(.+)$/,
  );
  if (!possessive) return null;

  const object = normalize(possessive[1]);
  const constructs = splitRelationalConstructs(possessive[2]);
  if (!constructs.some((item) => /만족|혼잡|불편|수요|필요|경험|예약|개선/.test(item))) {
    return null;
  }
  const entityType = inferRelationalEntityType(object);
  const resolvedEntityType = entityType === "unknown" ? "facility" : entityType;
  const satisfaction = constructs.some((item) => /만족|평가/.test(item));

  return {
    audience: `${object} 이용자`,
    audienceEvidence: `${object}의 이용 경험을 전제로 한 평가 항목`,
    primaryEntity: canonicalEntity(
      object,
      resolvedEntityType,
      "primary_entity",
      [possessive[0], "구체적 장소·서비스의 소유격 구조"],
    ),
    entityType: resolvedEntityType,
    objectKind: satisfaction
      ? "satisfaction_evaluation"
      : relationalObjectKind(resolvedEntityType),
    activity: `${object} 이용`,
    activityKind: "use",
    researchGoal: `${object}의 ${constructs.join(", ")} 파악`,
    researchConstructs: constructs,
    surveyArchetype: satisfaction
      ? "satisfaction"
      : usageArchetype(resolvedEntityType),
    isUsageObject: !satisfaction,
    includesNonUsers: false,
    purposeKinds: satisfaction
      ? ["satisfaction", "need_demand"]
      : ["usage_experience", "need_demand"],
  };
}

function resolveRelationalClause(
  normalizedInput: string,
): ResolvedRelationalClause | null {
  const frontedPurpose = resolveFrontedPurposeRespondentClause(normalizedInput);
  if (frontedPurpose) return frontedPurpose;
  const prequalifiedPurpose = resolvePrequalifiedPurposeClause(normalizedInput);
  if (prequalifiedPurpose) return prequalifiedPurpose;
  const qualifiedPurposeTail = resolveQualifiedRespondentPurposeTail(normalizedInput);
  if (qualifiedPurposeTail) return qualifiedPurposeTail;
  const qualifiedAudience = resolveQualifiedAudienceClause(normalizedInput);
  if (qualifiedAudience) return qualifiedAudience;
  const colloquialMovement = resolveColloquialMovementClause(normalizedInput);
  if (colloquialMovement) return colloquialMovement;
  const recipientMovement = resolveRecipientMovementClause(normalizedInput);
  if (recipientMovement) return recipientMovement;
  const visitExperience = resolveVisitExperienceClause(normalizedInput);
  if (visitExperience) return visitExperience;
  const objectAudience = resolveObjectAudienceClause(normalizedInput);
  if (objectAudience) return objectAudience;
  const embeddedAudience = normalizedInput.match(
    new RegExp(`^(.*?${relationalAudienceHead})(?:들)?(?:의)\\s+`),
  )?.[1];
  if (
    embeddedAudience &&
    !/(?:와|과|및)/.test(objectFromQualifiedAudience(embeddedAudience)) &&
    objectFromQualifiedAudience(embeddedAudience)
  ) {
    const embedded = resolveAudiencePossessiveClause(normalizedInput);
    if (embedded) return embedded;
  }
  const concretePossessive = resolveConcretePossessiveClause(normalizedInput);
  if (concretePossessive) return concretePossessive;

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

  const audienceMovement = normalizedInput.match(
    new RegExp(
      `^(.*?${relationalAudienceHead})(?:들)?(?:의|이|가)\\s+(.+?)\\s+(등하교|통학|출퇴근|이동)(?:\\s*(?:경험|환경|과정))?$`,
    ),
  );
  if (audienceMovement) {
    const statedAudience = normalize(audienceMovement[1]);
    const object = normalize(audienceMovement[2]);
    const movementKind = normalize(audienceMovement[3]);
    const objectWithParticle = withAccusativeParticle(object);
    const entityType = inferRelationalEntityType(object);
    const resolvedEntityType = entityType === "unknown" ? "place" : entityType;
    return {
      audience: `${objectWithParticle} 이용하거나 방문하는 ${statedAudience}`,
      audienceEvidence: normalize(`${audienceMovement[1]}의 ${object} ${movementKind} 경험`),
      primaryEntity: canonicalEntity(
        object,
        resolvedEntityType,
        "primary_entity",
        [audienceMovement[0], movementKind],
      ),
      entityType: resolvedEntityType,
      objectKind: "behavior_usage",
      activity: `${object} 수업이나 활동을 위해 오가는 이동`,
      activityKind: "move",
      researchGoal: `${object} ${movementKind} 및 이동 경험 파악`,
      researchConstructs: [
        "방문 빈도",
        "이동 수단",
        "소요 시간",
        "혼잡",
        "안전",
        "불편",
        "개선 수요",
      ],
      surveyArchetype: "mobility_experience",
      isUsageObject: false,
      includesNonUsers: false,
      purposeKinds: ["behavior_usage", "need_demand"],
    };
  }

  const objectAudienceUsage = normalizedInput.match(
    new RegExp(
      `^(.+?)(?:의)\\s+(.*?${relationalAudienceHead})(?:들)?(?:의)\\s+((?:이용|사용|방문)\\s*(?:현황|경험)(?:\\s*(?:과|와|및)\\s*(?:현황|경험))?)$`,
    ),
  );
  if (objectAudienceUsage) {
    const object = stripRelationalEntityDescriptor(objectAudienceUsage[1]);
    const statedAudience = normalize(objectAudienceUsage[2]);
    const entityType = inferRelationalEntityType(object, objectAudienceUsage[3]);
    const resolvedEntityType = entityType === "unknown" ? "service" : entityType;
    return {
      audience: statedAudience,
      audienceEvidence: normalize(
        `${objectAudienceUsage[1]}의 ${objectAudienceUsage[2]}의 ${objectAudienceUsage[3]}`,
      ),
      primaryEntity: canonicalEntity(
        object,
        resolvedEntityType,
        "primary_entity",
        [objectAudienceUsage[0], objectAudienceUsage[3]],
      ),
      entityType: resolvedEntityType,
      objectKind:
        resolvedEntityType === "facility" || resolvedEntityType === "university_building"
          ? "place_facility"
          : "service_product",
      activity: `${object} 이용`,
      activityKind: "use",
      researchGoal: `${object} 이용 현황과 경험 파악`,
      researchConstructs: ["이용 여부", "이용 빈도", "이용 행태", "만족도", "불편"],
      surveyArchetype:
        resolvedEntityType === "platform"
          ? "platform_usage"
          : resolvedEntityType === "product"
            ? "product_usage"
            : resolvedEntityType === "facility" || resolvedEntityType === "university_building"
              ? "facility_usage"
              : "service_usage",
      isUsageObject: true,
      includesNonUsers: true,
      purposeKinds: ["usage_experience"],
    };
  }

  const audienceObjectUsage = normalizedInput.match(
    new RegExp(
      `^(.*?${relationalAudienceHead})(?:들)?(?:의)\\s+(.+?)\\s+(이용|사용|방문)\\s*(경험|현황)(?:\\s*(?:과|와|및)\\s+(.+))?$`,
    ),
  );
  if (audienceObjectUsage) {
    const statedAudience = normalize(audienceObjectUsage[1]);
    const audienceInstitution = statedAudience.match(
      /^(.+?(?:대학교?|학교))\s+/,
    )?.[1];
    const statedObject = normalize(audienceObjectUsage[2]);
    const object =
      audienceInstitution && /^교내\s+/.test(statedObject)
        ? `${audienceInstitution} ${statedObject}`
        : statedObject;
    const trailingConstruct = normalize(audienceObjectUsage[5] ?? "")
      .replace(/\s*(?:설문\s*)?조사$/u, "")
      .trim();
    const entityType = inferRelationalEntityType(object, audienceObjectUsage[3]);
    const resolvedEntityType = entityType === "unknown" ? "service" : entityType;
    const isPlace =
      resolvedEntityType === "facility" || resolvedEntityType === "university_building";
    const researchConstructs = [
      "이용 여부",
      "이용 빈도",
      "이용 목적",
      "만족도",
      "불편",
      ...(trailingConstruct ? [trailingConstruct] : []),
    ];
    return {
      audience: statedAudience,
      audienceEvidence: normalize(audienceObjectUsage[0]),
      primaryEntity: canonicalEntity(
        object,
        resolvedEntityType,
        "primary_entity",
        [audienceObjectUsage[0], audienceObjectUsage[3]],
      ),
      entityType: resolvedEntityType,
      objectKind: isPlace ? "place_facility" : "service_product",
      activity: `${object} 이용`,
      activityKind: "use",
      researchGoal: trailingConstruct
        ? `${object} 이용 경험과 ${trailingConstruct} 파악`
        : `${object} 이용 경험과 행태 파악`,
      researchConstructs: [...new Set(researchConstructs)],
      surveyArchetype: isPlace
        ? "facility_usage"
        : resolvedEntityType === "platform"
          ? "platform_usage"
          : resolvedEntityType === "product"
            ? "product_usage"
            : "service_usage",
      isUsageObject: true,
      includesNonUsers: true,
      purposeKinds: trailingConstruct
        ? ["usage_experience", "need_demand"]
        : ["usage_experience"],
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
      isUsageObject: containsUsage,
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

  return resolveAudiencePossessiveClause(normalizedInput);
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

function reconcileComparisonIntent(
  base: SurveyIntent,
  resolved: ResolvedComparisonClause,
  rawInput: string,
  normalizedInput: string,
): { intent: SurveyIntent; context: ParsedSurveyContext } {
  const targetTexts = resolved.targets.map((target) => target.text);
  const combinedTarget = targetTexts.join("·");
  const audienceEntity = intentEntity(
    canonicalEntity(
      resolved.audience,
      "construct",
      "audience",
      [resolved.audienceEvidence],
    ),
    "target_population",
  );
  const objectEntities = resolved.targets.map((target) =>
    intentEntity(
      target,
      target.kind === "service" ||
        target.kind === "platform" ||
        target.kind === "product"
        ? "product_or_service"
        : "concrete_object",
    ),
  );
  const constructEntities = resolved.researchConstructs.map((text) => ({
    id: stableId("construct", text),
    text,
    normalizedText: text,
    role: "construct" as const,
    source: "explicit" as const,
    confidence: 0.95,
  }));
  const hasSatisfaction = resolved.researchConstructs.some((item) =>
    /만족|평가|사용성/.test(item),
  );
  const purposeKind = hasSatisfaction
    ? ("satisfaction" as const)
    : ("usage_experience" as const);
  const researchGoal = `${combinedTarget}의 ${resolved.researchConstructs.join(", ")} 비교`;
  const firstPurpose = {
    id: stableId("study-purpose", researchGoal),
    text: researchGoal,
    normalizedText: researchGoal,
    role: "study_purpose" as const,
    source: "explicit" as const,
    confidence: 0.97,
  };
  const entityTypes = new Set(resolved.targets.map((target) => target.kind));
  const allTargetsSupportUsagePredicate = resolved.targets.every((target) =>
    ["service", "platform", "product", "facility", "place", "university_building"].includes(
      target.kind,
    ),
  );
  const contextEntityType =
    entityTypes.size === 1
      ? (resolved.targets[0].kind as SurveyContextEntityType)
      : "unknown";
  const context: ParsedSurveyContext = {
    rawUserInput: rawInput,
    normalizedInput,
    audience: resolved.audience,
    primaryEntity: combinedTarget,
    entityType: contextEntityType,
    activity: allTargetsSupportUsagePredicate ? `${combinedTarget} 이용` : null,
    researchGoal,
    researchConstructs: [...resolved.researchConstructs],
    surveyArchetype: hasSatisfaction ? "satisfaction" : "service_usage",
    isUsageObject: allTargetsSupportUsagePredicate,
  };

  return {
    context,
    intent: {
      ...base,
      studyTitle: base.studyTitle
        ? {
            ...base.studyTitle,
            text: `${combinedTarget} 비교 조사`,
            normalizedText: `${combinedTarget} 비교 조사`,
            source: "inferred",
          }
        : base.studyTitle,
      targetPopulation: resolved.audience,
      targetPopulationEntities: [audienceEntity],
      studyPurpose: firstPurpose,
      studyPurposes: [firstPurpose],
      purpose: researchGoal,
      purposeBlocks: [
        {
          id: "purpose-comparison-1",
          text: researchGoal,
          kind: purposeKind,
          target: combinedTarget,
          targetEntityIds: objectEntities.map((item) => item.id),
          constructEntityIds: constructEntities.map((item) => item.id),
          order: 1,
          relationToPrevious: null,
        },
      ],
      semanticContext: context,
      objectKind: hasSatisfaction
        ? "satisfaction_evaluation"
        : "behavior_usage",
      surveyObject: combinedTarget,
      legacyEvaluationTarget: combinedTarget,
      entities: [audienceEntity, ...objectEntities, ...constructEntities],
      objects: objectEntities,
      activities: [],
      constructs: [...resolved.researchConstructs],
      constructEntities,
      evaluationTargets: targetTexts,
      targetCardinality: "multiple",
      targetListSource: "explicit_in_prompt",
      unitOfAnalysis: "평가 대상별",
      measurementMode: "comparison",
      screeningRequired: false,
      screeningReason: null,
      eligibilityCondition: resolved.audience,
      includesNonUsers: false,
      ambiguityLevel: "low",
      requiresCreatorClarification: false,
      missingInformation: [],
      intentMode: "single",
    },
  };
}

function reconcileRelationalClauseIntent(
  base: SurveyIntent,
  resolved: ResolvedRelationalClause,
  rawInput: string,
  normalizedInput: string,
): { intent: SurveyIntent; context: ParsedSurveyContext } {
  const matchingBaseObject = base.objects.find(
    (item) => normalize(item.text) === normalize(resolved.primaryEntity.text),
  );
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
      : matchingBaseObject?.role ??
        (resolved.entityType === "construct"
          ? "construct"
          : "concrete_object"),
  );
  const contextEntity = resolved.contextEntity
    ? intentEntity(resolved.contextEntity, "context")
    : null;
  const eligibilityEntity = resolved.eligibilityCondition
    ? {
        id: stableId("eligibility", resolved.eligibilityCondition),
        text: resolved.eligibilityCondition,
        normalizedText: resolved.eligibilityCondition,
        role: "eligibility" as const,
        source: "explicit" as const,
        confidence: 0.98,
      }
    : base.eligibilityEntity;
  const timeframeEntity = resolved.explicitTimeframe
    ? {
        id: stableId("timeframe", resolved.explicitTimeframe),
        text: resolved.explicitTimeframe,
        normalizedText: resolved.explicitTimeframe,
        role: "timeframe" as const,
        source: "explicit" as const,
        confidence: 0.98,
      }
    : base.explicitTimeframeEntity;
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
  const retainedDecisionEntities = base.entities.filter((item) =>
    ["decision_option", "unmet_need", "context"].includes(item.role),
  );
  const retainedContexts = base.contexts.filter(
    (item) => normalize(item.text) !== normalize(contextEntity?.text ?? ""),
  );
  const purposeBlocks = resolved.purposeKinds.map((kind, index) => ({
    id: `purpose-${kind}-${index + 1}`,
    text: `${resolved.primaryEntity.text}의 ${
      resolved.researchConstructs[index] ?? resolved.researchConstructs[0] ?? "관련 경험"
    } 파악`,
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
  const canonicalStudyTitle = `${resolved.primaryEntity.text} ${resolved.researchConstructs
    .slice(0, 2)
    .join("·")} 조사`;
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
      studyTitle: base.studyTitle
        ? {
            ...base.studyTitle,
            text: canonicalStudyTitle,
            normalizedText: canonicalStudyTitle,
            source: "inferred",
          }
        : base.studyTitle,
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
        ...(contextEntity ? [contextEntity] : []),
        ...(activityEntity ? [activityEntity] : []),
        ...(eligibilityEntity ? [eligibilityEntity] : []),
        ...(timeframeEntity ? [timeframeEntity] : []),
        ...constructEntities,
        ...retainedDecisionEntities,
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
      contexts: [...(contextEntity ? [contextEntity] : []), ...retainedContexts],
      explicitTimeframe: resolved.explicitTimeframe ?? base.explicitTimeframe,
      explicitTimeframeEntity: timeframeEntity,
      screeningRequired: resolved.screeningRequired ?? base.screeningRequired,
      screeningReason: resolved.screeningReason ?? base.screeningReason,
      eligibilityCondition:
        resolved.eligibilityCondition ?? base.eligibilityCondition ?? resolved.audience,
      eligibilityEntity,
      includesNonUsers: resolved.includesNonUsers,
      ambiguityLevel: "low",
      requiresCreatorClarification: false,
      missingInformation: [],
      intentMode: "single",
    },
  };
}

export function parseCanonicalSurveyIntent(
  rawInput: string,
  studyType: SurveyIntentStudyType = "general",
): CanonicalSurveyIntent {
  const normalizedInput = normalizeSurveyRequest(rawInput);
  const bareRoleAmbiguity = isBareRoleAmbiguousRequest(normalizedInput);
  const initialContext = parseSurveyGenerationContextCore(rawInput);
  let surveyIntent = parseSurveyIntentFromCanonicalSource(rawInput, studyType, {
    semanticContext: initialContext,
  });
  let generationContext = initialContext;
  const satisfaction =
    resolveAcademicSatisfaction(normalizedInput) ??
    resolveUsageAudienceSatisfaction(normalizedInput);
  const comparisonClause = resolveComparisonClause(normalizedInput);
  const relationalClause = resolveRelationalClause(normalizedInput);
  const consumption = resolveConsumptionActivity(
    normalizedInput,
    initialContext.audience ?? surveyIntent.targetPopulation,
  );
  const preservesCompositeDecision =
    surveyIntent.intentMode === "composite" ||
    (surveyIntent.objectKind === "decision_support" &&
      /(?:이를\s*바탕으로|그\s*결과(?:를)?\s*(?:활용해|토대로)|이를\s*(?:통해|근거로)|분석\s*결과에\s*따라|조사(?:한|하고)\s*뒤|분석(?:한|하고)\s*뒤)/.test(
        normalizedInput,
      ));
  const preservesExplicitActivityObject = Boolean(
    relationalClause &&
      !relationalClause.eligibilityCondition &&
      surveyIntent.activities.some((activity) => activity.source === "explicit") &&
      surveyIntent.objects.some((object) => {
        if (!["survey_instrument", "study_method"].includes(object.role)) {
          return false;
        }
        const explicitObject = normalize(object.text);
        const relationalObject = normalize(relationalClause.primaryEntity.text);
        return (
          explicitObject !== relationalObject &&
          explicitObject.includes(relationalObject)
        );
      }),
  );

  if (!preservesCompositeDecision && comparisonClause) {
    const reconciled = reconcileComparisonIntent(
      surveyIntent,
      comparisonClause,
      rawInput,
      normalizedInput,
    );
    surveyIntent = reconciled.intent;
    generationContext = reconciled.context;
  } else if (
    !preservesCompositeDecision &&
    !preservesExplicitActivityObject &&
    relationalClause
  ) {
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

  if (
    /^(?:앱|어플|서비스|플랫폼|프로그램|제품|상품|시설|공간|수업|강의|행사)(?:\s*(?:설문|조사))?$/.test(
      normalizedInput,
    )
  ) {
    surveyIntent = {
      ...surveyIntent,
      ambiguityLevel: "high",
      requiresCreatorClarification: true,
      missingInformation: [
        "조사할 구체적인 대상과 확인하려는 내용을 알려주세요.",
      ],
    };
  }

  if (bareRoleAmbiguity) {
    surveyIntent = {
      ...surveyIntent,
      ambiguityLevel: "high",
      requiresCreatorClarification: true,
      missingInformation: [
        "누구에게 무엇을 물어볼지와 확인하려는 내용을 구분해 알려주세요.",
      ],
    };
  }

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
  const canonicalContexts = surveyIntent.contexts.map((item) =>
    canonicalEntity(
      item.text,
      inferRelationalEntityType(item.text),
      "context",
      [item.text],
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
    : bareRoleAmbiguity
      ? {
          level: "high",
          requiresClarification: true,
          code: "ENTITY_RESOLUTION_AMBIGUOUS",
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
      ...canonicalContexts,
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
