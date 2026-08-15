export const surveyModeValues = ["standard", "research"] as const;

export type SurveyMode = (typeof surveyModeValues)[number];

export const defaultSurveyMode: SurveyMode = "standard";

export const surveyModeOptions = [
  {
    value: "standard",
    label: "일반 설문",
    description:
      "수업 과제, 만족도, 이용 현황처럼 빠르고 자연스러운 설문이 필요할 때",
  },
  {
    value: "research",
    label: "정밀·연구 설문",
    description:
      "논문, 가설 검증, 복잡한 분기처럼 정교한 설문이 필요할 때",
  },
] as const satisfies ReadonlyArray<{
  value: SurveyMode;
  label: string;
  description: string;
}>;

export const surveyModeLoadingMessages: Record<SurveyMode, readonly string[]> = {
  standard: [
    "입력 내용을 확인하고 있어요",
    "관련 정보를 확인하고 있어요",
    "설문 구조를 만들고 있어요",
    "문항과 선택지를 검토하고 있어요",
    "설문을 완성하고 있어요",
  ],
  research: [
    "연구 목적을 정리하고 있어요",
    "관련 자료를 확인하고 있어요",
    "변수와 측정 구조를 설계하고 있어요",
    "문항과 분기를 검토하고 있어요",
    "설문 초안을 완성하고 있어요",
  ],
};

export type SurveyModeReferenceMetadata = {
  files?: ReadonlyArray<{ name?: string; mimeType?: string }>;
};

const researchIntentPattern =
  /(?:논문|학술|학위|졸업\s*논문|연구\s*(?:모형|모델|질문|가설|설계)|가설\s*검증|독립\s*변수|종속\s*변수|매개\s*변수|조절\s*변수|매개\s*효과|조절\s*효과|신뢰도|타당도|회귀\s*분석|요인\s*분석|구조\s*방정식|다층\s*분석|통계적?\s*검증|척도|리커트|통제\s*변수|집단\s*비교|인과\s*관계)/i;

const academicFileNamePattern =
  /(?:논문|학술|학위|연구\s*(?:계획|모형|설계)|가설|척도|thesis|dissertation|journal|paper|article|scale)/i;

export function isSurveyMode(value: unknown): value is SurveyMode {
  return typeof value === "string" &&
    (surveyModeValues as readonly string[]).includes(value);
}

export function parseRequestedSurveyMode(value: unknown): SurveyMode | null {
  if (typeof value === "undefined") return defaultSurveyMode;
  return isSurveyMode(value) ? value : null;
}

export function recommendSurveyMode(
  prompt: string,
  references: SurveyModeReferenceMetadata = {},
): SurveyMode {
  if (researchIntentPattern.test(prompt.replace(/\s+/g, " ").trim())) {
    return "research";
  }

  const hasAcademicReference = (references.files ?? []).some((file) => {
    const name = file.name?.trim() ?? "";
    const mimeType = file.mimeType?.toLowerCase() ?? "";
    return (
      academicFileNamePattern.test(name) &&
      (mimeType === "application/pdf" ||
        mimeType.includes("word") ||
        mimeType.includes("document") ||
        mimeType === "")
    );
  });

  return hasAcademicReference ? "research" : "standard";
}
