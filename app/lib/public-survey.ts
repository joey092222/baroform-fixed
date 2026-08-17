import { and, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "@/db";
import { surveys } from "@/db/schema";
import {
  isSurveyCategory,
  type SurveyCategory,
} from "@/app/survey-board";
import type { SurveyQuestion } from "@/app/survey-intent";

export const publicSurveyCacheTag = "public-surveys";
export const publicSurveyRevalidateSeconds = 300;

export type PublicSurveyData = {
  slug: string;
  title: string;
  description: string;
  ownerName: string;
  schoolId: string;
  category: SurveyCategory;
  campus: string;
  targetAudience: string;
  durationMinutes: number;
  rewardCash: number;
  questionCount: number;
  questions: SurveyQuestion[];
  createdAt: string;
  updatedAt: string;
};

export function isValidSurveyShareToken(value: string) {
  return /^[a-f0-9]{12}$/.test(value);
}

export function defaultSurveyAudience(schoolId: string) {
  if (schoolId === "yonsei") return "연세대학교 재학생";
  return "대학생";
}

function parsePublicQuestions(value: string) {
  try {
    const questions = JSON.parse(value) as unknown;
    return Array.isArray(questions) ? (questions as SurveyQuestion[]) : [];
  } catch {
    return [];
  }
}

const getCachedPublicSurvey = unstable_cache(
  async (shareToken: string): Promise<PublicSurveyData | null> => {
    if (!isValidSurveyShareToken(shareToken)) return null;

    const db = await getDb();
    const [row] = await db
      .select({
        slug: surveys.slug,
        title: surveys.title,
        description: surveys.description,
        ownerName: surveys.ownerName,
        schoolId: surveys.schoolId,
        category: surveys.category,
        campus: surveys.campus,
        targetAudience: surveys.targetAudience,
        durationMinutes: surveys.durationMinutes,
        rewardCash: surveys.rewardCash,
        questionsJson: surveys.questionsJson,
        createdAt: surveys.createdAt,
        updatedAt: surveys.updatedAt,
      })
      .from(surveys)
      .where(
        and(
          eq(surveys.slug, shareToken),
          eq(surveys.isPublic, true),
        ),
      )
      .limit(1);

    if (!row) return null;

    const questions = parsePublicQuestions(row.questionsJson);
    return {
      slug: row.slug,
      title: row.title,
      description: row.description,
      ownerName: row.ownerName,
      schoolId: row.schoolId,
      category: isSurveyCategory(row.category) ? row.category : "campus",
      campus: row.campus,
      targetAudience:
        row.targetAudience.trim() || defaultSurveyAudience(row.schoolId),
      durationMinutes: row.durationMinutes,
      rewardCash: row.rewardCash,
      questionCount: questions.filter((question) => question.type !== "section")
        .length,
      questions,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  },
  ["public-survey-by-share-token"],
  {
    tags: [publicSurveyCacheTag],
    revalidate: publicSurveyRevalidateSeconds,
  },
);

export async function getPublicSurvey(shareToken: string) {
  return getCachedPublicSurvey(shareToken);
}
