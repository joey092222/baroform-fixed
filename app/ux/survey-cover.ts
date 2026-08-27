import { surveyCategories, type SurveyCategory } from "../survey-board";
import type { PublicSurvey } from "./types";

/**
 * Cover art rules as pure functions.
 *
 * Every survey card shows a cover. A cover is a photo with the survey's topic
 * set over it, so the photo carries mood and the words carry meaning — a photo
 * that misses the topic degrades to "odd backdrop" instead of "unreadable card".
 *
 * Nothing here fetches. Photo packs are downloaded ahead of time (see
 * `coverSearchTerms`) and served from `/covers/<category>/<index>.jpg`, so
 * rendering a card costs no network call and no API quota.
 */

export type CoverTone = {
  /** Fallback field colour when no photo exists. */
  readonly field: string;
  /** Topic colour on that field. */
  readonly ink: string;
};

export type SurveyCover =
  | {
      readonly kind: "photo";
      readonly src: string;
      readonly keyword: string;
      readonly tag: string;
      readonly tone: CoverTone;
    }
  | {
      readonly kind: "topic";
      readonly keyword: string;
      readonly tag: string;
      readonly tone: CoverTone;
    };

/** How many photos we keep per category. Index is `0..packSize - 1`. */
export const coverPackSize = 8;

/** Longest topic we set over a cover before trimming. Two lines at display size. */
export const maxCoverKeywordLength = 18;

/**
 * Search terms used to build each category's photo pack, in priority order.
 * Korean first — Pexels matches Korean natively via `locale=ko-KR` and returns
 * more situationally right frames for campus subjects than the English terms do.
 */
export const coverSearchTerms: Record<SurveyCategory, readonly string[]> = {
  course: ["강의실", "공부하는 학생", "노트 필기", "university lecture hall"],
  club: ["동아리 활동", "공연 무대", "team celebration", "student club"],
  research: ["실험실", "연구 자료", "laboratory research", "data analysis"],
  campus: ["대학 캠퍼스", "도서관", "학생식당", "campus building"],
  career: ["면접", "사무실 회의", "job interview", "office desk work"],
  other: ["도시 거리", "카페 창가", "everyday city life", "abstract texture"],
};

const tones: Record<SurveyCategory, CoverTone> = {
  course: { field: "#F3EDFA", ink: "#4A2C73" },
  club: { field: "#FDF0F4", ink: "#7A2444" },
  research: { field: "#E9F0FB", ink: "#1B3F73" },
  campus: { field: "#FFF0E8", ink: "#9C3608" },
  career: { field: "#EAF5EE", ink: "#1D5638" },
  other: { field: "#EFF1F3", ink: "#333B47" },
};

export function coverTone(category: SurveyCategory): CoverTone {
  return tones[category];
}

export function categoryLabel(category: SurveyCategory): string {
  return (
    surveyCategories.find((entry) => entry.id === category)?.label ?? "기타"
  );
}

/**
 * Stable index into a category's photo pack.
 *
 * Keyed on the slug so a survey keeps the same cover forever — a card that
 * changed its photo between two visits would read as a different survey. Two
 * surveys in one category can collide; that is acceptable, and a larger pack is
 * the lever if it shows.
 */
export function coverPhotoIndex(slug: string, packSize = coverPackSize): number {
  if (packSize <= 0) return 0;
  let hash = 0;
  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) % 0x7fffffff;
  }
  return hash % packSize;
}

export function coverPhotoSrc(
  category: SurveyCategory,
  slug: string,
  packSize = coverPackSize,
): string {
  return `/covers/${category}/${coverPhotoIndex(slug, packSize)}.jpg`;
}

const trailingQuestion =
  /\s*(?:에\s*(?:대한|관한)\s*(?:설문|조사|의견)|설문(?:조사)?|조사|에\s*대해\s*묻습니다)\s*$/;
/**
 * Interrogative tails. A title with no comma is one whole question, and setting
 * a whole question on a cover just repeats the title underneath it — so the
 * verb ending comes off and the noun phrase is what stays.
 */
const trailingPredicate =
  /\s*(?:무엇인가요|뭔가요|뭘까요|어떤가요|어떨까요|어떠세요|괜찮을까요|맞을까요|좋을까요|필요할까요|해야\s*할까요|하면\s*좋을까요|있나요|없나요|하나요|되나요|드나요|시나요|나요|까요|가요|을까|ㄹ까)\s*$/;
/** The particle left dangling once the predicate is gone. */
const danglingParticle = /\s*(?:은|는|이|가|을|를|와|과|의|도|만)$/;
const trailingPunctuation = /[?!.…\s]+$/;
const parenthetical = /\s*[([{（][^)\]}）]*[)\]}）]\s*/g;

/**
 * The topic to set over the cover, derived from the title.
 *
 * Titles are usually a question ("도서관 좌석 예약제, 지금 방식이 맞을까요?") while a
 * cover wants the subject ("도서관 좌석 예약제"). We take the clause before the
 * first comma, drop parentheticals and survey boilerplate, and trim. Generation
 * can override this by storing an explicit topic — see `surveyCover`.
 */
export function coverKeywordFromTitle(title: string): string {
  const cleaned = title.replace(parenthetical, " ").trim();
  const [firstClause] = cleaned.split(/[,·]/);
  const clause = (firstClause ?? "").trim() || cleaned;
  let trimmed = clause
    .replace(trailingQuestion, "")
    .replace(trailingPunctuation, "")
    .trim();
  // A question mark is the signal. It means the whole clause was interrogative,
  // so the verb ending and the particle holding it are both scaffolding:
  // "협업 도구는?" → "협업 도구", "이유가 뭔가요?" → "이유". Without one, nothing is
  // stripped — "학식 만족도 조사" keeps its 도, which is part of the word.
  // A title that put its subject before a comma already gave us the topic.
  if (clause === cleaned && /[?？]\s*$/.test(clause)) {
    const shortened = trimmed
      .replace(trailingPredicate, "")
      .replace(trailingPunctuation, "")
      .replace(danglingParticle, "")
      .trim();
    if (shortened.length >= 2) trimmed = shortened;
  }
  // A title of nothing but punctuation strips to "". Fall back to the raw title
  // rather than let a card render a blank cover.
  const keyword = trimmed || cleaned || title.trim();
  if (keyword.length <= maxCoverKeywordLength) return keyword;
  return `${keyword.slice(0, maxCoverKeywordLength - 1).trimEnd()}…`;
}

/**
 * Resolve a survey to the cover a card should render.
 *
 * `hasPhotoPack` is false until a category's pack is on disk, which is why the
 * topic-only cover is not a degraded state but a supported one: search comes up
 * empty for some subjects, and a card must never render blank.
 */
export function surveyCover(
  survey: Pick<PublicSurvey, "slug" | "title" | "category">,
  options: { hasPhotoPack?: boolean; packSize?: number } = {},
): SurveyCover {
  const { hasPhotoPack = true, packSize = coverPackSize } = options;
  const tone = coverTone(survey.category);
  const shared = {
    keyword: coverKeywordFromTitle(survey.title),
    tag: categoryLabel(survey.category),
    tone,
  } as const;
  if (!hasPhotoPack || packSize <= 0) return { kind: "topic", ...shared };
  return {
    kind: "photo",
    src: coverPhotoSrc(survey.category, survey.slug, packSize),
    ...shared,
  };
}

/** Attribution Pexels requires in exchange for the free tier. */
export const photoCreditNotice = {
  text: "사진 제공: Pexels",
  href: "https://www.pexels.com",
} as const;
