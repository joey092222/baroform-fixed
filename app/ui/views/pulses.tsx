"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  campusPulseTimeLeft,
  rankCampusPulses,
  type CampusPulse,
} from "../../campus-pulse";
import {
  type AuthUser,
} from "../../ux/types";
import { fetchPulses, votePulse } from "../../ux/data/pulses";
import {
  PulseCreateModal,
} from "../shared/campus-pulse";

export function CampusPulseBoardView({
  user,
  authToken,
  onAuth,
}: {
  user: AuthUser | null;
  authToken: string;
  onAuth: () => void;
}) {
  const [pulses, setPulses] = useState<CampusPulse[]>([]);
  const [selectedPulseId, setSelectedPulseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const loadPulses = useCallback(async () => {
    setLoading(true);
    try {
      setPulses(await fetchPulses(authToken));
    } catch {
      setPulses([]);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    fetchPulses(authToken)
      .then((nextPulses) => {
        if (!cancelled) setPulses(nextPulses);
      })
      .catch(() => {
        if (!cancelled) setPulses([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authToken]);

  const rankedPulses = useMemo(() => rankCampusPulses(pulses), [pulses]);
  const selectedPulse =
    rankedPulses.find((pulse) => pulse.id === selectedPulseId) ?? rankedPulses[0];
  const [voting, setVoting] = useState(false);

  /**
   * 로그인하지 않으면 투표할 수 없습니다 — 학교 계정당 한 번이라는 규칙이
   * 계정 없이는 성립하지 않습니다. 그래서 누르면 로그인으로 안내합니다.
   */
  const castVote = async (optionIndex: number) => {
    if (!selectedPulse || voting) return;
    if (!user) {
      onAuth();
      return;
    }
    setVoting(true);
    try {
      await votePulse(authToken, selectedPulse.id, optionIndex);
      await loadPulses();
    } finally {
      setVoting(false);
    }
  };

  const openCreate = () => {
    if (!user) {
      onAuth();
      return;
    }
    setCreateOpen(true);
  };

  return (
    <>
      <main className="pl-wrap">
        <div className="pl-head">
          <h1>캠퍼스 투표</h1>
          <p>한 문항으로 10초 만에 학교의 생각을 확인합니다.</p>
          <button type="button" className="pl-new" onClick={openCreate}>
            ＋ 새 투표
          </button>
        </div>

        <div className="pl-cols">
          <div className="pz-box">
            <h2>
              진행 중인 투표
              <span style={{ fontWeight: 400, fontSize: 12.5, color: "var(--bf-muted-soft)" }}>
                참여 많은 순 · {rankedPulses.length}개
              </span>
            </h2>
            {loading ? (
              <div className="pz-empty">
                <b>투표를 불러오고 있어요</b>
              </div>
            ) : rankedPulses.length === 0 ? (
              <div className="pz-empty">
                <b>진행 중인 투표가 없어요</b>
                <p>한 문항이면 됩니다. 첫 질문을 올려보세요.</p>
                <button type="button" className="pz-go" onClick={openCreate}>
                  투표 만들기
                </button>
              </div>
            ) : (
              rankedPulses.map((pulse, index) => {
                const left = campusPulseTimeLeft(pulse.expiresAt);
                const closing = left.includes("시간") || left.includes("분");
                return (
                  <button
                    type="button"
                    className="pl-row"
                    key={pulse.id}
                    aria-current={selectedPulse?.id === pulse.id}
                    onClick={() => setSelectedPulseId(pulse.id)}
                  >
                    <span className="pl-row-top">
                      {/* 1위만 이름을 붙입니다 — 「투표 3」은 정보가 아닙니다. */}
                      {index === 0 ? <em>참여 1위</em> : <span>선택지 {pulse.options.length}개</span>}
                      <span className={closing ? "pl-soon" : "pl-when"}>{left}</span>
                    </span>
                    <span className="pl-row-q">{pulse.question}</span>
                    <span className="pl-row-meta">
                      {pulse.totalVotes.toLocaleString("ko-KR")}명 참여
                      {pulse.myVote !== null ? " · 참여함" : ""}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="pz-box pl-detail">
            {loading ? (
              <p className="pz-poll-total" style={{ margin: 0 }}>불러오는 중…</p>
            ) : !selectedPulse ? (
              <>
                <h2>먼저 물어볼 것을 정해주세요</h2>
                <p className="pl-sub">
                  선택지 2~5개짜리 한 문항이면 됩니다. 결과는 바로 공개됩니다.
                </p>
                <button
                  type="button"
                  className="pz-go"
                  style={{ marginTop: 18, maxWidth: 200 }}
                  onClick={openCreate}
                >
                  투표 만들기
                </button>
              </>
            ) : (
              <>
                <span className="pl-live">
                  <i />
                  진행 중
                </span>
                <h2>{selectedPulse.question}</h2>
                <p className="pl-sub">
                  {selectedPulse.myVote !== null
                    ? "이미 참여했어요. 마감 전까지 바꿀 수 있습니다."
                    : "선택지만 누르면 바로 반영돼요. 학교 계정당 한 번 참여할 수 있어요."}
                </p>

                <div className="pl-opts">
                  {selectedPulse.options.map((option, index) => {
                    const votes = selectedPulse.overall[index] ?? 0;
                    const share = selectedPulse.totalVotes
                      ? Math.round((votes / selectedPulse.totalVotes) * 100)
                      : 0;
                    const mine = selectedPulse.myVote === index;
                    // 투표 전에는 결과를 가립니다 — 먼저 본 분포가 답을 끌어당깁니다.
                    const revealed = selectedPulse.myVote !== null;
                    return (
                      <button
                        type="button"
                        className="pl-opt"
                        key={option}
                        data-mine={mine}
                        disabled={voting}
                        onClick={() => void castVote(index)}
                      >
                        {revealed ? (
                          <span className="pl-fill" style={{ width: `${share}%` }} />
                        ) : null}
                        <span className="pl-label">{option}</span>
                        {revealed ? (
                          <>
                            <span className="pl-count">
                              {votes.toLocaleString("ko-KR")}명
                            </span>
                            <span className="pl-pct">{share}%</span>
                          </>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="pl-foot">
                  <span>
                    <b>{selectedPulse.totalVotes.toLocaleString("ko-KR")}</b>명 참여
                  </span>
                  <span>{campusPulseTimeLeft(selectedPulse.expiresAt)}</span>
                  {selectedPulse.myVote === null && !user ? (
                    <button
                      type="button"
                      className="pl-change pz-ghost"
                      style={{ minHeight: 36 }}
                      onClick={onAuth}
                    >
                      로그인하고 참여
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
      {createOpen && (
        <PulseCreateModal
          authToken={authToken}
          onClose={() => setCreateOpen(false)}
          onSaved={() => void loadPulses()}
        />
      )}
    </>
  );
}
