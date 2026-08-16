export const surveyTopicCategories = [
  "service_product",
  "place_facility",
  "behavior_usage",
  "ability_skill",
  "attitude_perception",
  "satisfaction_evaluation",
  "need_demand",
  "event_program",
  "academic_construct",
] as const;

export type SurveyTopicCategory = (typeof surveyTopicCategories)[number];

export type StructuredSurveyInput = {
  topic: string;
  target: string;
  objective: string;
  keyAspects: string[];
  referencePeriod: string;
  context: string;
};

export type SurveyFormValues = {
  topic: string;
  target: string;
  objective: string;
  keyAspects: string;
  referencePeriod: string;
  context: string;
};

export const emptySurveyFormValues: SurveyFormValues = {
  topic: "",
  target: "",
  objective: "",
  keyAspects: "",
  referencePeriod: "",
  context: "",
};

function clean(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}

export function parseKeyAspects(value: unknown) {
  const candidates = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n;·]+/)
      : [];
  return [...new Set(candidates.map((item) => clean(item, 100)).filter(Boolean))].slice(0, 12);
}

export function normalizeStructuredSurveyInput(
  value: Partial<StructuredSurveyInput> | SurveyFormValues,
): StructuredSurveyInput {
  return {
    topic: clean(value.topic, 160),
    target: clean(value.target, 160),
    objective: clean(value.objective, 500),
    keyAspects: parseKeyAspects(value.keyAspects),
    referencePeriod: clean(value.referencePeriod, 160),
    context: clean(value.context, 500),
  };
}

export function hasStructuredSurveyInput(
  value: Partial<StructuredSurveyInput> | null | undefined,
) {
  return Boolean(
    value &&
      (value.topic?.trim() ||
        value.target?.trim() ||
        value.objective?.trim() ||
        value.keyAspects?.length ||
        value.referencePeriod?.trim() ||
        value.context?.trim()),
  );
}

export function structuredSurveyInputErrors(value: StructuredSurveyInput) {
  return {
    topic: value.topic ? "" : "조사할 주제를 입력해주세요.",
    target: value.target ? "" : "설문에 응답할 대상을 입력해주세요.",
    objective: value.objective ? "" : "이 설문으로 알고 싶은 내용을 입력해주세요.",
  };
}

export function isCompleteStructuredSurveyInput(value: StructuredSurveyInput) {
  const errors = structuredSurveyInputErrors(value);
  return !errors.topic && !errors.target && !errors.objective;
}

export function classifySurveyTopic(
  value: Pick<StructuredSurveyInput, "topic" | "objective" | "keyAspects"> | string,
): SurveyTopicCategory {
  const topic = typeof value === "string" ? value : value.topic;
  const supporting =
    typeof value === "string" ? "" : `${value.objective} ${value.keyAspects.join(" ")}`;
  const subject = clean(topic, 300);
  const whole = `${subject} ${supporting}`;

  // A measurement construct takes precedence over incidental words such as "사용".
  if (/능력|역량|숙련|리터러시|문해력|기술\s*수준|활용\s*수준/.test(subject)) {
    return "ability_skill";
  }
  if (/만족도|만족\s*수준|평가|품질\s*평가/.test(subject)) {
    return "satisfaction_evaluation";
  }
  if (/수요|필요(?:성|도)?|요구|교육\s*의향|지원\s*의향/.test(subject)) {
    return "need_demand";
  }
  if (/인식|태도|의견|이미지|선호|관점/.test(subject)) {
    return "attitude_perception";
  }
  if (/영향|상관|관계|가설|매개|조절|구성개념|학업\s*성취/.test(subject)) {
    return "academic_construct";
  }
  if (/프로그램|행사|축제|워크숍|캠프|상담\s*(?:지원|프로그램)/.test(subject)) {
    return "event_program";
  }
  if (
    /맛나샘|도서관|식당|카페|기숙사|생활관|강의실|체육관|시설|공간|장소|건물|대우관/.test(
      subject,
    )
  ) {
    return "place_facility";
  }
  if (
    /네이버\s*웹툰|웹툰|앱|서비스|플랫폼|제품|브랜드|웹사이트|사이트|소프트웨어/.test(
      subject,
    )
  ) {
    return "service_product";
  }
  if (/이용|사용|행동|경험|빈도|시간|횟수|현황|습관|패턴/.test(whole)) {
    return "behavior_usage";
  }
  return "attitude_perception";
}

export function topicCategoryAllowsExperienceScreener(
  category: SurveyTopicCategory,
) {
  return (
    category === "service_product" ||
    category === "place_facility" ||
    category === "behavior_usage" ||
    category === "event_program"
  );
}

export function structuredSurveyCacheKey(value: StructuredSurveyInput) {
  return JSON.stringify([
    value.topic,
    value.target,
    value.objective,
    value.keyAspects,
    value.referencePeriod,
    value.context,
  ]);
}
