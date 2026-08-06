import type { SurveyQuestion } from "./survey-intent";

export const targetGradeValues = [
  "1학년",
  "2학년",
  "3학년",
  "4학년",
  "1-2학년",
  "3-4학년",
  "전학년",
] as const;

export type TargetGrade = (typeof targetGradeValues)[number];

export function isTargetGrade(value: string): value is TargetGrade {
  return (targetGradeValues as readonly string[]).includes(value);
}

function naturalGradeRange(targetGrade: TargetGrade) {
  if (targetGrade === "1-2학년") return "1학년 또는 2학년";
  if (targetGrade === "3-4학년") return "3학년 또는 4학년";
  return targetGrade;
}

export function surveyAudienceLabel(targetGrade: TargetGrade) {
  return targetGrade === "전학년"
    ? "연세대학교 재학생"
    : `연세대학교 ${naturalGradeRange(targetGrade)} 재학생`;
}

export function gradeEligibilityTitle(targetGrade: TargetGrade) {
  return targetGrade === "전학년"
    ? null
    : `귀하는 현재 ${surveyAudienceLabel(targetGrade)}입니까?`;
}

const leadingGradeAudience =
  /^(?:현재\s*)?(?:연세대학교(?:\s*신촌캠퍼스)?\s*)?(?:(?:[1-4]\s*학년)|(?:[13]\s*[-·~]\s*[24]\s*학년)|(?:[13]\s*학년\s*(?:또는|혹은|및|·)\s*[24]\s*학년)|(?:전\s*학년))\s*재학생\s*(?:중|가운데)?\s*/;

export function respondentGroupForGrade(
  respondentGroup: string | null | undefined,
  targetGrade: TargetGrade,
) {
  const audience = surveyAudienceLabel(targetGrade);
  const detail = (respondentGroup ?? "")
    .replace(leadingGradeAudience, "")
    .replace(/^(?:대학생|학생|재학생)(?:들)?$/, "")
    .trim();
  return detail ? `${audience} 중 ${detail}`.slice(0, 80) : audience;
}

const leadingAudienceDescription =
  /^(?:(?:응답\s*대상은\s*)?(?:연세대학교(?:\s*신촌캠퍼스)?\s*)?(?:(?:[1-4]\s*학년)|(?:[13]\s*[-·~]\s*[24]\s*학년)|(?:[13]\s*학년\s*(?:또는|혹은|및|·)\s*[24]\s*학년)|(?:전\s*학년))\s*재학생\s*(?:이며|이고|이면서)|(?:연세대학교(?:\s*신촌캠퍼스)?\s*)?(?:(?:[1-4]\s*학년)|(?:[13]\s*[-·~]\s*[24]\s*학년)|(?:[13]\s*학년\s*(?:또는|혹은|및|·)\s*[24]\s*학년)|(?:전\s*학년))\s*재학생(?:을|를)\s*대상으로)\s*,?\s*/;

export function surveyDescriptionForGrade(
  description: string,
  targetGrade: TargetGrade,
) {
  const audience = surveyAudienceLabel(targetGrade);
  const detail = description.replace(leadingAudienceDescription, "").trim();
  return detail
    ? `${audience}을 대상으로, ${detail}`.slice(0, 500)
    : `${audience}을 대상으로 한 설문입니다.`;
}

const combinedGradeClause =
  /^(?:귀하는\s*)?(?:현재\s*)?(?:연세대학교(?:\s*신촌캠퍼스)?\s*)?(?:(?:[1-4]\s*학년)|(?:[13]\s*[-·~]\s*[24]\s*학년)|(?:[13]\s*학년\s*(?:또는|혹은|및|·)\s*[24]\s*학년)|(?:전\s*학년))\s*재학생(?:이며|이고|이면서|이자|으로서)\s*,?\s*/;

const gradeOnlyQuestion =
  /(?:연세대학교(?:\s*신촌캠퍼스)?\s*)?(?:(?:[1-4]\s*학년)|(?:[13]\s*[-·~]\s*[24]\s*학년)|(?:[13]\s*학년\s*(?:또는|혹은|및|·)\s*[24]\s*학년)|(?:전\s*학년))\s*(?:재학생)?(?:입니까|인가요|이신가요|에\s*해당하나요)/;

const schoolOnlyQuestion =
  /연세대학교(?:\s*신촌캠퍼스)?\s*재학생(?:입니까|인가요|이신가요|에\s*해당하나요)/;

function cleanQuestionTitle(title: string) {
  const separated = title.replace(combinedGradeClause, "").trim();
  return separated
    .replace(
      /연세대학교(?:\s*신촌캠퍼스)?\s*전\s*학년\s*재학생/g,
      "연세대학교 재학생",
    )
    .replace(/전\s*학년\s*재학생/g, "재학생 전체");
}

function fitQuestionCount(questions: SurveyQuestion[], requestedCount: number) {
  const count = Math.min(30, Math.max(1, Math.round(requestedCount)));
  const result = questions
    .filter((question) => question.title.trim())
    .map((question) => ({ ...question }));

  while (result.length > count) {
    const lastIndex = result.length - 1;
    const dropIndex =
      result[lastIndex]?.type === "text" && result.length > 2
        ? lastIndex - 1
        : lastIndex;
    result.splice(dropIndex, 1);
  }

  return result.map((question, index) => ({
    ...question,
    id: index + 1,
  }));
}

export function applyTargetGradeToQuestions(
  questions: SurveyQuestion[],
  targetGrade: TargetGrade,
  requestedCount: number,
) {
  const cleaned = questions.map((question) => ({
    ...question,
    title: cleanQuestionTitle(question.title),
  }));

  if (targetGrade === "전학년") {
    return fitQuestionCount(
      cleaned.filter((question) => !gradeOnlyQuestion.test(question.title)),
      requestedCount,
    );
  }

  const eligibilityQuestion: SurveyQuestion = {
    id: 1,
    title: gradeEligibilityTitle(targetGrade) ?? "",
    reason: "선택한 학년 조건에 맞는 응답자인지 먼저 확인합니다.",
    type: "single",
    options: ["예", "아니요"],
    required: true,
  };
  const withoutGradeQuestions = cleaned.filter(
    (question) =>
      !gradeOnlyQuestion.test(question.title) &&
      !schoolOnlyQuestion.test(question.title),
  );

  return fitQuestionCount(
    [eligibilityQuestion, ...withoutGradeQuestions],
    requestedCount,
  );
}
