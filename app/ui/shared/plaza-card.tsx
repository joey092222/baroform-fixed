"use client";

import type { CSSProperties } from "react";

import { surveyCover } from "../../ux/survey-cover";
import type { PublicSurvey } from "../../ux/types";

/**
 * The survey card, shared by the plaza and the school board.
 *
 * One component rather than one per screen: the two lists show the same thing
 * and drifted apart the last time they each had their own markup. Styles live
 * in app/plaza.css under the pz- prefix.
 */

/** Responses a survey wants. Older rows predate the field, so fall back. */
export function surveyTarget(survey: PublicSurvey) {
  return survey.targetResponses && survey.targetResponses > 0
    ? survey.targetResponses
    : 100;
}

export function surveyQuestionCount(survey: PublicSurvey) {
  return survey.questionCount ?? survey.questions?.length ?? 0;
}

export function PlazaSurveyCard({
  survey,
  onOpen,
  onDetail,
  detailLabel = "자세히",
}: {
  survey: PublicSurvey;
  onOpen: () => void;
  onDetail?: () => void;
  detailLabel?: string;
}) {
  const cover = surveyCover(survey);
  const target = surveyTarget(survey);
  const received = survey.responseCount ?? 0;
  const percent = Math.min(100, Math.round((received / target) * 100));
  const external = survey.source === "external";

  return (
    <article className="pz-card">
      <div
        className={cover.kind === "photo" ? "pz-cover" : "pz-cover pz-cover-topic"}
        style={
          cover.kind === "photo"
            ? { backgroundImage: `url(${cover.src})` }
            : ({
                "--pz-field": cover.tone.field,
                "--pz-ink": cover.tone.ink,
              } as CSSProperties)
        }
      >
        <span className="pz-cover-tag">{cover.tag}</span>
        <span className="pz-cover-kw">{cover.keyword}</span>
      </div>
      <div className="pz-body">
        <div className="pz-chips">
          <span className="pz-chip pz-chip-pay">+{survey.rewardCash} C</span>
          {survey.targetAudience ? (
            <span className="pz-chip">{survey.targetAudience}</span>
          ) : null}
          {external ? <span className="pz-chip">외부 설문</span> : null}
        </div>
        <h3>{survey.title}</h3>
        <p className="pz-owner">
          {survey.ownerName}
          {survey.campus ? ` · ${survey.campus}` : ""}
        </p>
        <div className="pz-facts">
          <span>
            문항 <b>{surveyQuestionCount(survey)}</b>
          </span>
          <span>
            예상 <b>{survey.durationMinutes}분</b>
          </span>
        </div>
        {/* 외부 설문은 응답이 우리 쪽에 쌓이지 않으므로 게이지를 그리지 않습니다. */}
        {external ? (
          <p className="pz-outside">
            다른 서비스에서 진행되는 설문입니다. 새 탭에서 열립니다.
          </p>
        ) : (
          <div className="pz-gauge">
            <div className="pz-gauge-label">
              <span>
                응답 <b>{received.toLocaleString("ko-KR")}</b> / 목표{" "}
                {target.toLocaleString("ko-KR")}
              </span>
              <span className={percent >= 90 ? "pz-due" : undefined}>{percent}%</span>
            </div>
            <div className="pz-gauge-track">
              <i
                className={percent >= 100 ? "pz-full" : undefined}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}
        <div className="pz-acts">
          <button type="button" className="pz-go" onClick={onOpen}>
            {external ? "설문 열기" : "응답하기"}
          </button>
          {onDetail ? (
            <button type="button" className="pz-ghost" onClick={onDetail}>
              {detailLabel}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
