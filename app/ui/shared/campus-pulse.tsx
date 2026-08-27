"use client";

import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Plus,
  X,
} from "lucide-react";
import {
  useState,
} from "react";
import {
  type CampusPulse,
} from "../../campus-pulse";
import {
  type AuthUser,
} from "../../ux/types";
import { createPulse, votePulse } from "../../ux/data/pulses";

export function PulseCreateModal({
  authToken,
  onClose,
  onSaved,
}: {
  authToken: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [expiresHours, setExpiresHours] = useState(24);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await createPulse(authToken, { question, options, expiresHours });
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "투표를 만들지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop feature-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pulse-create-title">
      <form className="feature-modal pulse-create-modal" onSubmit={submit}>
        <button type="button" className="feature-modal-close" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        <span className="feature-modal-kicker"><BarChart3 size={16} /> CAMPUS PULSE</span>
        <h2 id="pulse-create-title">10초짜리 캠퍼스 질문을 열어보세요.</h2>
        <p>긴 설문이 아니어도 괜찮아요. 투표가 끝나는 즉시 학교 구성원의 결과가 보여요.</p>
        <label><span>질문</span><input required minLength={5} maxLength={120} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="예: 이번 축제 라인업, 만족한다 vs 아쉽다" /></label>
        <div className="pulse-option-editor">
          {options.map((option, index) => (
            <label key={index}><span>선택지 {index + 1}</span><input required maxLength={40} value={option} onChange={(event) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />{options.length > 2 && <button type="button" onClick={() => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}><X size={15} /></button>}</label>
          ))}
          {options.length < 4 && <button type="button" className="pulse-add-option" onClick={() => setOptions((current) => [...current, ""])}><Plus size={15} /> 선택지 추가</button>}
        </div>
        <label><span>투표 기간</span><select value={expiresHours} onChange={(event) => setExpiresHours(Number(event.target.value))}><option value={6}>6시간</option><option value={24}>24시간</option><option value={72}>3일</option><option value={168}>7일</option></select></label>
        {error && <span className="feature-modal-error" role="alert">{error}</span>}
        <button type="submit" className="feature-modal-submit" disabled={saving}>{saving ? "게시 중…" : "캠퍼스에 투표 열기"}<ArrowRight size={17} /></button>
      </form>
    </div>
  );
}

export function CampusPulseSection({
  pulse,
  loading,
  user,
  authToken,
  onAuth,
  onReload,
  onCreate,
  onOpenBoard,
  title = "오늘 캠퍼스의 생각",
  showBoardLink = true,
}: {
  pulse?: CampusPulse;
  loading: boolean;
  user: AuthUser | null;
  authToken: string;
  onAuth: () => void;
  onReload: () => void;
  onCreate: () => void;
  onOpenBoard: () => void;
  title?: string;
  showBoardLink?: boolean;
}) {
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState("");
  const resultCounts = pulse?.overall ?? [];
  const resultTotal = resultCounts.reduce((sum, count) => sum + count, 0);

  const vote = async (optionIndex: number) => {
    if (!user) { onAuth(); return; }
    if (!pulse || voting) return;
    setVoting(true);
    setError("");
    try {
      await votePulse(authToken, pulse.id, optionIndex);
      onReload();
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : "투표를 저장하지 못했어요.");
    } finally {
      setVoting(false);
    }
  };

  return (
    <section className="campus-pulse-section" id="campus-pulse" aria-labelledby="campus-pulse-title">
      <div className="campus-section-heading pulse-heading">
        <div><span>CAMPUS PULSE</span><h2 id="campus-pulse-title">{title}</h2></div>
        <div className="pulse-heading-actions">
          {showBoardLink && <button type="button" onClick={onOpenBoard}>투표 게시판 <ArrowRight size={16} /></button>}
          <button type="button" className="primary" onClick={user ? onCreate : onAuth}><Plus size={16} /> 새 투표 열기</button>
        </div>
      </div>
      {loading ? <span className="home-content-skeleton pulse-skeleton" /> : pulse ? (
        <div className="campus-pulse-card">
          <div className="pulse-question-panel">
            <span className="pulse-live"><i /> LIVE · {pulse.totalVotes}명 참여</span>
            <h3>{pulse.question}</h3>
            {pulse.myVote === null ? (
              <>
                <div className="pulse-vote-options">{pulse.options.map((option, index) => <button type="button" key={option} disabled={voting} onClick={() => void vote(index)}><span>{index + 1}</span>{option}<ArrowRight size={16} /></button>)}</div>
                <small className="pulse-login-note">선택지만 누르면 바로 반영돼요. 학교 계정당 한 번 참여할 수 있어요.</small>
              </>
            ) : (
              <div className="pulse-voted-message"><CheckCircle2 size={19} /><span><strong>투표했어요.</strong> 선택은 투표 기간 동안 다시 바꿀 수 있어요.</span></div>
            )}
            {error && <span className="feature-modal-error" role="alert">{error}</span>}
          </div>
          <div className="pulse-result-panel">
            <div className="pulse-result-head"><strong>{pulse.totalVotes.toLocaleString("ko-KR")}명 참여</strong></div>
            <div className="pulse-result-bars">{pulse.options.map((option, index) => { const percentage = resultTotal > 0 ? Math.round(((resultCounts[index] ?? 0) / resultTotal) * 100) : 0; return <div key={option}><span><strong>{option}</strong><em>{percentage}% · {resultCounts[index] ?? 0}명</em></span><i><b style={{ width: `${percentage}%` }} /></i></div>; })}</div>
            <small>학교 인증 계정의 투표만 집계해요. 학년·학과 같은 추가 정보는 받지 않아요.</small>
          </div>
        </div>
      ) : (
        <button type="button" className="pulse-empty" onClick={user ? onCreate : onAuth}><BarChart3 size={24} /><span><strong>아직 진행 중인 캠퍼스 투표가 없어요.</strong><small>첫 질문을 열고 10초 만에 학교의 생각을 확인해보세요.</small></span><ArrowRight size={18} /></button>
      )}
    </section>
  );
}

