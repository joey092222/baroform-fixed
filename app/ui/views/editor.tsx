"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { surveyAudienceLabel } from "../../survey-grade";
import type { TargetGrade } from "../../survey-grade";
import { surveyEditing } from "../../ux";
import type { Question } from "../../ux/types";

/**
 * The question editor.
 *
 * All editing rules live in `app/ux/survey-editing.ts` — the limits (30
 * questions, 12 options, 2 minimum, 200-character titles) and the structure
 * checks are enforced there and tested there. This file decides what the rules
 * look like, not what they are. It used to reimplement them, which is how the
 * limits ended up hardcoded in two places.
 *
 * Questions are collapsed and only the selected one opens. Thirty questions
 * with every control expanded is not a screen anyone can work in.
 */

const questionTypes: Array<Question["type"]> = [
  "single",
  "multiple",
  "dropdown",
  "scale",
  "shortText",
  "text",
  "date",
  "time",
];

function isChoice(type: Question["type"]) {
  return type === "single" || type === "multiple" || type === "dropdown";
}

/**
 * `when` decides whether the button is even clickable. Offering an edit that
 * cannot apply and refusing it after the click reads as a bug; a disabled
 * button says the same thing before the click.
 */
const quickEdits = [
  { id: "shorten", label: "문구 짧게", when: () => true },
  {
    id: "neutral",
    label: "중립 선택지 추가",
    when: (question: Question) =>
      isChoice(question.type) &&
      (question.options ?? []).length < surveyEditing.maxOptionsPerQuestion,
  },
  {
    id: "option",
    label: "선택지 늘리기",
    when: (question: Question) =>
      isChoice(question.type) &&
      (question.options ?? []).length < surveyEditing.maxOptionsPerQuestion,
  },
  { id: "scale", label: "척도로 바꾸기", when: (question: Question) => question.type !== "scale" },
  { id: "required", label: "필수로", when: (question: Question) => !question.required },
] as const;

const structureLabels: Record<
  ReturnType<typeof surveyEditing.evaluateDraftStructure>["checks"] extends Record<
    infer K,
    boolean
  >
    ? K
    : never,
  string
> = {
  enoughQuestions: "문항이 3개 이상입니다",
  titlesLongEnough: "모든 문항 제목이 5자 이상입니다",
  choicesHaveOptions: "선택형 문항에 선택지가 2개 이상입니다",
};

/** What is wrong with this question, in the order a person would fix it. */
function questionFlag(question: Question) {
  if (question.title.trim().length < surveyEditing.minQuestionTitleLength)
    return "제목이 짧습니다";
  if (
    isChoice(question.type) &&
    (question.options ?? []).filter((option) => option.trim()).length <
      surveyEditing.minOptionsPerQuestion
  ) {
    return "선택지가 부족합니다";
  }
  return "";
}

export function EditorView({
  title,
  setTitle,
  description,
  setDescription,
  questions,
  setQuestions,
  onBack,
  onPublish,
  targetGrade,
  onAiRevise,
}: {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  questions: Question[];
  setQuestions: (value: Question[]) => void;
  onBack: () => void;
  onPublish: () => void;
  targetGrade: TargetGrade;
  onAiRevise: (instruction: string) => Promise<string>;
}) {
  const [selectedId, setSelectedId] = useState(questions[0]?.id ?? 1);
  const [instruction, setInstruction] = useState("");
  const [revising, setRevising] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [quickMessage, setQuickMessage] = useState("");
  const quickTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (quickTimer.current) window.clearTimeout(quickTimer.current);
    };
  }, []);

  const selected =
    questions.find((question) => question.id === selectedId) ?? questions[0];
  const structure = useMemo(() => {
    const result = surveyEditing.evaluateDraftStructure(questions);
    const ids = Object.keys(result.checks) as Array<keyof typeof result.checks>;
    return {
      checks: result.checks,
      ids,
      passed: ids.filter((id) => result.checks[id]).length,
      total: ids.length,
    };
  }, [questions]);
  const answerable = questions.filter((question) => question.type !== "section");
  const minutes = surveyEditing.estimatedMinutes(questions);
  const ready = structure.passed === structure.total;

  /** Question number as a respondent counts them — sections are not questions. */
  const displayNumber = (index: number) =>
    questions.slice(0, index + 1).filter((question) => question.type !== "section")
      .length;

  const flash = (message: string) => {
    setQuickMessage(message);
    if (quickTimer.current) window.clearTimeout(quickTimer.current);
    quickTimer.current = window.setTimeout(() => setQuickMessage(""), 2600);
  };

  const apply = (next: Question[], message?: string) => {
    // The UX layer returns the same array when a limit blocks the edit, so an
    // unchanged reference means "nothing happened" and the message would lie.
    if (next === questions) {
      flash("더 이상 적용할 수 없어요");
      return;
    }
    setQuestions(next);
    if (message) flash(message);
  };

  const runQuickEdit = (id: (typeof quickEdits)[number]["id"]) => {
    if (!selected || selected.type === "section") return;
    if (id === "shorten") {
      const shortened = selected.title
        .replace(/\s*(?:에 대해|에 관해)\s*/g, " ")
        .replace(/하시나요\?$/, "한가요?")
        .replace(/\s{2,}/g, " ")
        .trim();
      apply(
        surveyEditing.updateQuestionField(questions, selected.id, "title", shortened),
        "문구를 줄였어요",
      );
      return;
    }
    if (id === "neutral") {
      apply(surveyEditing.addNeutralOption(questions, selected.id), "중립 선택지를 넣었어요");
      return;
    }
    if (id === "option") {
      apply(surveyEditing.addOption(questions, selected.id), "선택지를 하나 늘렸어요");
      return;
    }
    if (id === "scale") {
      apply(
        surveyEditing.changeQuestionType(questions, selected.id, "scale"),
        "선형 배율로 바꿨어요",
      );
      return;
    }
    apply(
      surveyEditing.updateQuestionField(questions, selected.id, "required", true),
      "필수 문항으로 바꿨어요",
    );
  };

  const submitRevision = async () => {
    const trimmed = instruction.trim();
    if (trimmed.length < 2 || revising) return;
    setRevising(true);
    setAiMessage("");
    try {
      setAiMessage(await onAiRevise(trimmed));
      setInstruction("");
    } finally {
      setRevising(false);
    }
  };

  return (
    <>
      <div className="ed-bar">
        <div className="ed-bar-in">
          <button type="button" className="ed-btn" onClick={onBack}>
            ← 돌아가기
          </button>
          <span className="ed-doc">{title.trim() || "제목 없는 설문"}</span>
          <span className="ed-saved">문항 {answerable.length}개 · 예상 {minutes}분</span>
          <span className="ed-bar-right">
            <span className="pz-chip">{surveyAudienceLabel(targetGrade)}</span>
            <button
              type="button"
              className="ed-btn ed-primary"
              onClick={onPublish}
              disabled={!ready}
              title={ready ? undefined : "기본 구조 점검을 통과해야 발행할 수 있어요"}
            >
              발행하기
            </button>
          </span>
        </div>
      </div>

      <main className="ed">
        {/* ── 개요 ── */}
        <aside className="ed-side">
          <h2>설문 구성</h2>
          <div className="ed-ol">
            {questions.map((question, index) =>
              question.type === "section" ? (
                <div className="ed-sec" key={question.id}>
                  {question.title.trim() || "섹션"}
                </div>
              ) : (
                <button
                  type="button"
                  key={question.id}
                  aria-current={question.id === selectedId}
                  onClick={() => setSelectedId(question.id)}
                >
                  <span className="ed-no">{displayNumber(index)}</span>
                  <span className="ed-tt">{question.title.trim() || "제목 없음"}</span>
                  {questionFlag(question) ? (
                    <span className="ed-flag" title={questionFlag(question)} />
                  ) : (
                    <span />
                  )}
                </button>
              ),
            )}
          </div>
          <p className="ed-olfoot">
            문항 <b>{answerable.length}</b> / {surveyEditing.maxQuestions} · 예상{" "}
            <b>{minutes}분</b>
          </p>
        </aside>

        {/* ── 캔버스 ── */}
        <div className="ed-canvas">
          <div className="ed-sheet">
            <div className="ed-head">
              <input
                className="ed-t"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="설문 제목"
                maxLength={100}
                aria-label="설문 제목"
              />
              <textarea
                className="ed-d"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="응답자에게 보일 안내문을 적어주세요"
                aria-label="설문 안내문"
              />
              <div className="ed-meta">
                <span className="pz-chip">문항 {answerable.length}개</span>
                <span className="pz-chip">예상 {minutes}분</span>
                <span className="pz-chip">{surveyAudienceLabel(targetGrade)}</span>
              </div>
            </div>

            {questions.map((question, index) => {
              const isSelected = question.id === selectedId;
              const flag = questionFlag(question);
              const options = question.options ?? [];
              const section = question.type === "section";
              return (
                <article
                  className="ed-card"
                  key={question.id}
                  data-selected={isSelected}
                  data-section={section}
                >
                  <button
                    type="button"
                    className="ed-chead"
                    onClick={() => setSelectedId(question.id)}
                  >
                    <span className="ed-badge">
                      {section ? "섹션" : `Q${displayNumber(index)}`}
                    </span>
                    <span>
                      <span className={question.title.trim() ? "ed-qt" : "ed-qt ed-empty"}>
                        {question.title.trim() || "문항을 적어주세요"}
                      </span>
                      <span className="ed-sub">
                        <span className="pz-chip">
                          {surveyEditing.questionTypeLabel(question.type)}
                        </span>
                        {!section ? (
                          <span className="pz-chip">
                            {question.required ? "필수" : "선택"}
                          </span>
                        ) : null}
                        {isChoice(question.type) ? (
                          <span className="pz-chip">선택지 {options.length}</span>
                        ) : null}
                        {flag ? <span className="ed-warn">⚠ {flag}</span> : null}
                      </span>
                    </span>
                    <span className="ed-tools">
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="위로"
                        onClick={(event) => {
                          event.stopPropagation();
                          apply(surveyEditing.moveQuestion(questions, question.id, -1));
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          event.preventDefault();
                          apply(surveyEditing.moveQuestion(questions, question.id, -1));
                        }}
                      >
                        ↑
                      </span>
                    </span>
                  </button>

                  {isSelected ? (
                    <div className="ed-cbody">
                      <div className="ed-row">
                        <label htmlFor={`q-title-${question.id}`}>문항 제목</label>
                        <textarea
                          id={`q-title-${question.id}`}
                          className="ed-in"
                          rows={2}
                          maxLength={surveyEditing.maxQuestionTitleLength}
                          value={question.title}
                          onChange={(event) =>
                            setQuestions(
                              surveyEditing.updateQuestionField(
                                questions,
                                question.id,
                                "title",
                                event.target.value,
                              ),
                            )
                          }
                        />
                        <p className="ed-cnt">
                          {question.title.length} / {surveyEditing.maxQuestionTitleLength}
                        </p>
                      </div>

                      {!section ? (
                        <div className="ed-row">
                          <label>문항 유형</label>
                          <div className="ed-types">
                            {questionTypes.map((type) => (
                              <button
                                type="button"
                                key={type}
                                aria-pressed={question.type === type}
                                onClick={() =>
                                  apply(
                                    surveyEditing.changeQuestionType(
                                      questions,
                                      question.id,
                                      type,
                                    ),
                                  )
                                }
                              >
                                {surveyEditing.questionTypeLabel(type)}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {isChoice(question.type) ? (
                        <div className="ed-row">
                          <label>선택지</label>
                          <div className="ed-opts">
                            {options.map((option, optionIndex) => (
                              <div className="ed-opt" key={`${question.id}-${optionIndex}`}>
                                <span className="ed-mk">
                                  {question.type === "multiple" ? "☐" : optionIndex + 1}
                                </span>
                                <input
                                  value={option}
                                  aria-label={`선택지 ${optionIndex + 1}`}
                                  onChange={(event) =>
                                    setQuestions(
                                      surveyEditing.updateOption(
                                        questions,
                                        question.id,
                                        optionIndex,
                                        event.target.value,
                                      ),
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  className="ed-del"
                                  aria-label={`선택지 ${optionIndex + 1} 삭제`}
                                  disabled={
                                    options.length <= surveyEditing.minOptionsPerQuestion
                                  }
                                  onClick={() =>
                                    apply(
                                      surveyEditing.removeOption(
                                        questions,
                                        question.id,
                                        optionIndex,
                                      ),
                                    )
                                  }
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="ed-optfoot">
                            <button
                              type="button"
                              disabled={
                                options.length >= surveyEditing.maxOptionsPerQuestion
                              }
                              onClick={() =>
                                apply(surveyEditing.addOption(questions, question.id))
                              }
                            >
                              ＋ 선택지
                            </button>
                            <button
                              type="button"
                              disabled={
                                options.length >= surveyEditing.maxOptionsPerQuestion
                              }
                              onClick={() =>
                                apply(
                                  surveyEditing.addNeutralOption(questions, question.id),
                                )
                              }
                            >
                              ＋ 중립 선택지
                            </button>
                            <small>
                              {options.length} / {surveyEditing.maxOptionsPerQuestion}
                            </small>
                          </div>
                        </div>
                      ) : null}

                      {question.type === "scale" ? (
                        <div className="ed-row">
                          <label>
                            척도 양끝 문구 ({question.scaleMin ?? 1}–{question.scaleMax ?? 5})
                          </label>
                          <div className="ed-scale">
                            <input
                              className="ed-in"
                              placeholder="가장 낮은 쪽"
                              value={question.scaleMinLabel ?? ""}
                              onChange={(event) =>
                                setQuestions(
                                  surveyEditing.updateQuestionField(
                                    questions,
                                    question.id,
                                    "scaleMinLabel",
                                    event.target.value,
                                  ),
                                )
                              }
                            />
                            <input
                              className="ed-in"
                              placeholder="가장 높은 쪽"
                              value={question.scaleMaxLabel ?? ""}
                              onChange={(event) =>
                                setQuestions(
                                  surveyEditing.updateQuestionField(
                                    questions,
                                    question.id,
                                    "scaleMaxLabel",
                                    event.target.value,
                                  ),
                                )
                              }
                            />
                          </div>
                        </div>
                      ) : null}

                      {!section ? (
                        <div className="ed-cfoot">
                          <label className="pz-chip" style={{ cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={question.required}
                              onChange={(event) =>
                                setQuestions(
                                  surveyEditing.updateQuestionField(
                                    questions,
                                    question.id,
                                    "required",
                                    event.target.checked,
                                  ),
                                )
                              }
                            />{" "}
                            필수 응답
                          </label>
                          <span className="ed-tools" style={{ marginLeft: "auto" }}>
                            <button
                              type="button"
                              aria-label="아래로 옮기기"
                              onClick={() =>
                                apply(surveyEditing.moveQuestion(questions, question.id, 1))
                              }
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              aria-label="복제"
                              onClick={() => {
                                const result = surveyEditing.duplicateQuestion(
                                  questions,
                                  question.id,
                                );
                                apply(result.questions);
                                if (result.addedId !== null) setSelectedId(result.addedId);
                              }}
                            >
                              ⧉
                            </button>
                            <button
                              type="button"
                              aria-label="삭제"
                              onClick={() =>
                                apply(surveyEditing.removeQuestion(questions, question.id))
                              }
                            >
                              ✕
                            </button>
                          </span>
                        </div>
                      ) : null}

                      {question.reason ? (
                        <p className="ed-reason">
                          <b>왜 이 문항인가</b> — {question.reason}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}

            <div className="ed-addrow">
              <button
                type="button"
                disabled={answerable.length >= surveyEditing.maxQuestions}
                onClick={() => {
                  const result = surveyEditing.addQuestion(questions);
                  apply(result.questions);
                  if (result.addedId !== null) setSelectedId(result.addedId);
                }}
              >
                ＋ 문항 추가
              </button>
              <button
                type="button"
                disabled={questions.length >= surveyEditing.maxQuestions}
                onClick={() => {
                  const result = surveyEditing.addSection(questions);
                  apply(result.questions);
                }}
              >
                ＋ 섹션 추가
              </button>
            </div>
          </div>
        </div>

        {/* ── 빠른 수정 · AI · 점검 ── */}
        <aside className="ed-side ed-right">
          <div className="ed-sec2">
            <h2 style={{ paddingLeft: 0 }}>빠른 수정</h2>
            <p>
              {selected && selected.type !== "section"
                ? `«${(selected.title.trim() || "선택한 문항").slice(0, 16)}»에 바로 적용됩니다.`
                : "문항을 먼저 고르세요."}
            </p>
            <div className="ed-quick">
              {quickEdits.map((edit) => (
                <button
                  type="button"
                  key={edit.id}
                  disabled={
                    !selected || selected.type === "section" || !edit.when(selected)
                  }
                  onClick={() => runQuickEdit(edit.id)}
                >
                  {edit.label}
                </button>
              ))}
            </div>
            {quickMessage ? (
              <p className="ed-note" style={{ margin: "10px 0 0" }} role="status">
                {quickMessage}
              </p>
            ) : null}
          </div>

          <div className="ed-sec2 ed-ai">
            <h2 style={{ paddingLeft: 0 }}>AI로 바로 수정</h2>
            <p>완성된 설문 전체에 반영됩니다.</p>
            <textarea
              value={instruction}
              maxLength={500}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="예) 문항을 8개로 줄이고 학년 문항을 앞으로 옮겨주세요"
              aria-label="AI 수정 요청"
            />
            <button
              type="button"
              className="ed-btn ed-primary"
              disabled={instruction.trim().length < 2 || revising}
              onClick={() => void submitRevision()}
            >
              {revising ? "수정 중…" : "수정 요청"}
            </button>
            {aiMessage ? (
              <p className="ed-note" style={{ margin: "10px 0 0" }} role="status">
                {aiMessage}
              </p>
            ) : null}
          </div>

          <div className="ed-sec2">
            <h2 style={{ paddingLeft: 0 }}>기본 구조 점검</h2>
            <div className="ed-chk">
              {structure.ids.map((id) => (
                <div key={id} data-ok={structure.checks[id]}>
                  <span className="ed-m">✓</span>
                  <span>{structureLabels[id]}</span>
                </div>
              ))}
            </div>
            <div className="ed-track">
              <i style={{ width: `${(structure.passed / structure.total) * 100}%` }} />
            </div>
            <p className="ed-chknum">
              <b>{structure.passed}</b> / {structure.total} 통과
              {ready ? "" : " · 통과하면 발행할 수 있습니다"}
            </p>
          </div>
        </aside>
      </main>
    </>
  );
}
