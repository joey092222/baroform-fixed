"use client";

import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  School,
} from "lucide-react";
import {
  useState,
} from "react";
import {
  surveyCategories,
  type SurveyCategory,
} from "../../survey-board";
import {
  surveySharePath,
} from "../../survey-share";
import {
  type AuthUser,
} from "../../ux/types";
import {
  BrandMark,
} from "../shared/chrome";
import {
  InstagramGlyph,
  shareSurveyCardToInstagramApp,
} from "../shared/share-cards";

export function PublishModal({
  title,
  onClose,
  onConfirm,
  onLogin,
  user,
  saving,
  error,
  cashBalance,
  rewardCash,
}: {
  title: string;
  onClose: () => void;
  onConfirm: (
    ownerName: string,
    listingRequested: boolean,
    category: SurveyCategory,
    shareToInstagram: boolean,
    targetResponses: number,
  ) => void;
  onLogin: () => void;
  user: AuthUser | null;
  saving: boolean;
  error: string;
  cashBalance: number;
  rewardCash: number;
}) {
  const [ownerName, setOwnerName] = useState(user?.name ?? "");
  const [listingRequested, setListingRequested] = useState(false);
  const [category, setCategory] = useState<SurveyCategory>("course");
  const [target, setTarget] = useState(100);

  // 목표는 곧 모집 비용입니다. 발행 버튼 옆에서 계산해 보여주지 않으면
  // 캐시가 부족한 것을 발행 후에 알게 됩니다.
  const needed = listingRequested ? target * rewardCash : 0;
  const shortfall = Math.max(0, needed - cashBalance);

  const publish = (toInstagram: boolean) => {
    if (!user) {
      onLogin();
      return;
    }
    onConfirm(
      ownerName.trim() || user.name,
      listingRequested,
      category,
      toInstagram,
      listingRequested ? target : 0,
    );
  };

  return (
    <div className="pb-back" role="dialog" aria-modal="true" aria-label="설문 발행">
      <div className="pb-modal">
        <div className="pb-head">
          <div>
            <h2>발행하기</h2>
            <p>{title.trim() || "제목 없는 설문"}</p>
          </div>
          <button type="button" className="pb-x" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className="pb-body">
          <div className="pb-fset">
            <b>게시자 표시 이름</b>
            <small>응답자에게 이 이름으로 보입니다.</small>
            <input
              className="pb-in"
              value={ownerName}
              maxLength={40}
              onChange={(event) => setOwnerName(event.target.value)}
              placeholder={user?.name ?? "이름"}
              aria-label="게시자 표시 이름"
            />
          </div>

          <div className="pb-fset">
            <b>응답을 어떻게 받을까요?</b>
            <small>나중에 바꿀 수 있습니다.</small>
            <div className="pb-scope">
              <label data-on={!listingRequested}>
                <input
                  type="radio"
                  name="publish-scope"
                  checked={!listingRequested}
                  onChange={() => setListingRequested(false)}
                />
                <span>
                  <span className="pb-t">링크만 받아서 직접 배포</span>
                  <span className="pb-d">
                    카카오톡·에브리타임 등에 직접 공유합니다. 캐시가 들지 않습니다.
                  </span>
                </span>
              </label>
              <label data-on={listingRequested}>
                <input
                  type="radio"
                  name="publish-scope"
                  checked={listingRequested}
                  onChange={() => setListingRequested(true)}
                />
                <span>
                  <span className="pb-t">학교 게시판에 올려 모집</span>
                  <span className="pb-d">
                    참여자에게 캐시를 지급하고 목표 인원까지 모읍니다.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {listingRequested ? (
            <>
              <div className="pb-fset">
                <b>게시판 분류</b>
                <small>게시판에서 이 분류로 찾을 수 있습니다.</small>
                <div className="pb-pills">
                  {surveyCategories.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      aria-pressed={category === entry.id}
                      onClick={() => setCategory(entry.id)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pb-fset">
                <b>목표 응답 수</b>
                <small>여기까지 모이면 진행 게이지가 100%가 됩니다.</small>
                <div className="pb-pills">
                  {[50, 100, 200, 300, 500, 1000].map((count) => (
                    <button
                      type="button"
                      key={count}
                      aria-pressed={target === count}
                      onClick={() => setTarget(count)}
                    >
                      {count.toLocaleString("ko-KR")}명
                    </button>
                  ))}
                </div>
                <p className="pb-cost">
                  필요 캐시 <b>{needed.toLocaleString("ko-KR")} C</b> · 보유{" "}
                  <b>{cashBalance.toLocaleString("ko-KR")} C</b>
                  {shortfall > 0 ? (
                    <>
                      {" · "}
                      <span className="pb-short">
                        {shortfall.toLocaleString("ko-KR")} C 부족
                      </span>
                      <br />
                      지금 발행하고 모자란 만큼은 나중에 충전해도 됩니다. 캐시가 없으면
                      모집이 멈춥니다.
                    </>
                  ) : null}
                </p>
              </div>
            </>
          ) : null}
        </div>

        <div className="pb-foot">
          {error ? (
            <p className="pb-err" role="alert">
              {error}
            </p>
          ) : null}
          <button type="button" disabled={saving} onClick={() => publish(false)}>
            {saving ? "발행 중…" : user ? "발행하기" : "로그인하고 발행하기"}
          </button>
          <button
            type="button"
            className="pb-ghost"
            disabled={saving}
            onClick={() => publish(true)}
          >
            발행하고 Instagram에 공유
          </button>
        </div>
      </div>
    </div>
  );
}


export function PublishedView({
  title,
  slug,
  listingRequested,
  onSurvey,
  onAnalytics,
  onHome,
  onBoard,
  initialInstagramStatus,
}: {
  title: string;
  slug: string;
  listingRequested: boolean;
  onSurvey: () => void;
  onAnalytics: () => void;
  onHome: () => void;
  onBoard: () => void;
  initialInstagramStatus: string;
}) {
  const [copied, setCopied] = useState(false);
  const [instagramSharing, setInstagramSharing] = useState(false);
  const [instagramStatus, setInstagramStatus] = useState(initialInstagramStatus);
  const sharePath = surveySharePath(slug);
  const shareUrl =
    typeof window === "undefined"
      ? sharePath
      : new URL(sharePath, window.location.origin).toString();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard access can be unavailable in an embedded preview.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const shareSurveyToInstagram = async () => {
    if (instagramSharing) return;
    setInstagramSharing(true);
    setInstagramStatus("");
    const status = await shareSurveyCardToInstagramApp({ title, surveyUrl: shareUrl });
    setInstagramStatus(status);
    setInstagramSharing(false);
  };

  return (
    <main className="published-page">
      <div className="published-shell">
        <span className="success-check">
          <Check size={28} />
        </span>
        <span className="published-kicker">배포 준비 완료</span>
        <h1>{title}</h1>
        <p>
          아래 링크를 보내면 누구나 로그인 없이 바로 응답할 수 있어요.
        </p>
        <div className="share-box">
          <span className="share-box-label">설문 참여 링크</span>
          <div className="published-share-row">
            <span className="published-share-url">{shareUrl}</span>
            <button type="button" className="copy-share-button" onClick={copyLink}>
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? "복사됨" : "링크 복사"}
            </button>
            <button
              type="button"
              className="instagram-publish-button"
              onClick={() => void shareSurveyToInstagram()}
              disabled={instagramSharing}
            >
              <InstagramGlyph size={18} />
              {instagramSharing ? "카드 만드는 중…" : "인스타로 배포"}
            </button>
          </div>
        </div>
        {instagramStatus && <span className="published-share-status" role="status">{instagramStatus}</span>}
        <div className="share-banner">
          <div>
            <BrandMark compact />
            <span>BAROFORM SURVEY</span>
          </div>
          <h2>{title}</h2>
          <p>로그인 없이 참여 · 익명 응답</p>
          <span className="share-banner-badge"><InstagramGlyph size={13} /> 인스타그램 4:5 카드 지원</span>
        </div>
        <div className="access-info">
          <div>
            <span>공개 범위</span>
            <strong>링크가 있는 모든 사람</strong>
          </div>
          <div>
            <span>학교 설문 목록</span>
            <strong>
              {listingRequested ? "게시 완료" : "표시하지 않음"}
            </strong>
          </div>
          <div>
            <span>응답자 로그인</span>
            <strong>필요 없음</strong>
          </div>
        </div>
        <div className="published-actions">
          <button
            type="button"
            className="secondary"
            onClick={listingRequested ? onBoard : onSurvey}
          >
            {listingRequested ? "게시판에서 확인" : "설문 화면 보기"}
            {listingRequested ? <School size={16} /> : <Eye size={16} />}
          </button>
          <button type="button" className="primary" onClick={onAnalytics}>
            응답 받기 시작
            <ArrowRight size={16} />
          </button>
        </div>
        <button type="button" className="home-text-button" onClick={onHome}>
          홈으로 돌아가기
        </button>
      </div>
    </main>
  );
}

