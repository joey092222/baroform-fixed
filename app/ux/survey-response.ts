import type { Question, StoredAnswer } from "./types";

/**
 * Respondent-side rules as pure functions: what counts as answered,
 * how far along you are, and what blocks submission.
 */

export type AnswerValue = number | string | string[];
export type AnswerMap = Record<number, AnswerValue>;

export const maxLongAnswerLength = 4000;
export const maxShortAnswerLength = 500;

/** Sections are prose, not questions — they never count toward progress or validation. */
export function answerableQuestions(questions: Question[]) {
  return questions.filter((question) => question.type !== "section");
}

export function isAnswered(value: AnswerValue | undefined) {
  if (value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function countAnswered(questions: Question[], answers: AnswerMap) {
  return answerableQuestions(questions).reduce(
    (count, question) => count + (isAnswered(answers[question.id]) ? 1 : 0),
    0,
  );
}

export function answerProgress(questions: Question[], answers: AnswerMap) {
  const total = answerableQuestions(questions).length;
  const answered = countAnswered(questions, answers);
  return {
    answered,
    total,
    percent: total ? Math.round((answered / total) * 100) : 0,
  };
}

/** The first required question left blank, or null when the response is submittable. */
export function firstMissingRequired(
  questions: Question[],
  answers: AnswerMap,
): Question | null {
  return (
    questions.find(
      (question) =>
        question.required &&
        question.type !== "section" &&
        !isAnswered(answers[question.id]),
    ) ?? null
  );
}

export function toggleChoiceAnswer(
  answers: AnswerMap,
  questionId: number,
  choice: string,
): AnswerMap {
  const current = Array.isArray(answers[questionId])
    ? (answers[questionId] as string[])
    : [];
  return {
    ...answers,
    [questionId]: current.includes(choice)
      ? current.filter((item) => item !== choice)
      : [...current, choice],
  };
}

export function scaleValues(question: Question) {
  const min = question.scaleMin ?? 1;
  const max = question.scaleMax ?? 5;
  return Array.from({ length: max - min + 1 }, (_, offset) => min + offset);
}

export function answerLengthLimit(type: Question["type"]) {
  if (type === "text") return maxLongAnswerLength;
  if (type === "shortText") return maxShortAnswerLength;
  return undefined;
}

/** Unanswered questions are submitted as "" so the server sees the full shape. */
export function buildResponsePayload(
  questions: Question[],
  answers: AnswerMap,
): StoredAnswer[] {
  return questions.map((question) => ({
    questionId: question.id,
    title: question.title,
    type: question.type,
    value: answers[question.id] ?? "",
  }));
}

export function completionSeconds(startedAtMs: number, nowMs: number) {
  return Math.round((nowMs - startedAtMs) / 1000);
}
