import {
  compactResearchIntentForPrompt,
  hasRelationalResearchIntent,
  parseSurveyResearchIntent,
  type SurveyResearchIntent,
} from "./survey-research-intent";
import {
  lintSurveyQuestionSemantics,
  normalizeSurveyRequest,
  parseSurveyGenerationContext,
  type ParsedSurveyContext,
} from "./survey-context";

export type SurveyIntentStudyType = "general" | "research";

export type SemanticRole =
  | "target_population"
  | "study_title"
  | "study_purpose"
  | "decision_goal"
  | "study_method"
  | "real_world_object"
  | "concrete_object"
  | "product_or_service"
  | "survey_instrument"
  | "activity"
  | "behavior"
  | "category_set"
  | "ability"
  | "construct"
  | "attitude"
  | "preference"
  | "pain_point"
  | "unmet_need"
  | "existing_context"
  | "existing_service"
  | "current_activity"
  | "proposed_solution"
  | "demand_target"
  | "decision_option"
  | "timeframe"
  | "eligibility"
  | "context";

export type SurveyActivityKind =
  | "create"
  | "distribute"
  | "participate"
  | "prepare"
  | "conduct"
  | "use"
  | "purchase"
  | "attend"
  | "move";

export type IntentEntity = {
  id: string;
  text: string;
  normalizedText: string;
  role: SemanticRole;
  source: "explicit" | "inferred";
  confidence: number;
  start?: number;
  end?: number;
  activityKind?: SurveyActivityKind;
};

export type IntentRelationType =
  | "performed_by"
  | "performed_on"
  | "measures"
  | "occurs_in"
  | "evidence_for"
  | "limited_to"
  | "includes"
  | "excludes";

export type IntentRelation = {
  type: IntentRelationType;
  fromEntityId: string;
  toEntityId: string;
  source: "explicit" | "inferred";
};

export type SurveyIntentObjectKind =
  | "service_product"
  | "place_facility"
  | "behavior_usage"
  | "ability_skill"
  | "attitude_perception"
  | "satisfaction_evaluation"
  | "need_demand"
  | "event_program"
  | "academic_construct"
  | "category_set"
  | "decision_support"
  | "composite";

export type SurveyIntentMode = "single" | "composite";

export type SurveyPurposeKind =
  | "usage_experience"
  | "satisfaction"
  | "need_demand"
  | "behavior_usage"
  | "attitude_perception"
  | "ability_skill"
  | "decision_support"
  | "relationship_analysis";

export type SurveyPurposeRelation =
  | "independent"
  | "precondition"
  | "evidence_for"
  | "problem_solution"
  | null;

export type SurveyPurposeSegment = {
  id: string;
  text: string;
  kind: SurveyPurposeKind;
  target: string;
  order: number;
  relationToPrevious: SurveyPurposeRelation;
};

export type SurveyPurposeBlock = SurveyPurposeSegment & {
  targetEntityIds: string[];
  constructEntityIds: string[];
};

export type TargetCardinality = "single" | "multiple";

export type TargetListSource =
  | "explicit_in_prompt"
  | "creator_required"
  | "respondent_supplied"
  | null;

export type MeasurementMode =
  | "single_evaluation"
  | "matrix_evaluation"
  | "repeated_evaluation"
  | "comparison"
  | "composite";

export type SurveyIntent = {
  intentMode: SurveyIntentMode;
  rawInput: string;
  entities: IntentEntity[];
  targetPopulation: string | null;
  targetPopulationEntities: IntentEntity[];
  studyTitle: IntentEntity | null;
  studyPurpose: IntentEntity | null;
  studyPurposes: IntentEntity[];
  purposeBlocks: SurveyPurposeBlock[];
  decisionGoals: IntentEntity[];
  surveyObject: string | null;
  /** Only populated for legacy single-purpose consumers. Composite intent must not use it. */
  legacyEvaluationTarget: string | null;
  objects: IntentEntity[];
  activities: IntentEntity[];
  constructs: string[];
  constructEntities: IntentEntity[];
  purpose: string | null;
  explicitTimeframe: string | null;
  explicitTimeframeEntity: IntentEntity | null;
  eligibilityCondition: string | null;
  eligibilityEntity: IntentEntity | null;
  evaluationTargets: string[];
  targetCardinality: TargetCardinality;
  targetListSource: TargetListSource;
  unitOfAnalysis: string;
  measurementMode: MeasurementMode;
  contexts: IntentEntity[];
  relations: IntentRelation[];
  screeningRequired: boolean;
  screeningReason: string | null;
  requiresCreatorClarification: boolean;
  missingInformation: string[];
  includesNonUsers: boolean;
  studyType: SurveyIntentStudyType;
  ambiguityLevel: "low" | "medium" | "high";
  objectKind: SurveyIntentObjectKind;
  semanticContext: ParsedSurveyContext;
  researchIntent: SurveyResearchIntent;
};

export type SurveyIntentViolationCode =
  | "SURVEY_PURPOSE_USED_AS_OBJECT"
  | "INVENTED_TIMEFRAME"
  | "INVALID_TARGET_ROLE"
  | "UNNECESSARY_SCREENING"
  | "NON_USERS_EXCLUDED"
  | "UNRELATED_SERVICE_EXPERIENCE"
  | "TARGET_PURPOSE_COMPOSITE_OBJECT"
  | "SEMANTIC_RELATION_INVALID"
  | "ABSTRACT_CATEGORY_TREATED_AS_PRODUCT"
  | "CATEGORY_SET_NOT_OPERATIONALIZED"
  | "GENERIC_TEMPLATE_ROLE_MISMATCH"
  | "INVALID_VERB_OBJECT_RELATION"
  | "DECISION_GOAL_DROPPED"
  | "UNMEASURABLE_QUESTION"
  | "MEASURABLE_VARIABLE_MISCLASSIFIED_AS_ABSTRACT"
  | "MULTI_VARIABLE_INTENT_FLATTENED"
  | "RELATION_NOT_EXTRACTED"
  | "DERIVED_METRIC_ASKED_DIRECTLY"
  | "GENERIC_CONCRETIZATION_FALLBACK_USED"
  | "VARIABLE_COVERAGE_MISSING"
  | "RELATION_COVERAGE_MISSING"
  | "ANALYSIS_GOAL_NOT_SUPPORTED"
  | "ANALYSIS_FEASIBILITY_UNSUPPORTED"
  | "DIRECT_RELATION_QUESTION_USED"
  | "INCOMPLETE_SURVEY_TITLE"
  | "GENERIC_DESCRIPTION_MISMATCH"
  | "COMPOSITE_PURPOSE_FLATTENED"
  | "STUDY_PURPOSE_USED_AS_EVALUATION_TARGET"
  | "MULTIPLE_TARGETS_STORED_AS_SINGLE_STRING"
  | "PURPOSE_BLOCK_DROPPED"
  | "PROPOSED_SOLUTION_NOT_SEPARATED"
  | "EXISTING_CONTEXT_NOT_MEASURED"
  | "GENERIC_NEEDS_TEMPLATE_ROLE_MISMATCH"
  | "LEGACY_BLUEPRINT_USED_FOR_COMPOSITE_INTENT"
  | "MALFORMED_TOPIC_PARTICLE"
  | "PREDICATE_ENTITY_MISMATCH"
  | "REQUEST_META_USED_AS_OBJECT";

export type ValidationSeverity = "fatal" | "repairable" | "warning";

export type SurveyIntentViolation = {
  code: SurveyIntentViolationCode;
  severity: ValidationSeverity;
  message: string;
  questionId?: string | number;
  evidence?: string;
  origin?: "question" | "plan" | "schema" | "relation_mapping";
};

export type SurveyIntentQuestionCandidate = {
  id?: string | number;
  title?: string;
  text?: string;
  role?: string;
  referencePeriod?: string | null;
  reference_period?: string | null;
  options?: Array<string | { label?: string }>;
  showIf?: unknown[];
  show_if?: unknown[];
  measuredConstruct?: string;
  measuredVariable?: string;
  measuredRole?: SemanticRole;
  planBlockId?: string;
  purposeBlockId?: string;
  measuredEntityIds?: string[];
  questionPurpose?: string;
  decisionGoalIds?: string[];
  subjectRole?: SemanticRole;
  objectRole?: SemanticRole;
  type?: string;
  reason?: string;
  analysis?: { purpose?: string } | null;
};

export type SurveyIntentCandidate = {
  title?: string;
  description?: string;
  eligibility?: string | null;
  questions: SurveyIntentQuestionCandidate[];
};

export function shouldEnforceSurveyIntentValidation(intent: SurveyIntent) {
  return intent.rawInput.trim().length > 0;
}

const normalize = (value: string) =>
  value
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?。]+$/g, "")
    .trim();

const normalizeRoleText = (value: string) =>
  normalize(value)
    .replace(/\s+/g, "")
    .replace(/의(?=[가-힣A-Za-z0-9])/g, "")
    .toLocaleLowerCase("ko-KR");

function semanticEntityId(role: SemanticRole, text: string) {
  const source = `${role}:${normalizeRoleText(text)}`;
  let hash = 2166136261;
  for (const character of source) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${role}-${(hash >>> 0).toString(36)}`;
}

function entity(
  text: string,
  role: SemanticRole,
  options: {
    source?: IntentEntity["source"];
    confidence?: number;
    activityKind?: SurveyActivityKind;
  } = {},
): IntentEntity {
  const normalizedText = normalize(text);
  return {
    id: semanticEntityId(role, normalizedText),
    text: normalizedText,
    normalizedText,
    role,
    source: options.source ?? "explicit",
    confidence: options.confidence ?? 0.9,
    ...(options.activityKind ? { activityKind: options.activityKind } : {}),
  };
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const surveyRequestEnding =
  /\s*(?:(?:설문\s*)?조사|설문|연구|효과\s*분석|영향\s*분석)\s*$/;

const purposeSuffix =
  /\s*(실태|만족도|인식|인지도|수요|이용\s*현황(?:과\s*경험)?|사용\s*현황(?:과\s*경험)?|이용\s*경험|사용\s*경험|경험|효과|영향)\s*$/;

const targetPrefix =
  /^(전\s*연령대(?:의\s*일반인)?|모든\s*연령대|일반인|학생(?:들)?|대학생(?:들)?|대학원생(?:들)?|직장인(?:들)?|청년(?:들)?|자취생(?:들)?|지역\s*주민(?:들)?|앱\s*이용자(?:들)?|고등학생(?:들)?|중학생(?:들)?|초등학생(?:들)?|학부모(?:들)?|교사(?:들)?|교직원(?:들)?|직원(?:들)?|소비자(?:들)?|사용자(?:들)?|이용자(?:들)?|(?:연세대|연세대학교)\s*(?:학부생|학생|재학생)(?:들)?|[가-힣A-Za-z0-9·-]+대(?:학교)?\s*(?:학부생|학생|재학생)(?:들)?|\d{1,2}대\s*(?:여성|남성)?)(?:들이|이|가|은|는|의|을|를)?\s*/;

const personTargetEnding =
  /(?:사람|일반인|학생|대학생|대학원생|직장인|청년|여성|남성|고객|이용자|사용자|소비자|직원|교직원|교사)(?:들)?$/;

function extractExplicitTimeframe(value: string) {
  const match = value.match(
    /(?:최근|지난)\s*(?:\d+\s*(?:일|주|개월|달|년)|한\s*(?:주|달|해)|일주일)(?:\s*(?:간|동안|이내|내))?|(?:이번|지난)\s*(?:학기|학년도)|가장\s*최근(?:의)?\s*(?:이용|사용|구매|방문|참여|경험)/,
  );
  return match?.[0].replace(/\s+/g, " ").trim() ?? null;
}

function stripTimeframe(value: string, timeframe: string | null) {
  if (!timeframe) return value;
  return value.replace(new RegExp(escapeRegExp(timeframe)), "").trim();
}

function extractTarget(value: string) {
  const multipleCourseAudience = value.match(
    /^((?:여러|복수의|각|현재\s*듣는)\s*(?:수업|과목|강의)(?:들)?)(?:에\s*대한)?\s+(.+?(?:대학생|학생)(?:들)?)의\s+(.+)$/,
  );
  if (multipleCourseAudience) {
    return {
      targetPopulation: multipleCourseAudience[2].replace(/들$/, "").trim(),
      remainder: `${multipleCourseAudience[1]}의 ${multipleCourseAudience[3]}`,
    };
  }

  const explicit = value.match(/^(.+?)\s*대상(?:으로|인)?\s+(.+)$/);
  if (explicit && personTargetEnding.test(explicit[1].trim())) {
    return {
      targetPopulation: explicit[1].trim(),
      remainder: explicit[2].trim(),
    };
  }

  const objectThenTarget = value.match(
    /^(.+?)의\s+(.+?(?:학생|대학생|대학원생|직장인|청년|고객|이용자|사용자|소비자|직원|교직원|교사)(?:들)?)의\s+(.+)$/,
  );
  if (
    objectThenTarget &&
    !/(?:시간|거리|빈도|비율|평균|분포|관계|영향|따른|만족도|수준|여부|형태)/.test(
      objectThenTarget[2],
    )
  ) {
    return {
      targetPopulation: objectThenTarget[2].replace(/들$/, "").trim(),
      remainder: `${objectThenTarget[1].trim()} ${objectThenTarget[3].trim()}`,
    };
  }

  const genitive = value.match(
    /^(.+?(?:학생|대학생|대학원생|직장인|청년|자취생|주민|학부모|고객|이용자|사용자|소비자|직원|교직원|교사)(?:들)?)의\s+(.+)$/,
  );
  if (genitive) {
    return {
      targetPopulation: genitive[1].replace(/들$/, "").trim(),
      remainder: genitive[2].trim(),
    };
  }

  const prefixed = value.match(targetPrefix);
  if (prefixed) {
    return {
      targetPopulation: prefixed[1].replace(/들$/, "").trim(),
      remainder: value.slice(prefixed[0].length).trim(),
    };
  }

  return { targetPopulation: null, remainder: value };
}

function normalizedObjectLabel(value: string) {
  return (
    value
      .replace(/배달앱/g, "배달 앱")
      .replace(/네이버\s*웹툰/g, "네이버 웹툰")
      .replace(/\s+/g, " ")
      .trim()
      // "동아리 활동 성과와 만족도 조사"에서 뒤쪽 차원("만족도 조사")만 떼면
      // 이어주던 접속조사가 남아 "동아리 활동 성과와에 얼마나 만족하시나요?"
      // 같은 문항이 나간다. 명사가 "와"나 "및"으로 끝나는 일은 거의 없으므로
      // 안전하게 뗄 수 있다. "과"는 학과·성과·효과처럼 명사의 일부인 경우가
      // 많고 표면형으로 접속조사와 구분되지 않아 건드리지 않는다.
      .replace(/\s*(?:와|및)$/, "")
      .trim()
  );
}

const activityMatchers: Array<{
  kind: SurveyActivityKind;
  canonical: string;
  pattern: RegExp;
}> = [
  {
    kind: "create",
    canonical: "제작",
    pattern: /(?:제작|만들|작성|구성)(?:하|해|했|하는|하고|할|해서|어|고)?/g,
  },
  {
    kind: "distribute",
    canonical: "배포",
    pattern: /(?:배포|공유|전달|응답자\s*모집)(?:하|해|했|하는|하고|할|해서|어|고)?/g,
  },
  {
    kind: "participate",
    canonical: "참여",
    pattern: /(?:참여|응답|작성해\s*제출|제출)(?:하|해|했|하는|하고|할|해서|어|고)?/g,
  },
  {
    kind: "prepare",
    canonical: "준비",
    pattern: /준비(?:하|해|했|하는|하고|할|해서|어|고)?/g,
  },
  {
    kind: "conduct",
    canonical: "수행",
    pattern: /(?:수행|진행|실시)(?:하|해|했|하는|하고|할|해서|어|고)?/g,
  },
  {
    kind: "use",
    canonical: "이용",
    pattern: /(?:이용|사용)(?:(?:하|해|했|하는|하고|할|해서|한)(?:\s*본|\s*적)?|해\s*본)/g,
  },
  {
    kind: "purchase",
    canonical: "구매",
    pattern: /(?:구매|먹어보|시식)(?:하|해|했|하는|하고|할|해서|고|ㄴ)?/g,
  },
  {
    kind: "attend",
    canonical: "수강",
    pattern: /(?:수강|참석|방문)(?:하|해|했|하는|하고|할|해서|어|고)?/g,
  },
];

function roleForObject(value: string): SemanticRole {
  if (/(?:설문|질문지|폼|questionnaire|form)(?:\s*(?:조사|도구|플랫폼))?$/i.test(value)) {
    return "survey_instrument";
  }
  if (/(?:사용자\s*조사|인터뷰|사용성\s*테스트|시험|테스트|실험)$/.test(value)) {
    return "study_method";
  }
  if (/(?:앱|어플|서비스|플랫폼|웹툰|제품|브랜드|도구)$/.test(value)) {
    return "product_or_service";
  }
  return "real_world_object";
}

function cleanActivityObject(value: string, previousObject: string | null) {
  let cleaned = normalize(value)
    .replace(/^.*?(?:위해|위한)\s+/, "")
    .replace(/^.*?(?:과정에서|상황에서)\s+/, "")
    .replace(/^(?:다른\s*사람이\s*만든)\s+/, "다른 사람이 만든 ")
    .replace(/(?:을|를|에)$/, "")
    .trim();
  if (
    !cleaned ||
    /(?:제작|만들|작성|구성|배포|공유|전달|참여|응답|준비|수행|진행)(?:하|해|했|하는|하고|할|해서|고)?$/.test(
      cleaned,
    )
  ) {
    return previousObject;
  }
  const trailingObject = cleaned.match(
    /((?:다른\s*사람이\s*만든\s+)?[가-힣A-Za-z0-9·-]+(?:\s+[가-힣A-Za-z0-9·-]+){0,4})$/,
  )?.[1];
  cleaned = trailingObject ?? cleaned;
  return normalizedObjectLabel(cleaned).slice(0, 80) || previousObject;
}

function extractActivityRelations(value: string) {
  const activities: IntentEntity[] = [];
  const objects: IntentEntity[] = [];
  let previousObject: string | null = null;

  for (const matcher of activityMatchers) {
    matcher.pattern.lastIndex = 0;
    for (const match of value.matchAll(matcher.pattern)) {
      const index = match.index ?? 0;
      const prefix = value.slice(Math.max(0, index - 90), index);
      const segment = prefix.split(/[,，]|(?:그리고|또는|및|와|과)\s+/).at(-1) ?? prefix;
      const objectText = cleanActivityObject(segment, previousObject);
      if (objectText) {
        previousObject = objectText;
        const objectRole = roleForObject(objectText);
        if (
          !objects.some(
            (item) =>
              normalizeRoleText(item.text) === normalizeRoleText(objectText),
          )
        ) {
          objects.push(entity(objectText, objectRole));
        }
        const activityText = `${objectText} ${matcher.canonical}`;
        if (
          !activities.some(
            (item) =>
              item.activityKind === matcher.kind &&
              normalizeRoleText(item.text) === normalizeRoleText(activityText),
          )
        ) {
          activities.push(
            entity(activityText, "activity", {
              activityKind: matcher.kind,
            }),
          );
        }
      }
    }
  }

  return { activities, objects };
}

function extractConstructEntities(value: string, activities: IntentEntity[]) {
  const result: IntentEntity[] = [];
  const add = (text: string) => {
    if (!result.some((item) => normalizeRoleText(item.text) === normalizeRoleText(text))) {
      result.push(entity(text, semanticRoleForVariable(text)));
    }
  };
  const activityLabel = activities.length > 0
    ? [...new Set(activities.map((item) => item.text))].join("·")
    : "관련 활동";
  if (/빈도|횟수/.test(value)) add(`${activityLabel} 빈도`);
  if (/불편/.test(value)) add(`${activityLabel} 과정의 불편`);
  if (/어려움/.test(value)) add(`${activityLabel} 과정의 어려움`);
  if (/만족도|만족/.test(value)) add("만족도");
  if (/인식|인지도|태도/.test(value)) add("인식과 태도");
  if (/자신감|자기효능감/.test(value)) add("자신감");
  if (/이해도/.test(value)) add("이해도");
  if (/사용\s*의도|이용\s*의향|향후\s*의향/.test(value)) add("향후 이용 의향");
  if (/중단\s*이유/.test(value)) add("중단 이유");
  if (/개선|요구|수요|필요/.test(value)) add("개선 요구");
  return result;
}

function purposeFor(value: string, kind: SurveyIntentObjectKind) {
  if (/실태/.test(value)) return "현재 수준과 실태 파악";
  if (/만족도/.test(value)) return "만족도 측정과 개선점 파악";
  if (/인식|인지도/.test(value)) return "인지와 인식 수준 파악";
  if (/수요/.test(value)) return "필요와 수요 파악";
  if (/효과/.test(value)) return "효과 파악";
  if (/영향/.test(value)) return "영향 관계 파악";
  if (/현황/.test(value)) return "현재 이용 현황과 경험 파악";
  if (kind === "ability_skill") return "현재 능력 수준과 교육 수요 파악";
  if (kind === "satisfaction_evaluation") return "만족도와 개선점 파악";
  if (kind === "attitude_perception") return "인식과 태도 파악";
  return "현재 경험과 의견 파악";
}

function purposeKindForObjectKind(kind: SurveyIntentObjectKind): SurveyPurposeKind {
  switch (kind) {
    case "behavior_usage":
      return "behavior_usage";
    case "satisfaction_evaluation":
      return "satisfaction";
    case "need_demand":
      return "need_demand";
    case "attitude_perception":
      return "attitude_perception";
    case "ability_skill":
      return "ability_skill";
    case "decision_support":
      return "decision_support";
    default:
      return "usage_experience";
  }
}

export function toLegacyIntentKind(kind: SurveyIntentObjectKind) {
  switch (kind) {
    case "composite":
      return null;
    case "need_demand":
      return "needs" as const;
    case "satisfaction_evaluation":
      return "satisfaction" as const;
    case "behavior_usage":
      return "usage" as const;
    case "event_program":
      return "event" as const;
    default:
      return "general" as const;
  }
}

function classifyIntent(value: string): SurveyIntentObjectKind {
  if (categorySetFromClause(value)) return "category_set";
  if (/(?:사용|활용)\s*능력|역량|숙련도|자기효능감|이해도|수행\s*능력/.test(value)) {
    return "ability_skill";
  }
  if (/만족도|전반적\s*평가|평가/.test(value)) {
    return "satisfaction_evaluation";
  }
  if (/인식|인지도|태도|우려|신뢰/.test(value)) {
    return "attitude_perception";
  }
  if (/수요|필요성|요구|교육\s*의향/.test(value)) return "need_demand";
  if (/행사|축제|프로그램|워크숍|세미나|공연/.test(value)) {
    return "event_program";
  }
  if (/시설|도서관|식당|카페|건물|기숙사|생활관|캠퍼스|공간/.test(value)) {
    return "place_facility";
  }
  if (/앱|어플|서비스|플랫폼|웹툰|제품|브랜드|도구/.test(value)) {
    return "service_product";
  }
  if (/이용|사용|구매|방문|참여|행태|빈도|현황|경험/.test(value)) {
    return "behavior_usage";
  }
  return "academic_construct";
}

function constructAndObject(value: string, kind: SurveyIntentObjectKind) {
  const withoutRequest = value.replace(surveyRequestEnding, "").trim();
  const suffix = withoutRequest.match(purposeSuffix)?.[1]?.replace(/\s+/g, " ") ?? null;
  let core = suffix
    ? withoutRequest.slice(0, withoutRequest.length - suffix.length).trim()
    : withoutRequest;

  const awarenessUsage = withoutRequest.match(
    /\s+(?:인지도|인지|인식)\s*(?:과|와|및)\s*(?:사용|이용)\s*(?:경험|현황|행태|실태|패턴|빈도)\s*$/,
  )?.[0];
  if (awarenessUsage) {
    const surveyObject = normalizedObjectLabel(
      withoutRequest
        .slice(0, -awarenessUsage.length)
        .replace(/^(?:교내|학교|캠퍼스)(?:에서)?\s+/, "")
        .trim(),
    );
    return {
      surveyObject,
      constructs: [
        `${surveyObject} 인식`,
        `${surveyObject} 이용 현황`,
      ],
    };
  }

  if (kind === "ability_skill") {
    const ability = core.match(/(.+?(?:(?:사용|활용)\s*능력|역량|숙련도|자기효능감|이해도|수행\s*능력))/)?.[1];
    const construct = normalizedObjectLabel(ability ?? core);
    const base = construct
      .replace(/\s*(?:(?:사용|활용)\s*능력|역량|숙련도|자기효능감|이해도|수행\s*능력)$/, "")
      .trim();
    const surveyObject = /(?:^|\s)(?:생성형\s*)?AI$/i.test(base)
      ? `${base.replace(/\s+/g, " ")} 도구 또는 AI 기반 서비스`
      : normalizedObjectLabel(base || construct);
    return { surveyObject, constructs: [construct] };
  }

  if (kind === "satisfaction_evaluation") {
    core = core.replace(/\s*(?:만족도|전반적\s*평가|평가)$/, "").trim();
    core = core
      .replace(
        /\s*(?:이용|사용|방문|참여|구매)\s*(?:경험|현황|행태)(?:과|와)\s*$/,
        "",
      )
      .trim();
    const surveyObject = normalizedObjectLabel(core);
    return {
      surveyObject,
      constructs: [`${surveyObject} 만족도`],
    };
  }

  if (kind === "attitude_perception") {
    core = core.replace(/\s*(?:인식|인지도|태도|우려|신뢰)$/, "").trim();
    const surveyObject = normalizedObjectLabel(core || withoutRequest);
    return {
      surveyObject,
      constructs: [`${surveyObject} 인식`],
    };
  }

  if (kind === "need_demand") {
    core = core.replace(/\s*(?:수요|필요성|요구)$/, "").trim();
    const surveyObject = normalizedObjectLabel(core || withoutRequest);
    return { surveyObject, constructs: [`${surveyObject} 수요`] };
  }

  const usageSuffix = core.match(
    /\s*(?:이용|사용|구매|방문|참여)\s*(?:현황(?:과\s*경험)?|경험|행태|실태|빈도)(?:(?:와|과|,)\s*(?:불편(?:\s*사항)?|어려움|문제점|개선\s*요구))?\s*$/,
  )?.[0];
  if (usageSuffix) core = core.slice(0, -usageSuffix.length).trim();
  const surveyObject = normalizedObjectLabel(core || withoutRequest);
  const usageConstruct = suffix || usageSuffix?.trim() || "관련 경험";
  return {
    surveyObject,
    constructs: [normalizedObjectLabel(`${surveyObject} ${usageConstruct}`)],
  };
}

const evidenceConnectorPattern =
  /(?:,?\s*)(이를\s*바탕으로|그\s*결과(?:를)?\s*(?:활용해|토대로)|이를\s*(?:통해|근거로)|분석\s*결과에\s*따라|조사한\s*뒤|분석한\s*뒤)(?:\s*)/;

function cleanIntentClause(value: string) {
  return normalize(value)
    .replace(
      /(?:에\s*대해|을|를)?\s*(?:조사|파악|분석|확인|알아보)(?:하고|한\s*뒤|해서|하여|해|하)?\s*$/,
      "",
    )
    .replace(/(?:에\s*대해|을|를)\s*$/, "")
    .trim();
}

function splitPurposeChain(value: string) {
  const match = evidenceConnectorPattern.exec(value);
  if (!match || match.index === undefined) {
    return {
      primaryClause: cleanIntentClause(value),
      decisionClause: null as string | null,
      connector: null as string | null,
    };
  }
  return {
    primaryClause: cleanIntentClause(value.slice(0, match.index)),
    decisionClause: cleanIntentClause(value.slice(match.index + match[0].length)),
    connector: match[1].replace(/\s+/g, " ").trim(),
  };
}

function purposeKindFromClause(value: string): SurveyPurposeKind | null {
  if (/만족도|전반적\s*평가/.test(value)) return "satisfaction";
  if (/수요|필요(?:성|한지|한가)?|요구|도입\s*(?:의향|여부)|이용\s*의향/.test(value)) {
    return "need_demand";
  }
  if (/(?:사용|이용|구매|방문|참여)\s*(?:경험|현황|실태)/.test(value)) {
    return "usage_experience";
  }
  if (/(?:사용|이용|구매|방문|참여)(?:\s|$)|불편|빈도|현황/.test(value)) {
    return "behavior_usage";
  }
  if (/인식|인지도|태도|신뢰|우려/.test(value)) return "attitude_perception";
  if (/능력|역량|숙련도|이해도/.test(value)) return "ability_skill";
  if (/관계|영향|따른|연관/.test(value)) return "relationship_analysis";
  return null;
}

function cleanPurposeTarget(value: string, kind: SurveyPurposeKind) {
  let target = normalize(value)
    .replace(/(?:을|를)?\s*(?:조사|파악|확인|분석)(?:하고|한\s*뒤|하여|해)?\s*$/g, "")
    .replace(/\s*(?:설문\s*)?조사\s*$/g, "")
    .trim();

  if (kind === "usage_experience" || kind === "behavior_usage") {
    target = target
      .replace(
        /\s*(?:의\s*)?(?:사용|이용|구매|방문|참여)\s*(?:경험|현황|실태|빈도)?\s*$/,
        "",
      )
      .replace(/\s*(?:의\s*)?(?:이용\s*)?불편(?:\s*사항)?\s*$/, "")
      .trim();
  } else if (kind === "satisfaction") {
    target = target.replace(/\s*(?:의\s*)?(?:이용\s*)?만족도\s*$/, "").trim();
  } else if (kind === "need_demand") {
    target = target
      .replace(/(?:이|가)?\s*(?:필요한지|필요한가|필요합니다|필요함)\s*$/, "")
      .replace(/\s*도입\s*의향\s*$/, "")
      .replace(/\s*도입(?:에\s*대한)?\s*(?:수요|필요성)\s*$/, "")
      .replace(/\s*(?:수요|필요성|요구)\s*$/, "")
      .replace(/\s*도입\s*$/, "")
      .replace(/\s*에\s*대한\s*$/, "")
      .trim();
  }

  return normalizedObjectLabel(target || value);
}

/**
 * 목적 표지가 양쪽에 독립적으로 있을 때만 복수 목적을 분리한다.
 * 따라서 "가격과 품질 만족도"처럼 하나의 만족도 목적 안에 있는 병렬 명사는
 * 분리되지 않는다.
 */
export function parsePurposeSegments(value: string): SurveyPurposeSegment[] {
  const normalized = normalize(value)
    .replace(
      /(?:을|를)?\s*(?:분석|조사|파악|확인|알아보)(?:(?:하|해)(?:고|서)?|고)?\s*싶(?:어|어요|습니다)\s*$/,
      "",
    )
    .trim();
  const connectorMatch = normalized.match(
    /^(.+?(?:(?:사용|이용|구매|방문|참여)\s*(?:경험|현황|실태|빈도)?|만족도|불편(?:\s*사항)?)(?:\s*조사)?)\s*(?:와|과|및)\s*(.+)$/,
  );
  const sequentialMatch = normalized.match(
    /^(.+?)\s*(?:을|를)?\s*(?:파악|확인|분석)하고\s+(.+)$/,
  );
  const match = connectorMatch ?? sequentialMatch;
  if (!match) return [];

  const clauses = [match[1], match[2]].map((item) => normalize(item));
  const kinds = clauses.map(purposeKindFromClause);
  if (!kinds[0] || !kinds[1] || kinds[0] === kinds[1]) return [];
  const firstKind = kinds[0];
  const secondKind = kinds[1];
  // "이용 경험과 불편 사항", "현황 및 만족도"는 하나의 현재 경험을
  // 여러 차원에서 보는 단일 목적이다. 별도 제안 대상의 수요·도입 의향이
  // 뒤따르는 경우에만 문제-해결형 복합 의도로 승격한다.
  if (secondKind !== "need_demand") return [];
  const proposedTarget = cleanPurposeTarget(clauses[1], secondKind);
  if (/^(?:불편(?:\s*사항)?|개선(?:\s*요구)?|필요(?:성)?|수요)$/.test(proposedTarget)) {
    return [];
  }
  const relation: SurveyPurposeRelation =
    secondKind === "need_demand" &&
    ["usage_experience", "behavior_usage", "satisfaction"].includes(firstKind)
      ? "problem_solution"
      : "independent";

  return clauses.map((clause, index) => ({
    id: `purpose-${index + 1}`,
    text: clause,
    kind: kinds[index] as SurveyPurposeKind,
    target:
      index === 1
        ? proposedTarget
        : cleanPurposeTarget(clause, kinds[index] as SurveyPurposeKind),
    order: index + 1,
    relationToPrevious: index === 0 ? null : relation,
  }));
}

function extractContextEntities(value: string) {
  const contexts: IntentEntity[] = [];
  const contextPattern =
    /([가-힣A-Za-z0-9·-]+(?:\s+[가-힣A-Za-z0-9·-]+){0,2}\s*(?:근처|주변|인근|지역|캠퍼스|학교\s*앞|대학가))/g;
  for (const match of value.matchAll(contextPattern)) {
    const label = normalize(match[1])
      .replace(
        /^(?:이를\s*바탕으로|그\s*결과(?:를)?\s*(?:활용해|토대로)|이를\s*(?:통해|근거로)|분석\s*결과에\s*따라)\s*/,
        "",
      )
      .trim();
    if (
      label &&
      !contexts.some(
        (item) => normalizeRoleText(item.text) === normalizeRoleText(label),
      )
    ) {
      contexts.push(entity(label, "context"));
    }
  }
  const namedPlacePattern = /([가-힣A-Za-z0-9·-]{2,20})(?:에|에서)\s+(?=(?:새로|어떤|필요한|부족한|원하는|구하기))/g;
  for (const match of value.matchAll(namedPlacePattern)) {
    const label = normalize(match[1]);
    if (
      label &&
      !/^(?:근처|주변|인근|지역|캠퍼스|학교|대학가)$/.test(label) &&
      !contexts.some(
        (item) =>
          normalizeRoleText(item.text) === normalizeRoleText(label) ||
          normalizeRoleText(item.text).includes(normalizeRoleText(label)),
      )
    ) {
      contexts.push(entity(label, "context"));
    }
  }
  return contexts;
}

function categorySetFromClause(value: string) {
  const normalized = normalize(value);
  const direct = normalized.match(
    /((?:주로\s*)?(?:어떤\s*)?(?:[가-힣A-Za-z0-9·-]+\s*){0,4}(?:품목|항목|분야|종류|유형|경로|목적|요인|선호\s*대상))(?=에|을|를|이|가|은|는|\s|$)/,
  )?.[1];
  const spending = normalized.match(
    /((?:돈|비용|예산)을\s*쓰는\s*분야|(?:구매|지출|소비)하는\s*(?:제품\s*)?종류)/,
  )?.[1];
  const label = normalizedObjectLabel(spending ?? direct ?? "")
    .replace(/^(?:(?:주로|어떤)\s+)+/, "")
    .trim();
  return label || null;
}

function decisionOptionFromClause(value: string | null) {
  if (!value) return null;
  const normalized = normalize(value);
  const what = normalized.match(
    /어떤\s+(.{1,40}?)(?:(?:을|를|이|가)\s*)?(?:개설|열|만들|생기|들어오|도입|마련|선정|결정|제공)/,
  )?.[1];
  const needed = normalized.match(
    /필요한\s+(.{1,40}?)(?:(?:을|를|이|가)\s*)?(?:조사|알아보|파악|분석|확인|선정|결정|$)/,
  )?.[1];
  const desired = normalized.match(
    /(?:새로\s*)?(?:생기길|들어오길)\s*원하는\s+(.{1,40}?)(?:(?:을|를)\s*)?(?:조사|알아보|파악|분석|확인|$)/,
  )?.[1];
  const lacking = normalized.match(
    /(?:필요한|부족한|선호하는)\s+(.{1,40}?)(?:(?:을|를|이|가)\s*)?(?:종류를?\s*)?(?:조사|알아보|파악|분석|확인|선정|결정|$)/,
  )?.[1];
  let label = normalize(what ?? needed ?? desired ?? lacking ?? "")
    .replace(/(?:하면\s*좋을지|좋을지|필요할지).*$/, "")
    .replace(/(?:을|를|이|가)$/, "")
    .trim();
  if (!label) return null;
  if (/^(?:매장|가게|점포|상점|시설|음식점|공간|서비스)$/.test(label)) {
    label = `${label} 종류`;
  }
  return label.slice(0, 80);
}

function semanticRoleForVariable(value: string): SemanticRole {
  if (categorySetFromClause(value)) return "category_set";
  if (/(?:사용|활용)?\s*(?:능력|역량|숙련도|자기효능감|이해도)/.test(value)) {
    return "ability";
  }
  if (/불편|어려움|문제|장벽/.test(value)) return "pain_point";
  if (/미충족|부족|구하기\s*어려/.test(value)) return "unmet_need";
  if (/선호|우선순위|의향/.test(value)) return "preference";
  if (/인식|태도|우려|기대|신뢰/.test(value)) return "attitude";
  if (/행동|빈도|패턴|습관|현황/.test(value)) return "behavior";
  return roleForObject(value);
}

function eligibilityFromTarget(target: string | null, surveyObject: string | null) {
  if (!target) return null;
  if (/(?:먹어본|시식한|구매한)\s*고객/.test(target)) {
    return `${surveyObject ?? "해당 대상"} 구매·시식 경험`;
  }
  if (/(?:이용|사용|참여|방문|수강)한\s*(?:사람|고객|이용자|사용자|참여자)/.test(target)) {
    return `${surveyObject ?? "해당 대상"} 실제 경험`;
  }
  return null;
}

function evaluationDesignFromPrompt(
  raw: string,
  primaryClause: string,
  surveyObject: string | null,
  objectKind: SurveyIntentObjectKind,
) {
  const designText = `${raw} ${primaryClause}`;
  const courseCue = /(?:수업|과목|강의)/.test(designText);
  const multipleCue =
    /(?:여러|복수의|각)\s*(?:수업|과목|강의)|(?:수업|과목|강의)들|수강\s*과목별|현재\s*듣는\s*(?:수업|과목|강의)/.test(
      designText,
    );
  const explicitListPrefix = courseCue
    ? raw.match(
        /^(.+?)\s+(?:수업|과목|강의)(?:들)?(?:에\s*대한|의|별)?\s*(?:만족도|평가|비교)/,
      )?.[1] ?? null
    : null;
  const explicitTargets = explicitListPrefix
    ? explicitListPrefix
        .split(/,\s*|\s+(?:및|와|과)\s+/)
        .map((item) =>
          item
            .replace(/^(?:여러|복수의|각|현재\s*듣는|수강한?)\s*/, "")
            .replace(/\s*(?:수업|과목|강의)$/, "")
            .trim(),
        )
        .filter((item) => item.length >= 2)
    : [];
  const dedupedTargets = [...new Set(explicitTargets)];
  const hasExplicitTargetList = dedupedTargets.length >= 2;
  const targetCardinality: TargetCardinality =
    hasExplicitTargetList || multipleCue ? "multiple" : "single";
  const isCourseEvaluation =
    courseCue && objectKind === "satisfaction_evaluation";
  const evaluationTargets = hasExplicitTargetList
    ? dedupedTargets.map((item) => `${item} 수업`)
    : targetCardinality === "single" && surveyObject
      ? [surveyObject]
      : [];
  const targetListSource: TargetListSource =
    targetCardinality === "multiple"
      ? hasExplicitTargetList
        ? "explicit_in_prompt"
        : "creator_required"
      : null;
  const measurementMode: MeasurementMode =
    targetCardinality === "multiple"
      ? /비교|차이|각각|과목별|수업별/.test(raw)
        ? "comparison"
        : hasExplicitTargetList
          ? "matrix_evaluation"
          : "repeated_evaluation"
      : "single_evaluation";
  const requiresCreatorClarification =
    isCourseEvaluation &&
    targetCardinality === "multiple" &&
    targetListSource === "creator_required";

  return {
    evaluationTargets,
    targetCardinality,
    targetListSource,
    unitOfAnalysis:
      isCourseEvaluation && targetCardinality === "multiple"
        ? "개별 수업"
        : surveyObject?.trim() || "개별 응답자",
    measurementMode,
    requiresCreatorClarification,
    missingInformation: requiresCreatorClarification
      ? ["평가할 수업 목록", "수업 선택 또는 반복 평가 방식"]
      : [],
  };
}

function compositePainPoint(existingTarget: string, proposedTarget: string) {
  const corpus = `${existingTarget} ${proposedTarget}`;
  if (/좌석|빈\s*자리|빈\s*좌석/.test(corpus)) {
    return `${existingTarget} 좌석 확인과 이용 과정의 불편`;
  }
  if (/주문/.test(corpus)) return `${existingTarget} 주문 과정의 불편`;
  if (/셔틀|통학/.test(corpus)) return "통학 과정의 불편";
  if (/예약/.test(corpus)) return `${existingTarget} 예약 과정의 불편`;
  if (/구독/.test(corpus)) return `${existingTarget} 비용과 이용 과정의 불편`;
  return `${existingTarget} 이용 과정의 불편`;
}

function buildCompositeSurveyIntent(options: {
  raw: string;
  requestStripped: string;
  targetPopulation: string | null;
  explicitTimeframe: string | null;
  segments: SurveyPurposeSegment[];
  studyType: SurveyIntentStudyType;
  researchIntent: SurveyResearchIntent;
  semanticContext: ParsedSurveyContext;
}): SurveyIntent {
  const first = options.segments[0];
  const second = options.segments[1];
  const existingTarget = first.target;
  const proposedTarget = second.target;
  const targetPopulationEntity = options.targetPopulation
    ? entity(options.targetPopulation, "target_population")
    : null;
  const existingEntity = entity(
    existingTarget,
    /시설|도서관|식당|카페|건물|기숙사|생활관|캠퍼스|공간/.test(existingTarget)
      ? "existing_context"
      : "existing_service",
  );
  const activityEntity = entity(`${existingTarget} 이용`, "current_activity", {
    source: "inferred",
    confidence: 0.94,
    activityKind: "use",
  });
  const painEntity = entity(
    compositePainPoint(existingTarget, proposedTarget),
    "pain_point",
    { source: "inferred", confidence: 0.86 },
  );
  const proposedEntity = entity(proposedTarget, "proposed_solution");
  const demandEntity = entity(`${proposedTarget} 수요`, "demand_target", {
    source: "explicit",
    confidence: 0.96,
  });
  const firstPurposeText =
    first.kind === "satisfaction"
      ? `${existingTarget} 만족도와 불편 파악`
      : `${existingTarget} 이용 경험과 불편 파악`;
  const secondPurposeText = `${proposedTarget} 필요와 도입 의향 파악`;
  const firstPurpose = entity(firstPurposeText, "study_purpose");
  const secondPurpose = entity(secondPurposeText, "study_purpose");
  const purposeBlocks: SurveyPurposeBlock[] = [
    {
      ...first,
      targetEntityIds: [existingEntity.id],
      constructEntityIds: [activityEntity.id, painEntity.id],
    },
    {
      ...second,
      targetEntityIds: [proposedEntity.id],
      constructEntityIds: [demandEntity.id],
    },
  ];
  const contexts = extractContextEntities(existingTarget);
  const timeframeEntity = options.explicitTimeframe
    ? entity(options.explicitTimeframe, "timeframe")
    : null;
  const studyTitle = entity(
    `${existingTarget} 이용 경험 및 ${proposedTarget} 수요 조사`,
    "study_title",
    { source: "inferred", confidence: 0.92 },
  );
  const relations: IntentRelation[] = [
    {
      type: "performed_on",
      fromEntityId: activityEntity.id,
      toEntityId: existingEntity.id,
      source: "explicit",
    },
    {
      type: "measures",
      fromEntityId: firstPurpose.id,
      toEntityId: activityEntity.id,
      source: "explicit",
    },
    {
      type: "measures",
      fromEntityId: firstPurpose.id,
      toEntityId: painEntity.id,
      source: "inferred",
    },
    {
      type: "measures",
      fromEntityId: secondPurpose.id,
      toEntityId: demandEntity.id,
      source: "explicit",
    },
    {
      type: "evidence_for",
      fromEntityId: firstPurpose.id,
      toEntityId: secondPurpose.id,
      source: "inferred",
    },
  ];
  if (targetPopulationEntity) {
    relations.push({
      type: "performed_by",
      fromEntityId: activityEntity.id,
      toEntityId: targetPopulationEntity.id,
      source: "explicit",
    });
  }
  if (contexts[0]) {
    relations.push({
      type: "occurs_in",
      fromEntityId: activityEntity.id,
      toEntityId: contexts[0].id,
      source: "explicit",
    });
  }
  const entities = [
    ...(targetPopulationEntity ? [targetPopulationEntity] : []),
    studyTitle,
    firstPurpose,
    secondPurpose,
    existingEntity,
    activityEntity,
    painEntity,
    proposedEntity,
    demandEntity,
    ...contexts,
    ...(timeframeEntity ? [timeframeEntity] : []),
  ].filter(
    (item, index, items) => items.findIndex((other) => other.id === item.id) === index,
  );

  return {
    intentMode: "composite",
    rawInput: options.raw,
    entities,
    targetPopulation: options.targetPopulation,
    targetPopulationEntities: targetPopulationEntity ? [targetPopulationEntity] : [],
    studyTitle,
    studyPurpose: firstPurpose,
    studyPurposes: [firstPurpose, secondPurpose],
    purposeBlocks,
    decisionGoals: [],
    surveyObject: null,
    legacyEvaluationTarget: null,
    objects: [existingEntity, proposedEntity],
    activities: [activityEntity],
    constructs: [activityEntity.text, painEntity.text, demandEntity.text],
    constructEntities: [activityEntity, painEntity, demandEntity],
    purpose: `${firstPurpose.text} → ${secondPurpose.text}`,
    explicitTimeframe: options.explicitTimeframe,
    explicitTimeframeEntity: timeframeEntity,
    eligibilityCondition: null,
    eligibilityEntity: null,
    evaluationTargets: [existingTarget, proposedTarget],
    targetCardinality: "multiple",
    targetListSource: "explicit_in_prompt",
    unitOfAnalysis: "개별 응답자",
    measurementMode: "composite",
    contexts,
    relations,
    screeningRequired: false,
    screeningReason: null,
    requiresCreatorClarification: false,
    missingInformation: [],
    includesNonUsers: true,
    studyType: options.studyType,
    ambiguityLevel: "low",
    objectKind: "composite",
    semanticContext: options.semanticContext,
    researchIntent: options.researchIntent,
  };
}

export function parseSurveyIntent(
  rawInput: string,
  studyType: SurveyIntentStudyType = "general",
): SurveyIntent {
  const raw = normalize(rawInput);
  const semanticContext = parseSurveyGenerationContext(rawInput);
  const requestStripped = normalizeSurveyRequest(raw)
    .replace(
      /(?:을|를)?\s*(?:분석|조사|파악|확인|알아보)(?:하라|해\s*(?:줘|주세요|봐|보세요)|해주세요|해줘|해봐|해보세요)\s*$/,
      "",
    )
    .trim();
  const explicitTimeframe = extractExplicitTimeframe(raw);
  let working = stripTimeframe(requestStripped, explicitTimeframe)
    .replace(
      /^.+?(?:를|을)\s*(?:(?:한\s*번도\s*)?(?:사용|이용)하지\s*않은|(?:사용|이용)해\s*본\s*적이\s*없는)\s*사람까지\s*포함한\s*/i,
      "",
    )
    .trim();
  const target = extractTarget(working);
  working = target.remainder;
  const researchIntent = parseSurveyResearchIntent(raw, {
    targetPopulation: target.targetPopulation,
    explicitTimeframe,
  });
  const purposeSegments = parsePurposeSegments(working);
  if (purposeSegments.length >= 2) {
    return buildCompositeSurveyIntent({
      raw,
      requestStripped,
      targetPopulation: target.targetPopulation,
      explicitTimeframe,
      segments: purposeSegments,
      studyType,
      researchIntent,
      semanticContext,
    });
  }
  const purposeChain = splitPurposeChain(working);
  const primaryClause = purposeChain.primaryClause || working;
  const contexts = extractContextEntities(
    purposeChain.decisionClause ?? primaryClause,
  );
  const categorySet = categorySetFromClause(primaryClause);
  const decisionOption = decisionOptionFromClause(
    purposeChain.decisionClause ??
      (/원하는|필요한|부족한|개설|들어오|생기/.test(primaryClause)
        ? primaryClause
        : null),
  );
  const activityRelations = extractActivityRelations(primaryClause);
  let kind =
    semanticContext.surveyArchetype === "mobility_experience"
      ? "behavior_usage"
      : classifyIntent(primaryClause);
  if (decisionOption) kind = "decision_support";
  else if (categorySet) kind = "category_set";
  if (
    activityRelations.activities.length > 0 &&
    ![
      "ability_skill",
      "attitude_perception",
      "satisfaction_evaluation",
      "need_demand",
      "category_set",
      "decision_support",
    ].includes(
      kind,
    )
  ) {
    kind = "behavior_usage";
  }
  const inferredActivityLabel =
    activityRelations.activities.length === 0
      ? primaryClause.match(
          /^(.{1,60}?)(?:\s*(?:빈도|횟수|패턴|현황|습관|과정에서))/,
        )?.[1]?.trim() ?? null
      : null;
  let activities = inferredActivityLabel
    ? [
        entity(inferredActivityLabel, "activity", {
          source: "inferred",
          confidence: 0.8,
          activityKind: /구매|소비|지출/.test(inferredActivityLabel)
            ? "purchase"
            : "use",
        }),
      ]
      : activityRelations.activities;
  const parts = constructAndObject(primaryClause, kind);
  if (semanticContext.surveyArchetype === "mobility_experience") {
    parts.surveyObject = semanticContext.primaryEntity;
    parts.constructs = semanticContext.researchConstructs;
    activities = semanticContext.activity
      ? [
          entity(semanticContext.activity, "activity", {
            source: "explicit",
            confidence: 0.98,
            activityKind: "move",
          }),
        ]
      : [];
  }
  if (kind === "satisfaction_evaluation" && parts.surveyObject) {
    parts.surveyObject = parts.surveyObject.replace(/\s*의$/, "").trim();
  }
  if (categorySet) {
    parts.surveyObject = categorySet;
    parts.constructs = [categorySet];
  } else if (decisionOption && !purposeChain.decisionClause) {
    parts.surveyObject = decisionOption;
    parts.constructs = [decisionOption];
  }
  const relationConstructs = extractConstructEntities(
    primaryClause,
    activities,
  );
  if (activityRelations.objects.length > 0 && !categorySet) {
    parts.surveyObject = activityRelations.objects[0].text;
  }
  if (relationConstructs.length > 0) {
    parts.constructs = relationConstructs.map((item) => item.text);
  }
  if (!parts.surveyObject && target.targetPopulation) {
    const qualifiedObject = target.targetPopulation.match(
      /^(.+?)(?:을|를)\s*(?:먹어본|시식한|구매한|이용한|사용한|방문한|참여한)\s*(?:사람|고객|이용자|사용자|참여자)/,
    )?.[1];
    if (qualifiedObject) {
      parts.surveyObject = normalizedObjectLabel(qualifiedObject);
      parts.constructs =
        kind === "satisfaction_evaluation"
          ? [`${parts.surveyObject} 만족도`]
          : [`${parts.surveyObject} 경험`];
    }
  }
  const eligibilityCondition = eligibilityFromTarget(
    target.targetPopulation,
    parts.surveyObject,
  );
  const evaluationDesign = evaluationDesignFromPrompt(
    raw,
    primaryClause,
    parts.surveyObject,
    kind,
  );
  const explicitlyIncludesNonUsers =
    /(?:비이용자|비사용자|사용해\s*본\s*적이\s*없는|이용해\s*본\s*적이\s*없는).*(?:포함|까지)|(?:전\s*연령대|모든\s*연령대|일반인)/.test(
      raw,
    );
  const includesNonUsers =
    !eligibilityCondition &&
    (explicitlyIncludesNonUsers ||
      kind === "ability_skill" ||
      kind === "attitude_perception" ||
      activities.length > 0 ||
      /실태|현황/.test(raw));
  const explicitPeriodExperienceScreening = Boolean(
    explicitTimeframe &&
      evaluationDesign.targetCardinality === "single" &&
      /(?:이용|사용|구매|방문|참여|시식|먹어본)\s*(?:경험|현황|실태)/.test(
        raw,
      ),
  );
  const screeningRequired = Boolean(
    eligibilityCondition || explicitPeriodExperienceScreening,
  );
  const screeningReason = eligibilityCondition
    ? `응답 대상이 ‘${eligibilityCondition}’ 조건으로 명시됨.`
    : explicitPeriodExperienceScreening
      ? `사용자가 지정한 ‘${explicitTimeframe}’ 기간의 실제 경험 여부가 필요함.`
      : null;
  const ambiguityLevel: SurveyIntent["ambiguityLevel"] = !parts.surveyObject
    ? "high"
    : target.targetPopulation || activities.length > 0 || kind !== "academic_construct"
      ? "low"
      : "medium";

  const targetEntity = target.targetPopulation
    ? entity(target.targetPopulation, "target_population")
    : null;
  const explicitObjectEntities = activityRelations.objects.length > 0
    ? activityRelations.objects
    : parts.surveyObject
      ? [
          entity(
            parts.surveyObject,
            categorySet
              ? "category_set"
              : decisionOption && !categorySet && !purposeChain.decisionClause
                ? "decision_option"
                : roleForObject(parts.surveyObject),
          ),
        ]
      : [];
  let constructEntities = relationConstructs.length > 0
    ? relationConstructs
    : parts.constructs
        .filter(Boolean)
        .map((item) => entity(item, semanticRoleForVariable(item)));
  const contextLabel = contexts[0]?.text ?? null;
  const decisionOptionEntity = decisionOption
    ? entity(decisionOption, "decision_option")
    : null;
  const behaviorEntity = categorySet
    ? entity(
        /소비|구매|지출|돈을\s*쓰/.test(primaryClause)
          ? "구매 및 지출 행동"
          : `${categorySet} 선택 행동`,
        "behavior",
        { source: "inferred", confidence: 0.86 },
      )
    : null;
  const unmetNeedEntity = decisionOption
    ? entity(
        `${contextLabel ? `${contextLabel}에서 ` : ""}충족되지 않는 ${
          /소비|구매|지출|돈을\s*쓰/.test(primaryClause)
            ? "소비"
            : parts.surveyObject ?? "현재"
        } 수요`,
        "unmet_need",
        { source: "inferred", confidence: 0.82 },
      )
    : null;
  constructEntities = [
    ...constructEntities,
    ...(behaviorEntity ? [behaviorEntity] : []),
    ...(unmetNeedEntity ? [unmetNeedEntity] : []),
    ...(decisionOptionEntity ? [decisionOptionEntity] : []),
  ].filter(
    (item, index, items) => items.findIndex((other) => other.id === item.id) === index,
  );

  const primaryPurposeText = categorySet
    ? /소비|구매|지출|돈을\s*쓰/.test(primaryClause)
      ? `${target.targetPopulation ?? "응답자"}의 소비 및 지출 현황 파악`
      : `${categorySet}별 현황 파악`
    : purposeFor(primaryClause, kind);
  const primaryStudyPurpose = entity(primaryPurposeText, "study_purpose", {
    source: /실태|만족도|인식|인지도|수요|효과|영향|현황|불편|어려움|빈도/.test(
      raw,
    )
      ? "explicit"
      : "inferred",
    confidence: constructEntities.length > 0 ? 0.94 : 0.7,
  });
  const decisionPurpose = decisionOption
    ? entity(
        `${contextLabel ? `${contextLabel}에 ` : ""}필요한 ${decisionOption} 파악`,
        "study_purpose",
        { source: "explicit", confidence: 0.95 },
      )
    : null;
  const studyPurposes = [
    primaryStudyPurpose,
    ...(decisionPurpose ? [decisionPurpose] : []),
  ];
  const decisionGoal = decisionOption
    ? entity(
        `${contextLabel ? `${contextLabel}에 ` : ""}개설·도입할 ${decisionOption} 결정`,
        "decision_goal",
        { source: "explicit", confidence: 0.96 },
      )
    : null;
  const decisionGoals = decisionGoal ? [decisionGoal] : [];
  const purpose = studyPurposes.map((item) => item.text).join(" → ");
  const studyPurpose = primaryStudyPurpose;
  const explicitStudyTitle = /(?:설문\s*)?조사$|연구$/.test(requestStripped);
  const conciseTitleParts = [
    target.targetPopulation,
    parts.surveyObject,
    decisionOption,
  ].filter((item): item is string => Boolean(item));
  const inferredStudyTitle = [...new Set(conciseTitleParts)].join(" ").trim();
  const studyTitle = entity(
    explicitStudyTitle
      ? requestStripped
      : `${inferredStudyTitle || working || raw} 조사`,
    "study_title",
    {
      source: explicitStudyTitle ? "explicit" : "inferred",
      confidence: explicitStudyTitle ? 0.98 : 0.72,
    },
  );
  const timeframeEntity = explicitTimeframe
    ? entity(explicitTimeframe, "timeframe")
    : null;
  const eligibilityEntity = eligibilityCondition
    ? entity(eligibilityCondition, "eligibility")
    : null;
  const semanticRelations: IntentRelation[] = [];
  for (const activity of activities) {
    if (targetEntity) {
      semanticRelations.push({
        type: "performed_by",
        fromEntityId: activity.id,
        toEntityId: targetEntity.id,
        source: "explicit",
      });
    }
    const activityObject = explicitObjectEntities[0];
    if (activityObject) {
      semanticRelations.push({
        type: "performed_on",
        fromEntityId: activity.id,
        toEntityId: activityObject.id,
        source: "explicit",
      });
    }
  }
  for (const variable of constructEntities) {
    semanticRelations.push({
      type: "measures",
      fromEntityId: primaryStudyPurpose.id,
      toEntityId: variable.id,
      source: variable.source,
    });
  }
  if (decisionGoal) {
    semanticRelations.push({
      type: "evidence_for",
      fromEntityId: primaryStudyPurpose.id,
      toEntityId: decisionGoal.id,
      source: purposeChain.connector ? "explicit" : "inferred",
    });
    if (decisionPurpose) {
      semanticRelations.push({
        type: "evidence_for",
        fromEntityId: decisionPurpose.id,
        toEntityId: decisionGoal.id,
        source: "explicit",
      });
    }
  }
  if (contexts[0] && (behaviorEntity || explicitObjectEntities[0])) {
    semanticRelations.push({
      type: "occurs_in",
      fromEntityId: (behaviorEntity ?? explicitObjectEntities[0]).id,
      toEntityId: contexts[0].id,
      source: "explicit",
    });
  }
  const entities = [
    ...(targetEntity ? [targetEntity] : []),
    studyTitle,
    ...studyPurposes,
    ...decisionGoals,
    ...explicitObjectEntities,
    ...activities,
    ...constructEntities,
    ...contexts,
    ...(timeframeEntity ? [timeframeEntity] : []),
    ...(eligibilityEntity ? [eligibilityEntity] : []),
  ].filter(
    (item, index, items) => items.findIndex((other) => other.id === item.id) === index,
  );

  return {
    intentMode: "single",
    rawInput: raw,
    entities,
    targetPopulation: target.targetPopulation,
    targetPopulationEntities: targetEntity ? [targetEntity] : [],
    studyTitle,
    studyPurpose,
    studyPurposes,
    purposeBlocks: [
      {
        id: "purpose-1",
        text: primaryPurposeText,
        kind: purposeKindForObjectKind(kind),
        target: parts.surveyObject ?? primaryClause,
        targetEntityIds: explicitObjectEntities.map((item) => item.id),
        constructEntityIds: constructEntities.map((item) => item.id),
        order: 1,
        relationToPrevious: null,
      },
    ],
    decisionGoals,
    surveyObject: parts.surveyObject || null,
    legacyEvaluationTarget: parts.surveyObject || null,
    objects: explicitObjectEntities,
    activities,
    constructs: constructEntities.map((item) => item.text),
    constructEntities,
    purpose,
    explicitTimeframe,
    explicitTimeframeEntity: timeframeEntity,
    eligibilityCondition,
    eligibilityEntity,
    ...evaluationDesign,
    contexts,
    relations: semanticRelations,
    screeningRequired,
    screeningReason,
    includesNonUsers,
    studyType,
    ambiguityLevel,
    objectKind: kind,
    semanticContext,
    researchIntent,
  };
}

function candidateQuestionText(question: SurveyIntentQuestionCandidate) {
  return (question.title ?? question.text ?? "").trim();
}

function optionLabels(question: SurveyIntentQuestionCandidate) {
  return (question.options ?? []).flatMap((option) => {
    if (typeof option === "string") return [option];
    return typeof option.label === "string" ? [option.label] : [];
  });
}

function pushViolation(
  violations: SurveyIntentViolation[],
  violation: SurveyIntentViolation,
) {
  if (
    violations.some(
      (item) =>
        item.code === violation.code && item.questionId === violation.questionId,
    )
  ) {
    return;
  }
  violations.push(violation);
}

export function validateSurveyIntentCandidate(
  intent: SurveyIntent,
  candidate: SurveyIntentCandidate,
) {
  const violations: SurveyIntentViolation[] = [];
  const researchIntent = intent.researchIntent;
  const relationalIntent = hasRelationalResearchIntent(researchIntent);
  const inventedTimeframe =
    /(?:최근|지난)\s*(?:\d+\s*(?:일|주|개월|달|년)|한\s*(?:주|달|해)|일주일)|(?:이번|지난)\s*(?:학기|학년도)/;
  const firstQuestion = candidate.questions[0];
  const actionAfterEntity =
    /^(?:을|를|에)?(?:직접)?(?:이용|사용|구매|먹|시식|참여|방문|경험|수강|제작|배포|공유|수행|진행)/;
  const entityTextUsedAsActionObject = (text: string, entityText: string) => {
    if (!entityText) return false;
    const corpus = normalizeRoleText(text);
    const needle = normalizeRoleText(entityText);
    const index = corpus.indexOf(needle);
    if (index < 0) return false;
    return actionAfterEntity.test(corpus.slice(index + needle.length));
  };
  const studyTitleAliases = intent.studyTitle?.text
    ? [
        intent.studyTitle.text,
        intent.targetPopulation
          ? intent.studyTitle.text.replace(
              new RegExp(
                `^${escapeRegExp(intent.targetPopulation)}(?:들)?(?:의)?\\s*`,
              ),
              "",
            )
          : "",
        intent.explicitTimeframe
          ? intent.studyTitle.text.replace(
              new RegExp(`^${escapeRegExp(intent.explicitTimeframe)}\\s*`),
              "",
            )
          : "",
      ].filter((item, index, items) => item && items.indexOf(item) === index)
    : [];
  const studyTitleUsedAsActionObject = (text: string) =>
    studyTitleAliases.some((title) =>
      entityTextUsedAsActionObject(text, title),
    );
  const semanticallySameObject = (candidate: IntentEntity) =>
    intent.objects.some((allowed) => {
      const allowedText = normalizeRoleText(allowed.text);
      const candidateText = normalizeRoleText(candidate.text);
      if (
        allowedText === candidateText ||
        allowedText.includes(candidateText) ||
        candidateText.includes(allowedText)
      ) {
        return true;
      }
      if (allowed.role !== candidate.role) return false;
      const tokens = (value: string) =>
        new Set(
          normalize(value)
            .replace(/또는|혹은|및|와|과/g, " ")
            .split(/\s+/)
            .map((item) => normalizeRoleText(item))
            .filter((item) => item.length >= 2),
        );
      const allowedTokens = tokens(allowed.text);
      const candidateTokens = tokens(candidate.text);
      if (allowedTokens.size === 0 || candidateTokens.size === 0) return false;
      const overlap = [...candidateTokens].filter((item) =>
        allowedTokens.has(item),
      ).length;
      return overlap / Math.min(allowedTokens.size, candidateTokens.size) >= 0.6;
    });
  const hasConcreteActionObject = intent.objects.some((item) =>
    ["product_or_service", "survey_instrument", "study_method"].includes(
      item.role,
    ),
  );
  const categoryEntities = intent.entities.filter(
    (item) => item.role === "category_set",
  );
  const decisionOptionEntities = intent.entities.filter(
    (item) => item.role === "decision_option",
  );
  const contextEntities = intent.contexts;
  let categoryOperationalized = categoryEntities.length === 0;
  let decisionGoalCovered = intent.decisionGoals.length === 0;
  let unmetNeedCovered = intent.decisionGoals.length === 0;
  const coveredPurposeBlockIds = new Set<string>();

  for (const issue of lintSurveyQuestionSemantics(
    intent.semanticContext,
    candidate.questions,
  )) {
    pushViolation(violations, {
      code: issue.code,
      severity: "repairable",
      message: issue.message,
      questionId: issue.questionId,
      evidence: issue.evidence,
      origin: "question",
    });
  }

  if (intent.intentMode === "composite") {
    if (intent.surveyObject || intent.legacyEvaluationTarget) {
      pushViolation(violations, {
        code: "MULTIPLE_TARGETS_STORED_AS_SINGLE_STRING",
        severity: "fatal",
        message: "복수 조사 대상이 단일 레거시 평가 대상 문자열에 저장됨.",
        evidence: intent.surveyObject ?? intent.legacyEvaluationTarget ?? undefined,
        origin: "schema",
      });
    }
    if (!intent.entities.some((item) => item.role === "proposed_solution")) {
      pushViolation(violations, {
        code: "PROPOSED_SOLUTION_NOT_SEPARATED",
        severity: "fatal",
        message: "도입을 검토하는 제안 기능이 현재 이용 대상과 분리되지 않음.",
        origin: "schema",
      });
    }
  }

  for (const [index, question] of candidate.questions.entries()) {
    const text = candidateQuestionText(question);
    const questionId = question.id ?? index + 1;
    const options = optionLabels(question);
    const referencePeriod =
      question.referencePeriod ?? question.reference_period ?? "";
    const normalizedQuestion = normalizeRoleText(text);
    if (intent.intentMode === "composite") {
      if (question.purposeBlockId) coveredPurposeBlockIds.add(question.purposeBlockId);
      for (const purposeBlock of intent.purposeBlocks) {
        const targetMentioned = normalizedQuestion.includes(
          normalizeRoleText(purposeBlock.target),
        );
        const measuredEntity = (question.measuredEntityIds ?? []).some((id) =>
          [...purposeBlock.targetEntityIds, ...purposeBlock.constructEntityIds].includes(id),
        );
        if (targetMentioned || measuredEntity) coveredPurposeBlockIds.add(purposeBlock.id);
      }
      const targetMentions = intent.purposeBlocks.filter((purposeBlock) =>
        normalizedQuestion.includes(normalizeRoleText(purposeBlock.target)),
      );
      const flattenedPurpose =
        targetMentions.length >= 2 &&
        /(?:설문\s*)?조사(?:와|과|및)|수요\s*조사(?:를|가|은|는)?\s*(?:이용|사용|필요)/.test(
          text,
        );
      if (flattenedPurpose) {
        // 한 문장에 두 대상이 함께 언급된 것만으로 두 목적을 각각 측정했다고
        // 간주하지 않는다. 명시적인 목적/엔터티 매핑이 없는 평탄화 문항은
        // 각 목적 블록의 coverage에서 제외한다.
        if (!question.purposeBlockId && !(question.measuredEntityIds?.length)) {
          for (const purposeBlock of targetMentions) {
            coveredPurposeBlockIds.delete(purposeBlock.id);
          }
        }
        pushViolation(violations, {
          code: "COMPOSITE_PURPOSE_FLATTENED",
          severity: "repairable",
          message: "서로 다른 조사 목적과 대상을 하나의 질문 대상으로 평탄화함.",
          questionId,
          evidence: text,
          origin: "question",
        });
        pushViolation(violations, {
          code: "STUDY_PURPOSE_USED_AS_EVALUATION_TARGET",
          severity: "repairable",
          message: "조사 목적 문구를 응답자가 평가할 실제 대상으로 사용함.",
          questionId,
          evidence: text,
          origin: "question",
        });
        pushViolation(violations, {
          code: "LEGACY_BLUEPRINT_USED_FOR_COMPOSITE_INTENT",
          severity: "repairable",
          message: "복합 의도에 단일 대상 레거시 설문 템플릿이 사용됨.",
          questionId,
          evidence: text,
          origin: "plan",
        });
        if (/현재\s*얼마나\s*필요|필요한\s*가장\s*큰\s*이유/.test(text)) {
          pushViolation(violations, {
            code: "GENERIC_NEEDS_TEMPLATE_ROLE_MISMATCH",
            severity: "repairable",
            message: "현재 이용 경험과 제안 기능 수요를 일반 수요 템플릿 하나로 처리함.",
            questionId,
            evidence: text,
            origin: "plan",
          });
        }
      }
    }
    const concreteObjectMatches = text.match(
      /[가-힣A-Za-z0-9·-]*(?:웹툰|앱|어플|플랫폼|브랜드|제품|서비스)/g,
    ) ?? [];
    const foreignConcreteObject = concreteObjectMatches.find((item) => {
      const normalizedItem = normalizeRoleText(item);
      if (
        /^(?:(?:해당|이|그|온라인|모바일)(?:서비스|앱|어플|플랫폼|브랜드|제품)|서비스|제품|플랫폼)$/.test(
          normalizedItem,
        )
      ) {
        return false;
      }
      const allowedCorpus = normalizeRoleText(
        [intent.rawInput, intent.surveyObject ?? "", ...intent.objects.map((object) => object.text)].join(" "),
      );
      return normalizedItem.length >= 2 && !allowedCorpus.includes(normalizedItem);
    });
    if (foreignConcreteObject) {
      pushViolation(violations, {
        code: "SEMANTIC_RELATION_INVALID",
        severity: "repairable",
        message: "사용자 입력에 없는 제품·서비스가 문항의 평가 대상으로 사용됨.",
        questionId,
        evidence: foreignConcreteObject,
      });
    }

    if (
      relationalIntent &&
      /(?:실제로\s*)?(?:경험하거나\s*선택한|조사하고자\s*하는|이\s*주제와\s*관련된)\s*(?:구체적인\s*)?(?:대상|항목)|구체적인\s*(?:대상|항목)을?\s*(?:적어|작성)/.test(
        text,
      )
    ) {
      pushViolation(violations, {
        code: "GENERIC_CONCRETIZATION_FALLBACK_USED",
        severity: "repairable",
        message: "측정 가능한 변수 대신 응답자에게 조사 대상을 다시 정하도록 요구함.",
        questionId,
        evidence: text,
      });
      pushViolation(violations, {
        code: "MEASURABLE_VARIABLE_MISCLASSIFIED_AS_ABSTRACT",
        severity: "repairable",
        message: "직접 측정 가능한 변수가 추상 주제로 잘못 분류됨.",
        questionId,
        evidence: text,
      });
    }

    for (const metric of researchIntent.derivedMetrics) {
      const metricLabel = metric.name.replace(/\s+/g, "\\s*");
      if (
        new RegExp(metricLabel).test(text) &&
        /(?:몇\s*(?:퍼센트|%)|비율은?\s*(?:얼마|어느)|평균은?\s*(?:얼마|어느)|추측|예상|생각)/.test(
          text,
        )
      ) {
        pushViolation(violations, {
          code: "DERIVED_METRIC_ASKED_DIRECTLY",
          severity: "repairable",
          message: "응답 결과에서 계산해야 할 집계 지표를 개인 응답자에게 직접 질문함.",
          questionId,
          evidence: text,
        });
      }
    }

    for (const category of categoryEntities) {
      const mentionsCategory = normalizedQuestion.includes(
        normalizeRoleText(category.text),
      );
      if (!mentionsCategory && question.measuredRole !== "category_set") continue;
      if (
        /(?:모두\s*)?(?:선택|골라)|무엇|어떤|가장\s*(?:많|큰)|지출|구매|빈도|순위|우선순위/.test(
          text,
        ) ||
        question.measuredRole === "category_set"
      ) {
        categoryOperationalized = true;
      }
      if (/현재\s*얼마나\s*관련|직접\s*경험\s*중|과거에?\s*경험|알고\s*있지만\s*경험/.test(text)) {
        pushViolation(violations, {
          code: "ABSTRACT_CATEGORY_TREATED_AS_PRODUCT",
          severity: "repairable",
          message: "범주형 변수가 제품·서비스 경험 대상처럼 사용됨.",
          questionId,
          evidence: text,
        });
        pushViolation(violations, {
          code: "INVALID_VERB_OBJECT_RELATION",
          severity: "repairable",
          message: "범주형 변수와 경험·관련성 동사의 의미 관계가 성립하지 않음.",
          questionId,
          evidence: text,
        });
      }
      if (/전반적으로\s*(?:어떻게\s*)?평가/.test(text)) {
        pushViolation(violations, {
          code: "GENERIC_TEMPLATE_ROLE_MISMATCH",
          severity: "repairable",
          message: "평가할 수 없는 범주형 변수에 제품 평가 템플릿이 적용됨.",
          questionId,
          evidence: text,
        });
      }
    }

    if (
      decisionOptionEntities.some((item) =>
        normalizedQuestion.includes(normalizeRoleText(item.text)),
      ) &&
      /선호|원하|필요|개설|생기|들어오|도입|마련|우선순위|이용\s*의향|방문/.test(
        text,
      )
    ) {
      decisionGoalCovered = true;
    }
    if (
      /부족|구하기\s*어려|충족되지\s*않|아쉬|불편|필요한\s*(?:품목|서비스|시설|매장|공간)/.test(
        text,
      ) &&
      (contextEntities.length === 0 ||
        contextEntities.some((item) =>
          normalizedQuestion.includes(normalizeRoleText(item.text)),
        ))
    ) {
      unmetNeedCovered = true;
    }

    if (
      studyTitleUsedAsActionObject(text) ||
      (intent.studyPurpose?.text
        ? entityTextUsedAsActionObject(text, intent.studyPurpose.text)
        : false)
    ) {
      pushViolation(violations, {
        code: "SURVEY_PURPOSE_USED_AS_OBJECT",
        severity: "repairable",
        message: "조사 목적이나 조사 제목이 이용·사용 대상의 목적어로 사용됨.",
        questionId,
        evidence: text,
      });
    }
    // 기준 기간은 행동·빈도 문항의 표준 설계 요소이고, 시스템 프롬프트도
    // 이를 요구한다(qualityCheck.referencePeriodsAddedWhereNeeded).
    // 사용자가 기간을 적지 않았다는 이유로 회상 구간까지 위반 처리하면
    // 정상적인 스크리닝·빈도 문항이 전부 교체된다. 사실 주장에 붙은
    // 기간만 위반으로 본다.
    const recallScoped =
      /(?:이용|사용|방문|참여|구매|수강|경험)(?:한|해\s*본)?\s*(?:적|경험|횟수|빈도)|얼마나\s*자주|몇\s*번|평균적으로|referencePeriod/.test(
        text,
      ) || Boolean(referencePeriod);
    if (
      !intent.explicitTimeframe &&
      !recallScoped &&
      inventedTimeframe.test(text)
    ) {
      pushViolation(violations, {
        code: "INVENTED_TIMEFRAME",
        severity: "repairable",
        message: "사용자가 지정하지 않은 기간이 사실 진술로 문항에 추가됨.",
        questionId,
        evidence: text,
      });
    }
    if (
      intent.targetPopulation &&
      /전\s*연령대|모든\s*연령대/.test(intent.targetPopulation) &&
      (/(?:귀하는\s*)?(?:전\s*연령대|모든\s*연령대)(?:의|에|입니까|인가요|에\s*해당)/.test(
        text,
      ) ||
        (text.includes(intent.targetPopulation) &&
          /(?:조사|연구).*(?:이용|사용|구매|참여|방문|경험)/.test(text)))
    ) {
      pushViolation(violations, {
        code: "INVALID_TARGET_ROLE",
        severity: "repairable",
        message: "표본 전체의 연령 범위가 개인 응답자의 속성이나 목적어로 사용됨.",
        questionId,
        evidence: text,
      });
    }
    if (
      intent.targetPopulation &&
      intent.studyTitle?.text &&
      entityTextUsedAsActionObject(text, intent.studyTitle.text) &&
      normalizeRoleText(intent.studyTitle?.text ?? "").includes(
        normalizeRoleText(intent.targetPopulation),
      )
    ) {
      pushViolation(violations, {
        code: "TARGET_PURPOSE_COMPOSITE_OBJECT",
        severity: "repairable",
        message: "조사 대상과 조사 목적을 붙인 문구가 행동의 목적어로 사용됨.",
        questionId,
        evidence: text,
      });
    }
    if (
      intent.includesNonUsers &&
      question.role === "screening" &&
      options.some((option) => /(?:아니요|없음|없다|미이용|비이용)/.test(option)) &&
      ((question.showIf?.length ?? 0) > 0 || (question.show_if?.length ?? 0) > 0)
    ) {
      pushViolation(violations, {
        code: "NON_USERS_EXCLUDED",
        severity: "repairable",
        message: "비이용자를 포함해야 하는 조사에서 이용 경험이 응답 자격으로 사용됨.",
        questionId,
        evidence: text,
      });
    }

    const questionRelations = extractActivityRelations(text);
    for (const object of questionRelations.objects) {
      const isKnownObject = semanticallySameObject(object);
      if (
        hasConcreteActionObject &&
        !isKnownObject &&
        object.role === "product_or_service" &&
        questionRelations.activities.some((activity) =>
          ["use", "purchase", "attend"].includes(activity.activityKind ?? ""),
        )
      ) {
        pushViolation(violations, {
          code: "SEMANTIC_RELATION_INVALID",
          severity: "repairable",
          message: "사용자 입력에 없는 제품·서비스가 행동 대상으로 추가됨.",
          questionId,
          evidence: text,
        });
      }
    }
  }

  if (intent.intentMode === "composite") {
    for (const purposeBlock of intent.purposeBlocks) {
      if (!coveredPurposeBlockIds.has(purposeBlock.id)) {
        pushViolation(violations, {
          code: "PURPOSE_BLOCK_DROPPED",
          severity: "repairable",
          message: `복합 조사 목적 '${purposeBlock.text}'을 측정하는 문항이 없음.`,
          evidence: purposeBlock.id,
          origin: "plan",
        });
      }
    }
    const firstPurpose = intent.purposeBlocks[0];
    if (firstPurpose && !coveredPurposeBlockIds.has(firstPurpose.id)) {
      pushViolation(violations, {
        code: "EXISTING_CONTEXT_NOT_MEASURED",
        severity: "repairable",
        message: "제안 기능의 필요성을 해석할 현재 이용 경험이 측정되지 않음.",
        evidence: firstPurpose.target,
        origin: "plan",
      });
    }
  }

  if (!categoryOperationalized) {
    pushViolation(violations, {
      code: "CATEGORY_SET_NOT_OPERATIONALIZED",
      severity: "repairable",
      message: "범주형 변수가 선택·빈도·우선순위처럼 분석 가능한 문항으로 측정되지 않음.",
      evidence: categoryEntities.map((item) => item.text).join(", "),
    });
  }
  if (!decisionGoalCovered || !unmetNeedCovered) {
    pushViolation(violations, {
      code: "DECISION_GOAL_DROPPED",
      severity: "repairable",
      message: "앞선 조사 결과가 사용될 최종 의사결정 목적 또는 미충족 수요 측정이 누락됨.",
      evidence: intent.decisionGoals.map((item) => item.text).join(", "),
    });
  }

  if (relationalIntent) {
    const questionCoversVariable = (
      variable: SurveyResearchIntent["variables"][number],
      question: SurveyIntentQuestionCandidate,
    ) => {
      const questionText = candidateQuestionText(question);
      const compactQuestion = normalizeRoleText(questionText);
      const compactMetadata = normalizeRoleText(
        `${question.measuredVariable ?? ""} ${question.measuredConstruct ?? ""}`,
      );
      const label = normalizeRoleText(variable.name);
      const core = normalizeRoleText(
        variable.name
          .replace(/^현재\s*/, "")
          .replace(/\s*(?:여부|형태|수준|정도|구간)$/, ""),
      );
      if (
        compactQuestion.includes(label) ||
        compactMetadata.includes(label) ||
        (core.length >= 2 &&
          (compactQuestion.includes(core) || compactMetadata.includes(core)))
      ) {
        return true;
      }
      if (/현재\s*거주\s*형태|자취\s*여부/.test(variable.name)) {
        return /거주\s*형태|자취\s*(?:중|여부|하고|하는)/.test(questionText);
      }
      if (/사용\s*여부|이용\s*여부/.test(variable.name)) {
        return /(?:사용|이용)(?:한|해\s*본)?\s*(?:적|경험)?(?:이\s*)?(?:있|없)/.test(
          questionText,
        );
      }
      if (/참여\s*여부/.test(variable.name)) {
        return /참여(?:한|해\s*본)?\s*(?:적|경험)?(?:이\s*)?(?:있|없)|현재\s*참여/.test(
          questionText,
        );
      }
      if (/통학\s*시간/.test(variable.name)) {
        return /통학\s*시간|학교까지.*(?:걸리|소요)|편도.*(?:분|시간)/.test(
          questionText,
        );
      }
      if (/수면\s*시간|수면량/.test(variable.name)) {
        return /수면\s*시간|몇\s*시간.*(?:자|수면)|하루.*(?:자|수면)/.test(questionText);
      }
      if (/^(?:나이|연령)$/.test(variable.name)) {
        return /나이|연령대?/.test(questionText);
      }
      // 생성기(researchVariableQuestion)는 "지각 빈도"를 "수업이나 약속에 늦은
      // 빈도"로 표현한다. 응답자에게 "지각"이라는 단어를 덜 노출하려는 의도라
      // 매처도 같은 표현을 알고 있어야 한다.
      if (/지각\s*(?:횟수|빈도)/.test(variable.name)) {
        return /지각.*(?:횟수|빈도|몇\s*회)|(?:횟수|빈도|몇\s*회).*지각|늦(?:은|는|었던)\s*(?:횟수|빈도)/.test(
          questionText,
        );
      }
      if (/공부\s*시간/.test(variable.name)) {
        return /공부(?:하는)?\s*시간|학습\s*시간/.test(questionText);
      }
      if (/근무\s*시간/.test(variable.name)) {
        return /근무\s*시간|하루.*근무/.test(questionText);
      }
      if (/거주\s*지역/.test(variable.name)) {
        return /거주(?:하는)?\s*지역|현재\s*지역/.test(questionText);
      }
      if (/운동\s*빈도/.test(variable.name)) {
        return /운동.*얼마나\s*자주|운동\s*빈도/.test(questionText);
      }
      if (/이용\s*빈도|사용\s*빈도/.test(variable.name)) {
        return /얼마나\s*자주\s*(?:이용|사용)|(?:이용|사용)\s*빈도/.test(
          questionText,
        );
      }
      return false;
    };
    const requiredVariables = researchIntent.variables.filter(
      (item) => item.scope === "respondent_level" && item.directlyAskable,
    );
    const variableQuestionIndexes = new Map(
      requiredVariables.map((variable) => [
        variable.id,
        candidate.questions.flatMap((question, index) =>
          questionCoversVariable(variable, question) ? [index] : [],
        ),
      ]),
    );
    const missingVariables = requiredVariables.filter(
      (item) => (variableQuestionIndexes.get(item.id)?.length ?? 0) === 0,
    );
    if (missingVariables.length > 0) {
      pushViolation(violations, {
        code: "VARIABLE_COVERAGE_MISSING",
        severity: "repairable",
        message: "관계 분석에 필요한 응답자 수준 변수가 문항에서 측정되지 않음.",
        evidence: missingVariables.map((item) => item.name).join(", "),
        origin: "question",
      });
    }
    if (requiredVariables.length - missingVariables.length < 2) {
      pushViolation(violations, {
        code: "MULTI_VARIABLE_INTENT_FLATTENED",
        severity: "repairable",
        message: "복수 변수 조사 요청이 하나의 주제로 평탄화됨.",
        evidence: researchIntent.relationExpression ?? undefined,
        origin: "plan",
      });
      pushViolation(violations, {
        code: "ANALYSIS_GOAL_NOT_SUPPORTED",
        severity: "repairable",
        message: "생성된 문항으로 요청한 관계·집단 비교 분석을 수행할 수 없음.",
        evidence: researchIntent.analysisGoals.map((item) => item.description).join(", "),
        origin: "relation_mapping",
      });
    }
    for (const relation of researchIntent.relations) {
      const fromIndexes = variableQuestionIndexes.get(relation.fromVariableId) ?? [];
      const toIndexes = variableQuestionIndexes.get(relation.toVariableId) ?? [];
      if (fromIndexes.length === 0 || toIndexes.length === 0) {
        pushViolation(violations, {
          code: "RELATION_COVERAGE_MISSING",
          severity: "repairable",
          message: "분석 관계의 양쪽 변수가 각각 독립된 문항으로 측정되지 않음.",
          evidence: relation.sourceExpression,
          origin: "relation_mapping",
        });
        continue;
      }
      const usable = (variableId: string, indexes: number[]) =>
        indexes.some((index) => {
          const question = candidate.questions[index];
          const optionCount = optionLabels(question).length;
          const variable = requiredVariables.find((item) => item.id === variableId);
          const textAnswerIsUsable =
            variable?.measurementLevel === "nominal" ||
            variable?.measurementLevel === "text";
          return optionCount >= 2 || question.type === "scale" || textAnswerIsUsable;
        });
      if (
        !usable(relation.fromVariableId, fromIndexes) ||
        !usable(relation.toVariableId, toIndexes)
      ) {
        pushViolation(violations, {
          code: "ANALYSIS_FEASIBILITY_UNSUPPORTED",
          severity: "repairable",
          message: "관계 분석에 필요한 변수가 비교 가능한 선택지·척도로 조작화되지 않음.",
          evidence: relation.sourceExpression,
          origin: "schema",
        });
      }
    }
    for (const [index, question] of candidate.questions.entries()) {
      const text = candidateQuestionText(question);
      if (
        /(?:앞에서\s*답한\s*)?두\s*값.*(?:관계|함께\s*달라|관련)|(?:관계|영향).*어떻게\s*생각|관련(?:이\s*있다고)?\s*느끼는\s*정도/.test(text)
      ) {
        pushViolation(violations, {
          code: "DIRECT_RELATION_QUESTION_USED",
          severity: "repairable",
          message: "두 변수의 관계를 분석하지 않고 응답자에게 주관적으로 직접 판단하게 함.",
          questionId: question.id ?? index + 1,
          evidence: text,
          origin: "question",
        });
      }
    }
    const title = candidate.title?.trim() ?? "";
    if (
      title &&
      /(?:대해|걸리는|따른|관한|위한|미치는|그리고|및|과|와)\s*$/.test(title)
    ) {
      pushViolation(violations, {
        code: "INCOMPLETE_SURVEY_TITLE",
        severity: "repairable",
        message: "설문 제목이 관형절이나 연결어 중간에서 끝남.",
        evidence: title,
      });
    }
    if (
      /경험과\s*평가,?\s*중요\s*요소\s*및\s*개선\s*의견|현재\s*경험과\s*의견\s*파악/.test(
        candidate.description ?? "",
      )
    ) {
      pushViolation(violations, {
        code: "GENERIC_DESCRIPTION_MISMATCH",
        severity: "repairable",
        message: "설명문이 추출된 변수와 분석 목적 대신 범용 문구로 작성됨.",
        evidence: candidate.description,
      });
    }
  }

  if (firstQuestion && !intent.screeningRequired) {
    if (firstQuestion.role === "screening") {
      pushViolation(violations, {
        code: "UNNECESSARY_SCREENING",
        severity: "repairable",
        message: "응답 자격 확인이 필요하지 않은 설문에 첫 문항 스크리너가 배치됨.",
        questionId: firstQuestion.id ?? 1,
        evidence: candidateQuestionText(firstQuestion),
      });
    }
  }

  if (
    intent.includesNonUsers &&
    candidate.eligibility &&
    /(?:이용|사용|구매|참여|경험)(?:한|이\s*있는)\s*(?:사람|응답자|이용자|사용자)|(?:이용|사용)\s*경험\s*필수/.test(
      candidate.eligibility,
    )
  ) {
    pushViolation(violations, {
      code: "NON_USERS_EXCLUDED",
      severity: "repairable",
      message: "비이용자를 포함해야 하는 조사에서 이용 경험자가 응답 자격으로 제한됨.",
      evidence: candidate.eligibility,
    });
  }

  return violations;
}

export function compactSurveyIntentForPrompt(intent: SurveyIntent) {
  return {
    intentMode: intent.intentMode,
    targetPopulation: intent.targetPopulation,
    semanticRoles: intent.entities.map((item) => ({
      id: item.id,
      text: item.text,
      role: item.role,
      source: item.source,
      confidence: item.confidence,
      ...(item.activityKind ? { activityKind: item.activityKind } : {}),
    })),
    studyTitle: intent.studyTitle?.text ?? null,
    studyPurpose: intent.studyPurpose?.text ?? null,
    studyPurposes: intent.studyPurposes.map((item) => ({
      id: item.id,
      text: item.text,
    })),
    purposeBlocks: intent.purposeBlocks.map((block) => ({
      id: block.id,
      text: block.text,
      kind: block.kind,
      target: block.target,
      targetEntityIds: block.targetEntityIds,
      constructEntityIds: block.constructEntityIds,
      order: block.order,
      relationToPrevious: block.relationToPrevious,
    })),
    decisionGoals: intent.decisionGoals.map((item) => ({
      id: item.id,
      text: item.text,
    })),
    surveyObject: intent.surveyObject,
    legacyEvaluationTarget: intent.legacyEvaluationTarget,
    objects: intent.objects.map((item) => ({ text: item.text, role: item.role })),
    activities: intent.activities.map((item) => ({
      text: item.text,
      activityKind: item.activityKind,
    })),
    constructs: intent.constructs,
    contexts: intent.contexts.map((item) => ({ id: item.id, text: item.text })),
    relations: intent.relations,
    purpose: intent.purpose,
    explicitTimeframe: intent.explicitTimeframe,
    eligibilityCondition: intent.eligibilityCondition,
    evaluationTargets: intent.evaluationTargets,
    targetCardinality: intent.targetCardinality,
    targetListSource: intent.targetListSource,
    unitOfAnalysis: intent.unitOfAnalysis,
    measurementMode: intent.measurementMode,
    screeningRequired: intent.screeningRequired,
    screeningReason: intent.screeningReason,
    requiresCreatorClarification: intent.requiresCreatorClarification,
    missingInformation: intent.missingInformation,
    includesNonUsers: intent.includesNonUsers,
    studyType: intent.studyType,
    ambiguityLevel: intent.ambiguityLevel,
    objectKind: intent.objectKind,
    semanticContext: intent.semanticContext,
    researchIntent: compactResearchIntentForPrompt(intent.researchIntent),
  };
}
