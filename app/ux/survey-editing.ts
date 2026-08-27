import type { Question } from "./types";

/**
 * Every structural rule for editing a survey draft, as pure functions.
 * No React, no markup — a replacement editor UI calls exactly these.
 *
 * Each function returns the SAME array reference when a limit blocks the edit,
 * so a caller can detect a no-op with `next === questions`.
 */

export const maxQuestions = 30;
export const maxOptionsPerQuestion = 12;
export const minOptionsPerQuestion = 2;
export const maxQuestionTitleLength = 200;
/** Below this a title is a placeholder, not a question. Used by the structure check. */
export const minQuestionTitleLength = 5;

export const defaultQuestionOptions = ["선택지 1", "선택지 2", "선택지 3"];
export const defaultScaleMin = 1;
export const defaultScaleMax = 5;
export const neutralOptionLabel = "잘 모르겠음";

/** Seed copy for newly added items. A new UI may pass its own via the `seed` args. */
export const questionSeed = {
  title: "새 질문을 입력해주세요.",
  reason: "이 질문이 필요한 이유를 AI가 함께 정리해드려요.",
};

export const sectionSeed = {
  title: "새 섹션",
  description: "섹션에 대한 안내를 입력해주세요.",
};

const choiceTypes: ReadonlyArray<Question["type"]> = [
  "single",
  "multiple",
  "dropdown",
];

export function isChoiceQuestion(type: Question["type"]) {
  return choiceTypes.includes(type);
}

function nextQuestionId(questions: Question[]) {
  return Math.max(...questions.map((question) => question.id), 0) + 1;
}

export function normalizeQuestionTitle(value: string) {
  return value.replace(/\r?\n/g, " ").slice(0, maxQuestionTitleLength);
}

export function addQuestion(
  questions: Question[],
  seed = questionSeed,
): { questions: Question[]; addedId: number | null } {
  if (questions.length >= maxQuestions) {
    return { questions, addedId: null };
  }
  const id = nextQuestionId(questions);
  return {
    questions: [
      ...questions,
      {
        id,
        title: seed.title,
        reason: seed.reason,
        type: "single",
        options: [...defaultQuestionOptions],
        required: false,
      },
    ],
    addedId: id,
  };
}

export function addSection(
  questions: Question[],
  seed = sectionSeed,
): { questions: Question[]; addedId: number | null } {
  if (questions.length >= maxQuestions) {
    return { questions, addedId: null };
  }
  const id = nextQuestionId(questions);
  return {
    questions: [
      ...questions,
      {
        id,
        title: seed.title,
        description: seed.description,
        reason: "",
        type: "section",
        required: false,
      },
    ],
    addedId: id,
  };
}

/** The draft must always keep at least one question. */
export function removeQuestion(questions: Question[], id: number) {
  if (questions.length <= 1) return questions;
  return questions.filter((question) => question.id !== id);
}

export function duplicateQuestion(
  questions: Question[],
  id: number,
): { questions: Question[]; addedId: number | null } {
  if (questions.length >= maxQuestions) {
    return { questions, addedId: null };
  }
  const sourceIndex = questions.findIndex((question) => question.id === id);
  if (sourceIndex < 0) return { questions, addedId: null };
  const addedId = nextQuestionId(questions);
  const next = [...questions];
  const source = questions[sourceIndex];
  next.splice(sourceIndex + 1, 0, {
    ...source,
    id: addedId,
    options: source.options ? [...source.options] : undefined,
  });
  return { questions: next, addedId };
}

export function moveQuestion(
  questions: Question[],
  id: number,
  direction: -1 | 1,
) {
  const currentIndex = questions.findIndex((question) => question.id === id);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= questions.length) {
    return questions;
  }
  const next = [...questions];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return next;
}

export function updateQuestionField<K extends keyof Question>(
  questions: Question[],
  id: number,
  key: K,
  value: Question[K],
) {
  return questions.map((question) =>
    question.id === id ? { ...question, [key]: value } : question,
  );
}

/**
 * Switching type keeps the shape consistent: choice types always carry options,
 * scale always carries bounds, sections are never required.
 */
export function changeQuestionType(
  questions: Question[],
  id: number,
  type: Question["type"],
) {
  return questions.map((question) =>
    question.id === id
      ? {
          ...question,
          type,
          options: isChoiceQuestion(type)
            ? question.options?.length
              ? question.options
              : [...defaultQuestionOptions]
            : undefined,
          required: type === "section" ? false : question.required,
          scaleMin:
            type === "scale" ? question.scaleMin ?? defaultScaleMin : undefined,
          scaleMax:
            type === "scale" ? question.scaleMax ?? defaultScaleMax : undefined,
        }
      : question,
  );
}

export function updateOption(
  questions: Question[],
  id: number,
  optionIndex: number,
  value: string,
) {
  return questions.map((question) =>
    question.id === id
      ? {
          ...question,
          options: (question.options ?? []).map((option, index) =>
            index === optionIndex ? value : option,
          ),
        }
      : question,
  );
}

export function addOption(questions: Question[], id: number) {
  const target = questions.find((question) => question.id === id);
  if (!target) return questions;
  if ((target.options?.length ?? 0) >= maxOptionsPerQuestion) return questions;
  return questions.map((question) =>
    question.id === id
      ? {
          ...question,
          options: [
            ...(question.options ?? []),
            `선택지 ${(question.options?.length ?? 0) + 1}`,
          ],
        }
      : question,
  );
}

export function removeOption(
  questions: Question[],
  id: number,
  optionIndex: number,
) {
  const target = questions.find((question) => question.id === id);
  if (!target) return questions;
  if ((target.options?.length ?? 0) <= minOptionsPerQuestion) return questions;
  return questions.map((question) =>
    question.id === id
      ? {
          ...question,
          options: (question.options ?? []).filter(
            (_, index) => index !== optionIndex,
          ),
        }
      : question,
  );
}

export function addNeutralOption(questions: Question[], id: number) {
  const target = questions.find((question) => question.id === id);
  if (!target) return questions;
  if (target.type !== "single" && target.type !== "multiple") return questions;
  const options = target.options ?? [];
  if (options.includes(neutralOptionLabel)) return questions;
  return updateQuestionField(questions, id, "options", [
    ...options,
    neutralOptionLabel,
  ]);
}

/**
 * A rough readiness signal, not a gate — publishing is never blocked by it.
 * The three checks and the 0-100 scale are a product judgment, free to change.
 */
export const structureCheckIds = [
  "enoughQuestions",
  "titlesLongEnough",
  "choicesHaveOptions",
] as const;

export type StructureCheckId = (typeof structureCheckIds)[number];

export function evaluateDraftStructure(questions: Question[]) {
  const checks: Record<StructureCheckId, boolean> = {
    enoughQuestions: questions.length >= 3,
    titlesLongEnough: questions.every(
      (question) => question.title.trim().length >= minQuestionTitleLength,
    ),
    choicesHaveOptions: questions
      .filter((question) => isChoiceQuestion(question.type))
      .every(
        (question) => (question.options ?? []).filter(Boolean).length >= 2,
      ),
  };
  const passed = structureCheckIds.filter((id) => checks[id]).length;
  return {
    checks,
    score: Math.round((passed / structureCheckIds.length) * 100),
  };
}

/** Reading-time estimate used for reward tiers and respondent expectations. */
export function estimatedMinutes(questions: Question[]) {
  const seconds = questions.reduce((total, question) => {
    if (question.type === "section") return total;
    if (question.type === "text") return total + 55;
    if (question.type === "shortText") return total + 28;
    if (question.type === "multiple") return total + 30;
    return total + 20;
  }, 20);
  return Math.max(1, Math.ceil(seconds / 60));
}

export const questionTypeLabels: Record<Question["type"], string> = {
  shortText: "단답형",
  text: "장문형",
  single: "객관식",
  multiple: "체크박스",
  dropdown: "드롭다운",
  scale: "선형 배율",
  date: "날짜",
  time: "시간",
  section: "섹션",
};

export function questionTypeLabel(type: Question["type"]) {
  return questionTypeLabels[type];
}
