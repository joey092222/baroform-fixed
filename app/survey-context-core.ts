import { lookupVerifiedSurveyKnowledge } from "./survey-knowledge";

export type SurveyArchetype =
  | "service_usage"
  | "product_usage"
  | "platform_usage"
  | "facility_usage"
  | "mobility_experience"
  | "learning_experience"
  | "relationship_experience"
  | "attitude"
  | "satisfaction"
  | "demand"
  | "consumption_behavior"
  | "category_frequency"
  | "academic_organization"
  | "multidimensional_construct"
  | "relationship_analysis"
  | "mixed";

export type SurveyContextEntityType =
  | "service"
  | "product"
  | "platform"
  | "feature"
  | "facility"
  | "university_building"
  | "place"
  | "movement"
  | "learning"
  | "relationship"
  | "academic_organization"
  | "category_set"
  | "construct"
  | "mixed"
  | "unknown";

export type ParsedSurveyContext = {
  rawUserInput: string;
  normalizedInput: string;
  audience: string | null;
  primaryEntity: string;
  entityType: SurveyContextEntityType;
  activity: string | null;
  researchGoal: string;
  researchConstructs: string[];
  surveyArchetype: SurveyArchetype;
  isUsageObject: boolean;
};

export type SurveySemanticLintCode =
  | "MALFORMED_TOPIC_PARTICLE"
  | "PREDICATE_ENTITY_MISMATCH"
  | "REQUEST_META_USED_AS_OBJECT";

export type SurveySemanticLintIssue = {
  code: SurveySemanticLintCode;
  questionId?: string | number;
  message: string;
  evidence: string;
};

export type SemanticQuestionLike = {
  id?: string | number;
  title?: string;
  text?: string;
  reason?: string;
  analysis?: { purpose?: string } | null;
};

const normalizeWhitespace = (value: string) =>
  value
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?。]+$/g, "")
    .trim();

export function normalizeSurveyRequest(value: string) {
  let normalized = normalizeWhitespace(value);
  for (let pass = 0; pass < 3; pass += 1) {
    normalized = normalized
      .replace(
        /\s*(?:에\s*대해|에\s*관해|와\s*관련해|과\s*관련해|관련해)?\s*(?:조사|파악|분석|확인|알아보)(?:(?:하|해)(?:고|서)?|고)?\s*싶(?:다|어|어요|습니다)\s*$/,
        "",
      )
      .replace(
        /\s*(?:에\s*대한|에\s*관한|와\s*관련한|과\s*관련한)?\s*(?:설문\s*조사|설문|조사)(?:를|을)?\s*(?:만들어|작성해|제작해|진행해|실시해|구성해)(?:\s*줘|\s*주세요|줘|주세요)?\s*$/,
        "",
      )
      .replace(
        /\s*(?:에\s*대해|에\s*대한|에\s*관해|에\s*관한|와\s*관련해|과\s*관련해|관련)\s*$/,
        "",
      )
      .replace(/\s+/g, " ")
      .trim();
  }
  return normalized;
}

const audienceHead =
  "(?:학부생|대학원생|재학생|휴학생|대학생|학생|일반인|직장인|청년|교직원|교수|교사|이용자|사용자|소비자|고객|주민|학부모)";

function cleanAudience(value: string) {
  return value
    .replace(/(?:들)$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitAudience(value: string) {
  const objectThenAudience = value.match(
    new RegExp(`^(.+?)(?:의)\\s+(${audienceHead}(?:들)?)(?:의)?\\s+(.+)$`),
  );
  if (objectThenAudience) {
    const scope = objectThenAudience[1].trim();
    const person = cleanAudience(objectThenAudience[2]);
    const scopeIsInstitution = /(?:대학교?|학교|기관)$/.test(scope);
    return {
      audience: scopeIsInstitution ? `${scope} ${person}` : person,
      subject: scopeIsInstitution
        ? objectThenAudience[3].trim()
        : scope,
    };
  }
  const genitive = value.match(
    new RegExp(`^(.{1,60}?${audienceHead}(?:들)?)(?:의)\\s+(.+)$`),
  );
  if (genitive) {
    return {
      audience: cleanAudience(genitive[1]),
      subject: genitive[2].trim(),
    };
  }
  const actor = value.match(
    new RegExp(`^(.{1,60}?${audienceHead})(?:들이|이|가)\\s+(.+)$`),
  );
  if (actor) {
    return {
      audience: cleanAudience(actor[1]),
      subject: actor[2].trim(),
    };
  }
  return { audience: null, subject: value.trim() };
}

function cleanEntity(value: string) {
  return value
    .replace(/^현재\s+/, "")
    .replace(/\s*(?:이용|사용|방문|참여)\s*(?:경험|현황|행태|실태|빈도)?$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function movementContext(
  rawUserInput: string,
  normalizedInput: string,
  audience: string | null,
  subject: string,
): ParsedSurveyContext | null {
  const movementSubject = subject
    .replace(
      /\s*(?:에\s*대한|에\s*관한)\s*(?:의견|인식|평가)\s*(?:설문\s*)?조사\s*$/,
      "",
    )
    .trim();
  const movementMatch = movementSubject.match(
    /^(.*?)(?:\s+)?(등하교|통학|출퇴근|이동)(?:\s*(?:경험|환경|과정))?(?:\s*(?:과|와)\s*.+)?$/,
  );
  if (!movementMatch) return null;

  const prefix = movementMatch[1].trim();
  const movement = movementMatch[2];
  const verified = lookupVerifiedSurveyKnowledge(prefix || normalizedInput);
  const primaryEntity =
    prefix || (movement === "통학" || movement === "등하교" ? "학교 통학" : `${movement} 경로`);
  const entityType: SurveyContextEntityType =
    verified?.entityType === "building"
      ? "university_building"
      : prefix
        ? /건물|강의동|관$/.test(prefix)
          ? "university_building"
          : "place"
        : "movement";
  const activity =
    movement === "등하교" && primaryEntity !== "학교 통학"
      ? `${primaryEntity} 수업이나 활동을 위해 오가는 이동`
      : movement === "통학" || movement === "등하교"
        ? "학교와 생활 공간 사이를 오가는 통학"
        : movement === "출퇴근"
          ? "근무지와 생활 공간 사이를 오가는 이동"
          : `${primaryEntity}을 오가는 이동`;
  const subjectLabel =
    primaryEntity === "학교 통학" ? "통학" : `${primaryEntity} ${movement}`;

  return {
    rawUserInput,
    normalizedInput,
    audience,
    primaryEntity,
    entityType,
    activity,
    researchGoal: `${subjectLabel} 및 이동 경험 파악`,
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
  };
}

function mixedContext(
  rawUserInput: string,
  normalizedInput: string,
  audience: string | null,
  subject: string,
): ParsedSurveyContext | null {
  if (
    !/(?:이용|사용|방문)\s*경험/.test(subject) ||
    !/(?:도입|개설|마련).*(?:수요|필요)|(?:수요|필요).*(?:도입|개설|마련)/.test(
      subject,
    )
  ) {
    return null;
  }
  const [existing = subject, proposed = "신규 서비스"] = subject.split(
    /(?:과|와|및)\s*(?=.+(?:도입|개설|마련|수요|필요))/,
    2,
  );
  return {
    rawUserInput,
    normalizedInput,
    audience,
    primaryEntity: `${cleanEntity(existing)} 및 ${proposed
      .replace(/\s*(?:도입)?\s*(?:수요|필요)(?:\s*조사)?$/g, "")
      .trim()}`,
    entityType: "mixed",
    activity: `${cleanEntity(existing)} 이용과 신규 대안 검토`,
    researchGoal: "현재 이용 경험과 불편, 신규 대안의 도입 수요를 분리해 파악",
    researchConstructs: [
      "현재 이용 빈도",
      "이용 목적",
      "현재 불편",
      "신규 대안 필요성",
      "이용 의향",
    ],
    surveyArchetype: "mixed",
    isUsageObject: false,
  };
}

export function parseSurveyGenerationContextCore(
  rawUserInput: string,
): ParsedSurveyContext {
  const normalizedInput = normalizeSurveyRequest(rawUserInput);
  const { audience, subject } = splitAudience(normalizedInput);
  const mixed = mixedContext(rawUserInput, normalizedInput, audience, subject);
  if (mixed) return mixed;
  const movement = movementContext(rawUserInput, normalizedInput, audience, subject);
  if (movement) return movement;

  const verified = lookupVerifiedSurveyKnowledge(subject);
  const facilityUse = subject.match(/^(.+?(?:내부\s*)?시설)\s*이용(?:\s*경험)?$/);
  if (facilityUse) {
    const primaryEntity = cleanEntity(facilityUse[1]);
    return {
      rawUserInput,
      normalizedInput,
      audience,
      primaryEntity,
      entityType: "facility",
      activity: `${primaryEntity} 이용`,
      researchGoal: `${primaryEntity} 이용 빈도와 만족도 및 개선점 파악`,
      researchConstructs: ["이용 여부", "이용 빈도", "이용 목적", "만족도", "불편", "개선 수요"],
      surveyArchetype: "facility_usage",
      isUsageObject: true,
    };
  }

  const usageObject = cleanEntity(subject);
  const isPlatform = /웹툰|플랫폼|사이트|SNS|OTT/.test(subject);
  const isProduct = /제품|기기|상품/.test(subject);
  const isService = /서비스|앱|어플|도구|프로그램/.test(subject);
  if (
    /(?:이용|사용|구매|방문)\s*(?:경험|현황|행태|실태|빈도)/.test(
      normalizedInput,
    )
  ) {
    const entityType: SurveyContextEntityType = isPlatform
      ? "platform"
      : isProduct
        ? "product"
        : verified?.entityType === "building"
          ? "university_building"
          : /시설|공간|도서관|식당|카페|건물/.test(subject)
            ? "facility"
            : isService
              ? "service"
              : "service";
    const surveyArchetype: SurveyArchetype =
      entityType === "platform"
        ? "platform_usage"
        : entityType === "product"
          ? "product_usage"
          : entityType === "facility" || entityType === "university_building"
            ? "facility_usage"
            : "service_usage";
    return {
      rawUserInput,
      normalizedInput,
      audience,
      primaryEntity: usageObject,
      entityType,
      activity: `${usageObject} 이용`,
      researchGoal: `${usageObject} 이용 경험과 행태 및 개선점 파악`,
      researchConstructs: ["이용 여부", "이용 빈도", "이용 목적", "만족도", "불편", "개선 수요"],
      surveyArchetype,
      isUsageObject: true,
    };
  }

  if (/수업|강의|학습|교육/.test(subject) && /경험/.test(subject)) {
    return {
      rawUserInput,
      normalizedInput,
      audience,
      primaryEntity: subject.replace(/\s*경험$/g, "").trim(),
      entityType: "learning",
      activity: "수업이나 학습에 참여하는 경험",
      researchGoal: "학습 경험과 어려움 및 개선 요구 파악",
      researchConstructs: ["참여 경험", "학습 과정", "어려움", "만족도", "개선 수요"],
      surveyArchetype: "learning_experience",
      isUsageObject: false,
    };
  }
  if (/관계|소통|교류|갈등/.test(subject)) {
    return {
      rawUserInput,
      normalizedInput,
      audience,
      primaryEntity: subject,
      entityType: "relationship",
      activity: "사람들과 관계를 맺고 소통하는 경험",
      researchGoal: "관계와 소통 경험 및 어려움 파악",
      researchConstructs: ["관계 빈도", "소통 경험", "갈등", "지원 수요"],
      surveyArchetype: "relationship_experience",
      isUsageObject: false,
    };
  }

  const surveyArchetype: SurveyArchetype = /수요|필요/.test(subject)
    ? "demand"
    : /만족도|만족|평가/.test(subject)
      ? "satisfaction"
      : /인식|태도|의견|생각/.test(subject)
        ? "attitude"
        : "attitude";
  const primaryEntity = subject
    .replace(/\s*(?:만족도|만족|평가|인식|태도|의견|생각|수요|필요)(?:\s*조사)?$/g, "")
    .trim() || subject;
  return {
    rawUserInput,
    normalizedInput,
    audience,
    primaryEntity,
    entityType: verified?.entityType === "building" ? "university_building" : "construct",
    activity: null,
    researchGoal:
      surveyArchetype === "demand"
        ? `${primaryEntity}에 대한 필요와 수요 파악`
        : surveyArchetype === "satisfaction"
          ? `${primaryEntity} 만족도와 개선점 파악`
          : `${primaryEntity}에 대한 인식과 의견 파악`,
    researchConstructs:
      surveyArchetype === "demand"
        ? ["현재 필요", "수요 수준", "도입 조건", "우선순위"]
        : surveyArchetype === "satisfaction"
          ? ["전반적 만족도", "세부 평가", "불편", "개선 수요"]
          : ["인지", "태도", "의견", "우려", "개선 수요"],
    surveyArchetype,
    isUsageObject: false,
  };
}

export function surveyTemplateKeyForContext(context: ParsedSurveyContext) {
  return `${context.surveyArchetype}_blueprint`;
}

const usageBlueprintEntityTypes = new Set<SurveyContextEntityType>([
  "service",
  "platform",
  "product",
  "feature",
  "facility",
]);

const usageBlueprintArchetypes = new Set<SurveyArchetype>([
  "service_usage",
  "platform_usage",
  "product_usage",
  "facility_usage",
]);

const surveyRequestWrapperInSubject =
  /(?:에\s*대해|에\s*관해|관련해|조사하고\s*싶|알아보고\s*싶|설문(?:을|를)?\s*만들|(?:만족도|인식|수요)\s*조사)/;

export function canUseUsageBlueprint(
  context: ParsedSurveyContext,
  subject = context.primaryEntity,
) {
  return (
    context.isUsageObject === true &&
    context.surveyArchetype !== "mobility_experience" &&
    usageBlueprintArchetypes.has(context.surveyArchetype) &&
    usageBlueprintEntityTypes.has(context.entityType) &&
    !surveyRequestWrapperInSubject.test(subject)
  );
}

export function lintSurveyQuestionSemantics(
  context: ParsedSurveyContext,
  questions: SemanticQuestionLike[],
) {
  const issues: SurveySemanticLintIssue[] = [];
  const add = (
    code: SurveySemanticLintCode,
    question: SemanticQuestionLike,
    evidence: string,
    message: string,
  ) => {
    if (
      issues.some(
        (item) => item.code === code && item.questionId === question.id,
      )
    ) {
      return;
    }
    issues.push({ code, questionId: question.id, evidence, message });
  };

  for (const question of questions) {
    const title = (question.title ?? question.text ?? "").trim();
    const reason = `${question.reason ?? ""} ${question.analysis?.purpose ?? ""}`.trim();
    const combined = `${title} ${reason}`.trim();
    if (/에\s*(?:대해|관해)\s*(?:를|을)|경험(?:에\s*대해)?(?:를|을)\s*이용/.test(title)) {
      add(
        "MALFORMED_TOPIC_PARTICLE",
        question,
        title,
        "조사 메타 표현이나 경험 명사 뒤에 목적격 조사와 이용 동사가 잘못 결합됨.",
      );
    }
    if (
      /(?:조사하고\s*싶|설문(?:을|를)?\s*만들고\s*싶|알아보고\s*싶)/.test(title) ||
      (context.normalizedInput.length >= 8 &&
        title.includes(context.normalizedInput) &&
        /(?:이용|사용|방문|구매|참여)/.test(title))
    ) {
      add(
        "REQUEST_META_USED_AS_OBJECT",
        question,
        title,
        "조사 의뢰문 전체가 질문의 행동 대상으로 사용됨.",
      );
    }

    if (!context.isUsageObject) {
      const entityMentioned =
        !context.primaryEntity || title.includes(context.primaryEntity);
      const incompatibleUsage =
        entityMentioned &&
        /(?:이용|사용)(?:한|해\s*본)?\s*(?:적|경험)|얼마나\s*자주\s*(?:이용|사용)|(?:이용|사용)\s*빈도/.test(
          title,
        );
      const abstractObjectUsage =
        /(?:경험|인식|태도|만족도|의견|생각)(?:에\s*대해)?(?:를|을)?\s*(?:이용|사용)/.test(
          title,
        );
      const genericUsageAnalysis =
        context.surveyArchetype === "mobility_experience" &&
        /이용\s*경험이\s*있는.*비이용자|이용\s*빈도를\s*구간별/.test(reason);
      if (incompatibleUsage || abstractObjectUsage || genericUsageAnalysis) {
        add(
          "PREDICATE_ENTITY_MISMATCH",
          question,
          combined,
          `${context.entityType}/${context.surveyArchetype} 대상에 이용·사용 서술어를 적용할 수 없음.`,
        );
      }
    }
  }
  return issues;
}
