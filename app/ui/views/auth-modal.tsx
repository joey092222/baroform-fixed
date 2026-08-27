"use client";

import {
  ArrowRight,
  Coins,
  FileText,
  UserRound,
  X,
} from "lucide-react";
import {
  useState,
} from "react";
import {
  schoolOptions,
} from "../../survey-board";
import {
  type AuthUser,
} from "../../ux/types";
import { authenticate } from "../../ux/data/auth";

export function AuthModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (token: string, user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [schoolId, setSchoolId] = useState("yonsei");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await authenticate(mode, {
        email,
        password,
        name,
        schoolId,
      });
      onSuccess(result.token, result.user);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "잠시 후 다시 시도해주세요.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <form className="auth-modal" onSubmit={submit}>
        <button type="button" className="modal-close" onClick={onClose} aria-label="닫기">
          <X size={20} />
        </button>
        <span className="auth-icon"><UserRound size={24} /></span>
        <h2>{mode === "login" ? "바로폼 로그인" : "학교 프로필 만들기"}</h2>
        <p>
          설문은 로그인 없이 참여할 수 있어요. 캐시를 적립하거나 학교
          게시판에 설문을 올릴 때만 프로필이 필요해요.
        </p>
        <div className="auth-benefits">
          <span><Coins size={14} />참여 캐시 자동 적립</span>
          <span><FileText size={14} />내 설문·응답 내역 보관</span>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="로그인 또는 회원가입">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>
            로그인
          </button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>
            회원가입
          </button>
        </div>
        {mode === "register" && (
          <>
            <label className="auth-field">
              <span>이름 또는 활동명</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="예) 박준성" maxLength={30} required />
            </label>
            <label className="auth-field">
              <span>학교</span>
              <select value={schoolId} onChange={(event) => setSchoolId(event.target.value)} required>
                {schoolOptions.map((school) => (
                  <option key={school.id} value={school.id}>{school.name} · {school.campus}</option>
                ))}
              </select>
              <small>베타 기간에는 연세대학교 신촌캠퍼스만 가입할 수 있어요.</small>
            </label>
          </>
        )}
        <label className="auth-field">
          <span>이메일</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required />
        </label>
        <label className="auth-field">
          <span>비밀번호</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} required />
        </label>
        {error && <p className="publish-error" role="alert">{error}</p>}
        <button className="modal-confirm" type="submit" disabled={saving}>
          {saving ? "확인 중…" : mode === "login" ? "로그인" : "가입하고 시작하기"}
          {!saving && <ArrowRight size={17} />}
        </button>
      </form>
    </div>
  );
}

