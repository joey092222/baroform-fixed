// 설문 카드 썸네일 — 제목·카테고리에서 주제를 읽어 어울리는 사진을 고른다.
// 랜덤 이미지 대신, 한국어 주제어를 사진 검색어로 옮겨 같은 설문은 늘 같은 사진이 나온다.
import type { SurveyCategory } from "./survey-board";

type Rule = { match: RegExp; keywords: string };

// 위에서부터 먼저 걸리는 규칙을 쓴다. 구체적인 주제가 위로 온다.
const topicRules: Rule[] = [
  { match: /축제|공연|라인업|가수|콘서트|아카라카|대동제/, keywords: "concert,festival,stage" },
  { match: /도서관|열람실|스터디|공부|자습/, keywords: "library,study,books" },
  { match: /식당|학식|맛집|카페|메뉴|음식|배달|먹/, keywords: "cafe,food,restaurant" },
  { match: /운동|헬스|체육|스포츠|러닝|등산/, keywords: "gym,sports,running" },
  { match: /알바|아르바이트|시급|근로|일자리/, keywords: "barista,parttime,work" },
  { match: /인턴|취업|채용|면접|커리어|진로|자소서/, keywords: "office,interview,career" },
  { match: /대학원|논문|연구|학술|IRB|실험/, keywords: "research,laboratory,science" },
  { match: /수업|강의|과제|학점|시험|성적|전공|수강/, keywords: "classroom,lecture,campus" },
  { match: /동아리|학회|모집|지원서|신입|서포터즈|대외활동/, keywords: "team,club,students" },
  { match: /셔틀|버스|지하철|통학|등하교|교통|자전거/, keywords: "bus,commute,transport" },
  { match: /기숙사|자취|원룸|주거|하숙/, keywords: "dormitory,apartment,room" },
  { match: /카카오톡|인스타|SNS|유튜브|틱톡|미디어|앱|어플/, keywords: "smartphone,socialmedia,app" },
  { match: /소비|가격|지출|용돈|금융|투자|재테크|캐시/, keywords: "shopping,money,wallet" },
  { match: /연애|데이트|친구|인간관계|소개팅/, keywords: "couple,date,friends" },
  { match: /여행|방학|해외|교환학생|워홀/, keywords: "travel,airport,suitcase" },
  { match: /운전|면허|자동차/, keywords: "driving,car,road" },
  { match: /건강|수면|스트레스|정신|상담|다이어트/, keywords: "wellness,sleep,calm" },
  { match: /환경|재활용|기후|봉사/, keywords: "nature,recycle,volunteer" },
  { match: /브랜드|마케팅|제품|서비스|창업|수요/, keywords: "startup,brand,marketing" },
  { match: /선물|쇼핑|택배|배송/, keywords: "gift,delivery,package" },
  { match: /시설|공간|캠퍼스|건물|강의실|교내/, keywords: "campus,building,university" },
  { match: /북한|정치|사회|인식|여론/, keywords: "newspaper,city,people" },
];

const categoryKeywords: Record<string, string> = {
  course: "classroom,lecture,campus",
  club: "team,club,students",
  research: "research,laboratory,science",
  campus: "campus,university,building",
  career: "office,interview,career",
  other: "university,students,campus",
};

/** 같은 설문은 늘 같은 사진이 나오도록 slug에서 고정 seed를 만든다 */
function lockSeed(slug: string) {
  let hash = 0;
  for (const character of slug) {
    hash = (hash * 31 + character.charCodeAt(0)) % 100000;
  }
  return hash;
}

export function surveyImageKeywords(
  title: string,
  category?: SurveyCategory | string,
) {
  for (const rule of topicRules) {
    if (rule.match.test(title)) return rule.keywords;
  }
  return categoryKeywords[category ?? "other"] ?? categoryKeywords.other;
}

export function surveyImageUrl(survey: {
  slug: string;
  title: string;
  category?: string;
}) {
  const keywords = surveyImageKeywords(survey.title, survey.category);
  return `https://loremflickr.com/560/300/${keywords}?lock=${lockSeed(survey.slug)}`;
}
