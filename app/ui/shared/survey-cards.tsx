"use client";

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Coins,
  FileText,
  Link2,
  UsersRound,
} from "lucide-react";
import { categoryLabel, schoolLabel } from "../../survey-board";
import type { CommunityCategory } from "../../community";
import type { OwnedSurvey, PublicSurvey } from "../../ux/types";

export function CampusSurveyCard({
  survey,
  onClick,
  featured = false,
}: {
  survey: PublicSurvey;
  onClick: () => void;
  featured?: boolean;
}) {
  if (featured) {
    return (
      <button
        type="button"
        className="survey-card preview-featured-card accent-blue"
        onClick={onClick}
        aria-label={`${survey.title} 설문 참여하기`}
      >
        <div className="preview-card-topline">
          <span className="category-pill">{categoryLabel(survey.category)}</span>
          <span className="preview-open-status">
            <i />
            {survey.source === "external" ? survey.platform ?? "외부 설문" : "로그인 없이 참여"}
          </span>
        </div>
        <span className="preview-card-owner">{survey.ownerName}</span>
        <h3>{survey.title}</h3>
        {survey.description && (
          <p className="preview-card-description">{survey.description}</p>
        )}
        <div className="preview-card-footer">
          <span><Clock3 size={16} />약 {survey.durationMinutes}분</span>
          {survey.source === "external" ? (
            <span className="preview-card-reward"><UsersRound size={16} /> 목표 {survey.targetResponses ?? 0}명</span>
          ) : (
            <span className="preview-card-reward"><Coins size={16} />+{(survey.rewardCash ?? 30).toLocaleString("ko-KR")}C</span>
          )}
          <strong>참여하기 <ArrowRight size={17} /></strong>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="survey-card accent-blue"
      onClick={onClick}
      aria-label={`${survey.title} 설문 참여하기`}
    >
      <div className="survey-card-top">
        <span className="category-pill">{categoryLabel(survey.category)}</span>
        <span className="survey-cash">
          {survey.source === "external" ? <Link2 size={14} /> : <Coins size={14} />}
          <strong>{survey.source === "external" ? survey.platform ?? "외부 설문" : `+${(survey.rewardCash ?? 30).toLocaleString("ko-KR")}C`}</strong>
        </span>
      </div>
      <h3>{survey.title}</h3>
      <div className="survey-card-compact-details">
        <span>{survey.questionCount}문항</span>
        <span>응답 {(survey.responseCount ?? 0).toLocaleString("ko-KR")}개</span>
      </div>
      <span className="survey-card-compact-campus">{schoolLabel(survey.schoolId)}</span>
      <div className="survey-card-compact-meta">
        <span><Clock3 size={15} />약 {survey.durationMinutes}분</span>
        <ArrowRight size={16} />
      </div>
    </button>
  );
}

export type HomeCommunityPost = {
  id: string;
  title: string;
  content: string;
  category: CommunityCategory;
  authorName: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
};

export function homeRelativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(value).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });
}

export function HomeSurveyCard({
  survey,
  onClick,
}: {
  survey: PublicSurvey;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`home-live-survey-card category-${survey.category}`}
      onClick={onClick}
    >
      <span className="home-live-survey-top">
        <span>{categoryLabel(survey.category)}</span>
        <em><i /> {survey.source === "external" ? survey.platform ?? "외부 설문" : "참여 가능"}</em>
      </span>
      <strong>{survey.title}</strong>
      <span className="home-survey-meta">
        <span><Clock3 size={13} /> 약 {survey.durationMinutes}분</span>
        <span>{survey.source === "external" ? "링크 설문" : `${survey.questionCount ?? survey.questions?.length ?? 0}문항`}</span>
      </span>
      <span className="home-survey-reward">
        {survey.source === "external" ? <UsersRound size={13} /> : <Coins size={13} />}
        {survey.source === "external" ? `목표 ${survey.targetResponses ?? 0}명` : `${(survey.rewardCash ?? 30).toLocaleString("ko-KR")}C`}
      </span>
      <span className="home-survey-campus">
        <CheckCircle2 size={13} />
        <span>{survey.campus || schoolLabel(survey.schoolId)}</span>
      </span>
      <span className="home-live-survey-footer">
        <span>{survey.source === "external" ? "참여 이동" : "응답"} {(survey.responseCount ?? 0).toLocaleString("ko-KR")}{survey.source === "external" ? "회" : "개"}</span>
        <strong>참여하기 <ArrowRight size={15} /></strong>
      </span>
    </button>
  );
}

export function HomeOwnedSurveyCard({
  survey,
  onClick,
}: {
  survey: OwnedSurvey;
  onClick: () => void;
}) {
  return (
    <button type="button" className="home-owned-survey-card" onClick={onClick}>
      <span>
        <small>{categoryLabel(survey.category)}</small>
        <em>{survey.isListed ? "공개 중" : "링크 공개"}</em>
      </span>
      <strong>{survey.title}</strong>
      <div>
        <span><FileText size={14} /> {survey.questionCount ?? survey.questions?.length ?? 0}문항</span>
        <span><UsersRound size={14} /> 응답 {survey.responseCount}개</span>
      </div>
      <footer>
        결과 확인하기 <ArrowRight size={15} />
      </footer>
    </button>
  );
}

