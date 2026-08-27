"use client";

import { useCallback, useMemo, useState } from "react";
import { reviseSurvey } from "../data/survey-draft";
import {
  deduplicateSurveyOptions,
  shortenSurveyQuestionTitle,
} from "../../survey-revision";
import { defaultSurveyMode, type SurveyMode } from "../../survey-mode";
import type { TargetGrade } from "../../survey-grade";
import * as edits from "../survey-editing";
import {
  emptySurveyReferences,
  type Question,
  type SurveyReferences,
} from "../types";

export type QuickEditId = "shorten" | "dedupe" | "neutral";

export type QuickEditResult = {
  id: QuickEditId;
  changed: boolean;
  /** Why nothing changed, when `changed` is false. */
  reason: "already-short" | "no-duplicates" | "already-present" | null;
};

/**
 * The survey document being built, from first prompt through publish.
 * This is the one piece of state that must survive every screen transition.
 */
export function useSurveyDraft({
  initialTitle,
  initialDescription,
  initialQuestions,
}: {
  initialTitle: string;
  initialDescription: string;
  initialQuestions: Question[];
}) {
  // Generation inputs
  const [prompt, setPromptValue] = useState("");
  const [references, setReferencesValue] =
    useState<SurveyReferences>(emptySurveyReferences);
  const [surveyMode, setSurveyMode] = useState<SurveyMode>(defaultSurveyMode);
  const [targetGrade, setTargetGrade] = useState<TargetGrade>("전학년");
  const [questionCount, setQuestionCount] = useState(7);

  // The document
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);

  const structure = useMemo(
    () => edits.evaluateDraftStructure(questions),
    [questions],
  );

  const clampQuestionCount = useCallback((value: number) => {
    setQuestionCount(
      Math.min(edits.maxQuestions, Math.max(1, Math.trunc(value) || 1)),
    );
  }, []);

  const replaceDocument = useCallback(
    (next: { title: string; description: string; questions: Question[] }) => {
      setTitle(next.title);
      setDescription(next.description);
      setQuestions(next.questions);
      setQuestionCount(next.questions.length);
    },
    [],
  );

  /** Copies an existing survey into the draft as a new starting point. */
  const loadFromSurvey = useCallback(
    (source: { title: string; description: string; questions: Question[] }) => {
      replaceDocument({
        title: `${source.title} 복사본`.slice(0, 100),
        description: source.description,
        questions: source.questions.map((question, index) => ({
          ...question,
          id: index + 1,
        })),
      });
    },
    [replaceDocument],
  );

  const addQuestion = useCallback(() => {
    let addedId: number | null = null;
    setQuestions((current) => {
      const result = edits.addQuestion(current);
      addedId = result.addedId;
      return result.questions;
    });
    return addedId;
  }, []);

  const addSection = useCallback(() => {
    let addedId: number | null = null;
    setQuestions((current) => {
      const result = edits.addSection(current);
      addedId = result.addedId;
      return result.questions;
    });
    return addedId;
  }, []);

  const duplicateQuestion = useCallback((id: number) => {
    let addedId: number | null = null;
    setQuestions((current) => {
      const result = edits.duplicateQuestion(current, id);
      addedId = result.addedId;
      return result.questions;
    });
    return addedId;
  }, []);

  const removeQuestion = useCallback((id: number) => {
    setQuestions((current) => edits.removeQuestion(current, id));
  }, []);

  const moveQuestion = useCallback((id: number, direction: -1 | 1) => {
    setQuestions((current) => edits.moveQuestion(current, id, direction));
  }, []);

  const updateQuestion = useCallback(
    <K extends keyof Question>(id: number, key: K, value: Question[K]) => {
      setQuestions((current) =>
        edits.updateQuestionField(current, id, key, value),
      );
    },
    [],
  );

  const changeQuestionType = useCallback(
    (id: number, type: Question["type"]) => {
      setQuestions((current) => edits.changeQuestionType(current, id, type));
    },
    [],
  );

  const updateOption = useCallback(
    (id: number, optionIndex: number, value: string) => {
      setQuestions((current) =>
        edits.updateOption(current, id, optionIndex, value),
      );
    },
    [],
  );

  const addOption = useCallback((id: number) => {
    setQuestions((current) => edits.addOption(current, id));
  }, []);

  const removeOption = useCallback((id: number, optionIndex: number) => {
    setQuestions((current) => edits.removeOption(current, id, optionIndex));
  }, []);

  /** One-tap cleanups. Reports whether anything actually changed. */
  const runQuickEdit = useCallback(
    (id: QuickEditId, questionId: number): QuickEditResult => {
      const target = questions.find((question) => question.id === questionId);
      if (!target) return { id, changed: false, reason: null };

      if (id === "shorten") {
        const shortened = shortenSurveyQuestionTitle(target.title);
        if (!shortened || shortened === target.title) {
          return { id, changed: false, reason: "already-short" };
        }
        updateQuestion(questionId, "title", shortened);
        return { id, changed: true, reason: null };
      }

      if (id === "dedupe") {
        if (!target.options) return { id, changed: false, reason: null };
        const unique = deduplicateSurveyOptions(target.options);
        if (unique.length === target.options.length) {
          return { id, changed: false, reason: "no-duplicates" };
        }
        updateQuestion(questionId, "options", unique);
        return { id, changed: true, reason: null };
      }

      if (target.type !== "single" && target.type !== "multiple") {
        return { id, changed: false, reason: null };
      }
      if ((target.options ?? []).includes(edits.neutralOptionLabel)) {
        return { id, changed: false, reason: "already-present" };
      }
      setQuestions((current) => edits.addNeutralOption(current, questionId));
      return { id, changed: true, reason: null };
    },
    [questions, updateQuestion],
  );

  /** Hands the whole document to the AI and swaps in whatever comes back. */
  const reviseWithAi = useCallback(
    async (instruction: string) => {
      const normalized = instruction.replace(/\s+/g, " ").trim();
      if (normalized.length < 2) {
        throw new Error("수정 요청을 조금 더 자세히 적어주세요.");
      }
      const result = await reviseSurvey({
        title,
        description,
        questions,
        instruction: normalized,
        targetGrade,
      });
      replaceDocument(result);
      return result.message;
    },
    [description, questions, replaceDocument, targetGrade, title],
  );

  return {
    // generation inputs
    prompt,
    references,
    surveyMode,
    targetGrade,
    questionCount,
    setPrompt: setPromptValue,
    setReferences: setReferencesValue,
    setSurveyMode,
    setTargetGrade,
    setQuestionCount: clampQuestionCount,

    // document
    title,
    description,
    questions,
    structure,
    setTitle,
    setDescription,
    replaceDocument,
    loadFromSurvey,
    /**
     * Escape hatch for an editor that manages the whole list itself.
     * Prefer the granular actions below — they carry the limits.
     */
    replaceQuestions: setQuestions,

    // editing
    addQuestion,
    addSection,
    duplicateQuestion,
    removeQuestion,
    moveQuestion,
    updateQuestion,
    changeQuestionType,
    updateOption,
    addOption,
    removeOption,
    runQuickEdit,
    reviseWithAi,

    // limits, so the UI never hardcodes them
    limits: {
      maxQuestions: edits.maxQuestions,
      maxOptionsPerQuestion: edits.maxOptionsPerQuestion,
      minOptionsPerQuestion: edits.minOptionsPerQuestion,
      maxQuestionTitleLength: edits.maxQuestionTitleLength,
    },
  };
}

export type SurveyDraftController = ReturnType<typeof useSurveyDraft>;
