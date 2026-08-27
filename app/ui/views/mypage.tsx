"use client";

import {
} from "lucide-react";
import {
  useState,
} from "react";
import {
  categoryLabel,
  schoolLabel,
} from "../../survey-board";
import { surveyQuestionCount, surveyTarget } from "../shared/plaza-card";
import {
  surveySharePath,
} from "../../survey-share";
import {
  type AuthUser,
  type OwnedSurvey,
  type WalletData,
} from "../../ux/types";
import {
  Footer,
} from "../shared/chrome";

export function MyPageView({
  user,
  surveys,
  loading,
  error,
  onCreate,
  onOpenSurvey,
  onOpenAnalytics,
  onOpenBoard,
  onDeleteSurvey,
  onLogout,
  wallet,
}: {
  user: AuthUser;
  surveys: OwnedSurvey[];
  loading: boolean;
  error: string;
  onCreate: () => void;
  onOpenSurvey: (survey: OwnedSurvey) => void;
  onOpenAnalytics: (survey: OwnedSurvey) => void;
  onOpenBoard: () => void;
  onDeleteSurvey: (survey: OwnedSurvey) => Promise<void>;
  onLogout: () => void;
  wallet: WalletData;
}) {
  const [copiedSlug, setCopiedSlug] = useState("");
  const [deletingSlug, setDeletingSlug] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const totalResponses = surveys.reduce(
    (total, survey) => total + survey.responseCount,
    0,
  );

  const copySurveyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(
        new URL(surveySharePath(slug), window.location.origin).toString(),
      );
      setCopiedSlug(slug);
      window.setTimeout(() => setCopiedSlug(""), 1600);
    } catch {
      setCopiedSlug("");
    }
  };

  const deleteSurvey = async (survey: OwnedSurvey) => {
    const confirmed = window.confirm(
      `‘${survey.title}’ 설문을 삭제할까요?\n저장된 응답과 결과도 함께 삭제되며 되돌릴 수 없어요.`,
    );
    if (!confirmed) return;

    setDeletingSlug(survey.slug);
    setDeleteError("");
    try {
      await onDeleteSurvey(survey);
    } catch (deleteFailure) {
      setDeleteError(
        deleteFailure instanceof Error
          ? deleteFailure.message
          : "설문을 삭제하지 못했어요.",
      );
    } finally {
      setDeletingSlug("");
    }
  };

  const listed = surveys.filter((survey) => survey.isListed);
  const drafts = surveys.filter((survey) => !survey.isListed);
  // 평균 보상으로 남은 캐시를 응답 수로 환산합니다. 잔액보다 이 숫자가
  // 결정적입니다 — 여기서 막히면 목표를 채울 방법이 없습니다.
  const averageReward = surveys.length
    ? Math.max(
        1,
        Math.round(
          surveys.reduce((sum, survey) => sum + survey.rewardCash, 0) / surveys.length,
        ),
      )
    : 30;
  const affordable = Math.floor(wallet.balance / averageReward);
  const goalTotal = surveys.reduce((sum, survey) => sum + surveyTarget(survey), 0);
  const goalPercent = goalTotal
    ? Math.min(100, Math.round((totalResponses / goalTotal) * 100))
    : 0;
  const nearlyFull = listed.filter((survey) => {
    const target = surveyTarget(survey);
    return survey.responseCount >= target * 0.9 && survey.responseCount < target;
  });
  const shortOnCash = affordable < Math.max(0, goalTotal - totalResponses);

  return (
    <>
      <main className="wk-wrap">
        <div className="wk-head">
          <h1>작업실</h1>
          <p>{schoolLabel(user.schoolId)} · {user.name}</p>
          <button type="button" className="wk-out" onClick={onLogout}>로그아웃</button>
        </div>

        <div className="wk-kpis">
          <div className="wk-kpi">
            <div className="wk-k">만든 설문</div>
            <div className="wk-v">
              {listed.length}
              <small> / 총 {surveys.length}</small>
            </div>
            <div className="wk-d">
              공개 <b>{listed.length}</b> · 초안 <b>{drafts.length}</b>
            </div>
          </div>
          <div className="wk-kpi">
            <div className="wk-k">받은 응답</div>
            <div className="wk-v">{totalResponses.toLocaleString("ko-KR")}</div>
            <div className="wk-d">
              설문당 평균 <b>
                {surveys.length ? Math.round(totalResponses / surveys.length) : 0}
              </b>
            </div>
          </div>
          <div className="wk-kpi">
            <div className="wk-k">목표 달성률</div>
            <div className="wk-v">
              {goalPercent}
              <small>%</small>
            </div>
            <div className="wk-d">
              <b>{totalResponses.toLocaleString("ko-KR")}</b> / 목표{" "}
              {goalTotal.toLocaleString("ko-KR")}
            </div>
          </div>
          <div className="wk-kpi wk-runway">
            <div className="wk-k">남은 캐시로 더 받을 수 있는 응답</div>
            <div className="wk-v">
              약 {affordable.toLocaleString("ko-KR")}
              <small>명</small>
            </div>
            <div className="wk-d">
              {wallet.balance.toLocaleString("ko-KR")} C · 평균 <b>{averageReward} C</b>/응답
            </div>
          </div>
        </div>

        <div className="wk-cols">
          <div className="pz-box">
            <h2>
              내가 만든 설문
              <button type="button" onClick={onCreate}>＋ 새 설문</button>
            </h2>
            {loading ? (
              <div className="pz-empty"><b>내 설문을 불러오고 있어요</b></div>
            ) : error ? (
              <div className="pz-empty">
                <b>내 설문을 불러오지 못했어요</b>
                <p>{error}</p>
              </div>
            ) : surveys.length === 0 ? (
              <div className="pz-empty">
                <b>아직 만든 설문이 없어요</b>
                <p>주제를 한 줄 적으면 문항과 선택지, 척도까지 설계해드립니다.</p>
                <button type="button" className="pz-go" onClick={onCreate}>
                  설문 만들기
                </button>
              </div>
            ) : (
              surveys.map((survey) => {
                const target = surveyTarget(survey);
                const percent = Math.min(
                  100,
                  Math.round((survey.responseCount / target) * 100),
                );
                return (
                  <div className="wk-row" key={survey.slug}>
                    <div className="wk-row-top">
                      <h3>{survey.title}</h3>
                      <span className={survey.isListed ? "wk-pill wk-live" : "wk-pill wk-draft"}>
                        <i />
                        {survey.isListed ? "모집중" : "초안"}
                      </span>
                    </div>
                    <div className="wk-meta">
                      <span className="pz-chip">{categoryLabel(survey.category)}</span>
                      <span className="pz-chip">문항 {surveyQuestionCount(survey)}</span>
                      <span className="pz-chip">예상 {survey.durationMinutes}분</span>
                      {survey.targetAudience ? (
                        <span className="pz-chip">{survey.targetAudience}</span>
                      ) : null}
                      <span className="pz-chip">보상 {survey.rewardCash} C</span>
                    </div>
                    <div className="wk-grid2">
                      <div className="pz-gauge">
                        <div className="pz-gauge-label">
                          <span>
                            응답 <b>{survey.responseCount.toLocaleString("ko-KR")}</b> / 목표{" "}
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
                      <div className="wk-acts">
                        <button type="button" onClick={() => void copySurveyLink(survey.slug)}>
                          {copiedSlug === survey.slug ? "복사됨" : "링크 복사"}
                        </button>
                        <button type="button" onClick={() => onOpenSurvey(survey)}>
                          문항 수정
                        </button>
                        <button
                          type="button"
                          className="wk-primary"
                          onClick={() => onOpenAnalytics(survey)}
                        >
                          결과 보기
                        </button>
                        <button
                          type="button"
                          className="wk-danger"
                          disabled={deletingSlug === survey.slug}
                          onClick={() => void deleteSurvey(survey)}
                        >
                          {deletingSlug === survey.slug ? "삭제 중…" : "삭제"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {deleteError ? (
              <p className="wk-row" role="alert" style={{ color: "var(--bf-danger)", fontSize: 13 }}>
                {deleteError}
              </p>
            ) : null}
          </div>

          <div className="wk-side">
            {/* 완료된 일은 여기 올리지 않습니다 — 손댈 것만 남깁니다. */}
            {nearlyFull.length > 0 || shortOnCash ? (
              <div className="pz-box">
                <h2>지금 손대야 하는 것</h2>
                {nearlyFull.map((survey) => (
                  <div className="wk-todo" key={survey.slug}>
                    <span className="wk-ic wk-warn">◷</span>
                    <span>
                      <span className="wk-t">「{survey.title}」이 목표에 거의 찼습니다</span>
                      <span className="wk-m">
                        {survey.responseCount} / {surveyTarget(survey)}명 ·{" "}
                        {surveyTarget(survey) - survey.responseCount}명 남음
                      </span>
                      <button type="button" onClick={() => onOpenAnalytics(survey)}>
                        결과 보기 →
                      </button>
                    </span>
                  </div>
                ))}
                {shortOnCash ? (
                  <div className="wk-todo">
                    <span className="wk-ic wk-bad">₩</span>
                    <span>
                      <span className="wk-t">캐시가 {affordable}명분만 남았습니다</span>
                      <span className="wk-m">
                        남은 목표는 {Math.max(0, goalTotal - totalResponses).toLocaleString("ko-KR")}명입니다
                      </span>
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="pz-box">
              <h2>
                캐시
                <button type="button" onClick={onOpenBoard}>설문 찾기</button>
              </h2>
              <div className="pz-prof" style={{ paddingBottom: 0 }}>
                <div className="pz-wallet" style={{ marginTop: 0 }}>
                  <span>보유 캐시</span>
                  <b>{wallet.balance.toLocaleString("ko-KR")}</b>
                </div>
              </div>
              {wallet.transactions.length === 0 ? (
                <p className="pz-poll-total" style={{ padding: "14px 16px", margin: 0 }}>
                  아직 적립 내역이 없어요. 설문에 참여하면 쌓입니다.
                </p>
              ) : (
                <div style={{ marginTop: 14 }}>
                  {wallet.transactions.slice(0, 5).map((transaction) => (
                    <div className="wk-tx" key={transaction.id}>
                      <span>{transaction.description}</span>
                      <em className={transaction.amount >= 0 ? "wk-plus" : "wk-minus"}>
                        {transaction.amount >= 0 ? "+" : ""}
                        {transaction.amount.toLocaleString("ko-KR")}
                      </em>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

