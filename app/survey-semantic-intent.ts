export type SurveyIntentStudyType = "general" | "research";

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
  targetPopulation: string | null;
  surveyObject: string | null;
  constructs: string[];
  purpose: string | null;
  explicitTimeframe: string | null;
  eligibilityCondition: string | null;
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
  | "TARGET_PURPOSE_COMPOSITE_OBJECT";

export type SurveyIntentViolation = {
  code: SurveyIntentViolationCode;
  message: string;
  questionId?: string | number;
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
};

export type SurveyIntentCandidate = {
  title?: string;
  description?: string;
  eligibility?: string | null;
  questions: SurveyIntentQuestionCandidate[];
};

export function shouldEnforceSurveyIntentValidation(intent: SurveyIntent) {
  return (
    intent.objectKind === "ability_skill" ||
    Boolean(intent.explicitTimeframe) ||
    Boolean(intent.eligibilityCondition) ||
    /전\s*연령대|모든\s*연령대/.test(intent.targetPopulation ?? "") ||
    /(?:비이용자|비사용자|사용해\s*본\s*적이\s*없는|이용해\s*본\s*적이\s*없는).*(?:포함|까지)/.test(
      intent.rawInput,
    )
  );
}

const normalize = (value: string) =>
  value
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?。]+$/g, "")
    .trim();

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const surveyRequestEnding =
  /\s*(?:(?:설문\s*)?조사|설문|연구|효과\s*분석|영향\s*분석)\s*$/;

const purposeSuffix =
  /\s*(실태|만족도|인식|인지도|수요|이용\s*현황(?:과\s*경험)?|사용\s*현황(?:과\s*경험)?|이용\s*경험|사용\s*경험|경험|효과|영향)\s*$/;

const targetPrefix =
  /^(전\s*연령대(?:의\s*일반인)?|모든\s*연령대|일반인|대학생(?:들)?|대학원생(?:들)?|직장인(?:들)?|청년(?:들)?|고등학생(?:들)?|중학생(?:들)?|초등학생(?:들)?|학부모(?:들)?|교사(?:들)?|교직원(?:들)?|직원(?:들)?|소비자(?:들)?|사용자(?:들)?|이용자(?:들)?|연세대학교\s*(?:학부생|학생|재학생)|[가-힣A-Za-z0-9·-]+대학교\s*(?:학부생|학생|재학생)|\d{1,2}대\s*(?:여성|남성)?)(?:의|을|를)?\s*/;

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
    /\s*(?:이용|사용|구매|방문|참여)\s*(?:현황(?:과\s*경험)?|경험|행태|실태|빈도)\s*$/,
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
      /(?:을|를)?\s*(?:분석|조사|파악|확인|알아보)(?:해|하|고)?\s*싶(?:어|어요|습니다)\s*$/,
      "",
    )
    .trim();
  const explicitTimeframe = extractExplicitTimeframe(raw);
  let working = stripTimeframe(requestStripped, explicitTimeframe)
    .replace(
      /^AI(?:를|을)\s*사용해\s*본\s*적이\s*없는\s*사람까지\s*포함한\s*/i,
      "",
    )
    .trim();
  const target = extractTarget(working);
  working = target.remainder;
  const kind = classifyIntent(working);
  const parts = constructAndObject(working, kind);
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
    : target.targetPopulation || kind !== "academic_construct"
      ? "low"
      : "medium";

  return {
    rawInput: raw,
    targetPopulation: target.targetPopulation,
    surveyObject: parts.surveyObject || null,
    constructs: parts.constructs.filter(Boolean),
    purpose: purposeFor(working, kind),
    explicitTimeframe,
    eligibilityCondition,
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
  const surveyMetaAsObject =
    /(?:실태|만족도|인식|인지도|수요|이용\s*현황|사용\s*현황|경험|효과|영향)?\s*(?:설문\s*)?조사(?:를|을)?\s*(?:직접\s*)?(?:이용|사용|구매|먹|시식|참여|방문|경험)/i;
  const inventedTimeframe =
    /(?:최근|지난)\s*(?:\d+\s*(?:일|주|개월|달|년)|한\s*(?:주|달|해)|일주일)|(?:이번|지난)\s*(?:학기|학년도)/;
  const firstQuestion = candidate.questions[0];

  for (const [index, question] of candidate.questions.entries()) {
    const text = candidateQuestionText(question);
    const questionId = question.id ?? index + 1;
    const options = optionLabels(question);
    const referencePeriod =
      question.referencePeriod ?? question.reference_period ?? "";
    const combined = `${text} ${referencePeriod}`.trim();

    if (surveyMetaAsObject.test(text)) {
      pushViolation(violations, {
        code: "SURVEY_PURPOSE_USED_AS_OBJECT",
        message: "조사 목적이나 조사 제목이 이용·사용 대상의 목적어로 사용됨.",
        questionId,
      });
    }
    if (!intent.explicitTimeframe && inventedTimeframe.test(combined)) {
      pushViolation(violations, {
        code: "INVENTED_TIMEFRAME",
        message: "사용자가 지정하지 않은 기간이 문항에 추가됨.",
        questionId,
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
        message: "표본 전체의 연령 범위가 개인 응답자의 속성이나 목적어로 사용됨.",
        questionId,
      });
    }
    if (
      intent.targetPopulation &&
      /(?:조사|연구)/.test(text) &&
      text.includes(intent.targetPopulation) &&
      /(?:이용|사용|구매|먹|참여|방문|경험)/.test(text)
    ) {
      pushViolation(violations, {
        code: "TARGET_PURPOSE_COMPOSITE_OBJECT",
        message: "조사 대상과 조사 목적을 붙인 문구가 행동의 목적어로 사용됨.",
        questionId,
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
        message: "비이용자를 포함해야 하는 조사에서 이용 경험이 응답 자격으로 사용됨.",
        questionId,
      });
    }
  }

  if (firstQuestion && !intent.screeningRequired) {
    const text = candidateQuestionText(firstQuestion);
    const options = optionLabels(firstQuestion);
    const yesNo =
      options.length === 2 &&
      options.some((option) => /^예|네[,. ]/.test(option)) &&
      options.some((option) => /^아니요|없음/.test(option));
    if (
      firstQuestion.role === "screening" ||
      (yesNo && /(?:이용|사용|구매|먹|참여|방문|경험)한?\s*적/.test(text))
    ) {
      pushViolation(violations, {
        code: "UNNECESSARY_SCREENING",
        message: "응답 자격 확인이 필요하지 않은 설문에 첫 문항 스크리너가 배치됨.",
        questionId: firstQuestion.id ?? 1,
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
      message: "비이용자를 포함해야 하는 조사에서 이용 경험자가 응답 자격으로 제한됨.",
    });
  }

  if (
    intent.objectKind !== "service_product" &&
    intent.objectKind !== "place_facility" &&
    candidate.questions.some((question) =>
      /(?:설문|조사)(?:을|를)?\s*(?:이용|사용|구매|방문)/.test(
        candidateQuestionText(question),
      ),
    )
  ) {
    pushViolation(violations, {
      code: "UNRELATED_SERVICE_EXPERIENCE",
      message: "서비스가 아닌 측정 개념을 서비스 이용 경험처럼 질문함.",
    });
  }

  return violations;
}

export function compactSurveyIntentForPrompt(intent: SurveyIntent) {
  return {
    targetPopulation: intent.targetPopulation,
    surveyObject: intent.surveyObject,
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
