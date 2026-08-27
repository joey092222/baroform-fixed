"use client";

import { useState } from "react";

import { surveyCover } from "../../ux/survey-cover";
import { surveyResponse } from "../../ux";
import type { AuthUser, PublicSurvey, Question } from "../../ux/types";
import { useSurveyResponse } from "../../ux/state/use-survey-response";

/**
 * The response screen — the only screen a respondent ever sees.
 *
 * Leaving here means none of the creator's numbers get filled, so the screen is
 * built around not leaving: no navigation, no outbound links, and how much is
 * left always visible at the top and bottom. Nobody finishes a form whose end
 * they cannot see.
 *
 * There is still one way out, because someone who opened this by mistake was
 * otherwise stuck. It asks first once answers exist — the answers are only in
 * this component, so leaving discards them and nothing warns you afterwards.
 *
 * One page rather than one question at a time: going back to fix an earlier
 * answer should not cost a screen transition.
 */

function isChoice(type: Question["type"]) {
  return type === "single" || type === "multiple";
}

export function SurveyView({
  survey,
  onBack,
  user,
  authToken,
  onAuth,
  onReward,
}: {
  survey: PublicSurvey;
  onBack: () => void;
  user: AuthUser | null;
  authToken: string;
  onAuth: () => void;
  onReward: () => void;
}) {
  const {
    questions,
    answerableCount,
    answers,
    progress,
    submitting,
    submitted,
    error,
    blockedQuestionId,
    reward,
    setAnswer,
    toggleChoice,
    submit,
  } = useSurveyResponse({ survey, authToken, onRewarded: onReward });

  const [leaving, setLeaving] = useState(false);

  const cover = surveyCover(survey);
  const missing = surveyResponse.firstMissingRequired(questions, answers);
  const requiredLeft = questions.filter(
    (question) =>
      question.type !== "section" &&
      question.required &&
      !surveyResponse.isAnswered(answers[question.id]),
  ).length;

  /** Question number as a respondent counts them — sections are not questions. */
  const displayNumber = (index: number) =>
    questions.slice(0, index + 1).filter((question) => question.type !== "section")
      .length;

  const submitResponse = async () => {
    const outcome = await submit();
    if (outcome.blockedQuestion) {
      document
        .getElementById(`question-${outcome.blockedQuestion.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  if (submitted) {
    return (
      <div className="rs-shell">
        <div className="rs-done">
          <div className="rs-ok" aria-hidden="true">
            ✓
          </div>
          <h2>응답이 저장됐어요</h2>
          <p>
            솔직한 의견 감사합니다. 결과는 설문을 만든 사람이 정리해 공개할 수
            있습니다.
          </p>
          {reward && reward.amount > 0 ? (
            <div className="rs-earned">
              <b>+{reward.amount.toLocaleString("ko-KR")} C</b>
              <small>
                {reward.balance !== null
                  ? `캐시 적립 완료 · 잔액 ${reward.balance.toLocaleString("ko-KR")} C`
                  : "캐시 적립 완료"}
              </small>
            </div>
          ) : reward?.requiresLogin ? (
            <div className="rs-earned">
              <b>+{survey.rewardCash.toLocaleString("ko-KR")} C</b>
              <small>로그인하면 받을 수 있어요. 응답은 이미 저장됐습니다.</small>
            </div>
          ) : reward?.ownSurvey ? (
            <div className="rs-earned">
              <small>내 설문은 캐시 적립 대상이 아니에요.</small>
            </div>
          ) : null}
          <div className="rs-acts">
            <button type="button" onClick={onBack}>
              참여할 다른 설문 보기
            </button>
            {reward?.requiresLogin ? (
              <button type="button" className="rs-ghost" onClick={onAuth}>
                로그인하고 캐시 받기
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rs-shell">
      <div className="rs-bar">
        <div className="rs-bar-in">
          <div className="rs-bar-row">
            <span className="rs-brand">바로폼</span>
            <span>
              <b>{progress.percent}%</b> 완료
            </span>
            <span className="rs-left">
              {progress.answered} / {answerableCount}
            </span>
            <button
              type="button"
              className="rs-quit"
              onClick={() => (progress.answered > 0 ? setLeaving(true) : onBack())}
            >
              나가기
            </button>
          </div>
          <div className="rs-track">
            <i style={{ width: `${progress.percent}%` }} />
          </div>
          {leaving ? (
            <div className="rs-leave">
              <span>지금 나가면 적은 답변이 사라집니다.</span>
              <button type="button" onClick={() => setLeaving(false)}>
                이어서 하기
              </button>
              <button type="button" className="rs-leave-go" onClick={onBack}>
                나가기
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {cover.kind === "photo" ? (
        <div className="rs-cover" style={{ backgroundImage: `url(${cover.src})` }}>
          <span className="rs-tag">{cover.tag}</span>
          <span className="rs-kw">{cover.keyword}</span>
        </div>
      ) : null}

      <div className="rs-head">
        <h1>{survey.title}</h1>
        {survey.description ? <p>{survey.description}</p> : null}
        <div className="rs-pills">
          <span className="pz-chip">문항 {answerableCount}개</span>
          <span className="pz-chip">예상 {survey.durationMinutes}분</span>
          {survey.targetAudience ? (
            <span className="pz-chip">{survey.targetAudience}</span>
          ) : null}
          <span className="pz-chip">{survey.ownerName}</span>
        </div>
      </div>

      {survey.rewardCash > 0 ? (
        <div className={user ? "rs-reward" : "rs-reward rs-guest"}>
          <span className="rs-coin">{survey.rewardCash}</span>
          <span>
            <b>
              {user
                ? `완료하면 ${survey.rewardCash} C가 적립돼요`
                : `로그인하면 ${survey.rewardCash} C를 받을 수 있어요`}
            </b>
            <small>
              {user
                ? "설문마다 한 번만 적립됩니다."
                : "지금은 로그인 없이 참여 중입니다. 응답은 그대로 반영됩니다."}
            </small>
          </span>
          {!user ? (
            <button type="button" className="rs-go" onClick={onAuth}>
              로그인
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="rs-qs">
        {questions.map((question, index) => {
          if (question.type === "section") {
            return (
              <section className="rs-q rs-section" key={question.id}>
                <h2>{question.title}</h2>
                {question.description ? <p className="rs-cap">{question.description}</p> : null}
              </section>
            );
          }
          const value = answers[question.id];
          const limit = surveyResponse.answerLengthLimit(question.type);
          const chosen = Array.isArray(value) ? value : [];
          return (
            <section
              className="rs-q"
              id={`question-${question.id}`}
              key={question.id}
              data-missing={blockedQuestionId === question.id}
            >
              <div className="rs-qh">
                <span className="rs-no">{displayNumber(index)}</span>
                <span className="rs-qt">
                  {question.title}
                  {question.required ? <em aria-label="필수">*</em> : null}
                </span>
              </div>
              {question.type === "multiple" ? (
                <p className="rs-cap">복수 선택이 가능해요.</p>
              ) : question.type === "single" ? (
                <p className="rs-cap">하나만 선택해주세요.</p>
              ) : question.type === "text" ? (
                <p className="rs-cap">솔직한 의견을 들려주세요.</p>
              ) : null}

              {isChoice(question.type) ? (
                <div className="rs-choices">
                  {(question.options ?? []).map((option) => {
                    const on =
                      question.type === "single" ? value === option : chosen.includes(option);
                    return (
                      <label key={option} data-on={on}>
                        <input
                          type={question.type === "single" ? "radio" : "checkbox"}
                          name={`question-${question.id}`}
                          checked={on}
                          onChange={() =>
                            question.type === "single"
                              ? setAnswer(question.id, option)
                              : toggleChoice(question.id, option)
                          }
                        />
                        <span>{option}</span>
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {question.type === "scale" ? (
                <div className="rs-scale">
                  <div
                    className="rs-scale-btns"
                    style={{
                      gridTemplateColumns: `repeat(${surveyResponse.scaleValues(question).length}, 1fr)`,
                    }}
                  >
                    {surveyResponse.scaleValues(question).map((point) => (
                      <button
                        type="button"
                        key={point}
                        aria-pressed={value === point}
                        onClick={() => setAnswer(question.id, point)}
                      >
                        {point}
                      </button>
                    ))}
                  </div>
                  <div className="rs-scale-labels">
                    <span>{question.scaleMinLabel ?? "전혀 그렇지 않음"}</span>
                    <span>{question.scaleMaxLabel ?? "매우 그러함"}</span>
                  </div>
                </div>
              ) : null}

              {question.type === "dropdown" ? (
                <div className="rs-text">
                  <select
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => setAnswer(question.id, event.target.value)}
                    aria-label={question.title}
                  >
                    <option value="">선택해주세요.</option>
                    {(question.options ?? []).map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {(question.type === "text" || question.type === "shortText") && limit ? (
                <div className="rs-text">
                  {question.type === "text" ? (
                    <textarea
                      value={typeof value === "string" ? value : ""}
                      maxLength={limit}
                      onChange={(event) => setAnswer(question.id, event.target.value)}
                      placeholder="자유롭게 적어주세요"
                      aria-label={question.title}
                    />
                  ) : (
                    <input
                      value={typeof value === "string" ? value : ""}
                      maxLength={limit}
                      onChange={(event) => setAnswer(question.id, event.target.value)}
                      placeholder="한 줄로 적어주세요"
                      aria-label={question.title}
                    />
                  )}
                  <p
                    className="rs-cnt"
                    data-warn={(typeof value === "string" ? value.length : 0) > limit * 0.9}
                  >
                    {typeof value === "string" ? value.length : 0} / {limit}
                  </p>
                </div>
              ) : null}

              {question.type === "date" || question.type === "time" ? (
                <div className="rs-text">
                  <input
                    type={question.type}
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => setAnswer(question.id, event.target.value)}
                    aria-label={question.title}
                  />
                </div>
              ) : null}

              <p className="rs-err">이 문항은 반드시 응답해야 합니다.</p>
            </section>
          );
        })}
      </div>

      <div className="rs-submit">
        {error ? (
          <p className="rs-error" role="alert">
            {error}
          </p>
        ) : null}
        <p className="rs-gate" data-done={!missing}>
          {missing ? (
            <>
              필수 문항 <b>{requiredLeft}개</b>가 남았습니다
            </>
          ) : (
            "필수 문항을 모두 채웠습니다"
          )}
        </p>
        <button type="button" disabled={submitting} onClick={() => void submitResponse()}>
          {submitting ? "응답 저장 중…" : "응답 제출하기"}
        </button>
        <p className="rs-note">
          제출 후에는 수정할 수 없습니다. 수집 항목은 응답 내용과 소요 시간뿐입니다.
        </p>
      </div>
    </div>
  );
}
