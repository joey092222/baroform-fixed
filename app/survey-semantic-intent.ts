export type SurveyIntentStudyType = "general" | "research";

export type SemanticRole =
  | "target_population"
  | "study_title"
  | "study_purpose"
  | "study_method"
  | "real_world_object"
  | "product_or_service"
  | "survey_instrument"
  | "activity"
  | "construct"
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
  | "attend";

export type IntentEntity = {
  text: string;
  normalizedText: string;
  role: SemanticRole;
  source: "explicit" | "inferred";
  confidence: number;
  start?: number;
  end?: number;
  activityKind?: SurveyActivityKind;
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
  | "academic_construct";

export type SurveyIntent = {
  rawInput: string;
  entities: IntentEntity[];
  targetPopulation: string | null;
  targetPopulationEntities: IntentEntity[];
  studyTitle: IntentEntity | null;
  studyPurpose: IntentEntity | null;
  surveyObject: string | null;
  objects: IntentEntity[];
  activities: IntentEntity[];
  constructs: string[];
  constructEntities: IntentEntity[];
  purpose: string | null;
  explicitTimeframe: string | null;
  explicitTimeframeEntity: IntentEntity | null;
  eligibilityCondition: string | null;
  eligibilityEntity: IntentEntity | null;
  screeningRequired: boolean;
  includesNonUsers: boolean;
  studyType: SurveyIntentStudyType;
  ambiguityLevel: "low" | "medium" | "high";
  objectKind: SurveyIntentObjectKind;
};

export type SurveyIntentViolationCode =
  | "SURVEY_PURPOSE_USED_AS_OBJECT"
  | "INVENTED_TIMEFRAME"
  | "INVALID_TARGET_ROLE"
  | "UNNECESSARY_SCREENING"
  | "NON_USERS_EXCLUDED"
  | "UNRELATED_SERVICE_EXPERIENCE"
  | "TARGET_PURPOSE_COMPOSITE_OBJECT"
  | "SEMANTIC_RELATION_INVALID";

export type ValidationSeverity = "fatal" | "repairable" | "warning";

export type SurveyIntentViolation = {
  code: SurveyIntentViolationCode;
  severity: ValidationSeverity;
  message: string;
  questionId?: string | number;
  evidence?: string;
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
  subjectRole?: SemanticRole;
  objectRole?: SemanticRole;
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
  /^(전\s*연령대(?:의\s*일반인)?|모든\s*연령대|일반인|학생(?:들)?|대학생(?:들)?|대학원생(?:들)?|직장인(?:들)?|청년(?:들)?|고등학생(?:들)?|중학생(?:들)?|초등학생(?:들)?|학부모(?:들)?|교사(?:들)?|교직원(?:들)?|직원(?:들)?|소비자(?:들)?|사용자(?:들)?|이용자(?:들)?|연세대학교\s*(?:학부생|학생|재학생)(?:들)?|[가-힣A-Za-z0-9·-]+대학교\s*(?:학부생|학생|재학생)(?:들)?|\d{1,2}대\s*(?:여성|남성)?)(?:들이|이|가|은|는|의|을|를)?\s*/;

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
  if (objectThenTarget) {
    return {
      targetPopulation: objectThenTarget[2].replace(/들$/, "").trim(),
      remainder: `${objectThenTarget[1].trim()} ${objectThenTarget[3].trim()}`,
    };
  }

  const genitive = value.match(
    /^(.+?(?:학생|대학생|대학원생|직장인|청년|고객|이용자|사용자|소비자|직원|교직원|교사)(?:들)?)의\s+(.+)$/,
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
  return value
    .replace(/배달앱/g, "배달 앱")
    .replace(/네이버\s*웹툰/g, "네이버 웹툰")
    .replace(/\s+/g, " ")
    .trim();
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
      result.push(entity(text, "construct"));
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

function classifyIntent(value: string): SurveyIntentObjectKind {
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

export function parseSurveyIntent(
  rawInput: string,
  studyType: SurveyIntentStudyType = "general",
): SurveyIntent {
  const raw = normalize(rawInput);
  const requestStripped = raw
    .replace(
      /(?:을|를)?\s*(?:분석|조사|파악|확인|알아보)(?:(?:하|해)(?:고|서)?|고)?\s*싶(?:어|어요|습니다)\s*$/,
      "",
    )
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
  const relations = extractActivityRelations(working);
  let kind = classifyIntent(working);
  if (
    relations.activities.length > 0 &&
    !["ability_skill", "attitude_perception", "satisfaction_evaluation", "need_demand"].includes(
      kind,
    )
  ) {
    kind = "behavior_usage";
  }
  const parts = constructAndObject(working, kind);
  const relationConstructs = extractConstructEntities(
    working,
    relations.activities,
  );
  if (relations.objects.length > 0) {
    parts.surveyObject = relations.objects[0].text;
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
  const explicitlyIncludesNonUsers =
    /(?:비이용자|비사용자|사용해\s*본\s*적이\s*없는|이용해\s*본\s*적이\s*없는).*(?:포함|까지)|(?:전\s*연령대|모든\s*연령대|일반인)/.test(
      raw,
    );
  const includesNonUsers =
    !eligibilityCondition &&
    (explicitlyIncludesNonUsers ||
      kind === "ability_skill" ||
      kind === "attitude_perception" ||
      relations.activities.length > 0 ||
      /실태|현황/.test(raw));
  const screeningRequired = Boolean(
    eligibilityCondition ||
      (explicitTimeframe &&
        /(?:이용|사용|구매|방문|참여)\s*(?:경험|현황|실태)/.test(raw)) ||
      (kind === "satisfaction_evaluation" &&
        !includesNonUsers &&
        /재택근무|서비스|시설|제품|프로그램|행사|수업/.test(
          parts.surveyObject ?? "",
        )),
  );
  const ambiguityLevel: SurveyIntent["ambiguityLevel"] = !parts.surveyObject
    ? "high"
    : target.targetPopulation || relations.activities.length > 0 || kind !== "academic_construct"
      ? "low"
      : "medium";

  const targetEntity = target.targetPopulation
    ? entity(target.targetPopulation, "target_population")
    : null;
  const explicitObjectEntities = relations.objects.length > 0
    ? relations.objects
    : parts.surveyObject
      ? [entity(parts.surveyObject, roleForObject(parts.surveyObject))]
      : [];
  const constructEntities = relationConstructs.length > 0
    ? relationConstructs
    : parts.constructs
        .filter(Boolean)
        .map((item) => entity(item, "construct"));
  const purpose = purposeFor(working, kind);
  const studyPurpose = entity(purpose, "study_purpose", {
    source: /실태|만족도|인식|인지도|수요|효과|영향|현황|불편|어려움|빈도/.test(
      raw,
    )
      ? "explicit"
      : "inferred",
    confidence: constructEntities.length > 0 ? 0.94 : 0.7,
  });
  const explicitStudyTitle = /(?:설문\s*)?조사$|연구$/.test(requestStripped);
  const conciseTitleParts = [
    target.targetPopulation,
    parts.surveyObject,
    ...constructEntities.slice(0, 2).map((item) => item.text),
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
  const entities = [
    ...(targetEntity ? [targetEntity] : []),
    studyTitle,
    studyPurpose,
    ...explicitObjectEntities,
    ...relations.activities,
    ...constructEntities,
    ...(timeframeEntity ? [timeframeEntity] : []),
    ...(eligibilityEntity ? [eligibilityEntity] : []),
  ];

  return {
    rawInput: raw,
    entities,
    targetPopulation: target.targetPopulation,
    targetPopulationEntities: targetEntity ? [targetEntity] : [],
    studyTitle,
    studyPurpose,
    surveyObject: parts.surveyObject || null,
    objects: explicitObjectEntities,
    activities: relations.activities,
    constructs: constructEntities.map((item) => item.text),
    constructEntities,
    purpose,
    explicitTimeframe,
    explicitTimeframeEntity: timeframeEntity,
    eligibilityCondition,
    eligibilityEntity,
    screeningRequired,
    includesNonUsers,
    studyType,
    ambiguityLevel,
    objectKind: kind,
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

  for (const [index, question] of candidate.questions.entries()) {
    const text = candidateQuestionText(question);
    const questionId = question.id ?? index + 1;
    const options = optionLabels(question);
    const referencePeriod =
      question.referencePeriod ?? question.reference_period ?? "";
    const combined = `${text} ${referencePeriod}`.trim();

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
    if (!intent.explicitTimeframe && inventedTimeframe.test(combined)) {
      pushViolation(violations, {
        code: "INVENTED_TIMEFRAME",
        severity: "repairable",
        message: "사용자가 지정하지 않은 기간이 문항에 추가됨.",
        questionId,
        evidence: combined,
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
    targetPopulation: intent.targetPopulation,
    semanticRoles: intent.entities.map((item) => ({
      text: item.text,
      role: item.role,
      source: item.source,
      confidence: item.confidence,
      ...(item.activityKind ? { activityKind: item.activityKind } : {}),
    })),
    studyTitle: intent.studyTitle?.text ?? null,
    studyPurpose: intent.studyPurpose?.text ?? null,
    surveyObject: intent.surveyObject,
    objects: intent.objects.map((item) => ({ text: item.text, role: item.role })),
    activities: intent.activities.map((item) => ({
      text: item.text,
      activityKind: item.activityKind,
    })),
    constructs: intent.constructs,
    purpose: intent.purpose,
    explicitTimeframe: intent.explicitTimeframe,
    eligibilityCondition: intent.eligibilityCondition,
    screeningRequired: intent.screeningRequired,
    includesNonUsers: intent.includesNonUsers,
    studyType: intent.studyType,
    ambiguityLevel: intent.ambiguityLevel,
    objectKind: intent.objectKind,
  };
}
