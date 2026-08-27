"use client";

import { useMemo, useState } from "react";

import {
  expandTemplate,
  surveyTemplates,
  templateCategories,
  templateQuestionCount,
  templatesByCategory,
  type SurveyTemplate,
  type TemplateCategory,
} from "../../survey-templates";
import { targetGradeValues, type TargetGrade } from "../../survey-grade";
import type { SurveyMode } from "../../survey-mode";
import { surveyEditing } from "../../ux";
import { SurveyReferenceControls } from "../shared/reference-input";
import { emptySurveyReferences } from "../../ux/types";
import type { Question, SurveyReferences } from "../../ux/types";

/**
 * Survey creation, as a stepper.
 *
 * Three ways in, because the work already done differs: a topic (AI), a known
 * kind of survey (template), or the questions themselves (blank). Each answer
 * dims and collapses its step so the page always shows one open question.
 *
 * Only the AI path calls the model. Templates expand locally from
 * app/survey-templates.ts, and a blank survey needs no generation at all — both
 * jump straight to the editor.
 */

type Way = "ai" | "template" | "blank";

const ways: Array<{ id: Way; name: string; ask: string; body: string; fact: string }> = [
  {
    id: "ai",
    name: "AI 설문",
    ask: "한 줄로 적어주세요",
    body: "주제 한 줄만 적으면 문항과 선택지, 척도까지 설계합니다.",
    fact: "약 40초 · 주제 무엇이든",
  },
  {
    id: "template",
    name: "템플릿 적용",
    ask: "어떤 조사인가요?",
    body: "에브리타임 설문 318건을 분석해 만든 28종. 문항이 이미 짜여 있습니다.",
    fact: `${surveyTemplates.length}종 · 즉시 완성`,
  },
  {
    id: "blank",
    name: "직접 만들기",
    ask: "설문 제목을 정해주세요",
    body: "빈 문항에서 시작합니다. 목적과 응답 대상은 미리 채워집니다.",
    fact: "빈 설문 · 편집기로",
  },
];

/**
 * What the survey is for. Depth differs — a class assignment and a thesis are
 * not the same instrument — so this picks the generation mode rather than just
 * labelling the survey.
 */
const purposes: Array<{ id: string; label: string; mode: SurveyMode }> = [
  { id: "coursework", label: "수업 과제·발표", mode: "standard" },
  { id: "thesis", label: "학위논문·학술연구", mode: "research" },
  { id: "startup", label: "창업 수요검증", mode: "standard" },
  { id: "company", label: "기업 리서치", mode: "research" },
  { id: "club", label: "동아리·단체 운영", mode: "standard" },
  { id: "personal", label: "개인 관심", mode: "standard" },
];

const examples = [
  { chip: "학생식당 만족도", prompt: "학생식당 메뉴와 가격에 대해 학생들이 어떻게 생각하는지 알고 싶어요" },
  { chip: "가격 민감도", prompt: "새로 낼 메뉴의 가격을 얼마까지 낼 수 있는지 조사하고 싶어요" },
  { chip: "팀플 경험", prompt: "팀 프로젝트를 할 때 어떤 어려움을 겪는지 조사하고 싶어요" },
  { chip: "셔틀 배차", prompt: "교내 셔틀버스 배차 간격에 대한 재학생 인식을 조사하고 싶어요" },
];

export function CreateView({
  prompt,
  setPrompt,
  references,
  setReferences,
  surveyMode,
  setSurveyMode,
  targetGrade,
  setTargetGrade,
  questionCount,
  setQuestionCount,
  onCreate,
  onBack,
  onUseQuestions,
  isAnalyzing,
}: {
  prompt: string;
  setPrompt: (value: string) => void;
  references: SurveyReferences;
  setReferences: (value: SurveyReferences) => void;
  surveyMode: SurveyMode;
  setSurveyMode: (value: SurveyMode) => void;
  targetGrade: TargetGrade;
  setTargetGrade: (value: TargetGrade) => void;
  questionCount: number;
  setQuestionCount: (value: number) => void;
  onCreate: () => void;
  onBack: () => void;
  /** Templates and blank surveys skip generation and open the editor directly. */
  onUseQuestions: (document: {
    title: string;
    description: string;
    questions: Question[];
  }) => void;
  isAnalyzing: boolean;
}) {
  const [step, setStep] = useState(1);
  const [way, setWay] = useState<Way | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [category, setCategory] = useState<TemplateCategory>(templateCategories[0]);
  const [blankTitle, setBlankTitle] = useState("");
  const [purposeId, setPurposeId] = useState(purposes[0].id);

  const chosenWay = ways.find((entry) => entry.id === way) ?? null;
  const template = useMemo(
    () => surveyTemplates.find((entry) => entry.id === templateId) ?? null,
    [templateId],
  );
  const purpose = purposes.find((entry) => entry.id === purposeId) ?? purposes[0];

  const subject =
    way === "template" ? prompt.trim() : way === "blank" ? blankTitle.trim() : prompt.trim();
  const step2Ready =
    way === "template" ? Boolean(template) : subject.length >= 2;

  const chooseWay = (next: Way) => {
    setWay(next);
    setTemplateId("");
    setStep(2);
  };

  const choosePurpose = (id: string) => {
    setPurposeId(id);
    const found = purposes.find((entry) => entry.id === id);
    if (found) setSurveyMode(found.mode);
  };

  const applyTemplate = (chosen: SurveyTemplate) => {
    onUseQuestions({
      // 조사 대상만으로는 제목이 되지 않고("중앙도서관"), 템플릿 이름만으로는
      // 무엇을 조사하는지 모릅니다. 둘을 붙이고 편집기에서 고치게 합니다.
      title: subject ? `${subject} ${chosen.category} 조사`.slice(0, 100) : chosen.name,
      description: chosen.description,
      questions: expandTemplate(chosen, subject),
    });
  };

  const applyBlank = () => {
    const seeded = surveyEditing.addQuestion([]);
    onUseQuestions({
      title: blankTitle.trim(),
      description: "",
      questions: seeded.questions.map((question) => ({ ...question, title: "" })),
    });
  };

  const finish = () => {
    if (way === "template" && template) return applyTemplate(template);
    if (way === "blank") return applyBlank();
    onCreate();
  };

  const stateOf = (index: number) =>
    step === index ? "on" : step > index ? "done" : "todo";

  const summaries: Record<number, string> = {
    1: chosenWay?.name ?? "",
    2:
      way === "template"
        ? template?.name ?? ""
        : subject.slice(0, 46) + (subject.length > 46 ? "…" : ""),
    3: `${purpose.label} · ${targetGrade} · ${questionCount}문항`,
  };

  return (
    <>
      <div className="mk-bar">
        <div className="mk-bar-in">
          <h1 className="mk-doc">설문 만들기</h1>
          <span className="mk-ttl">
            <b className="mk-of">
              <b>{step}</b> / 3
            </b>
          </span>
          <span className="mk-bar-right">
            <button type="button" className="ed-btn" onClick={onBack}>
              나가기
            </button>
          </span>
          <span className="mk-progress">
            <i style={{ width: `${(step / 3) * 100}%` }} />
          </span>
        </div>
      </div>

      <main className="mk-flow">
        {/* ── 1. 만드는 방법 ── */}
        <section className="mk-step" data-state={stateOf(1)}>
          <div className="mk-mark">
            <em>01</em>
            <small>만드는 방법</small>
          </div>
          <div className="mk-body">
            <h2>어떻게 만들까요?</h2>
            <p className="mk-ask">어느 쪽으로 시작하든 문항은 나중에 전부 고칠 수 있습니다.</p>
            {stateOf(1) === "done" ? (
              <div className="mk-sum">
                <b>{summaries[1]}</b>
                <button type="button" onClick={() => setStep(1)}>
                  수정
                </button>
              </div>
            ) : null}
            <div className="mk-panel">
              <div className="mk-ways">
                {ways.map((entry) => (
                  <button
                    type="button"
                    className="mk-way"
                    key={entry.id}
                    aria-pressed={way === entry.id}
                    onClick={() => chooseWay(entry.id)}
                  >
                    <b>{entry.name}</b>
                    <p>{entry.body}</p>
                    <span className="mk-fact">{entry.fact}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. 무엇을 ── */}
        <section className="mk-step" data-state={stateOf(2)}>
          <div className="mk-mark">
            <em>02</em>
            <small>무엇을</small>
          </div>
          <div className="mk-body">
            <h2>{chosenWay?.ask ?? "무엇을 조사하나요?"}</h2>
            <p className="mk-ask">{chosenWay?.body ?? ""}</p>
            {stateOf(2) === "done" ? (
              <div className="mk-sum">
                <b>{summaries[2]}</b>
                <button type="button" onClick={() => setStep(2)}>
                  수정
                </button>
              </div>
            ) : null}
            <div className="mk-panel">
              {way === "ai" ? (
                <>
                  <textarea
                    className="mk-topic"
                    value={prompt}
                    maxLength={300}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="예) 도서관 좌석 예약제를 학생들이 어떻게 생각하는지 알고 싶어요"
                    aria-label="조사할 주제"
                  />
                  <p className="mk-cnt">{prompt.length} / 300</p>
                  <div className="mk-egs">
                    {examples.map((example) => (
                      <button
                        type="button"
                        key={example.chip}
                        onClick={() => setPrompt(example.prompt)}
                      >
                        {example.chip}
                      </button>
                    ))}
                  </div>
                  {/* 첨부는 주제와 같은 자리에 둡니다 — 참고 자료도 「무엇을 조사하나」의
                      일부이고, 별도 단계로 빼면 있는 줄도 모릅니다. */}
                  <div style={{ marginTop: 12 }}>
                    <SurveyReferenceControls
                      references={references}
                      onChange={setReferences}
                      disabled={isAnalyzing}
                    />
                  </div>
                  {references.images.length + references.files.length + references.links.length > 0 ? (
                    <p className="mk-hint">
                      참고 자료{" "}
                      <b>
                        {references.images.length +
                          references.files.length +
                          references.links.length}
                      </b>
                      건이 함께 반영됩니다.{" "}
                      <button
                        type="button"
                        style={{
                          background: 0,
                          border: 0,
                          padding: 0,
                          font: "inherit",
                          color: "var(--bf-blue)",
                          cursor: "pointer",
                        }}
                        onClick={() => setReferences(emptySurveyReferences)}
                      >
                        비우기
                      </button>
                    </p>
                  ) : null}
                </>
              ) : way === "template" ? (
                <>
                  <div className="mk-tcats">
                    {templateCategories.map((entry) => (
                      <button
                        type="button"
                        key={entry}
                        aria-pressed={category === entry}
                        onClick={() => setCategory(entry)}
                      >
                        {entry} {templatesByCategory(entry).length}
                      </button>
                    ))}
                  </div>
                  <div className="mk-tgrid">
                    {templatesByCategory(category).map((entry) => (
                      <button
                        type="button"
                        className="mk-tcard"
                        key={entry.id}
                        aria-pressed={templateId === entry.id}
                        onClick={() => setTemplateId(entry.id)}
                      >
                        <b>{entry.name}</b>
                        <p>{entry.description}</p>
                        <span className="mk-tm">
                          <span>문항 {templateQuestionCount(entry)}</span>
                          <span>표본 {entry.sampleCount}건</span>
                          <span>블록 {entry.blocks.length}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="mk-topic"
                    style={{ minHeight: 56, fontSize: 16, marginTop: 12 }}
                    value={prompt}
                    maxLength={100}
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="조사 대상 이름 (예: 중앙도서관) — 비워두면 일반 문구로 만듭니다"
                    aria-label="조사 대상 이름"
                  />
                </>
              ) : way === "blank" ? (
                <>
                  <textarea
                    className="mk-topic"
                    style={{ minHeight: 64, fontSize: 18 }}
                    value={blankTitle}
                    maxLength={100}
                    onChange={(event) => setBlankTitle(event.target.value)}
                    placeholder="예) 도서관 좌석 예약제 만족도 조사"
                    aria-label="설문 제목"
                  />
                  <p className="mk-cnt">{blankTitle.length} / 100</p>
                </>
              ) : null}
              <div className="mk-next">
                <button type="button" disabled={!step2Ready} onClick={() => setStep(3)}>
                  다음
                </button>
                <small>
                  {step2Ready
                    ? ""
                    : way === "template"
                      ? "템플릿을 하나 골라주세요"
                      : "두 글자 이상 적어주세요"}
                </small>
              </div>
            </div>
          </div>
        </section>

        {/* ── 3. 목적과 응답 대상 ── */}
        <section className="mk-step" data-state={stateOf(3)}>
          <div className="mk-mark">
            <em>03</em>
            <small>목적과 대상</small>
          </div>
          <div className="mk-body">
            <h2>무엇에 쓰고, 누구에게 받을까요?</h2>
            <p className="mk-ask">
              목적에 따라 문항의 깊이가 달라지고, 대상에 따라 표현과 예시가 달라집니다.
            </p>
            <div className="mk-panel">
              <div className="mk-fset">
                <b>이 설문을 어디에 쓰나요?</b>
                <small>
                  수업 과제와 학위논문은 요구되는 정밀도가 다릅니다. 고른 목적이 설문 방식(
                  {surveyMode === "research" ? "정밀·연구" : "일반"})을 정합니다.
                </small>
                <div className="mk-pills">
                  {purposes.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      aria-pressed={purposeId === entry.id}
                      onClick={() => choosePurpose(entry.id)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mk-fset">
                <b>응답 대상</b>
                <small>문항의 표현과 예시가 대상에 맞게 달라집니다.</small>
                <div className="mk-pills">
                  {targetGradeValues.map((grade) => (
                    <button
                      type="button"
                      key={grade}
                      aria-pressed={targetGrade === grade}
                      onClick={() => setTargetGrade(grade)}
                    >
                      {grade}
                    </button>
                  ))}
                </div>
              </div>

              {way === "ai" ? (
                <div className="mk-fset">
                  <b>문항 수</b>
                  <small>
                    문항이 많아지면 응답률이 떨어집니다. 12문항이 넘으면 이탈이 늘어납니다.
                  </small>
                  <div className="mk-stepper">
                    <button
                      type="button"
                      aria-label="문항 수 줄이기"
                      disabled={questionCount <= 1}
                      onClick={() => setQuestionCount(questionCount - 1)}
                    >
                      −
                    </button>
                    <span className="mk-v">{questionCount}</span>
                    <button
                      type="button"
                      aria-label="문항 수 늘리기"
                      disabled={questionCount >= surveyEditing.maxQuestions}
                      onClick={() => setQuestionCount(questionCount + 1)}
                    >
                      ＋
                    </button>
                  </div>
                  <p className="mk-hint">
                    1개에서 {surveyEditing.maxQuestions}개까지 · 예상 응답 시간{" "}
                    <b>{Math.max(1, Math.round(questionCount * 0.3))}분</b>
                  </p>
                </div>
              ) : way === "template" && template ? (
                <p className="mk-hint">
                  이 템플릿의 문항은 <b>{templateQuestionCount(template)}개</b>로 이미
                  정해져 있습니다. 만든 뒤 편집기에서 늘리거나 줄일 수 있습니다.
                </p>
              ) : null}

              <div className="mk-next">
                <button type="button" disabled={isAnalyzing} onClick={finish}>
                  {isAnalyzing
                    ? "만들고 있어요…"
                    : way === "ai"
                      ? "설문 만들기"
                      : way === "template"
                        ? "이 템플릿으로 만들기"
                        : "빈 설문 만들기"}
                </button>
                <small>
                  {way === "ai"
                    ? "약 40초 걸립니다. 만든 뒤 문항을 전부 고칠 수 있습니다."
                    : "바로 편집기가 열립니다. AI 호출은 없습니다."}
                </small>
              </div>

              <p className="mk-hint" style={{ marginTop: 18 }}>
                응답자를 어떻게 모을지(링크 배포 · 광장 모집 · 패널 배정)는{" "}
                <b>발행할 때</b> 정합니다.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
