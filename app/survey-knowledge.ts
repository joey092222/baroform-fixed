export type SurveyEntityType =
  | "building"
  | "cafeteria"
  | "club"
  | "event"
  | "course"
  | "library"
  | "dormitory"
  | "service"
  | "department-experience"
  | "student-life"
  | "other";

export type VerifiedSurveyKnowledge = {
  canonicalName: string;
  aliases: string[];
  entityType: SurveyEntityType;
  summary: string;
  stableFacts: string[];
  surveyDimensions: string[];
  sources: Array<{
    title: string;
    url: string;
  }>;
  verifiedAt: string;
};

// This registry is only an outage fallback for facts already checked against
// public sources. Live AI generation still performs web research for every
// prompt. Do not put volatile facts such as opening hours or prices here.
const verifiedKnowledge: VerifiedSurveyKnowledge[] = [
  {
    canonicalName: "연세대학교 대우관",
    aliases: ["연세대학교 대우관", "연세대 대우관", "대우관"],
    entityType: "building",
    summary:
      "연세대학교 공식 안내에서 대우관은 본관과 별관으로 구성된 교내 교육·연구 건물로 확인돼요. 건물 이용 설문에는 거리와 접근성, 강의실·편의시설, 내부 동선과 실내환경을 함께 다뤄야 해요.",
    stableFacts: [
      "대우관은 본관과 별관으로 구성된 연세대학교 신촌캠퍼스 건물이에요.",
      "강의실·연구실·행정실 등 교육과 대학 운영을 위한 공간으로 사용돼요.",
    ],
    surveyDimensions: [
      "캠퍼스 내 이동 거리와 외부 접근",
      "출입구·계단·엘리베이터와 내부 동선",
      "강의실·학습공간과 수업 설비",
      "화장실·휴게공간 등 편의시설",
      "온도·환기·조명·소음과 혼잡도",
      "청결·안전·교통약자 접근성·유지보수",
    ],
    sources: [
      {
        title: "연세대학교 건물의 역사 · 대우관",
        url: "https://www.yonsei.ac.kr/sc/349/subview.do",
      },
      {
        title: "연세대학교 신촌캠퍼스맵",
        url: "https://www.yonsei.ac.kr/campusMap/sc/view.do",
      },
    ],
    verifiedAt: "2026-07-31",
  },
  {
    canonicalName: "연세대학교 맛나샘식당",
    aliases: ["연세대학교 맛나샘식당", "연세대 맛나샘", "맛나샘식당", "맛나샘"],
    entityType: "cafeteria",
    summary:
      "연세대학교 공식 편의시설 안내에서 맛나샘은 학생회관에 있는 학식당으로 확인돼요. 식당 설문에는 맛·메뉴·가격·양뿐 아니라 대기, 좌석, 위생과 이용 편의를 함께 다뤄야 해요.",
    stableFacts: [
      "맛나샘은 연세대학교 학생회관에 있는 식당이에요.",
      "학생들이 식사를 위해 이용하는 교내 편의시설이에요.",
    ],
    surveyDimensions: [
      "음식의 맛과 품질",
      "메뉴 다양성·가격·양",
      "대기시간과 주문·배식 편의",
      "좌석·혼잡도와 청결·위생",
      "접근성과 이용 가능 시간대",
    ],
    sources: [
      {
        title: "연세대학교 편의시설 · 맛나샘식당",
        url: "https://www.yonsei.ac.kr/sc/366/subview.do",
      },
    ],
    verifiedAt: "2026-07-31",
  },
];

const normalizeLookupText = (value: string) =>
  value
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ko-KR");

export function lookupVerifiedSurveyKnowledge(
  prompt: string,
): VerifiedSurveyKnowledge | null {
  const normalized = normalizeLookupText(prompt);
  const matches = verifiedKnowledge
    .flatMap((entry) =>
      entry.aliases.map((alias) => ({
        entry,
        alias: normalizeLookupText(alias),
      })),
    )
    .filter(({ alias }) => alias.length >= 2 && normalized.includes(alias))
    .sort((left, right) => right.alias.length - left.alias.length);

  return matches[0]?.entry ?? null;
}

