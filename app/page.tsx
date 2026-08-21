"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Clock3,
  Coins,
  Copy,
  Eye,
  FileText,
  GripVertical,
  ImagePlus,
  Link2,
  LogIn,
  LogOut,
  Heart,
  Menu,
  MessageCircle,
  Minus,
  MoreHorizontal,
  Plus,
  School,
  Search,
  Share2,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
  WandSparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  analyzeSurveyPrompt,
  type SurveyBlueprint,
  type SurveyQuestion,
} from "./survey-intent";
import type {
  SurveyClarification,
  SurveyResearch,
} from "./survey-ai";
import {
  categoryLabel,
  schoolLabel,
  schoolOptions,
  surveyCategories,
  type SurveyCategory,
} from "./survey-board";
import {
  maxReferenceFileBytes,
  maxReferenceFiles,
  maxReferenceFilesTotalBytes,
  referenceFileAccept,
  referenceFileChunkBytes,
  referenceFileMimeTypes,
} from "./reference-files";
import {
  downloadSurveyCsv,
  downloadSurveyExcel,
  downloadSurveyWord,
} from "./survey-export";
import {
  JsonResponseError,
} from "./lib/http/json-response";
import {
  ResultsDashboard,
  type ResponseDecision,
  type ResponseDecisionMap,
} from "./results-dashboard";
import {
  deduplicateSurveyOptions,
  shortenSurveyQuestionTitle,
} from "./survey-revision";
import CommunityView from "./community-view";
import {
  communityCategoryLabel,
  type CommunityCategory,
} from "./community";
import {
  campusPulseTimeLeft,
  rankCampusPulses,
  type CampusPulse,
} from "./campus-pulse";
import { WorkspaceReviewView, WorkspaceView } from "./workspace-view";
import { shouldSubmitPromptOnEnter } from "./prompt-keyboard";
import { formatQuestionReason } from "./question-reason";
import {
  defaultSurveyMode,
  recommendSurveyMode,
  surveyModeLoadingMessages,
  surveyModeOptions,
  type SurveyMode,
} from "./survey-mode";
import {
  estimateSurveyGenerationSeconds,
  formatSurveyGenerationSeconds,
  getSurveyGenerationTiming,
} from "./survey-generation-time";
import {
  readSurveyGenerationResponse,
  surveyGenerationErrorMessage,
  surveyGenerationErrorMetadata,
  type SurveyGenerationFailureStage,
} from "./survey-generation-client";
import { surveyAudienceLabel } from "./survey-grade";
import { surveySharePath } from "./survey-share";

type View =
  | "landing"
  | "home"
  | "board"
  | "pulses"
  | "community"
  | "workspace"
  | "workspace-review"
  | "mypage"
  | "create"
  | "editor"
  | "published"
  | "survey"
  | "analytics";

export type PublicSurvey = {
  source?: "internal" | "external";
  slug: string;
  title: string;
  description: string;
  ownerName: string;
  schoolId: string;
  category: SurveyCategory;
  campus: string;
  durationMinutes: number;
  rewardCash: number;
  targetAudience?: string;
  responseCount?: number;
  questionCount?: number;
  createdAt?: string;
  updatedAt?: string;
  questions?: Question[];
  externalUrl?: string;
  platform?: string;
  targetResponses?: number;
  participantCount?: number;
};

type OwnedSurvey = PublicSurvey & {
  manageToken: string;
  responseCount: number;
  listingRequested: boolean;
  isListed: boolean;
};

type StoredAnswer = {
  questionId: number;
  title: string;
  type: Question["type"];
  value: number | string | string[];
};

type StoredResponse = {
  id: string;
  answers: StoredAnswer[];
  completionSeconds: number;
  createdAt: string;
  quality?: {
    score: number;
    status: "usable" | "review" | "exclude";
    reasons: string[];
  };
};

type ClarificationState = {
  prompt: string;
  clarification: SurveyClarification;
  research: SurveyResearch;
};

type SurveyReferenceImage = {
  id: string;
  name: string;
  dataUrl: string;
};

type SurveyReferenceFile = {
  id: string;
  name: string;
  fileToken: string;
  mimeType: string;
  size: number;
};

type SurveyReferences = {
  images: SurveyReferenceImage[];
  files: SurveyReferenceFile[];
  links: string[];
};

type Question = SurveyQuestion;

function QuestionTitleField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;

    field.style.height = "0px";
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={fieldRef}
      className="question-title-input"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\r?\n/g, " "))}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.preventDefault();
      }}
      onFocus={() => {
        const field = fieldRef.current;
        if (!field) return;
        field.style.height = "0px";
        field.style.height = `${field.scrollHeight}px`;
      }}
      rows={1}
      aria-label={label}
      maxLength={200}
    />
  );
}

type AuthUser = {
  id: string;
  email: string;
  name: string;
  schoolId: string;
};

type WalletData = {
  balance: number;
  transactions: Array<{
    id: string;
    amount: number;
    description: string;
    createdAt: string;
  }>;
};

type ManagedSurveySnapshot = {
  slug: string;
  manageToken: string;
  title: string;
  questions: Question[];
};

const managedSurveyStorageKey = "baroform:last-managed-survey";
const authTokenStorageKey = "baroform:session-token";
const maxReferenceImages = 10;
const maxReferenceLinks = 3;
const maxReferenceImageDataLength = 300_000;
const maxReferenceDataLength = 3_000_000;

function hasSurveyReferences(references: SurveyReferences) {
  return (
    references.images.length > 0 ||
    references.files.length > 0 ||
    references.links.length > 0
  );
}

function referenceDataLength(references: SurveyReferences) {
  return references.images.reduce(
    (total, image) => total + image.dataUrl.length,
    0,
  );
}

function referenceFilesTotalBytes(references: SurveyReferences) {
  return references.files.reduce((total, file) => total + file.size, 0);
}

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("사진을 읽지 못했어요."));
    reader.onerror = () => reject(new Error("사진을 읽지 못했어요."));
    reader.readAsDataURL(file);
  });
}

function loadReferenceImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("사진을 열지 못했어요."));
    };
    image.src = objectUrl;
  });
}

async function prepareReferenceImage(file: File): Promise<SurveyReferenceImage> {
  if (!/^image\/(?:jpeg|png|webp)$/i.test(file.type)) {
    throw new Error("JPG, PNG, WEBP 사진만 첨부할 수 있어요.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("사진 한 장은 12MB 이하로 올려주세요.");
  }

  const source = await loadReferenceImage(file);
  let scale = Math.min(1, 1600 / Math.max(source.naturalWidth, source.naturalHeight));
  let quality = 0.88;
  let dataUrl = "";

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("사진을 처리하지 못했어요.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL("image/webp", quality);
    if (dataUrl.length <= maxReferenceImageDataLength) break;
    scale *= 0.8;
    quality = Math.max(0.62, quality - 0.05);
  }

  if (!dataUrl || dataUrl.length > maxReferenceImageDataLength) {
    const originalDataUrl = await readFileAsDataUrl(file);
    if (originalDataUrl.length > maxReferenceImageDataLength) {
      throw new Error("사진 용량을 줄인 뒤 다시 올려주세요.");
    }
    dataUrl = originalDataUrl;
  }

  return {
    id: crypto.randomUUID(),
    name: file.name.slice(0, 80) || "첨부 사진",
    dataUrl,
  };
}

function referenceFileMimeType(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return referenceFileMimeTypes[extension] ?? null;
}

function formatReferenceFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`;
  return `${(size / (1024 * 1024)).toFixed(1)}MB`;
}

async function prepareReferenceFile(file: File): Promise<SurveyReferenceFile> {
  const mimeType = referenceFileMimeType(file);
  if (!mimeType) {
    throw new Error(
      "PDF, Word, PowerPoint, Excel, CSV, TXT, Markdown 파일만 첨부할 수 있어요.",
    );
  }
  if (file.size > maxReferenceFileBytes) {
    throw new Error("파일 한 개는 10MB 이하로 올려주세요.");
  }
  if (file.size <= 0) throw new Error("내용이 있는 파일을 선택해주세요.");

  const startResponse = await fetch("/api/reference-files", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: file.name, mimeType, size: file.size }),
  });
  const startResult = (await startResponse.json().catch(() => ({}))) as {
    uploadId?: string;
    uploadToken?: string;
    error?: string;
  };
  if (!startResponse.ok || !startResult.uploadId || !startResult.uploadToken) {
    throw new Error(startResult.error || "파일 업로드를 시작하지 못했어요.");
  }

  const partIds: string[] = [];
  for (let offset = 0; offset < file.size; offset += referenceFileChunkBytes) {
    const partResponse = await fetch(
      `/api/reference-files/${encodeURIComponent(startResult.uploadId)}/parts`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${startResult.uploadToken}`,
          "content-type": "application/octet-stream",
        },
        body: file.slice(
          offset,
          Math.min(file.size, offset + referenceFileChunkBytes),
          "application/octet-stream",
        ),
      },
    );
    const partResult = (await partResponse.json().catch(() => ({}))) as {
      partId?: string;
      error?: string;
    };
    if (!partResponse.ok || !partResult.partId) {
      throw new Error(partResult.error || "파일 일부를 올리지 못했어요.");
    }
    partIds.push(partResult.partId);
  }

  const completeResponse = await fetch(
    `/api/reference-files/${encodeURIComponent(startResult.uploadId)}/complete`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${startResult.uploadToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ partIds }),
    },
  );
  const completeResult = (await completeResponse.json().catch(() => ({}))) as {
    fileToken?: string;
    error?: string;
  };
  if (!completeResponse.ok || !completeResult.fileToken) {
    throw new Error(completeResult.error || "파일 업로드를 마치지 못했어요.");
  }

  return {
    id: crypto.randomUUID(),
    name: file.name.slice(0, 120) || "첨부 파일",
    fileToken: completeResult.fileToken,
    mimeType,
    size: file.size,
  };
}

const targetGradeOptions = [
  "1학년",
  "2학년",
  "3학년",
  "4학년",
  "1-2학년",
  "3-4학년",
  "전학년",
] as const;

type TargetGrade = (typeof targetGradeOptions)[number];

function estimatedMinutes(questions: Question[]) {
  const seconds = questions.reduce((total, question) => {
    if (question.type === "section") return total;
    if (question.type === "text") return total + 55;
    if (question.type === "shortText") return total + 28;
    if (question.type === "multiple") return total + 30;
    return total + 20;
  }, 20);
  return Math.max(1, Math.ceil(seconds / 60));
}

function questionTypeLabel(type: Question["type"]) {
  const labels: Record<Question["type"], string> = {
    shortText: "단답형",
    text: "장문형",
    single: "객관식",
    multiple: "체크박스",
    dropdown: "드롭다운",
    scale: "선형 배율",
    date: "날짜",
    time: "시간",
    section: "섹션",
  };
  return labels[type];
}

const promptSuggestions = [
  "신입생 학교생활 적응 조사",
  "축제 참여자 만족도",
  "새 서비스 사용 경험",
];

const defaultBlueprint = analyzeSurveyPrompt(promptSuggestions[0]);
const initialQuestions = defaultBlueprint.aiQuestions;

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "brand-mark compact" : "brand-mark"} aria-hidden>
      <span />
      <span />
    </span>
  );
}

function Header({
  view,
  onNavigate,
  onMenu,
  user,
  onAuth,
  onProfile,
  cashBalance,
}: {
  view: View;
  onNavigate: (view: View) => void;
  onMenu: () => void;
  user: AuthUser | null;
  onAuth: () => void;
  onProfile: () => void;
  cashBalance: number;
}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <button
          className="workspace-menu-trigger"
          type="button"
          onClick={onMenu}
          aria-label="작업 메뉴 열기"
        >
          <Menu size={19} />
          <span>메뉴</span>
        </button>
        <button
          className="brand"
          type="button"
          onClick={() => onNavigate("home")}
          aria-label="바로폼 홈"
        >
          <BrandMark />
          <strong>바로폼</strong>
        </button>
        <nav className="main-nav" aria-label="주요 메뉴">
          <button
            type="button"
            className={view === "board" ? "active" : ""}
            aria-current={view === "board" ? "page" : undefined}
            onClick={() => onNavigate("board")}
          >
            전체 설문
          </button>
          <button
            type="button"
            className={view === "pulses" ? "active" : ""}
            aria-current={view === "pulses" ? "page" : undefined}
            onClick={() => onNavigate("pulses")}
          >
            캠퍼스의 생각
          </button>
          <button
            type="button"
            className={view === "community" ? "active" : ""}
            aria-current={view === "community" ? "page" : undefined}
            onClick={() => onNavigate("community")}
          >
            커뮤니티
          </button>
          <button
            type="button"
            className={view === "workspace" ? "active" : ""}
            aria-current={view === "workspace" ? "page" : undefined}
            onClick={() => onNavigate("workspace")}
          >
            협업
          </button>
          {user && (
            <button
              type="button"
              className={view === "mypage" ? "active" : ""}
              aria-current={view === "mypage" ? "page" : undefined}
              onClick={onProfile}
            >
              내 설문
            </button>
          )}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <span className="member-school">
                <School size={14} />
                {schoolLabel(user.schoolId)}
              </span>
              <button className="cash-chip" type="button" onClick={onProfile}>
                <Coins size={14} />
                {cashBalance.toLocaleString("ko-KR")}C
              </button>
            </>
          ) : null}
          <button
            className={`auth-button ${view === "mypage" ? "active" : ""}`}
            type="button"
            onClick={user ? onProfile : onAuth}
            aria-current={view === "mypage" ? "page" : undefined}
          >
            {user ? <UserRound size={15} /> : <LogIn size={15} />}
            {user ? user.name : "로그인"}
          </button>
          <button
            className="nav-cta"
            type="button"
            onClick={() => onNavigate("create")}
          >
            <span className="nav-cta-icon"><WandSparkles size={17} /></span>
            <span className="nav-cta-copy">
              <strong>
                <span className="nav-cta-desktop-label">AI로 설문 자동 제작하기</span>
                <span className="nav-cta-mobile-label">AI 설문 제작</span>
              </strong>
              <small>한 문장으로 바로 시작</small>
            </span>
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}

function WorkspaceSidebar({
  open,
  view,
  user,
  surveys,
  wallet,
  onNavigate,
  onCreate,
  onOpenSurvey,
  onAuth,
  onClose,
}: {
  open: boolean;
  view: View;
  user: AuthUser | null;
  surveys: OwnedSurvey[];
  wallet: WalletData;
  onNavigate: (view: View) => void;
  onCreate: () => void;
  onOpenSurvey: (survey: OwnedSurvey) => void;
  onAuth: () => void;
  onClose: () => void;
}) {
  const go = (nextView: View) => {
    onNavigate(nextView);
    onClose();
  };

  const openProfile = () => {
    if (user) go("mypage");
    else onAuth();
    onClose();
  };

  return (
    <>
      <button
        type="button"
        className={`workspace-sidebar-backdrop ${open ? "open" : ""}`}
        onClick={onClose}
        aria-label="작업 메뉴 닫기"
        tabIndex={open ? 0 : -1}
      />
      <aside
        className={`workspace-sidebar ${open ? "open" : ""}`}
        aria-label="바로폼 작업 메뉴"
        aria-hidden={!open}
      >
        <div className="workspace-sidebar-head">
          <button
            type="button"
            className="workspace-brand"
            onClick={() => go("home")}
            aria-label="바로폼 홈"
          >
            <BrandMark />
            <span>
              <strong>바로폼</strong>
              <small>대학생 설문 공간</small>
            </span>
          </button>
          <button
            type="button"
            className="workspace-sidebar-close"
            onClick={onClose}
            aria-label="작업 메뉴 닫기"
          >
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          className={`workspace-create ${view === "create" ? "active" : ""}`}
          onClick={() => {
            onCreate();
            onClose();
          }}
        >
          <Plus size={18} />
          새 설문 만들기
        </button>

        <nav className="workspace-nav" aria-label="서비스 메뉴">
          <button
            type="button"
            className={view === "home" ? "active" : ""}
            onClick={() => go("home")}
          >
            <WandSparkles size={17} />
            홈
          </button>
          <button
            type="button"
            className={view === "board" ? "active" : ""}
            onClick={() => go("board")}
          >
            <School size={17} />
            설문 찾기
          </button>
          <button
            type="button"
            className={view === "pulses" ? "active" : ""}
            onClick={() => go("pulses")}
          >
            <BarChart3 size={17} />
            캠퍼스의 생각
          </button>
          <button
            type="button"
            className={view === "community" ? "active" : ""}
            onClick={() => go("community")}
          >
            <UsersRound size={17} />
            커뮤니티
          </button>
          <button
            type="button"
            className={view === "workspace" ? "active" : ""}
            onClick={() => go("workspace")}
          >
            <UsersRound size={17} />
            협업 워크스페이스
          </button>
          <button
            type="button"
            className={view === "mypage" ? "active" : ""}
            onClick={openProfile}
          >
            <UserRound size={17} />
            마이페이지
          </button>
        </nav>

        <section className="workspace-history" aria-labelledby="recent-surveys-title">
          <div className="workspace-section-heading">
            <span id="recent-surveys-title">최근 만든 설문</span>
          </div>
          {user && surveys.length > 0 ? (
            <div className="workspace-recent-list">
              {surveys.slice(0, 2).map((survey) => (
                <button
                  type="button"
                  key={survey.slug}
                  onClick={() => {
                    onOpenSurvey(survey);
                    onClose();
                  }}
                  title={survey.title}
                >
                  <FileText size={15} />
                  <span>
                    <strong>{survey.title}</strong>
                    <small>응답 {survey.responseCount}개</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="workspace-empty-history"
              onClick={() => {
                if (user) onCreate();
                else onAuth();
                onClose();
              }}
            >
              {user ? "아직 만든 설문이 없어요" : "로그인하면 내 설문을 볼 수 있어요"}
            </button>
          )}
        </section>

        <button type="button" className="workspace-profile" onClick={openProfile}>
          <span className="workspace-avatar">{user?.name.slice(0, 1) ?? "바"}</span>
          <span>
            <strong>{user?.name ?? "로그인"}</strong>
            <small>{user ? schoolLabel(user.schoolId) : "내 기록 확인하기"}</small>
          </span>
          <span className="workspace-profile-cash">
            <Coins size={14} />
            {wallet.balance.toLocaleString("ko-KR")}C
          </span>
        </button>
      </aside>
    </>
  );
}

function CampusSurveyCard({
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

function SurveyReferenceControls({
  references,
  onChange,
  disabled = false,
}: {
  references: SurveyReferences;
  onChange: (references: SurveyReferences) => void;
  disabled?: boolean;
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const [processingFile, setProcessingFile] = useState(false);
  const [referenceError, setReferenceError] = useState("");

  const addImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const available = maxReferenceImages - references.images.length;
    if (available <= 0) {
      setReferenceError(`사진은 최대 ${maxReferenceImages}장까지 첨부할 수 있어요.`);
      return;
    }

    setProcessingImage(true);
    setReferenceError("");
    try {
      const prepared: SurveyReferenceImage[] = [];
      for (const file of files.slice(0, available)) {
        prepared.push(await prepareReferenceImage(file));
      }
      const nextReferences = {
        ...references,
        images: [...references.images, ...prepared],
      };
      if (referenceDataLength(nextReferences) > maxReferenceDataLength) {
        throw new Error(
          "전체 참고 자료 용량이 커요. 사진이나 파일 일부를 삭제한 뒤 다시 시도해주세요.",
        );
      }
      onChange(nextReferences);
      if (files.length > available) {
        setReferenceError(`사진은 최대 ${maxReferenceImages}장까지 첨부할 수 있어요.`);
      }
    } catch (error) {
      setReferenceError(
        error instanceof Error ? error.message : "사진을 첨부하지 못했어요.",
      );
    } finally {
      setProcessingImage(false);
    }
  };

  const addFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const available = maxReferenceFiles - references.files.length;
    if (available <= 0) {
      setReferenceError(`파일은 최대 ${maxReferenceFiles}개까지 첨부할 수 있어요.`);
      return;
    }

    setProcessingFile(true);
    setReferenceError("");
    try {
      const selectedFiles = files.slice(0, available);
      const selectedBytes = selectedFiles.reduce((total, file) => total + file.size, 0);
      if (
        referenceFilesTotalBytes(references) + selectedBytes >
        maxReferenceFilesTotalBytes
      ) {
        throw new Error("첨부 파일은 전체 20MB까지 올릴 수 있어요.");
      }
      const prepared: SurveyReferenceFile[] = [];
      for (const file of selectedFiles) {
        prepared.push(await prepareReferenceFile(file));
      }
      const nextReferences = {
        ...references,
        files: [...references.files, ...prepared],
      };
      onChange(nextReferences);
      if (files.length > available) {
        setReferenceError(`파일은 최대 ${maxReferenceFiles}개까지 첨부할 수 있어요.`);
      }
    } catch (error) {
      setReferenceError(
        error instanceof Error ? error.message : "파일을 첨부하지 못했어요.",
      );
    } finally {
      setProcessingFile(false);
    }
  };

  const addLink = () => {
    const rawValue = linkValue.trim();
    if (!rawValue) return;
    if (references.links.length >= maxReferenceLinks) {
      setReferenceError(`링크는 최대 ${maxReferenceLinks}개까지 추가할 수 있어요.`);
      return;
    }

    try {
      const url = new URL(
        /^https?:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`,
      );
      const hostname = url.hostname.toLowerCase();
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        hostname === "localhost" ||
        hostname.endsWith(".local") ||
        /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
          hostname,
        )
      ) {
        throw new Error();
      }
      url.hash = "";
      const normalized = url.toString();
      if (normalized.length > 2048) throw new Error();
      if (references.links.includes(normalized)) {
        setReferenceError("이미 추가한 링크예요.");
        return;
      }
      onChange({ ...references, links: [...references.links, normalized] });
      setLinkValue("");
      setLinkOpen(false);
      setReferenceError("");
    } catch {
      setReferenceError("누구나 열 수 있는 웹페이지 링크를 확인해주세요.");
    }
  };

  return (
    <div className="reference-controls">
      {hasSurveyReferences(references) && (
        <div className="reference-list" aria-label="AI 참고 자료">
          {references.images.map((image) => (
            <span className="reference-chip image-reference" key={image.id}>
              <span
                className="reference-thumbnail"
                style={{ backgroundImage: `url(${image.dataUrl})` }}
                aria-hidden="true"
              />
              <span>{image.name}</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...references,
                    images: references.images.filter((item) => item.id !== image.id),
                  })
                }
                disabled={disabled}
                aria-label={`${image.name} 삭제`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          {references.files.map((file) => (
            <span className="reference-chip file-reference" key={file.id}>
              <FileText size={14} aria-hidden="true" />
              <span>
                {file.name}
                <small>{formatReferenceFileSize(file.size)}</small>
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...references,
                    files: references.files.filter((item) => item.id !== file.id),
                  })
                }
                disabled={disabled}
                aria-label={`${file.name} 삭제`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
          {references.links.map((link) => (
            <span className="reference-chip link-reference" key={link}>
              <Link2 size={13} aria-hidden="true" />
              <span>{new URL(link).hostname.replace(/^www\./, "")}</span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...references,
                    links: references.links.filter((item) => item !== link),
                  })
                }
                disabled={disabled}
                aria-label={`${link} 삭제`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      {linkOpen && (
        <div className="reference-link-entry">
          <Link2 size={15} aria-hidden="true" />
          <input
            type="url"
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLink();
              }
              if (event.key === "Escape") {
                setLinkOpen(false);
                setLinkValue("");
              }
            }}
            placeholder="참고할 공개 링크를 붙여넣으세요"
            autoFocus
            disabled={disabled}
          />
          <button type="button" onClick={addLink} disabled={disabled || !linkValue.trim()}>
            추가
          </button>
        </div>
      )}

      <div className="reference-action-row">
        <div className="reference-actions">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={
              disabled || processingImage || references.images.length >= maxReferenceImages
            }
          >
            <ImagePlus size={15} />
            {processingImage ? "사진 처리 중" : "사진 첨부"}
          </button>
          <button
            type="button"
            onClick={() => documentInputRef.current?.click()}
            disabled={
              disabled || processingFile || references.files.length >= maxReferenceFiles
            }
          >
            <FileText size={15} />
            {processingFile ? "파일 처리 중" : "파일 첨부"}
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkOpen((current) => !current);
              setReferenceError("");
            }}
            disabled={disabled || references.links.length >= maxReferenceLinks}
          >
            <Link2 size={15} />
            링크 추가
          </button>
        </div>
        <span className="reference-hint">
          사진 10장 · 파일 10MB/개 · 전체 20MB
        </span>
      </div>
      {referenceError && <p className="reference-error">{referenceError}</p>}
      <input
        ref={imageInputRef}
        className="reference-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={addImages}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={documentInputRef}
        className="reference-file-input"
        type="file"
        accept={referenceFileAccept}
        multiple
        onChange={addFiles}
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

function LandingView({
  onEnterSite,
  surveys,
  loadingSurveys,
}: {
  onEnterSite: () => void;
  surveys: PublicSurvey[];
  loadingSurveys: boolean;
}) {
  const fallbackSurveys: PublicSurvey[] = [
    { slug: "sample-1", title: "학교 도서관 이용 경험 조사", description: "", ownerName: "경영대 프로젝트팀", schoolId: "yonsei", category: "campus", campus: "신촌캠퍼스", durationMinutes: 3, rewardCash: 30, questionCount: 12, responseCount: 48 },
    { slug: "sample-2", title: "대학생 인턴 준비 과정 조사", description: "", ownerName: "진로 학회", schoolId: "yonsei", category: "career", campus: "신촌캠퍼스", durationMinutes: 5, rewardCash: 50, questionCount: 15, responseCount: 73 },
    { slug: "sample-3", title: "일정 관리 앱 사용성 평가", description: "", ownerName: "UX 리서치팀", schoolId: "yonsei", category: "research", campus: "신촌캠퍼스", durationMinutes: 4, rewardCash: 50, questionCount: 14, responseCount: 31 },
    { slug: "sample-4", title: "축제 참여자 만족도 조사", description: "", ownerName: "학생기획단", schoolId: "yonsei", category: "club", campus: "신촌캠퍼스", durationMinutes: 2, rewardCash: 30, questionCount: 9, responseCount: 126 },
    { slug: "sample-5", title: "대학생 소비 습관 연구", description: "", ownerName: "소비자행동 연구팀", schoolId: "yonsei", category: "course", campus: "신촌캠퍼스", durationMinutes: 7, rewardCash: 70, questionCount: 18, responseCount: 54 },
    { slug: "sample-6", title: "교내 편의시설 만족도", description: "", ownerName: "캠퍼스 개선팀", schoolId: "yonsei", category: "campus", campus: "신촌캠퍼스", durationMinutes: 3, rewardCash: 30, questionCount: 11, responseCount: 92 },
  ];
  const hasLiveSurveys = surveys.length > 0;
  const marqueeSurveys = hasLiveSurveys ? surveys.slice(0, 12) : fallbackSurveys;
  const surveyRows = [
    marqueeSurveys.filter((_, index) => index % 2 === 0),
    marqueeSurveys.filter((_, index) => index % 2 === 1),
  ].filter((row) => row.length > 0);

  return (
    <>
      <main className="landing-page">
        <nav className="landing-nav" aria-label="랜딩 페이지 메뉴">
          <button type="button" className="brand" onClick={onEnterSite} aria-label="바로폼 홈으로 이동">
            <BrandMark />
            <strong>바로폼</strong>
          </button>
          <div>
            <a href="#product">제품</a>
            <a href="#how-it-works">이용 방법</a>
            <a href="#campus-surveys">학교 설문</a>
          </div>
          <button type="button" className="landing-nav-cta" onClick={onEnterSite}>
            무료로 시작하기 <ArrowRight size={16} />
          </button>
        </nav>

        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-glow landing-hero-glow-left" />
          <div className="landing-hero-glow landing-hero-glow-right" />
          <div className="landing-hero-content">
            <span className="landing-kicker">대학생의 질문이 실제 응답이 되는 곳</span>
            <h1 id="landing-title">학생들의 질문과 답을 한곳에서.</h1>
            <p>한 문장으로 설문을 만들고, 우리 학교에서 응답을 모으고, 결과까지 바로 읽어보세요.</p>
            <div className="landing-hero-actions">
              <button
                type="button"
                className="landing-primary"
                onClick={onEnterSite}
              >
                첫 설문 만들기
                <ArrowRight size={18} />
              </button>
            </div>
            <div className="landing-product-frame" id="product" aria-label="바로폼 제품 화면 예시">
              <div className="landing-product-bar">
                <span><BrandMark compact /><strong>바로폼</strong></span>
                <div><i /><i /><i /></div>
              </div>
              <div className="landing-product-layout">
                <aside>
                  <span>설문 구성</span>
                  {["설문 소개", "이용 빈도", "선택 이유", "개선 의견"].map((item, index) => (
                    <i key={item} className={index === 1 ? "active" : ""}>{String(index).padStart(2, "0")} {item}</i>
                  ))}
                </aside>
                <article>
                  <small>BAROFORM</small>
                  <h2>대학생 카페 공부 경험 조사</h2>
                  <p>카페에서 공부하는 빈도와 선택 이유를 알아보는 설문입니다.</p>
                  <div className="landing-question-mockup">
                    <span>01</span>
                    <strong>평소 카페에서 얼마나 자주 공부하나요?</strong>
                    {["거의 하지 않음", "월 1~2회", "주 1~2회", "주 3회 이상"].map((option) => <i key={option}>{option}</i>)}
                  </div>
                </article>
                <aside className="landing-ai-panel">
                  <strong><Sparkles size={15} /> AI로 바로 수정</strong>
                  <p>질문을 더 짧게 정리하고 선택지 간격을 맞춰줘</p>
                  <button type="button" tabIndex={-1}>AI로 반영하기</button>
                </aside>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-proof-strip" aria-label="바로폼 핵심 흐름">
          <span>AI 설문 설계</span><i />
          <span>학교 응답 모집</span><i />
          <span>실시간 결과 분석</span><i />
          <span>결과 카드 공유</span>
        </section>

        <section className="landing-story" id="how-it-works" aria-labelledby="landing-story-title">
          <div className="landing-container landing-story-heading">
            <span className="landing-eyebrow">설문을 만드는 새로운 방식</span>
            <h2 id="landing-story-title">질문은 짧게.<br />설계는 정확하게.</h2>
            <p>무엇을 조사할지 한 문장으로 알려주세요. 바로폼이 사용자의 의도를 읽고 측정 가능한 질문으로 구성합니다.</p>
          </div>
          <div className="landing-container landing-feature-stack">
            <article className="landing-feature-row">
              <div>
                <span>01 · CREATE</span>
                <h3>한 문장이 설문 초안이 됩니다.</h3>
                <p>참고 링크, 문서, 이미지를 함께 넣으면 맥락까지 반영합니다. 불필요한 되묻기는 줄이고 요청한 핵심을 바로 측정합니다.</p>
              </div>
              <div className="landing-feature-visual create-visual">
                <span>대학생들의 SNS 이용 시간을 조사하고 싶어요</span>
                <div><Link2 size={16} /> 참고 링크</div>
                <button type="button" tabIndex={-1}><Sparkles size={16} /> AI로 설문 만들기</button>
              </div>
            </article>
            <article className="landing-feature-row reverse">
              <div>
                <span>02 · DISTRIBUTE</span>
                <h3>만든 즉시, 필요한 응답자에게.</h3>
                <p>학교 게시판, 공유 링크, Instagram용 카드까지 한 번에 준비합니다. 응답자는 로그인 없이 바로 참여할 수 있습니다.</p>
              </div>
              <div className="landing-feature-visual publish-visual">
                <div className="landing-share-card">
                  <small>YONSEI CAMPUS SURVEY</small>
                  <strong>학교 도서관<br />이용 경험 조사</strong>
                  <span>약 3분 · 50C</span>
                </div>
                <div className="landing-share-actions">
                  <span><Share2 size={16} /> 링크 배포</span>
                  <span><InstagramGlyph size={16} /> Instagram</span>
                </div>
              </div>
            </article>
            <article className="landing-feature-row">
              <div>
                <span>03 · ANALYZE</span>
                <h3>응답 수보다 먼저, 응답의 품질을 봅니다.</h3>
                <p>실시간 분포, 주요 인사이트, 품질 주의 응답을 한 화면에서 확인하고 CSV·Excel·Word로 내보낼 수 있습니다.</p>
              </div>
              <div className="landing-feature-visual analytics-visual">
                <div><span>분석 가능 응답</span><strong>94</strong><small>/ 전체 100</small></div>
                <div className="landing-bars"><i style={{ width: "82%" }} /><i style={{ width: "58%" }} /><i style={{ width: "36%" }} /></div>
                <p><Sparkles size={16} /> 응답자의 62%가 저녁 시간대 이용을 선호해요.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="landing-survey-showcase" id="campus-surveys" aria-labelledby="survey-showcase-title">
          <div className="landing-container landing-showcase-heading">
            <div className="landing-section-heading">
              <span className="landing-eyebrow">{hasLiveSurveys ? "지금 우리 학교" : "설문 예시"}</span>
              <h2 id="survey-showcase-title">
                {loadingSurveys ? "설문을 불러오는 중" : hasLiveSurveys ? "지금 열려 있는 설문" : "이런 설문을 만들 수 있어요"}
              </h2>
            </div>
            <button type="button" className="landing-board-link" onClick={onEnterSite}>
              전체 설문 보기 <ArrowRight size={16} />
            </button>
          </div>
          <div className="landing-survey-marquee" aria-label={hasLiveSurveys ? "현재 참여 가능한 설문" : "설문 예시"}>
            {surveyRows.map((row, rowIndex) => (
              <div className="survey-marquee-row" key={`survey-row-${rowIndex}`}>
                <div className={`survey-marquee-track${rowIndex === 1 ? " is-reverse" : ""}`}>
                  {[0, 1].map((copyIndex) => (
                    <div
                      className="survey-marquee-group"
                      key={`survey-group-${rowIndex}-${copyIndex}`}
                      aria-hidden={copyIndex === 1}
                    >
                      {row.map((survey) => (
                        <article className="landing-survey-card" key={`${copyIndex}-${survey.title}`}>
                          <div className="survey-card-topline">
                            <span>{categoryLabel(survey.category)}</span>
                            <strong>+{survey.rewardCash}C</strong>
                          </div>
                          <h3>{survey.title}</h3>
                          <p><Clock3 size={13} />약 {survey.durationMinutes}분</p>
                        </article>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section landing-process">
          <div className="landing-container">
            <div className="landing-section-heading">
              <span className="landing-eyebrow">왜 바로폼인가</span>
              <h2>설문 제작부터 응답 수집까지 한곳에서.</h2>
            </div>
            <div className="landing-step-grid">
              <article>
                <span>01</span>
                <div className="landing-step-icon"><Sparkles size={22} /></div>
                <h3>의도를 읽는 AI</h3>
                <p>주제의 의미를 그대로 해석해 바로 측정할 질문을 만듭니다.</p>
              </article>
              <article>
                <span>02</span>
                <div className="landing-step-icon"><UsersRound size={22} /></div>
                <h3>캠퍼스 응답망</h3>
                <p>새 설문과 외부 설문 모두 학교 구성원에게 빠르게 알립니다.</p>
              </article>
              <article>
                <span>03</span>
                <div className="landing-step-icon"><BarChart3 size={22} /></div>
                <h3>읽히는 결과</h3>
                <p>실시간 분석과 공유 카드로 조사 결과를 다시 확산시킵니다.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-final-cta">
          <div>
            <span>질문 하나에서 시작하세요</span>
            <h2>학생들의 의견을 바로 만나보세요.</h2>
          </div>
          <div className="landing-final-actions">
            <button type="button" onClick={onEnterSite}>
              무료로 시작하기 <ArrowRight size={19} />
            </button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

type HomeCommunityPost = {
  id: string;
  title: string;
  content: string;
  category: CommunityCategory;
  authorName: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
};

function homeRelativeTime(value: string) {
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

function HomeSurveyCard({
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

function HomeOwnedSurveyCard({
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

function ExternalSurveyModal({
  authToken,
  onClose,
  onSaved,
}: {
  authToken: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(3);
  const [targetResponses, setTargetResponses] = useState(50);
  const [category, setCategory] = useState<SurveyCategory>("campus");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/external-surveys", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ title, externalUrl, description, durationMinutes, targetResponses, category }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "외부 설문을 등록하지 못했어요.");
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "외부 설문을 등록하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop feature-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="external-survey-title">
      <form className="feature-modal" onSubmit={submit}>
        <button type="button" className="feature-modal-close" onClick={onClose} aria-label="닫기"><X size={20} /></button>
        <span className="feature-modal-kicker"><Link2 size={16} /> EXTERNAL SURVEY</span>
        <h2 id="external-survey-title">이미 만든 설문도 바로 모집하세요.</h2>
        <p>Google Forms, Typeform 등 공개 링크를 등록하면 학교 설문 목록에서 응답자를 찾을 수 있어요.</p>
        <label><span>설문 제목</span><input required minLength={2} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 축제 라인업 만족도 조사" /></label>
        <label><span>설문 링크</span><input required type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://forms.google.com/..." /></label>
        <label><span>한 줄 소개 <small>선택</small></span><textarea maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="누가, 왜 참여하면 좋은지 알려주세요." /></label>
        <div className="feature-modal-row">
          <label><span>예상 시간</span><input type="number" min={1} max={60} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} /><em>분</em></label>
          <label><span>목표 인원</span><input type="number" min={5} max={5000} value={targetResponses} onChange={(event) => setTargetResponses(Number(event.target.value))} /><em>명</em></label>
        </div>
        <label><span>카테고리</span><select value={category} onChange={(event) => setCategory(event.target.value as SurveyCategory)}>{surveyCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        {error && <span className="feature-modal-error" role="alert">{error}</span>}
        <button type="submit" className="feature-modal-submit" disabled={saving}>{saving ? "등록 중…" : "학교 게시판에 등록하기"}<ArrowRight size={17} /></button>
      </form>
    </div>
  );
}

function PulseCreateModal({
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
      const response = await fetch("/api/pulses", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ question, options, expiresHours }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "투표를 만들지 못했어요.");
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

function CampusPulseSection({
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
      const response = await fetch(`/api/pulses/${pulse.id}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ optionIndex }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "투표를 저장하지 못했어요.");
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

function CampusPulseBoardView({
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
      const response = await fetch("/api/pulses?school=yonsei", {
        cache: "no-store",
        headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
      });
      const result = (await response.json()) as { pulses?: CampusPulse[] };
      if (!response.ok) throw new Error();
      setPulses(result.pulses ?? []);
    } catch {
      setPulses([]);
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pulses?school=yonsei", {
      cache: "no-store",
      headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
    })
      .then(async (response) => {
        const result = (await response.json()) as { pulses?: CampusPulse[] };
        if (!response.ok) throw new Error();
        return result.pulses ?? [];
      })
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
  const openCreate = () => {
    if (!user) {
      onAuth();
      return;
    }
    setCreateOpen(true);
  };

  return (
    <>
      <main className="pulse-board-page">
        <section className="pulse-board-hero">
          <div>
            <span>CAMPUS PULSE BOARD</span>
            <h1>캠퍼스의 생각</h1>
            <p>짧게 묻고 바로 답하는 캠퍼스 투표 게시판이에요. 참여가 가장 많은 질문부터 확인해 보세요.</p>
          </div>
          <button type="button" onClick={openCreate}><Plus size={17} /> 새 투표 만들기</button>
        </section>

        <section className="pulse-board-layout" aria-label="캠퍼스 투표 게시판">
          <div className="pulse-board-list-panel">
            <div className="pulse-board-list-head">
              <div><strong>진행 중인 투표</strong><small>참여 많은 순</small></div>
              <span>{rankedPulses.length}개</span>
            </div>
            <div className="pulse-board-list">
              {loading ? (
                [0, 1, 2, 3].map((item) => <span className="pulse-board-row-skeleton" key={item} />)
              ) : rankedPulses.length > 0 ? (
                rankedPulses.map((pulse, index) => (
                  <button
                    type="button"
                    className={selectedPulse?.id === pulse.id ? "active" : ""}
                    key={pulse.id}
                    onClick={() => setSelectedPulseId(pulse.id)}
                  >
                    <span className="pulse-board-row-top">
                      <em>{index === 0 ? "참여 1위" : `투표 ${index + 1}`}</em>
                      <small>{campusPulseTimeLeft(pulse.expiresAt)}</small>
                    </span>
                    <strong>{pulse.question}</strong>
                    <span className="pulse-board-row-meta"><UsersRound size={14} /> {pulse.totalVotes.toLocaleString("ko-KR")}명 참여 · 선택지 {pulse.options.length}개</span>
                  </button>
                ))
              ) : (
                <button type="button" className="pulse-board-list-empty" onClick={openCreate}>
                  <BarChart3 size={22} />
                  <span><strong>진행 중인 투표가 없어요.</strong><small>첫 질문을 게시해 보세요.</small></span>
                </button>
              )}
            </div>
          </div>

          <div className="pulse-board-detail">
            <CampusPulseSection
              pulse={selectedPulse}
              loading={loading}
              user={user}
              authToken={authToken}
              onAuth={onAuth}
              onReload={() => void loadPulses()}
              onCreate={openCreate}
              onOpenBoard={() => undefined}
              title="선택한 캠퍼스의 생각"
              showBoardLink={false}
            />
          </div>
        </section>
      </main>
      {createOpen && (
        <PulseCreateModal
          authToken={authToken}
          onClose={() => setCreateOpen(false)}
          onSaved={() => void loadPulses()}
        />
      )}
      <Footer />
    </>
  );
}

function ProductHomeView({
  surveys,
  ownedSurveys,
  loadingSurveys,
  user,
  authToken,
  cashBalance,
  onAuth,
  onRefreshSurveys,
  onCreate,
  onOpenBoard,
  onOpenSurvey,
  onOpenOwnedSurvey,
  onOpenCommunity,
  onOpenPulseBoard,
}: {
  surveys: PublicSurvey[];
  ownedSurveys: OwnedSurvey[];
  loadingSurveys: boolean;
  user: AuthUser | null;
  authToken: string;
  cashBalance: number;
  onAuth: () => void;
  onRefreshSurveys: () => void;
  onCreate: (prompt?: string) => void;
  onOpenBoard: () => void;
  onOpenSurvey: (survey: PublicSurvey) => void;
  onOpenOwnedSurvey: (survey: OwnedSurvey) => void;
  onOpenCommunity: () => void;
  onOpenPulseBoard: () => void;
}) {
  const [communityPosts, setCommunityPosts] = useState<HomeCommunityPost[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [quickPrompt, setQuickPrompt] = useState("");
  const [surveySearch, setSurveySearch] = useState("");
  const [surveyFilter, setSurveyFilter] = useState<"all" | SurveyCategory>("all");
  const [externalSurveyOpen, setExternalSurveyOpen] = useState(false);
  const [pulseCreateOpen, setPulseCreateOpen] = useState(false);
  const [pulses, setPulses] = useState<CampusPulse[]>([]);
  const [loadingPulses, setLoadingPulses] = useState(true);

  const loadPulses = useCallback(async () => {
    try {
      const response = await fetch("/api/pulses?school=yonsei", {
        cache: "no-store",
        headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
      });
      const result = (await response.json()) as { pulses?: CampusPulse[] };
      if (!response.ok) throw new Error();
      setPulses(result.pulses ?? []);
    } catch {
      setPulses([]);
    } finally {
      setLoadingPulses(false);
    }
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pulses?school=yonsei", {
      cache: "no-store",
      headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
    })
      .then(async (response) => {
        const result = (await response.json()) as { pulses?: CampusPulse[] };
        if (!response.ok) throw new Error();
        return result.pulses ?? [];
      })
      .then((nextPulses) => {
        if (!cancelled) setPulses(nextPulses);
      })
      .catch(() => {
        if (!cancelled) setPulses([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPulses(false);
      });
    return () => { cancelled = true; };
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    const loadCommunityPreview = async () => {
      try {
        const response = await fetch("/api/community?scope=all&school=yonsei", {
          cache: "no-store",
        });
        const result = (await response.json()) as {
          posts?: HomeCommunityPost[];
        };
        if (!cancelled && response.ok) {
          setCommunityPosts((result.posts ?? []).slice(0, 6));
        }
      } catch {
        if (!cancelled) setCommunityPosts([]);
      } finally {
        if (!cancelled) setLoadingCommunity(false);
      }
    };
    void loadCommunityPreview();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredHomeSurveys = useMemo(() => {
    const keyword = surveySearch.replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
    return [...surveys]
      .filter((survey) => surveyFilter === "all" || survey.category === surveyFilter)
      .filter((survey) =>
        !keyword ||
        [survey.title, survey.ownerName, survey.description, categoryLabel(survey.category)]
          .join(" ")
          .toLocaleLowerCase("ko-KR")
          .includes(keyword),
      )
      .sort((left, right) =>
        (right.createdAt ?? "").localeCompare(left.createdAt ?? ""),
      );
  }, [surveyFilter, surveySearch, surveys]);
  const filteringSurveys = Boolean(surveySearch.trim()) || surveyFilter !== "all";
  const recommendedSurveys = filteredHomeSurveys.slice(0, filteringSurveys ? 12 : 4);
  const moreSurveys = filteringSurveys ? [] : filteredHomeSurveys.slice(4, 12);
  const totalResponses = surveys.reduce(
    (total, survey) => total + (survey.responseCount ?? 0),
    0,
  );
  const featuredPulse = useMemo(() => rankCampusPulses(pulses)[0], [pulses]);

  return (
    <>
      <main className="campus-home-main response-first-home">
        <section className="home-participation-lead" aria-labelledby="campus-home-title">
          <div className="home-participation-copy">
            <span>PARTICIPATE</span>
            <h1 id="campus-home-title">지금 참여할 설문</h1>
            <p>우리 학교의 질문에 답하고, 참여 캐시를 모아보세요.</p>
          </div>
          <div className="home-participation-stats" aria-label="바로폼 설문 현황">
            <span><strong>{surveys.length}</strong><small>참여 가능</small></span>
            <span><strong>{totalResponses.toLocaleString("ko-KR")}</strong><small>누적 응답</small></span>
          </div>
          {user ? (
            <div className="home-reward-state signed-in">
              <span><Coins size={19} /></span>
              <div>
                <small>{user.name}님의 참여 캐시</small>
                <strong>{cashBalance.toLocaleString("ko-KR")}C 적립 중</strong>
              </div>
              <CheckCircle2 size={18} />
            </div>
          ) : (
            <button className="home-reward-state" type="button" onClick={onAuth}>
              <span><Coins size={19} /></span>
              <div>
                <strong>로그인하고 참여 캐시 받기</strong>
                <small>로그인 없이 참여할 수 있지만 캐시는 적립되지 않아요.</small>
              </div>
              <ArrowRight size={18} />
            </button>
          )}
        </section>

        <section className="home-ai-launch" aria-labelledby="home-ai-title">
          <div>
            <span>AI SURVEY STUDIO</span>
            <h2 id="home-ai-title">조사할 내용을 한 문장으로 적어보세요.</h2>
            <p>바로폼이 측정할 항목과 선택지를 설계하고 편집 가능한 초안으로 이어갑니다.</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onCreate(quickPrompt.trim() || undefined);
            }}
          >
            <textarea
              value={quickPrompt}
              onChange={(event) => setQuickPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (
                  !shouldSubmitPromptOnEnter({
                    key: event.key,
                    shiftKey: event.shiftKey,
                    isComposing: event.nativeEvent.isComposing,
                  })
                ) {
                  return;
                }
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }}
              placeholder="예) 대학생들의 카페 공부 빈도를 조사해줘"
              rows={3}
              maxLength={300}
            />
            <div>
              <span><Sparkles size={15} /> 조사 의도를 읽고 문항을 구성해요</span>
              <button type="submit">설문 초안 만들기 <ArrowRight size={16} /></button>
            </div>
          </form>
        </section>

        <section className="home-survey-discovery" aria-label="설문 찾기">
          <label className="home-survey-search">
            <Search size={18} />
            <input
              value={surveySearch}
              onChange={(event) => setSurveySearch(event.target.value)}
              placeholder="설문 제목이나 주제를 검색해 보세요"
              aria-label="메인 설문 검색"
            />
            {surveySearch && (
              <button type="button" aria-label="검색어 지우기" onClick={() => setSurveySearch("")}>
                <X size={16} />
              </button>
            )}
          </label>
          <div className="home-category-tabs" role="tablist" aria-label="메인 설문 카테고리">
            {[{ id: "all" as const, label: "전체" }, ...surveyCategories].map((category) => (
              <button
                type="button"
                role="tab"
                aria-selected={surveyFilter === category.id}
                className={surveyFilter === category.id ? "active" : ""}
                key={category.id}
                onClick={() => setSurveyFilter(category.id)}
              >
                {category.label}
              </button>
            ))}
          </div>
        </section>

        <section className="campus-home-section home-survey-section" aria-labelledby="home-surveys-title">
          <div className="campus-section-heading">
            <div>
              <span>{filteringSurveys ? "SEARCH RESULTS" : "RECOMMENDED"}</span>
              <h2 id="home-surveys-title">
                {filteringSurveys ? "조건에 맞는 설문" : "먼저 만나볼 설문"}
              </h2>
            </div>
            <div className="home-section-controls">
              <span className="home-section-count">
                {loadingSurveys ? "불러오는 중" : `${filteredHomeSurveys.length}개`}
              </span>
              <button type="button" onClick={onOpenBoard}>
                전체 설문 <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {loadingSurveys ? (
            <div className="home-survey-grid" aria-label="설문 목록 불러오는 중">
              {[0, 1, 2, 3].map((item) => (
                <span className="home-content-skeleton" key={item} />
              ))}
            </div>
          ) : recommendedSurveys.length > 0 ? (
            <div className="home-survey-grid">
              {recommendedSurveys.map((survey) => (
                <HomeSurveyCard
                  key={survey.slug}
                  survey={survey}
                  onClick={() => onOpenSurvey(survey)}
                />
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="home-section-empty"
              onClick={() => {
                if (surveys.length > 0) {
                  setSurveySearch("");
                  setSurveyFilter("all");
                } else {
                  onCreate();
                }
              }}
            >
              <span>{surveys.length > 0 ? <Search size={20} /> : <Plus size={20} />}</span>
              <strong>{surveys.length > 0 ? "조건에 맞는 설문이 없어요." : "아직 공개된 설문이 없어요."}</strong>
              <small>{surveys.length > 0 ? "검색어나 카테고리를 다시 선택해 보세요." : "첫 번째 설문을 만들어 캠퍼스에 질문해 보세요."}</small>
            </button>
          )}
        </section>

        {moreSurveys.length > 0 && (
          <section className="campus-home-section home-survey-section home-more-surveys" aria-labelledby="home-more-surveys-title">
            <div className="campus-section-heading">
              <div>
                <span>MORE SURVEYS</span>
                <h2 id="home-more-surveys-title">계속 둘러보기</h2>
              </div>
              <button type="button" onClick={onOpenBoard}>
                전체 설문 보기 <ArrowRight size={16} />
              </button>
            </div>
            <div className="home-survey-grid">
              {moreSurveys.map((survey) => (
                <HomeSurveyCard
                  key={survey.slug}
                  survey={survey}
                  onClick={() => onOpenSurvey(survey)}
                />
              ))}
            </div>
          </section>
        )}

        <CampusPulseSection
          pulse={featuredPulse}
          loading={loadingPulses}
          user={user}
          authToken={authToken}
          onAuth={onAuth}
          onReload={() => void loadPulses()}
          onCreate={() => setPulseCreateOpen(true)}
          onOpenBoard={onOpenPulseBoard}
        />

        {ownedSurveys.length > 0 && (
          <section className="campus-home-section home-owned-section" aria-labelledby="home-owned-title">
            <div className="campus-section-heading">
              <div>
                <span>MY SURVEYS</span>
                <h2 id="home-owned-title">내가 만든 설문</h2>
              </div>
              <span className="home-section-count">{ownedSurveys.length}개</span>
            </div>
            <div className="home-owned-survey-grid">
              {ownedSurveys.slice(0, 4).map((survey) => (
                <HomeOwnedSurveyCard
                  key={survey.slug}
                  survey={survey}
                  onClick={() => onOpenOwnedSurvey(survey)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="campus-home-lower-grid">
          <div className="campus-community-preview">
            <div className="campus-section-heading compact">
              <div>
                <span>COMMUNITY</span>
                <h2>캠퍼스에서 나누는 이야기</h2>
              </div>
              <button type="button" onClick={onOpenCommunity}>
                전체 보기 <ArrowRight size={16} />
              </button>
            </div>
            <div className="home-community-list">
              {loadingCommunity ? (
                [0, 1, 2, 3].map((item) => (
                  <span className="home-community-skeleton" key={item} />
                ))
              ) : communityPosts.length > 0 ? (
                communityPosts.map((post) => (
                  <button type="button" key={post.id} onClick={onOpenCommunity}>
                    <span className="home-community-post-head">
                      <b>{communityCategoryLabel(post.category)}</b>
                      <small>{homeRelativeTime(post.createdAt)}</small>
                    </span>
                    <strong>{post.title}</strong>
                    <p>{post.content}</p>
                    <span className="home-community-post-meta">
                      <em>{post.authorName}</em>
                      <span><Heart size={13} /> {post.likeCount}</span>
                      <span><MessageCircle size={13} /> {post.commentCount}</span>
                    </span>
                  </button>
                ))
              ) : (
                <button type="button" className="home-community-empty" onClick={onOpenCommunity}>
                  <UsersRound size={22} />
                  <span><strong>아직 첫 이야기를 기다리고 있어요.</strong><small>커뮤니티에서 질문을 남겨보세요.</small></span>
                  <ArrowRight size={17} />
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="home-organizer-panel" aria-labelledby="home-organizer-title">
          <div>
            <span>FOR ORGANIZERS</span>
            <h2 id="home-organizer-title">이미 제작한 설문이 있나요?</h2>
            <p>응답자용 설문 목록과 분리된 제작·모집 도구를 이용해 보세요.</p>
          </div>
          <div className="home-organizer-actions">
            <button type="button" onClick={() => onCreate()}>
              <span><WandSparkles size={19} /></span>
              <div><strong>AI 설문 제작</strong><small>질문 설계부터 배포까지</small></div>
              <ArrowRight size={17} />
            </button>
            <button type="button" onClick={() => user ? setExternalSurveyOpen(true) : onAuth()}>
              <span><Link2 size={19} /></span>
              <div><strong>외부 설문 등록</strong><small>기존 링크로 응답자 모집</small></div>
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      </main>
      <Footer />
      {externalSurveyOpen && (
        <ExternalSurveyModal
          authToken={authToken}
          onClose={() => setExternalSurveyOpen(false)}
          onSaved={onRefreshSurveys}
        />
      )}
      {pulseCreateOpen && (
        <PulseCreateModal
          authToken={authToken}
          onClose={() => setPulseCreateOpen(false)}
          onSaved={() => void loadPulses()}
        />
      )}
    </>
  );
}


function SchoolBoardView({
  surveys,
  loadingSurveys,
  onOpenSurvey,
  onCreate,
}: {
  surveys: PublicSurvey[];
  loadingSurveys: boolean;
  onOpenSurvey: (survey: PublicSurvey) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState<"all" | SurveyCategory>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"latest" | "short" | "reward" | "popular">("latest");

  const visibleSurveys = useMemo(() => {
    let filtered = [...surveys];
    if (filter !== "all") {
      filtered = filtered.filter((survey) => survey.category === filter);
    }
    if (search.trim()) {
      const keyword = search.trim().toLocaleLowerCase("ko-KR");
      filtered = filtered.filter(
        (survey) =>
          survey.title.toLocaleLowerCase("ko-KR").includes(keyword) ||
          survey.ownerName.toLocaleLowerCase("ko-KR").includes(keyword) ||
          survey.description.toLocaleLowerCase("ko-KR").includes(keyword) ||
          categoryLabel(survey.category).includes(keyword),
      );
    }
    filtered.sort((a, b) => {
      if (sort === "short") return a.durationMinutes - b.durationMinutes;
      if (sort === "reward") return b.rewardCash - a.rewardCash;
      if (sort === "popular") return (b.responseCount ?? 0) - (a.responseCount ?? 0);
      return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
    });
    return filtered;
  }, [filter, search, sort, surveys]);

  return (
    <>
      <main className="school-board-page">
        <section className="board-hero">
          <div>
            <span className="board-campus-badge">
              <span>Y</span>
              연세대학교 신촌캠퍼스
            </span>
            <h1>학교 설문 게시판</h1>
          </div>
          <button type="button" className="board-create-button" onClick={onCreate}>
            <Plus size={18} />
            내 설문 올리기
          </button>
        </section>

        <section className="school-surveys-section board-page-section" id="school-surveys">
          <div className="board-toolbar">
            <div className="school-board-select" aria-label="현재 학교">
              <School size={17} />
              <span>연세대학교</span>
              <small>신촌캠퍼스</small>
            </div>
            <div className="board-search">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="제목, 게시자, 카테고리 검색"
                aria-label="학교 설문 검색"
              />
              {search && (
                <button
                  type="button"
                  aria-label="검색어 지우기"
                  onClick={() => setSearch("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <label className="board-sort-select">
              <span>정렬</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                <option value="latest">최신순</option>
                <option value="short">짧은 설문순</option>
                <option value="reward">리워드 높은 순</option>
                <option value="popular">참여 많은 순</option>
              </select>
            </label>
          </div>

          <div className="board-category-row">
            <div className="filter-tabs category-tabs" role="tablist" aria-label="설문 카테고리">
              {[
                { id: "all" as const, label: "전체" },
                ...surveyCategories,
              ].map((item) => (
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  className={filter === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <span className="board-result-count">
              {loadingSurveys ? "불러오는 중" : `${visibleSurveys.length}개의 설문`}
            </span>
          </div>

          {loadingSurveys ? (
            <div className="board-loading" aria-live="polite">
              <span />
              <span />
              <span />
              <p>학교 설문을 불러오고 있어요.</p>
            </div>
          ) : visibleSurveys.length > 0 ? (
            <div className="all-surveys-grid board-survey-grid">
              {visibleSurveys.map((survey) => (
                <CampusSurveyCard
                  key={survey.slug}
                  survey={survey}
                  onClick={() => onOpenSurvey(survey)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-search public-empty board-empty-state">
              {search ? <Search size={27} /> : <School size={27} />}
              <strong>
                {search
                  ? "일치하는 설문이 없어요."
                  : "아직 공개된 학교 설문이 없어요."}
              </strong>
              <span>
                {search
                  ? "검색어나 카테고리를 바꿔보세요."
                  : "첫 설문을 올리면 연세대 게시판에서 바로 응답을 모집할 수 있어요."}
              </span>
              {!search && (
                <button type="button" onClick={onCreate}>
                  첫 학교 설문 만들기
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function MyPageView({
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
  const listedCount = surveys.filter((survey) => survey.isListed).length;

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

  return (
    <>
      <main className="mypage-page">
        <section className="mypage-hero">
          <div>
            <span className="eyebrow">MY BAROFORM</span>
            <h1>{user.name}님의 설문</h1>
            <p>{schoolLabel(user.schoolId)}에서 만든 설문을 한곳에서 관리해요.</p>
          </div>
          <div className="mypage-hero-actions">
            <button type="button" className="mypage-logout" onClick={onLogout}>
              <LogOut size={16} />
              로그아웃
            </button>
            <button type="button" className="board-create-button" onClick={onCreate}>
              <Plus size={18} />
              새 설문 만들기
            </button>
          </div>
        </section>

        <section className="mypage-summary" aria-label="내 설문 요약">
          <article>
            <span>만든 설문</span>
            <strong>{surveys.length}</strong>
            <small>전체 설문</small>
          </article>
          <article>
            <span>받은 응답</span>
            <strong>{totalResponses}</strong>
            <small>모든 설문 합계</small>
          </article>
          <article>
            <span>학교 게시판</span>
            <strong>{listedCount}</strong>
            <small>현재 공개 중</small>
          </article>
          <article className="mypage-cash-summary">
            <span>보유 캐시</span>
            <strong>{wallet.balance.toLocaleString("ko-KR")}<em>C</em></strong>
            <small>설문 참여 적립</small>
          </article>
        </section>

        <section className="wallet-section">
          <div className="wallet-card">
            <div className="wallet-card-top">
              <span className="wallet-icon"><Coins size={22} /></span>
              <div>
                <span>바로폼 캐시</span>
                <strong>{wallet.balance.toLocaleString("ko-KR")}C</strong>
              </div>
            </div>
            <p>로그인한 상태로 다른 사람의 설문을 완료하면 설문마다 30C가 한 번 적립돼요.</p>
          </div>
          <div className="wallet-history">
            <div>
              <span className="eyebrow">최근 적립 내역</span>
              <strong>{wallet.transactions.length > 0 ? `${wallet.transactions.length}건` : "아직 없음"}</strong>
            </div>
            {wallet.transactions.length > 0 ? (
              <ul>
                {wallet.transactions.slice(0, 4).map((transaction) => (
                  <li key={transaction.id}>
                    <span>
                      <strong>{transaction.description}</strong>
                      <small>{new Date(transaction.createdAt).toLocaleDateString("ko-KR")}</small>
                    </span>
                    <em>+{transaction.amount.toLocaleString("ko-KR")}C</em>
                  </li>
                ))}
              </ul>
            ) : (
              <p>학교 설문에 참여하면 이곳에서 적립 내역을 확인할 수 있어요.</p>
            )}
          </div>
        </section>

        <section className="my-surveys-section">
          <div className="my-surveys-heading">
            <div>
              <span className="eyebrow">내가 만든 설문</span>
              <h2>설문 관리</h2>
            </div>
            <button type="button" onClick={onOpenBoard}>
              학교 설문 게시판
              <ChevronRight size={16} />
            </button>
          </div>

          {deleteError && (
            <p className="my-survey-error" role="alert">
              {deleteError}
            </p>
          )}

          {loading ? (
            <div className="board-loading mypage-loading" aria-live="polite">
              <span />
              <span />
              <span />
              <p>내 설문을 불러오고 있어요.</p>
            </div>
          ) : error ? (
            <div className="mypage-empty">
              <CircleHelp size={27} />
              <strong>내 설문을 불러오지 못했어요.</strong>
              <p>{error}</p>
            </div>
          ) : surveys.length === 0 ? (
            <div className="mypage-empty">
              <WandSparkles size={28} />
              <strong>아직 만든 설문이 없어요.</strong>
              <p>AI에게 조사 목적을 알려주면 첫 설문을 바로 만들 수 있어요.</p>
              <button type="button" onClick={onCreate}>
                첫 설문 만들기
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="my-survey-list">
              {surveys.map((survey) => (
                <article className="my-survey-card" key={survey.slug}>
                  <div className="my-survey-main">
                    <div className="my-survey-badges">
                      <span className={survey.isListed ? "listed" : "link-only"}>
                        {survey.isListed ? "학교 게시판 공개" : "링크 공개"}
                      </span>
                      <span>{categoryLabel(survey.category)}</span>
                    </div>
                    <h3>{survey.title}</h3>
                    <p>{survey.description || "설문 안내문이 없어요."}</p>
                    <div className="my-survey-meta">
                      <span>
                        <UsersRound size={15} />
                        응답 {survey.responseCount}개
                      </span>
                      <span>
                        <Clock3 size={15} />
                        약 {survey.durationMinutes}분
                      </span>
                      {survey.createdAt && (
                        <span>
                          <CalendarDays size={15} />
                          {new Date(survey.createdAt).toLocaleDateString("ko-KR")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="my-survey-actions">
                    <button
                      type="button"
                      className="copy"
                      onClick={() => void copySurveyLink(survey.slug)}
                    >
                      {copiedSlug === survey.slug ? <Check size={16} /> : <Copy size={16} />}
                      {copiedSlug === survey.slug ? "복사됨" : "링크 복사"}
                    </button>
                    <button type="button" onClick={() => onOpenSurvey(survey)}>
                      <Eye size={16} />
                      설문 보기
                    </button>
                    <button
                      type="button"
                      className="primary"
                      onClick={() => onOpenAnalytics(survey)}
                    >
                      <BarChart3 size={16} />
                      결과 보기
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={deletingSlug === survey.slug}
                      onClick={() => void deleteSurvey(survey)}
                    >
                      <Trash2 size={16} />
                      {deletingSlug === survey.slug ? "삭제 중…" : "삭제"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function CreateView({
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
  isAnalyzing: boolean;
}) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const canGenerate = prompt.trim().length >= 2 || hasSurveyReferences(references);
  const recommendedMode = useMemo(
    () =>
      recommendSurveyMode(prompt, {
        files: references.files.map(({ name, mimeType }) => ({ name, mimeType })),
      }),
    [prompt, references.files],
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <main className="create-page">
      <header className="create-header">
        <button type="button" className="create-back" onClick={onBack}>
          <ArrowLeft size={18} />
          홈으로
        </button>
        <button type="button" className="brand create-brand" onClick={onBack}>
          <BrandMark compact />
          <strong>바로폼</strong>
        </button>
        <span className="create-step">새 설문</span>
      </header>

      <section className="create-stage">
        <div className="create-copy">
          <span className="create-ai-mark">설문 초안 만들기</span>
          <h1>어떤 설문을 만들까요?</h1>
          <p>내용을 적거나 참고할 사진·파일·링크를 추가해주세요.</p>
        </div>

        <div className="create-composer">
          <textarea
            id="survey-maker"
            ref={inputRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="예) 연세대 학생들의 대우관 등하교 경험과 불편한 점을 조사하고 싶어요"
            rows={3}
            maxLength={300}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                onCreate();
              }
            }}
          />
          <SurveyReferenceControls
            references={references}
            onChange={setReferences}
            disabled={isAnalyzing}
          />
          <fieldset className="survey-mode-setting" disabled={isAnalyzing}>
            <legend>설문 제작 방식</legend>
            <div className="survey-mode-options">
              {surveyModeOptions.map((option) => (
                <label
                  className={`survey-mode-card ${surveyMode === option.value ? "selected" : ""}`}
                  key={option.value}
                >
                  <input
                    type="radio"
                    name="survey-mode"
                    value={option.value}
                    checked={surveyMode === option.value}
                    onChange={() => setSurveyMode(option.value)}
                  />
                  <span className="survey-mode-radio" aria-hidden="true" />
                  <span className="survey-mode-copy">
                    <span>
                      <strong>{option.label}</strong>
                      {recommendedMode === option.value && <em>추천</em>}
                    </span>
                    <small>{option.description}</small>
                  </span>
                </label>
              ))}
            </div>
            <p>두 방식 모두 관련 정보를 확인하고 문항 품질을 검토해요.</p>
          </fieldset>
          <div className="create-composer-footer">
            <div className={`create-readiness ${canGenerate ? "ready" : ""}`}>
              <i />
              <span>{canGenerate ? "문항을 만들 준비가 됐어요" : "주제나 자료를 입력해주세요"}</span>
            </div>
            <span className="create-counter">{prompt.length}/300</span>
            <button
              type="button"
              onClick={onCreate}
              disabled={isAnalyzing || !canGenerate}
              aria-label="설문 생성하기"
            >
              <Sparkles size={17} />
              <span>{isAnalyzing ? "설문 만드는 중" : "AI로 설문 만들기"}</span>
              {!isAnalyzing && <ArrowRight size={16} />}
            </button>
          </div>
        </div>

        <div className="create-settings" aria-label="설문 생성 설정">
          <div className="setting-block grade-setting">
            <div className="setting-heading">
              <span><UsersRound size={16} /> 응답 대상</span>
              <small>학년을 선택해주세요</small>
            </div>
            <div className="grade-options">
              {targetGradeOptions.map((grade) => (
                <button
                  type="button"
                  key={grade}
                  className={targetGrade === grade ? "active" : ""}
                  onClick={() => setTargetGrade(grade)}
                >
                  {grade}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-block count-setting">
            <div className="setting-heading">
              <span><BarChart3 size={16} /> 문항 수</span>
              <small>1~30개</small>
            </div>
            <div className="count-stepper">
              <button
                type="button"
                onClick={() => setQuestionCount(Math.max(1, questionCount - 1))}
                disabled={questionCount <= 1}
                aria-label="문항 수 줄이기"
              >
                <Minus size={17} />
              </button>
              <label>
                <input
                  type="number"
                  value={questionCount}
                  min={1}
                  max={30}
                  onChange={(event) =>
                    setQuestionCount(
                      Math.min(30, Math.max(1, Number(event.target.value) || 1)),
                    )
                  }
                  aria-label="생성할 문항 수"
                />
                <span>개</span>
              </label>
              <button
                type="button"
                onClick={() => setQuestionCount(Math.min(30, questionCount + 1))}
                disabled={questionCount >= 30}
                aria-label="문항 수 늘리기"
              >
                <Plus size={17} />
              </button>
            </div>
          </div>
        </div>

        <div className="create-summary">
          <CheckCircle2 size={15} />
          <span>
            {surveyMode === "research" ? "정밀·연구 설문" : "일반 설문"} · {targetGrade} 대상 · {questionCount}문항
            {hasSurveyReferences(references)
              ? ` · 참고자료 ${references.images.length + references.files.length + references.links.length}개`
              : ""}
          </span>
          <span>생성 후 모든 문항을 직접 또는 AI로 수정할 수 있어요.</span>
        </div>
      </section>
    </main>
  );
}

function AuthModal({
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
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name, schoolId }),
      });
      const result = (await response.json()) as {
        token?: string;
        user?: AuthUser;
        error?: string;
      };
      if (!response.ok || !result.token || !result.user) {
        throw new Error(result.error || "로그인 정보를 확인하지 못했어요.");
      }
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

function ClarificationModal({
  state,
  onChoose,
  onClose,
}: {
  state: ClarificationState;
  onChoose: (option: string) => void;
  onClose: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const suggestedOptions = state.clarification.options.filter(
    (option) => !/^(?:직접\s*(?:설명|입력)|기타)/.test(option),
  );

  const submitAnswer = () => {
    const normalized = answer.replace(/\s+/g, " ").trim();
    if (normalized) onChoose(normalized);
  };

  return (
    <div className="generation-overlay" role="dialog" aria-modal="true">
      <div className="clarification-card">
        <span className="clarification-icon">
          <CircleHelp size={24} />
        </span>
        <span className="clarification-label">정확한 설문을 위해 한 가지만</span>
        <h2>{state.clarification.question}</h2>
        <p>{state.clarification.reason}</p>
        {state.research.sources.length > 0 && (
          <small>공개 자료를 확인했지만 이 부분은 임의로 정하지 않았어요.</small>
        )}
        <div className="clarification-options">
          {suggestedOptions.map((option) => (
            <button type="button" key={option} onClick={() => onChoose(option)}>
              {option}
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
        <form
          className="clarification-answer"
          onSubmit={(event) => {
            event.preventDefault();
            submitAnswer();
          }}
        >
          <label htmlFor="clarification-answer">직접 알려주기</label>
          <div>
            <input
              id="clarification-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="예: 학생회관에 있는 교내 식당이에요"
              maxLength={180}
              autoFocus
            />
            <button type="submit" disabled={!answer.trim()} aria-label="답변 보내기">
              <ArrowRight size={17} />
            </button>
          </div>
          <small>Enter를 누르면 이 설명을 반영해 바로 설계해요.</small>
        </form>
        <button className="clarification-close" type="button" onClick={onClose}>
          처음 문장을 다시 적을게요
        </button>
      </div>
    </div>
  );
}

function EditorView({
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
  const [preview, setPreview] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiRevising, setAiRevising] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [quickAction, setQuickAction] = useState<{
    id: "shorten" | "dedupe" | "neutral";
    message: string;
  } | null>(null);
  const quickActionTimer = useRef<number | null>(null);
  const selectedQuestion =
    questions.find((question) => question.id === selectedId) ?? questions[0];

  useEffect(() => {
    return () => {
      if (quickActionTimer.current) window.clearTimeout(quickActionTimer.current);
    };
  }, []);

  const showQuickAction = (
    id: "shorten" | "dedupe" | "neutral",
    message: string,
  ) => {
    setQuickAction({ id, message });
    if (quickActionTimer.current) window.clearTimeout(quickActionTimer.current);
    quickActionTimer.current = window.setTimeout(() => setQuickAction(null), 2600);
  };

  function updateQuestion<K extends keyof Question>(
    id: number,
    key: K,
    value: Question[K],
  ) {
    setQuestions(
      questions.map((question) =>
        question.id === id ? { ...question, [key]: value } : question,
      ),
    );
  }

  const addQuestion = () => {
    if (questions.length >= 30) return;
    const id = Math.max(...questions.map((question) => question.id), 0) + 1;
    const next: Question = {
      id,
      title: "새 질문을 입력해주세요.",
      reason: "이 질문이 필요한 이유를 AI가 함께 정리해드려요.",
      type: "single",
      options: ["선택지 1", "선택지 2", "선택지 3"],
      required: false,
    };
    setQuestions([...questions, next]);
    setSelectedId(id);
  };

  const addSection = () => {
    if (questions.length >= 30) return;
    const id = Math.max(...questions.map((question) => question.id), 0) + 1;
    setQuestions([
      ...questions,
      {
        id,
        title: "새 섹션",
        description: "섹션에 대한 안내를 입력해주세요.",
        reason: "",
        type: "section",
        required: false,
      },
    ]);
    setSelectedId(id);
  };

  const removeQuestion = (id: number) => {
    if (questions.length === 1) return;
    const next = questions.filter((question) => question.id !== id);
    setQuestions(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? 1);
  };

  const duplicateQuestion = (id: number) => {
    if (questions.length >= 30) return;
    const sourceIndex = questions.findIndex((question) => question.id === id);
    if (sourceIndex < 0) return;
    const nextId = Math.max(...questions.map((question) => question.id), 0) + 1;
    const next = [...questions];
    next.splice(sourceIndex + 1, 0, {
      ...questions[sourceIndex],
      id: nextId,
      options: questions[sourceIndex].options
        ? [...(questions[sourceIndex].options ?? [])]
        : undefined,
    });
    setQuestions(next);
    setSelectedId(nextId);
  };

  const moveQuestion = (id: number, direction: -1 | 1) => {
    const currentIndex = questions.findIndex((question) => question.id === id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= questions.length) return;
    const next = [...questions];
    [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    setQuestions(next);
  };

  const changeQuestionType = (id: number, type: Question["type"]) => {
    setQuestions(
      questions.map((question) =>
        question.id === id
          ? {
              ...question,
              type,
              options:
                type === "single" || type === "multiple" || type === "dropdown"
                  ? question.options?.length
                    ? question.options
                    : ["선택지 1", "선택지 2", "선택지 3"]
                  : undefined,
              required: type === "section" ? false : question.required,
              scaleMin: type === "scale" ? question.scaleMin ?? 1 : undefined,
              scaleMax: type === "scale" ? question.scaleMax ?? 5 : undefined,
            }
          : question,
      ),
    );
  };

  const updateOption = (id: number, optionIndex: number, value: string) => {
    setQuestions(
      questions.map((question) =>
        question.id === id
          ? {
              ...question,
              options: (question.options ?? []).map((option, index) =>
                index === optionIndex ? value : option,
              ),
            }
          : question,
      ),
    );
  };

  const addOption = (id: number) => {
    setQuestions(
      questions.map((question) =>
        question.id === id
          ? {
              ...question,
              options:
                (question.options?.length ?? 0) >= 12
                  ? question.options
                  : [
                      ...(question.options ?? []),
                      `선택지 ${(question.options?.length ?? 0) + 1}`,
                    ],
            }
          : question,
      ),
    );
  };

  const removeOption = (id: number, optionIndex: number) => {
    setQuestions(
      questions.map((question) =>
        question.id === id && (question.options?.length ?? 0) > 2
          ? {
              ...question,
              options: (question.options ?? []).filter((_, index) => index !== optionIndex),
            }
          : question,
      ),
    );
  };

  const submitAiRevision = async () => {
    const instruction = aiInstruction.replace(/\s+/g, " ").trim();
    if (instruction.length < 2 || aiRevising) return;
    setAiRevising(true);
    setAiMessage("");
    try {
      const message = await onAiRevise(instruction);
      setAiMessage(message);
      setAiInstruction("");
    } catch (error) {
      setAiMessage(
        error instanceof Error ? error.message : "AI가 설문을 수정하지 못했어요.",
      );
    } finally {
      setAiRevising(false);
    }
  };

  const shortenSelectedQuestion = () => {
    if (!selectedQuestion) return;
    const shortened = shortenSurveyQuestionTitle(selectedQuestion.title);
    if (!shortened || shortened === selectedQuestion.title) {
      showQuickAction("shorten", "이미 충분히 짧은 문장이에요");
      return;
    }
    updateQuestion(selectedQuestion.id, "title", shortened);
    showQuickAction("shorten", "문장을 짧게 바꿨어요");
  };

  const deduplicateSelectedOptions = () => {
    if (!selectedQuestion?.options) return;
    const unique = deduplicateSurveyOptions(selectedQuestion.options);
    if (unique.length === selectedQuestion.options.length) {
      showQuickAction("dedupe", "겹치는 선택지가 없어요");
      return;
    }
    updateQuestion(selectedQuestion.id, "options", unique);
    showQuickAction("dedupe", "중복 선택지를 정리했어요");
  };

  const addNeutralOption = () => {
    if (
      !selectedQuestion ||
      (selectedQuestion.type !== "single" &&
        selectedQuestion.type !== "multiple")
    ) {
      return;
    }
    const options = selectedQuestion.options ?? [];
    if (options.includes("잘 모르겠음")) {
      showQuickAction("neutral", "이미 추가되어 있어요");
      return;
    }
    updateQuestion(selectedQuestion.id, "options", [
      ...options,
      "잘 모르겠음",
    ]);
    showQuickAction("neutral", "선택지를 추가했어요");
  };

  const structureChecks = [
    questions.length >= 3,
    questions.every((question) => question.title.trim().length >= 5),
    questions
      .filter(
        (question) =>
          question.type === "single" ||
          question.type === "multiple" ||
          question.type === "dropdown",
      )
      .every((question) => (question.options ?? []).filter(Boolean).length >= 2),
  ];
  const structureScore = Math.round(
    (structureChecks.filter(Boolean).length / structureChecks.length) * 100,
  );

  return (
    <main className="editor-page">
      <div className="editor-topbar">
        <div className="editor-brand">
          <button type="button" onClick={onBack} aria-label="이전 화면">
            <ArrowLeft size={19} />
          </button>
          <BrandMark compact />
          <strong>바로폼</strong>
          <span className="save-state">
            <WandSparkles size={12} />
            초안 편집 중
          </span>
        </div>
        <div className="editor-tabs" role="tablist">
          <button
            type="button"
            className={!preview ? "active" : ""}
            onClick={() => setPreview(false)}
          >
            설문 편집
          </button>
          <button
            type="button"
            className={preview ? "active" : ""}
            onClick={() => setPreview(true)}
          >
            미리보기
          </button>
        </div>
        <div className="editor-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="더 보기"
          >
            <MoreHorizontal size={19} />
          </button>
          <button
            type="button"
            className="preview-button"
            onClick={() => setPreview((value) => !value)}
          >
            <Eye size={16} />
            미리보기
          </button>
          <button type="button" className="publish-button" onClick={onPublish}>
            배포하기
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div className={`editor-layout ${preview ? "preview-mode" : ""}`}>
        {!preview && (
          <aside className="question-sidebar">
            <div className="sidebar-heading">
              <span>설문 구성</span>
              <button type="button" aria-label="설문 구성 도움말">
                <CircleHelp size={15} />
              </button>
            </div>
            <button
              type="button"
              className="outline-intro"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <span className="outline-number">00</span>
              <span>
                <strong>설문 소개</strong>
                <small>제목과 안내문</small>
              </span>
            </button>
            <div className="outline-list">
              {questions.map((question, index) => (
                <button
                  type="button"
                  key={question.id}
                  className={selectedId === question.id ? "active" : ""}
                  onClick={() => setSelectedId(question.id)}
                >
                  <GripVertical size={14} />
                  <span className="outline-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <strong>{question.title}</strong>
                    <small>{questionTypeLabel(question.type)}</small>
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="add-outline"
              onClick={addQuestion}
              disabled={questions.length >= 30}
            >
              <Plus size={16} />
              질문 추가
            </button>
            <div className="outline-progress">
              <span>
                <strong>{questions.length}</strong>개 질문
              </span>
              <span>예상 {estimatedMinutes(questions)}분</span>
            </div>
          </aside>
        )}

        <section className="editor-canvas">
          <div className="editor-canvas-heading">
            <div>
              <span>AI 추천 · 목표 {questions.length}문항</span>
              <h1>{preview ? "응답 화면 미리보기" : "설문 미리보기"}</h1>
            </div>
            <p>
              {preview
                ? "응답자가 보게 될 화면을 확인하고 있어요."
                : "문항을 클릭하면 바로 수정할 수 있어요."}
            </p>
          </div>
          <div className="canvas-width">
            <div className="survey-title-card">
              <span className="tiny-brand">BAROFORM</span>
              {preview ? (
                <>
                  <h1>{title}</h1>
                  <p>{description}</p>
                </>
              ) : (
                <>
                  <input
                    className="title-input"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    aria-label="설문 제목"
                    maxLength={100}
                  />
                  <textarea
                    className="description-input"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    aria-label="설문 설명"
                    maxLength={600}
                  />
                </>
              )}
              <div className="survey-meta-pills">
                <span>익명 응답</span>
                <span>{targetGrade} 대상</span>
                <span>약 {estimatedMinutes(questions)}분</span>
              </div>
            </div>

            {questions.map((question, index) => (
              <article
                className={`question-card ${
                  !preview && selectedId === question.id ? "selected" : ""
                } ${question.type === "section" ? "section-card" : ""}`}
                key={question.id}
                onClick={() => !preview && setSelectedId(question.id)}
              >
                <div className="question-card-heading">
                  <span>
                    {question.type === "section"
                      ? "섹션"
                      : String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="question-copy">
                    {preview ? (
                      <h2>
                        {question.title}
                        {question.required && <em>*</em>}
                      </h2>
                    ) : (
                      <QuestionTitleField
                        value={question.title}
                        onChange={(value) =>
                          updateQuestion(
                            question.id,
                            "title",
                            value,
                          )
                        }
                        label={`${index + 1}번 질문`}
                      />
                    )}
                    {preview ? (
                      question.description && <p>{question.description}</p>
                    ) : (
                      <input
                        className="question-description-input"
                        value={question.description ?? ""}
                        onChange={(event) =>
                          updateQuestion(question.id, "description", event.target.value)
                        }
                        placeholder={
                          question.type === "section"
                            ? "섹션 안내를 입력해주세요."
                            : "질문 설명 추가 (선택)"
                        }
                        maxLength={300}
                      />
                    )}
                    {!preview &&
                    question.type !== "section" &&
                    question.reason ? (
                      <p className="question-ai-reason">
                        <Sparkles size={13} />
                        {formatQuestionReason(question.reason)}
                      </p>
                    ) : null}
                  </div>
                </div>

                {question.type === "scale" && (
                  <div className="scale-options">
                    {Array.from(
                      {
                        length:
                          (question.scaleMax ?? 5) - (question.scaleMin ?? 1) + 1,
                      },
                      (_, offset) => (question.scaleMin ?? 1) + offset,
                    ).map((value) => (
                      <button type="button" key={value}>
                        {value}
                      </button>
                    ))}
                    <div className="scale-labels">
                      <span>{question.scaleMinLabel || "전혀 그렇지 않음"}</span>
                      <span>{question.scaleMaxLabel || "매우 그러함"}</span>
                    </div>
                    {!preview && (
                      <div className="scale-settings">
                        <label>
                          시작
                          <select
                            value={question.scaleMin ?? 1}
                            onChange={(event) =>
                              updateQuestion(question.id, "scaleMin", Number(event.target.value))
                            }
                          >
                            <option value={0}>0</option>
                            <option value={1}>1</option>
                          </select>
                        </label>
                        <label>
                          끝
                          <select
                            value={question.scaleMax ?? 5}
                            onChange={(event) =>
                              updateQuestion(question.id, "scaleMax", Number(event.target.value))
                            }
                          >
                            {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                              <option value={value} key={value}>{value}</option>
                            ))}
                          </select>
                        </label>
                        <input
                          value={question.scaleMinLabel ?? ""}
                          onChange={(event) => updateQuestion(question.id, "scaleMinLabel", event.target.value)}
                          placeholder="최솟값 라벨"
                          maxLength={40}
                        />
                        <input
                          value={question.scaleMaxLabel ?? ""}
                          onChange={(event) => updateQuestion(question.id, "scaleMaxLabel", event.target.value)}
                          placeholder="최댓값 라벨"
                          maxLength={40}
                        />
                      </div>
                    )}
                  </div>
                )}

                {(question.type === "single" ||
                  question.type === "multiple") && (
                  <div className="multiple-options">
                    {question.options?.map((option, optionIndex) => (
                      <label key={`${question.id}-${optionIndex}`}>
                        <input
                          type={
                            question.type === "single"
                              ? "radio"
                              : question.type === "multiple"
                                ? "checkbox"
                                : "text"
                          }
                          name={
                            question.type === "single"
                              ? `question-${question.id}`
                              : undefined
                          }
                          disabled={!preview}
                        />
                        {preview ? (
                          <span>{option}</span>
                        ) : (
                          <input
                            className="option-text-input"
                            value={option}
                            onChange={(event) =>
                              updateOption(
                                question.id,
                                optionIndex,
                                event.target.value,
                              )
                            }
                            aria-label={`${index + 1}번 질문 선택지 ${optionIndex + 1}`}
                            maxLength={100}
                          />
                        )}
                        {!preview && (
                          <button
                            type="button"
                            className="remove-option"
                            aria-label="선택지 삭제"
                            disabled={(question.options?.length ?? 0) <= 2}
                            onClick={() => removeOption(question.id, optionIndex)}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </label>
                    ))}
                    {!preview && (
                      <button
                        type="button"
                        className="add-option"
                        onClick={() => addOption(question.id)}
                        disabled={(question.options?.length ?? 0) >= 12}
                      >
                        <Plus size={14} />
                        선택지 추가
                      </button>
                    )}
                    {!preview && (
                      <label className="shuffle-options">
                        <input
                          type="checkbox"
                          checked={question.shuffleOptions === true}
                          onChange={(event) =>
                            updateQuestion(question.id, "shuffleOptions", event.target.checked)
                          }
                        />
                        선택지 순서 섞기
                      </label>
                    )}
                  </div>
                )}

                {(question.type === "text" || question.type === "shortText") && (
                  <textarea
                    className="long-answer"
                    rows={question.type === "text" ? 3 : 1}
                    placeholder="응답을 입력해주세요."
                    disabled={!preview}
                    maxLength={question.type === "text" ? 4000 : 500}
                  />
                )}

                {question.type === "dropdown" && preview && (
                  <select className="preview-dropdown" defaultValue="">
                    <option value="" disabled>선택해주세요.</option>
                    {(question.options ?? []).map((option) => (
                      <option value={option} key={option}>{option}</option>
                    ))}
                  </select>
                )}

                {question.type === "dropdown" && !preview && (
                  <div className="multiple-options dropdown-editor-options">
                    {(question.options ?? []).map((option, optionIndex) => (
                      <label key={`${question.id}-dropdown-${optionIndex}`}>
                        <span className="dropdown-option-number">{optionIndex + 1}</span>
                        <input
                          className="option-text-input"
                          value={option}
                          onChange={(event) =>
                            updateOption(question.id, optionIndex, event.target.value)
                          }
                          maxLength={100}
                        />
                        <button
                          type="button"
                          className="remove-option"
                          disabled={(question.options?.length ?? 0) <= 2}
                          onClick={() => removeOption(question.id, optionIndex)}
                          aria-label="선택지 삭제"
                        >
                          <X size={14} />
                        </button>
                      </label>
                    ))}
                    <button
                      type="button"
                      className="add-option"
                      onClick={() => addOption(question.id)}
                      disabled={(question.options?.length ?? 0) >= 12}
                    >
                      <Plus size={14} /> 선택지 추가
                    </button>
                    <label className="shuffle-options">
                      <input
                        type="checkbox"
                        checked={question.shuffleOptions === true}
                        onChange={(event) =>
                          updateQuestion(question.id, "shuffleOptions", event.target.checked)
                        }
                      />
                      선택지 순서 섞기
                    </label>
                  </div>
                )}

                {question.type === "date" && (
                  <input className="date-time-preview" type="date" disabled={!preview} />
                )}

                {question.type === "time" && (
                  <input className="date-time-preview" type="time" disabled={!preview} />
                )}

                {!preview && (
                  <div className="question-controls">
                    <select
                      value={question.type}
                      aria-label="질문 유형"
                      onChange={(event) =>
                        changeQuestionType(
                          question.id,
                          event.target.value as Question["type"],
                        )
                      }
                    >
                      <option value="shortText">단답형</option>
                      <option value="text">장문형</option>
                      <option value="single">객관식</option>
                      <option value="multiple">체크박스</option>
                      <option value="dropdown">드롭다운</option>
                      <option value="scale">선형 배율</option>
                      <option value="date">날짜</option>
                      <option value="time">시간</option>
                      <option value="section">섹션</option>
                    </select>
                    <div className="question-action-buttons">
                      <button
                        type="button"
                        onClick={() => moveQuestion(question.id, -1)}
                        disabled={index === 0}
                        aria-label="질문 위로 이동"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(question.id, 1)}
                        disabled={index === questions.length - 1}
                        aria-label="질문 아래로 이동"
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateQuestion(question.id)}
                        disabled={questions.length >= 30}
                        aria-label="질문 복제"
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeQuestion(question.id)}
                        disabled={questions.length === 1}
                        aria-label="질문 삭제"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {question.type !== "section" && (
                      <label className="required-toggle">
                        <span>필수</span>
                        <input
                          type="checkbox"
                          checked={question.required}
                          onChange={(event) =>
                            updateQuestion(
                              question.id,
                              "required",
                              event.target.checked,
                            )
                          }
                        />
                        <i />
                      </label>
                    )}
                  </div>
                )}
              </article>
            ))}
            {!preview && (
              <div className="canvas-add-row">
                <button
                  type="button"
                  className="canvas-add"
                  onClick={addQuestion}
                  disabled={questions.length >= 30}
                >
                  <Plus size={17} />
                  질문 추가하기
                </button>
                <button
                  type="button"
                  className="canvas-add secondary"
                  onClick={addSection}
                  disabled={questions.length >= 30}
                >
                  <CalendarDays size={17} />
                  섹션 추가
                </button>
              </div>
            )}
            {preview && (
              <button type="button" className="survey-submit-preview">
                응답 제출하기
              </button>
            )}
          </div>
        </section>

        {!preview && (
          <aside className="ai-sidebar">
            <div className="ai-assistant-title">
              <span>
                <Sparkles size={16} />
              </span>
              <div>
                <strong>AI로 바로 수정</strong>
                <small>완성된 설문 전체에 반영해요</small>
              </div>
            </div>
            <div className="ai-revision-banner">
              <label htmlFor="ai-revision-input">
                어떤 내용을 수정/추가할까요?
              </label>
              <textarea
                id="ai-revision-input"
                value={aiInstruction}
                onChange={(event) => setAiInstruction(event.target.value)}
                placeholder="예) 통학 시간 질문을 추가하고 전체 문장을 더 짧게 바꿔줘"
                rows={4}
                maxLength={500}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    void submitAiRevision();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => void submitAiRevision()}
                disabled={aiRevising || aiInstruction.trim().length < 2}
              >
                {aiRevising ? "수정 중…" : "AI로 반영하기"}
                {!aiRevising && <ArrowUp size={15} />}
              </button>
              {aiMessage && <p role="status">{aiMessage}</p>}
            </div>
            <div className="selected-question-box">
              <span>현재 선택</span>
              <strong>{selectedQuestion?.title}</strong>
            </div>
            <div className="assistant-suggestions">
              <div className="quick-edit-heading">
                <span>빠른 수정</span>
                <small>누르면 선택 문항에 바로 적용돼요</small>
              </div>
              <button
                type="button"
                className={quickAction?.id === "shorten" ? "applied" : ""}
                onClick={shortenSelectedQuestion}
              >
                문장을 더 짧게 정리
                {quickAction?.id === "shorten" ? <Check size={14} /> : <ChevronRight size={14} />}
              </button>
              <button
                type="button"
                className={quickAction?.id === "dedupe" ? "applied" : ""}
                onClick={deduplicateSelectedOptions}
                disabled={
                  selectedQuestion?.type !== "single" &&
                  selectedQuestion?.type !== "multiple" &&
                  selectedQuestion?.type !== "dropdown"
                }
              >
                중복 선택지 정리
                {quickAction?.id === "dedupe" ? <Check size={14} /> : <ChevronRight size={14} />}
              </button>
              <button
                type="button"
                className={quickAction?.id === "neutral" ? "applied" : ""}
                onClick={addNeutralOption}
                disabled={
                  selectedQuestion?.type !== "single" &&
                  selectedQuestion?.type !== "multiple"
                }
              >
                ‘잘 모르겠음’ 추가
                {quickAction?.id === "neutral" ? <Check size={14} /> : <ChevronRight size={14} />}
              </button>
              <p className={`quick-edit-status ${quickAction ? "visible" : ""}`} role="status">
                <CheckCircle2 size={14} />
                {quickAction?.message ?? "선택한 문항을 빠르게 다듬을 수 있어요"}
              </p>
            </div>
            <div className="ai-quality">
              <div>
                <span>기본 구조 점검</span>
                <strong>{structureScore === 100 ? "완료" : "확인 필요"}</strong>
              </div>
              <div className="quality-track">
                <span style={{ width: `${structureScore}%` }} />
              </div>
              <p>
                질문 수, 제목, 선택지 구성을 기준으로 확인한 결과예요.
              </p>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}

function PublishModal({
  title,
  onClose,
  onConfirm,
  onLogin,
  user,
  saving,
  error,
}: {
  title: string;
  onClose: () => void;
  onConfirm: (
    ownerName: string,
    listingRequested: boolean,
    category: SurveyCategory,
    shareToInstagram: boolean,
  ) => void;
  onLogin: () => void;
  user: AuthUser | null;
  saving: boolean;
  error: string;
}) {
  const [ownerName, setOwnerName] = useState(user?.name ?? "");
  const [listingRequested, setListingRequested] = useState(false);
  const [category, setCategory] = useState<SurveyCategory>("course");

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="publish-modal">
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={20} />
        </button>
        <span className="modal-step">마지막 한 단계</span>
        <span className="publish-icon">
          <Share2 size={24} />
        </span>
        <h2>완성한 설문을 배포할까요?</h2>
        <p>
          로그인한 계정에 설문과 결과가 안전하게 저장돼요. 응답자는 계정 없이
          참여할 수 있어요.
        </p>
        <div className="publish-summary">
          <span>설문 제목</span>
          <strong>{title}</strong>
          <div>
            <span>
              <Check size={14} />
              공개 설문
            </span>
            <span>
              <Clock3 size={14} />
              약 2분
            </span>
          </div>
        </div>
        <div className="publish-option">
          <label htmlFor="owner-name">게시자 표시 이름</label>
          <input
            id="owner-name"
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
            placeholder="예) 경영대 학생 프로젝트팀"
            maxLength={50}
          />
          <small>실제 소속이나 팀 이름만 입력해주세요.</small>
        </div>
        <label className="listing-consent">
          <input
            type="checkbox"
            checked={listingRequested}
            onChange={(event) => setListingRequested(event.target.checked)}
          />
          <span>
            <strong>연세대학교 설문 게시판에도 올리기</strong>
            <small>
              선택한 카테고리 게시판에 설문이 바로 공개돼요.
            </small>
          </span>
        </label>
        {listingRequested && (
          <div className="board-publish-fields">
            <div className="board-school-summary">
              <School size={17} />
              <span>
                <small>게시 학교</small>
                <strong>{user ? schoolLabel(user.schoolId) : "로그인 후 학교 자동 선택"}</strong>
              </span>
            </div>
            <div className="publish-option">
              <label htmlFor="survey-category">게시판 카테고리</label>
              <select
                id="survey-category"
                value={category}
                onChange={(event) => setCategory(event.target.value as SurveyCategory)}
              >
                {surveyCategories.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>
            {!user && (
              <button className="board-login-callout" type="button" onClick={onLogin}>
                <LogIn size={16} />
                로그인하고 학교 선택하기
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        )}
        <div className="publish-instagram-callout">
          <span><InstagramGlyph size={19} /></span>
          <div>
            <strong>Instagram 앱으로 설문 카드 바로 보내기</strong>
            <small>모바일 공유창에 4:5 홍보 이미지와 참여 문구를 함께 전달해요.</small>
          </div>
          <CheckCircle2 size={16} />
        </div>
        {error && (
          <p className="publish-error" role="alert">
            {error}
          </p>
        )}
        <div className="publish-action-stack">
          <button
            type="button"
            className="modal-confirm instagram-confirm"
            onClick={() => {
              if (!user) {
                onLogin();
                return;
              }
              onConfirm(ownerName.trim() || user.name, listingRequested, category, true);
            }}
            disabled={saving}
          >
            <InstagramGlyph size={18} />
            {saving ? "설문 배포 중…" : "배포하고 Instagram 앱 열기"}
            {!saving && <ArrowRight size={17} />}
          </button>
          <button
            type="button"
            className="publish-link-only"
            onClick={() => {
              if (!user) {
                onLogin();
                return;
              }
              onConfirm(ownerName.trim() || user.name, listingRequested, category, false);
            }}
            disabled={saving}
          >
            <Link2 size={16} />
            링크로만 배포하기
          </button>
        </div>
        <span className="modal-note">
          <CheckCircle2 size={14} />
          설문 배포는 로그인 필수 · 응답 참여는 로그인 선택
        </span>
      </div>
    </div>
  );
}

async function shareSurveyCardToInstagramApp({
  title,
  surveyUrl,
}: SurveyShareCardInput) {
  try {
    const blob = await createInstagramSurveyCard({ title, surveyUrl });
    const safeTitle = (title || "바로폼-설문")
      .replace(/[\\/:*?"<>|]/g, "")
      .trim()
      .slice(0, 45);
    const file = new File([blob], `${safeTitle || "바로폼-설문"}-참여.png`, {
      type: "image/png",
    });
    const caption = [
      title,
      "로그인 없이 바로 참여할 수 있어요.",
      `설문 참여하기 ${surveyUrl}`,
      "#바로폼 #대학생설문 #설문조사",
    ].join("\n");
    const canShareFile =
      typeof navigator.share === "function" &&
      (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));

    if (canShareFile) {
      try {
        await navigator.clipboard.writeText(caption);
      } catch {
        // Some mobile browsers hand the caption to the share target directly.
      }
      await navigator.share({ files: [file], title, text: caption });
      return "Instagram 공유창에 설문 카드를 전달하고 참여 문구를 복사했어요.";
    }

    downloadResultShareFile(file);
    try {
      await navigator.clipboard.writeText(caption);
      return "설문 카드 저장과 Instagram용 문구 복사를 완료했어요.";
    } catch {
      return "Instagram용 설문 카드를 저장했어요.";
    }
  } catch (shareError) {
    if (shareError instanceof DOMException && shareError.name === "AbortError") {
      return "설문 배포는 완료됐고 Instagram 공유는 취소했어요.";
    }
    return "설문은 배포됐지만 Instagram 카드를 열지 못했어요. 아래 버튼에서 다시 시도해주세요.";
  }
}

function PublishedView({
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

function SurveyView({
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
  const [answers, setAnswers] = useState<Record<number, number | string | string[]>>(
    {},
  );
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [rewardResult, setRewardResult] = useState<{
    amount: number;
    balance: number | null;
    requiresLogin: boolean;
    ownSurvey: boolean;
  } | null>(null);
  const startedAt = useRef(0);
  const questions = survey.questions ?? [];
  const answerableQuestions = questions.filter((question) => question.type !== "section");
  const answeredCount = answerableQuestions.reduce((count, question) => {
    const answer = answers[question.id];
    const answered =
      answer !== undefined &&
      answer !== "" &&
      (!Array.isArray(answer) || answer.length > 0);
    return count + (answered ? 1 : 0);
  }, 0);
  const progressPercent = answerableQuestions.length
    ? Math.round((answeredCount / answerableQuestions.length) * 100)
    : 0;

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const toggleChoice = (questionId: number, choice: string) => {
    const current = Array.isArray(answers[questionId])
      ? (answers[questionId] as string[])
      : [];
    setAnswers({
      ...answers,
      [questionId]: current.includes(choice)
        ? current.filter((item) => item !== choice)
        : [...current, choice],
    });
  };

  const submitResponse = async () => {
    const missing = questions.find((question) => {
      if (!question.required || question.type === "section") return false;
      const answer = answers[question.id];
      return (
        answer === undefined ||
        answer === "" ||
        (Array.isArray(answer) && answer.length === 0)
      );
    });
    if (missing) {
      setError(`필수 질문 “${missing.title}”에 응답해주세요.`);
      document
        .getElementById(`question-${missing.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/surveys/${survey.slug}/responses`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          answers: questions.map((question) => ({
            questionId: question.id,
            title: question.title,
            type: question.type,
            value: answers[question.id] ?? "",
          })),
          completionSeconds: Math.round((Date.now() - startedAt.current) / 1000),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        reward?: {
          amount: number;
          balance: number | null;
          requiresLogin: boolean;
          ownSurvey: boolean;
        };
      };
      if (!response.ok) {
        throw new Error(result.error || "응답을 저장하지 못했어요.");
      }
      setRewardResult(result.reward ?? null);
      setSubmitted(true);
      if ((result.reward?.amount ?? 0) > 0) onReward();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "응답을 저장하지 못했어요.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="respondent-page submitted-page">
        <div className="submission-card">
          <span className="success-check">
            <Check size={27} />
          </span>
          <span className="eyebrow">응답 완료</span>
          <h1>소중한 의견을 보내주셔서 감사해요.</h1>
          <p>
            응답은 익명으로 안전하게 저장됐어요. 설문 게시자가 정한
            목적에 맞게 결과에 반영됩니다.
          </p>
          <div className="reward-result completion-info">
            <span className="completion-info-icon" aria-hidden="true">
              {rewardResult && rewardResult.amount > 0 ? <Coins size={20} /> : <CheckCircle2 size={19} />}
            </span>
            <span className="completion-info-copy">
              <small>{rewardResult && rewardResult.amount > 0 ? "캐시 적립 완료" : "제출 상태"}</small>
              <strong>
                {rewardResult && rewardResult.amount > 0
                  ? `+${rewardResult.amount.toLocaleString("ko-KR")}C · 총 ${(rewardResult.balance ?? 0).toLocaleString("ko-KR")}C`
                  : rewardResult?.ownSurvey
                    ? "내 설문은 캐시 적립 대상이 아니에요"
                    : "정상적으로 저장됐어요"}
              </strong>
            </span>
          </div>
          <div className="submission-actions">
            {rewardResult?.requiresLogin && (
              <button type="button" className="submission-login" onClick={onAuth}>
                다음 설문부터 로그인하고 캐시 받기
                <Coins size={16} />
              </button>
            )}
            <button type="button" className="submission-browse" onClick={onBack}>
              <span>다른 학교 설문 보기</span>
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="respondent-page">
      <div className="respondent-header">
        <button type="button" onClick={onBack} aria-label="홈으로">
          <BrandMark compact />
          <strong>바로폼</strong>
        </button>
        <span>
          {user ? <Coins size={13} /> : <Check size={13} />}
          {user ? `완료 시 +${(survey.rewardCash ?? 30).toLocaleString("ko-KR")}C` : "로그인 없이 참여 중"}
        </span>
      </div>
      <div className="respondent-progress-wrap">
        <div>
          <span>{answeredCount}/{answerableQuestions.length}문항</span>
          <strong>{progressPercent}% 완료</strong>
        </div>
        <div
          className="respondent-progress-track"
          role="progressbar"
          aria-label="설문 응답 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
      <div className="respondent-shell">
        <div className="reward-banner">
          <span className="reward-circle cash-reward-circle">
            <Coins size={19} />
          </span>
          <div>
            <small>{user ? "완료 후 바로 적립" : "로그인하면 받을 수 있어요"}</small>
            <strong>+{(survey.rewardCash ?? 30).toLocaleString("ko-KR")}C</strong>
          </div>
          {!user && (
            <button type="button" className="reward-login-button" onClick={onAuth}>
              로그인
            </button>
          )}
          <span className="reward-time">
            <Clock3 size={14} />
            약 {survey.durationMinutes}분
          </span>
        </div>

        <section className="survey-cover">
          <span className="tiny-brand">BAROFORM</span>
          <h1>{survey.title}</h1>
          <p>{survey.description}</p>
          <div className="survey-meta-pills">
            <span>익명 응답</span>
            <span>약 {survey.durationMinutes}분</span>
          </div>
        </section>

        {questions.map((question, index) => (
          <section
            className={`respond-question ${question.type === "section" ? "respond-section" : ""}`}
            id={`question-${question.id}`}
            key={question.id}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>
              {question.title}
              {question.required && <em>*</em>}
            </h2>
            {question.description && (
              <p className="respond-description">{question.description}</p>
            )}
            {question.type === "scale" && (
              <div
                className="respond-scale"
                style={{
                  gridTemplateColumns: `repeat(${(question.scaleMax ?? 5) - (question.scaleMin ?? 1) + 1}, minmax(48px, 1fr))`,
                }}
              >
                {Array.from(
                  {
                    length:
                      (question.scaleMax ?? 5) - (question.scaleMin ?? 1) + 1,
                  },
                  (_, offset) => (question.scaleMin ?? 1) + offset,
                ).map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={answers[question.id] === value ? "selected" : ""}
                    onClick={() =>
                      setAnswers({ ...answers, [question.id]: value })
                    }
                  >
                    {value}
                  </button>
                ))}
                <div>
                  <span>{question.scaleMinLabel || "전혀 그렇지 않음"}</span>
                  <span>{question.scaleMaxLabel || "매우 그러함"}</span>
                </div>
              </div>
            )}
            {(question.type === "single" ||
              question.type === "multiple") && (
              <>
                <p className="question-caption">
                  {question.type === "single"
                    ? "하나만 선택해주세요."
                    : "복수 선택이 가능해요."}
                </p>
                <div className="respond-choices">
                  {(question.options ?? []).map((choice) => {
                    const selected =
                      question.type === "single"
                        ? answers[question.id] === choice
                        : Array.isArray(answers[question.id])
                          ? (answers[question.id] as string[]).includes(choice)
                          : false;
                    return (
                      <button
                        type="button"
                        key={choice}
                        className={selected ? "selected" : ""}
                        onClick={() =>
                          question.type === "single"
                            ? setAnswers({
                                ...answers,
                                [question.id]: choice,
                              })
                            : toggleChoice(question.id, choice)
                        }
                      >
                        <span>{selected && <Check size={14} />}</span>
                        {choice}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {question.type === "dropdown" && (
              <select
                className="respond-dropdown"
                value={typeof answers[question.id] === "string" ? answers[question.id] as string : ""}
                onChange={(event) =>
                  setAnswers({ ...answers, [question.id]: event.target.value })
                }
              >
                <option value="">선택해주세요.</option>
                {(question.options ?? []).map((choice) => (
                  <option value={choice} key={choice}>{choice}</option>
                ))}
              </select>
            )}
            {(question.type === "text" || question.type === "shortText") && (
              <textarea
                rows={question.type === "text" ? 5 : 1}
                value={
                  typeof answers[question.id] === "string"
                    ? (answers[question.id] as string)
                    : ""
                }
                onChange={(event) =>
                  setAnswers({
                    ...answers,
                    [question.id]: event.target.value,
                  })
                }
                placeholder="솔직한 의견을 들려주세요."
                maxLength={question.type === "text" ? 4000 : 500}
              />
            )}
            {question.type === "date" && (
              <input
                className="respond-date-time"
                type="date"
                value={typeof answers[question.id] === "string" ? answers[question.id] as string : ""}
                onChange={(event) =>
                  setAnswers({ ...answers, [question.id]: event.target.value })
                }
              />
            )}
            {question.type === "time" && (
              <input
                className="respond-date-time"
                type="time"
                value={typeof answers[question.id] === "string" ? answers[question.id] as string : ""}
                onChange={(event) =>
                  setAnswers({ ...answers, [question.id]: event.target.value })
                }
              />
            )}
          </section>
        ))}

        {error && (
          <p className="response-error" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          className="respond-submit"
          disabled={submitting || questions.length === 0}
          onClick={submitResponse}
        >
          {submitting ? "응답 저장 중…" : "응답 제출하기"}
          {!submitting && <ArrowRight size={17} />}
        </button>
        <p className="privacy-note">
          응답 내용은 설문 결과를 위해서만 저장되며 공개 목록에 노출되지
          않아요.
        </p>
      </div>
    </main>
  );
}

/*
Kept as a visual reference while the live dashboard below uses only persisted responses.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function AnalyticsView({
  survey,
  manageToken,
  onHome,
  onCreate,
}: {
  survey: PublicSurvey | null;
  manageToken: string;
  onHome: () => void;
  onCreate: () => void;
}) {
  const [tab, setTab] = useState("한눈에 보기");
  const [responses, setResponses] = useState<StoredResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!survey?.slug || !manageToken) {
      setResponses([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/surveys/${encodeURIComponent(survey.slug)}/responses`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "x-baroform-manage-token": manageToken },
    })
      .then(async (response) => {
        const result = (await response.json()) as {
          responses?: StoredResponse[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "응답 결과를 불러오지 못했어요.");
        }
        setResponses(result.responses ?? []);
      })
      .catch((fetchError) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "응답 결과를 불러오지 못했어요.",
        );
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [manageToken, survey?.slug]);

  const questionSummaries = useMemo<QuestionSummary[]>(() => {
    const questions = survey?.questions ?? [];
    return questions
      .filter((question) => question.type !== "section")
      .map((question) => {
      const values = responses
        .map(
          (response) =>
            response.answers.find(
              (answer) => answer.questionId === question.id,
            )?.value,
        )
        .filter(
          (value): value is number | string | string[] =>
            value !== undefined &&
            value !== "" &&
            (!Array.isArray(value) || value.length > 0),
        );

      if (question.type === "scale") {
        const numbers = values.filter(
          (value): value is number => typeof value === "number",
        );
        const average =
          numbers.length > 0
            ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length
            : 0;
        return {
          id: question.id,
          title: question.title,
          type: question.type,
          responseCount: numbers.length,
          headline: numbers.length > 0 ? `${average.toFixed(1)} / 5` : "응답 대기 중",
          percentage: Math.round((average / 5) * 100),
          bars: [1, 2, 3, 4, 5].map((score) => {
            const count = numbers.filter((value) => value === score).length;
            return {
              label: `${score}점`,
              count,
              percentage:
                numbers.length > 0 ? Math.round((count / numbers.length) * 100) : 0,
            };
          }),
        };
      }

      if (question.type === "multiple") {
        const choices = values.flatMap((value) =>
          Array.isArray(value) ? value : [],
        );
        const optionCounts = (question.options ?? []).map((option) => ({
          label: option,
          count: choices.filter((choice) => choice === option).length,
          percentage:
            values.length > 0
              ? Math.round(
                  (choices.filter((choice) => choice === option).length /
                    values.length) *
                    100,
                )
              : 0,
        }));
        const top = [...optionCounts].sort((a, b) => b.count - a.count)[0];
        return {
          id: question.id,
          title: question.title,
          type: question.type,
          responseCount: values.length,
          headline:
            top && top.count > 0
              ? `${top.label} ${top.percentage}%`
              : "응답 대기 중",
          percentage: top?.percentage ?? 0,
          bars: optionCounts,
        };
      }

      return {
        id: question.id,
        title: question.title,
        type: question.type,
        responseCount: values.length,
        headline:
          values.length > 0 ? `서술형 응답 ${values.length}개` : "응답 대기 중",
        percentage: 0,
        bars: [],
      };
      });
  }, [responses, survey?.questions]);

  const averageSeconds =
    responses.length > 0
      ? Math.round(
          responses.reduce(
            (sum, response) => sum + response.completionSeconds,
            0,
          ) / responses.length,
        )
      : 0;

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}초`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder > 0 ? `${minutes}분 ${remainder}초` : `${minutes}분`;
  };

  const parseStoredDate = (value: string) => {
    const normalized = value.includes("T")
      ? value
      : `${value.replace(" ", "T")}Z`;
    return new Date(normalized);
  };

  const formatResponseDate = (value: string) => {
    const date = parseStoredDate(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const trend = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("ko-KR", { weekday: "short" });
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const count = responses.filter((response) => {
        const createdAt = parseStoredDate(response.createdAt);
        return createdAt >= date && createdAt < next;
      }).length;
      return { label: formatter.format(date), count };
    });
  }, [responses]);

  const maxTrend = Math.max(...trend.map((item) => item.count), 1);

  const copySurveyLink = async () => {
    if (!survey) return;
    const url = new URL(
      surveySharePath(survey.slug),
      window.location.origin,
    ).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("브라우저에서 링크를 복사하지 못했어요.");
    }
  };

  const downloadCsv = () => {
    if (!survey || responses.length === 0) return;
    const questions = survey.questions ?? [];
    const escapeCell = (value: unknown) => {
      const text = Array.isArray(value) ? value.join(" · ") : String(value ?? "");
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [
      ["응답 ID", "응답 시간", "소요 시간(초)", ...questions.map((q) => q.title)],
      ...responses.map((response) => [
        response.id,
        response.createdAt,
        response.completionSeconds,
        ...questions.map(
          (question) =>
            response.answers.find(
              (answer) => answer.questionId === question.id,
            )?.value ?? "",
        ),
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCell).join(",")).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${survey.title}-응답.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!survey) {
    return (
      <main className="analytics-page">
        <div className="analytics-topbar">
          <button type="button" className="brand" onClick={onHome}>
            <BrandMark />
            <strong>바로폼</strong>
          </button>
        </div>
        <div className="analytics-empty-wrap">
          <div className="analytics-empty-card">
            <span>
              <BarChart3 size={25} />
            </span>
            <h1>분석할 설문이 아직 없어요.</h1>
            <p>설문을 배포하고 응답이 들어오면 실제 결과가 여기에 표시돼요.</p>
            <button type="button" onClick={onCreate}>
              내 설문 만들기
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="analytics-page">
      <div className="analytics-topbar">
        <button type="button" className="brand" onClick={onHome}>
          <BrandMark />
          <strong>바로폼</strong>
        </button>
        <div className="analytics-survey-select">
          <span>신촌캠 학생 식당 만족도 조사</span>
          <ChevronDown size={15} />
        </div>
        <button type="button" className="share-results">
          <Share2 size={15} />
          결과 공유
        </button>
      </div>
      <div className="analytics-shell">
        <div className="analytics-heading">
          <div>
            <span className="eyebrow">RESULTS</span>
            <h1>응답에서 답을 찾았어요.</h1>
            <p>목적에 가장 가까운 결과부터 자동으로 정리했어요.</p>
          </div>
          <span className="live-state">
            <i />
            실시간 업데이트
          </span>
        </div>
        <div className="metric-grid">
          <div className="metric-card dark">
            <span>유효 응답 / 목표 응답</span>
            <strong>
              247<small>/300</small>
            </strong>
            <div className="metric-track">
              <span />
            </div>
            <p>목표까지 53개 남았어요</p>
          </div>
          <div className="metric-card">
            <span>전체 응답</span>
            <strong>253</strong>
            <p className="positive">
              <TrendingUp size={14} />
              어제보다 48개 증가
            </p>
          </div>
          <div className="metric-card">
            <span>마지막 응답</span>
            <strong className="time-metric">3분 전</strong>
            <p>오늘 14:32</p>
          </div>
          <button type="button" className="metric-card metric-action">
            <span>결과 내보내기</span>
            <strong>응답 원본 파일</strong>
            <Download size={18} />
          </button>
        </div>
        <div className="analytics-tabs" role="tablist">
          {["한눈에 보기", "문항별 결과", "응답 관리"].map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? "active" : ""}
              key={item}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === "한눈에 보기" && (
          <div className="analytics-dashboard">
            <section className="satisfaction-card">
              <div className="card-title">
                <span>가장 중요한 결과</span>
                <h2>학교생활 만족도</h2>
              </div>
              <div className="satisfaction-content">
                <div className="donut">
                  <div>
                    <strong>72%</strong>
                    <span>긍정 응답</span>
                  </div>
                </div>
                <div>
                  <strong>10명 중 7명은 현재 경험에 만족해요.</strong>
                  <p>
                    특히 2학년의 긍정 응답이 가장 높았고, 1학년은 시설
                    개선을 더 많이 요청했어요.
                  </p>
                  <div className="legend">
                    <span>
                      <i className="positive-dot" /> 긍정 72%
                    </span>
                    <span>
                      <i className="neutral-dot" /> 보통 18%
                    </span>
                    <span>
                      <i className="negative-dot" /> 부정 10%
                    </span>
                  </div>
                </div>
              </div>
            </section>
            <section className="insight-card">
              <div className="card-title horizontal">
                <div>
                  <span>AI가 찾은 핵심</span>
                  <h2>결과 요약</h2>
                </div>
                <Sparkles size={18} />
              </div>
              <ol>
                <li>
                  <span>01</span>
                  <p>
                    <strong>교우 관계</strong>가 전체 만족도를 가장 크게
                    설명하고 있어요.
                  </p>
                </li>
                <li>
                  <span>02</span>
                  <p>
                    <strong>학교 시설</strong> 개선 요구는 1학년에서 두 배
                    높았어요.
                  </p>
                </li>
                <li>
                  <span>03</span>
                  <p>
                    응답자의 63%가 <strong>야간 열람 공간</strong> 확대를
                    원해요.
                  </p>
                </li>
              </ol>
            </section>
            <section className="bar-card">
              <div className="card-title horizontal">
                <div>
                  <span>만족한 경험</span>
                  <h2>어떤 경험이 만족도를 만들었나요?</h2>
                </div>
                <button type="button">
                  문항 상세
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="horizontal-bars">
                {[
                  ["교우 관계", 78],
                  ["수업 및 학습", 67],
                  ["동아리 활동", 54],
                  ["학교 시설", 41],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <i>
                      <b style={{ width: `${value}%` }} />
                    </i>
                    <strong>{value}%</strong>
                  </div>
                ))}
              </div>
            </section>
            <section className="response-trend-card">
              <div className="card-title">
                <span>응답 추이</span>
                <h2>최근 7일</h2>
              </div>
              <div className="mini-chart">
                {[31, 47, 38, 69, 58, 82, 72].map((value, index) => (
                  <i key={index}>
                    <b style={{ height: `${value}%` }} />
                    <span>{["목", "금", "토", "일", "월", "화", "수"][index]}</span>
                  </i>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "문항별 결과" && (
          <div className="question-results-list">
            {[
              ["01", "현재 학교생활에 전반적으로 얼마나 만족하시나요?", "4.1 / 5"],
              ["02", "학교생활에서 가장 만족하는 부분은 무엇인가요?", "교우 관계 78%"],
              ["03", "가장 먼저 개선되었으면 하는 점은 무엇인가요?", "시설 개선 41%"],
            ].map(([number, question, result]) => (
              <article key={number}>
                <span>{number}</span>
                <div>
                  <h2>{question}</h2>
                  <div className="result-bar">
                    <i>
                      <b style={{ width: number === "01" ? "82%" : "68%" }} />
                    </i>
                    <strong>{result}</strong>
                  </div>
                </div>
                <ChevronRight size={18} />
              </article>
            ))}
          </div>
        )}

        {tab === "응답 관리" && (
          <div className="response-table-card">
            <div className="response-table-header">
              <div>
                <h2>개별 응답</h2>
                <p>중복·불성실 응답을 확인하고 관리할 수 있어요.</p>
              </div>
              <button type="button">
                <Download size={15} />
                CSV 내보내기
              </button>
            </div>
            <div className="response-table">
              <div className="response-row table-head">
                <span>응답 ID</span>
                <span>응답 시간</span>
                <span>소요 시간</span>
                <span>상태</span>
              </div>
              {responseRows.map((row) => (
                <div className="response-row" key={row[0]}>
                  {row.map((cell, index) => (
                    <span key={cell} className={index === 3 ? "status-cell" : ""}>
                      {cell}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
*/

type ResultShareCardInput = {
  title: string;
  responseCount: number;
  highlightQuestion: string;
  highlightResult: string;
  surveyUrl: string;
};

type SurveyShareCardInput = {
  title: string;
  surveyUrl: string;
};

function InstagramGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function drawCanvasRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const corner = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + corner, y);
  context.arcTo(x + width, y, x + width, y + height, corner);
  context.arcTo(x + width, y + height, x, y + height, corner);
  context.arcTo(x, y + height, x, y, corner);
  context.arcTo(x, y, x + width, y, corner);
  context.closePath();
}

function drawWrappedCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const characters = Array.from(text.trim());
  const lines: string[] = [];
  let line = "";

  characters.forEach((character) => {
    const nextLine = `${line}${character}`;
    if (line && context.measureText(nextLine).width > maxWidth) {
      lines.push(line.trim());
      line = character.trimStart();
    } else {
      line = nextLine;
    }
  });
  if (line) lines.push(line.trim());

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let lastLine = visibleLines[maxLines - 1] ?? "";
    while (
      lastLine &&
      context.measureText(`${lastLine}…`).width > maxWidth
    ) {
      lastLine = lastLine.slice(0, -1);
    }
    visibleLines[maxLines - 1] = `${lastLine.trimEnd()}…`;
  }

  visibleLines.forEach((visibleLine, index) => {
    context.fillText(visibleLine, x, y + index * lineHeight);
  });
  return y + visibleLines.length * lineHeight;
}

async function createInstagramSurveyCard({
  title,
  surveyUrl,
}: SurveyShareCardInput) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("설문 홍보 카드 캔버스를 만들지 못했어요.");

  const background = context.createLinearGradient(0, 0, 1080, 1350);
  background.addColorStop(0, "#f8f9ff");
  background.addColorStop(0.56, "#edf1ff");
  background.addColorStop(1, "#fff6e9");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(900, 130, 10, 900, 130, 450);
  glow.addColorStop(0, "rgba(106, 128, 220, 0.36)");
  glow.addColorStop(1, "rgba(106, 128, 220, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#20345f";
  drawCanvasRoundedRect(context, 76, 68, 76, 76, 21);
  context.fill();
  context.fillStyle = "#ffffff";
  drawCanvasRoundedRect(context, 94, 86, 19, 19, 5);
  context.fill();
  drawCanvasRoundedRect(context, 117, 109, 19, 19, 5);
  context.fill();

  context.fillStyle = "#20345f";
  context.font = '800 34px "Pretendard Variable", sans-serif';
  context.fillText("BAROFORM", 178, 119);
  context.fillStyle = "#6676b6";
  context.font = '800 21px "Pretendard Variable", sans-serif';
  context.fillText("SURVEY INVITATION", 765, 116);

  context.fillStyle = "#dfe6ff";
  drawCanvasRoundedRect(context, 76, 218, 254, 54, 27);
  context.fill();
  context.fillStyle = "#465caa";
  context.font = '800 22px "Pretendard Variable", sans-serif';
  context.fillText("지금 참여해주세요", 105, 253);

  context.fillStyle = "#182640";
  context.font = '850 70px "Pretendard Variable", sans-serif';
  const titleBottom = drawWrappedCanvasText(
    context,
    title || "우리 학교 설문",
    76,
    372,
    920,
    94,
    4,
  );

  context.fillStyle = "#68758f";
  context.font = '650 29px "Pretendard Variable", sans-serif';
  context.fillText("당신의 답이 더 좋은 캠퍼스를 만들어요.", 80, titleBottom + 55);

  context.fillStyle = "#ffffff";
  drawCanvasRoundedRect(context, 76, 790, 928, 322, 36);
  context.fill();
  context.strokeStyle = "#dce2f0";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = "#20345f";
  context.font = '850 27px "Pretendard Variable", sans-serif';
  context.fillText("로그인 없이 바로 참여", 126, 866);
  context.fillStyle = "#77839a";
  context.font = '620 23px "Pretendard Variable", sans-serif';
  context.fillText("링크를 열고 설문을 완료해주세요.", 126, 913);

  context.fillStyle = "#20345f";
  drawCanvasRoundedRect(context, 126, 968, 828, 90, 22);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = '750 24px "Pretendard Variable", sans-serif';
  const displayUrl = surveyUrl.replace(/^https?:\/\//, "");
  drawWrappedCanvasText(context, displayUrl, 164, 1022, 750, 31, 2);

  context.fillStyle = "#6d7a96";
  context.font = '650 22px "Pretendard Variable", sans-serif';
  context.fillText("바로폼에서 만든 설문 · 익명 응답", 78, 1247);
  context.fillStyle = "#20345f";
  context.font = '800 22px "Pretendard Variable", sans-serif';
  context.fillText("baroform", 875, 1247);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("설문 홍보 카드 이미지를 만들지 못했어요."));
    }, "image/png");
  });
}

async function createInstagramResultCard({
  title,
  responseCount,
  highlightQuestion,
  highlightResult,
  surveyUrl,
}: ResultShareCardInput) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("결과 카드 캔버스를 만들지 못했어요.");

  const background = context.createLinearGradient(0, 0, 1080, 1350);
  background.addColorStop(0, "#f8f8ff");
  background.addColorStop(0.52, "#e9edff");
  background.addColorStop(1, "#dce5ff");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(860, 160, 20, 860, 160, 460);
  glow.addColorStop(0, "rgba(115, 136, 226, 0.42)");
  glow.addColorStop(1, "rgba(115, 136, 226, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#273762";
  drawCanvasRoundedRect(context, 78, 70, 78, 78, 22);
  context.fill();
  context.fillStyle = "#ffffff";
  drawCanvasRoundedRect(context, 96, 88, 20, 20, 5);
  context.fill();
  drawCanvasRoundedRect(context, 119, 111, 20, 20, 5);
  context.fill();

  context.fillStyle = "#273762";
  context.font = '800 34px "Pretendard Variable", sans-serif';
  context.fillText("BAROFORM", 180, 122);
  context.fillStyle = "#5969b0";
  context.font = '800 22px "Pretendard Variable", sans-serif';
  context.fillText("RESULT CARD", 810, 119);

  context.fillStyle = "#172442";
  context.font = '850 60px "Pretendard Variable", sans-serif';
  const titleBottom = drawWrappedCanvasText(
    context,
    title || "우리 학교 설문 결과",
    82,
    252,
    900,
    78,
    2,
  );

  context.fillStyle = "#6f7b9b";
  context.font = '650 26px "Pretendard Variable", sans-serif';
  context.fillText("지금까지 모인 실제 응답", 84, titleBottom + 35);
  context.fillStyle = "#273762";
  context.font = '900 144px "Pretendard Variable", sans-serif';
  context.fillText(responseCount.toLocaleString("ko-KR"), 80, titleBottom + 190);
  const countWidth = context.measureText(
    responseCount.toLocaleString("ko-KR"),
  ).width;
  context.font = '850 48px "Pretendard Variable", sans-serif';
  context.fillText("개", 96 + countWidth, titleBottom + 187);

  const insightTop = Math.max(640, titleBottom + 255);
  context.fillStyle = "#273762";
  drawCanvasRoundedRect(context, 78, insightTop, 924, 400, 42);
  context.fill();
  context.fillStyle = "#9eaded";
  context.font = '800 23px "Pretendard Variable", sans-serif';
  context.fillText("가장 눈에 띄는 결과", 130, insightTop + 72);
  context.fillStyle = "#ffffff";
  context.font = '750 35px "Pretendard Variable", sans-serif';
  const questionBottom = drawWrappedCanvasText(
    context,
    highlightQuestion,
    130,
    insightTop + 135,
    820,
    48,
    3,
  );
  context.fillStyle = "#f2c66d";
  context.font = '900 53px "Pretendard Variable", sans-serif';
  drawWrappedCanvasText(
    context,
    highlightResult,
    130,
    questionBottom + 34,
    820,
    66,
    2,
  );

  context.fillStyle = "#5f6d8f";
  context.font = '650 24px "Pretendard Variable", sans-serif';
  context.fillText(
    `응답 ${responseCount.toLocaleString("ko-KR")}개 기준 · 개별 응답 내용은 포함하지 않았어요.`,
    82,
    1184,
  );
  context.fillStyle = "#273762";
  context.font = '800 25px "Pretendard Variable", sans-serif';
  const displayUrl = surveyUrl.replace(/^https?:\/\//, "");
  context.fillText(displayUrl, 82, 1245);
  context.fillStyle = "#8190b5";
  context.font = '600 20px "Pretendard Variable", sans-serif';
  context.fillText("이 결과는 참여 응답을 요약한 것으로 전체 학생을 대표하지 않을 수 있어요.", 82, 1295);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("결과 카드 이미지를 만들지 못했어요."));
    }, "image/png");
  });
}

function downloadResultShareFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RealAnalyticsView({
  onHome,
  title,
  slug,
  manageToken,
  authToken,
  questions,
}: {
  onHome: () => void;
  title: string;
  slug: string;
  manageToken: string;
  /** 판단 API는 세션 소유자 확인이 필요하다. 결과 조회용 manageToken과는 별개다. */
  authToken: string;
  questions: Question[];
}) {
  const [responses, setResponses] = useState<StoredResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(slug && manageToken));
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<"excel" | "word" | "csv" | null>(
    null,
  );
  const [exportError, setExportError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  // 설문 주인이 응답별로 내린 포함/제외 판단. 서버에 저장된다.
  const [decisions, setDecisions] = useState<ResponseDecisionMap>({});
  const [decisionError, setDecisionError] = useState("");

  useEffect(() => {
    if (!slug || !manageToken) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(
          `/api/surveys/${encodeURIComponent(slug)}/responses`,
          {
            cache: "no-store",
            headers: { "x-baroform-manage-token": manageToken },
          },
        );
        const result = (await response.json()) as {
          responses?: StoredResponse[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error || "결과를 불러오지 못했어요.");
        }
        if (!cancelled) setResponses(result.responses ?? []);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "결과를 불러오지 못했어요.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, manageToken]);

  useEffect(() => {
    if (!slug || !authToken) return;
    let cancelled = false;
    void fetch(`/api/surveys/${encodeURIComponent(slug)}/decisions`, {
      cache: "no-store",
      headers: { authorization: `Bearer ${authToken}` },
    })
      .then(async (response) => {
        // 설문이 바뀌면 이전 설문 판단이 남지 않도록 실패 시에도 비운다.
        if (!response.ok) {
          if (!cancelled) setDecisions({});
          return;
        }
        const result = (await response.json()) as {
          decisions?: ResponseDecisionMap;
        };
        if (!cancelled) setDecisions(result.decisions ?? {});
      })
      .catch(() => {
        if (!cancelled) setDecisions({});
      });
    return () => {
      cancelled = true;
    };
  }, [slug, authToken]);

  const resetDecisions = useCallback(() => {
    if (!slug || !authToken) return;
    const previous = decisions;
    setDecisions({});
    setDecisionError("");
    void fetch(`/api/surveys/${encodeURIComponent(slug)}/decisions`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${authToken}` },
    })
      .then((response) => {
        if (!response.ok) {
          setDecisions(previous);
          setDecisionError("되돌리지 못했어요. 잠시 후 다시 시도해주세요.");
        }
      })
      .catch(() => {
        setDecisions(previous);
        setDecisionError("되돌리지 못했어요. 연결을 확인해주세요.");
      });
  }, [authToken, decisions, slug]);

  const decideResponse = useCallback(
    (responseId: string, decision: ResponseDecision | null) => {
      if (!slug) return;
      if (!authToken) {
        setDecisionError("판단을 저장하려면 로그인이 필요해요.");
        return;
      }
      // 화면을 먼저 바꾸고 서버에 보낸다. 실패하면 이전 값으로 되돌린다.
      const previous = decisions;
      setDecisionError("");
      setDecisions((current) => {
        const next = { ...current };
        if (decision) next[responseId] = decision;
        else delete next[responseId];
        return next;
      });
      void fetch(`/api/surveys/${encodeURIComponent(slug)}/decisions`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ responseId, decision }),
      })
        .then((response) => {
          // 조용히 되돌리면 사용자에게는 '아무 일도 안 일어남'으로 보인다.
          if (!response.ok) {
            setDecisions(previous);
            setDecisionError("판단을 저장하지 못했어요. 잠시 후 다시 시도해주세요.");
          }
        })
        .catch(() => {
          setDecisions(previous);
          setDecisionError("판단을 저장하지 못했어요. 연결을 확인해주세요.");
        });
    },
    [authToken, decisions, slug],
  );

  const analysisResponses = responses.filter((response) => response.quality?.status !== "exclude");

  const questionSummaries = questions
    .filter((question) => question.type !== "section")
    .map((question) => {
    const values = analysisResponses
      .map(
        (response) =>
          response.answers.find(
            (answer) => answer.questionId === question.id,
          )?.value,
      )
      .filter((value) => value !== undefined && value !== "");

    if (question.type === "scale") {
      const numbers = values.filter(
        (value): value is number => typeof value === "number",
      );
      const average =
        numbers.length > 0
          ? numbers.reduce((total, value) => total + value, 0) / numbers.length
          : 0;
      return {
        question,
        label: numbers.length > 0 ? `평균 ${average.toFixed(1)} / 5` : "응답 없음",
        percentage: numbers.length > 0 ? (average / 5) * 100 : 0,
      };
    }

    if (question.type === "single" || question.type === "multiple") {
      const counts = new Map<string, number>();
      values.forEach((value) => {
        if (typeof value === "string") {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        } else if (Array.isArray(value)) {
          value.forEach((choice) =>
            counts.set(choice, (counts.get(choice) ?? 0) + 1),
          );
        }
      });
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        question,
        label: top ? `${top[0]} · ${top[1]}명` : "응답 없음",
        percentage:
          top && analysisResponses.length > 0 ? (top[1] / analysisResponses.length) * 100 : 0,
      };
    }

    return {
      question,
      label: values.length > 0 ? `주관식 ${values.length}개` : "응답 없음",
      percentage:
        analysisResponses.length > 0 ? (values.length / analysisResponses.length) * 100 : 0,
    };
    });

  const shareSummary = questionSummaries.find(
    (summary) => summary.label !== "응답 없음",
  );
  const shareQuestion =
    shareSummary?.question.title ?? "우리 학교의 의견을 모으고 있어요.";
  const shareResult =
    shareSummary?.label ?? `${analysisResponses.length.toLocaleString("ko-KR")}개의 응답`;
  const sharePath = slug ? surveySharePath(slug) : "/";

  const createResultShareFile = async () => {
    const surveyUrl = `${window.location.origin}${sharePath}`;
    const blob = await createInstagramResultCard({
      title: title || "우리 학교 설문 결과",
      responseCount: analysisResponses.length,
      highlightQuestion: shareQuestion,
      highlightResult: shareResult,
      surveyUrl,
    });
    const safeTitle = (title || "바로폼-설문-결과")
      .replace(/[\\/:*?"<>|]/g, "")
      .trim()
      .slice(0, 45);
    const file = new File([blob], `${safeTitle || "바로폼-설문-결과"}.png`, {
      type: "image/png",
    });
    const caption = [
      `${title || "우리 학교 설문"} 결과`,
      `품질 확인을 통과한 ${analysisResponses.length.toLocaleString("ko-KR")}개의 응답을 분석했어요.`,
      `${shareQuestion}: ${shareResult}`,
      `설문 참여하기 ${surveyUrl}`,
      "#바로폼 #대학생설문 #설문결과",
    ].join("\n");
    return { file, caption };
  };

  const shareResultToInstagram = async () => {
    if (analysisResponses.length === 0 || sharing) return;
    setSharing(true);
    setShareStatus("");
    try {
      const { file, caption } = await createResultShareFile();
      const canShareFile =
        typeof navigator.share === "function" &&
        (typeof navigator.canShare !== "function" ||
          navigator.canShare({ files: [file] }));

      if (canShareFile) {
        setShareStatus("공유 앱 목록에서 Instagram을 선택해주세요.");
        await navigator.share({
          files: [file],
          title: `${title || "바로폼 설문"} 결과`,
          text: caption,
        });
        setShareStatus("결과 카드를 공유했어요.");
      } else {
        downloadResultShareFile(file);
        try {
          await navigator.clipboard.writeText(caption);
          setShareStatus(
            "이미지를 저장하고 인스타그램용 캡션도 복사했어요.",
          );
        } catch {
          setShareStatus(
            "이미지를 저장했어요. 인스타그램에서 사진을 선택해주세요.",
          );
        }
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        setShareStatus("공유를 취소했어요.");
      } else {
        setShareStatus("결과 카드를 만들지 못했어요. 다시 시도해주세요.");
      }
    } finally {
      setSharing(false);
    }
  };

  const downloadInstagramCard = async () => {
    if (analysisResponses.length === 0 || sharing) return;
    setSharing(true);
    setShareStatus("");
    try {
      const { file, caption } = await createResultShareFile();
      downloadResultShareFile(file);
      try {
        await navigator.clipboard.writeText(caption);
        setShareStatus("카드 이미지 저장과 캡션 복사를 완료했어요.");
      } catch {
        setShareStatus("카드 이미지를 저장했어요.");
      }
    } catch {
      setShareStatus("결과 카드를 만들지 못했어요. 다시 시도해주세요.");
    } finally {
      setSharing(false);
    }
  };

  const exportResults = async (format: "excel" | "word" | "csv") => {
    if (responses.length === 0 || exporting) return;
    setExporting(format);
    setExportError("");
    // 원본 기록은 하나도 빼지 않는다. 대신 서버 판정과 사람 판단을 같이 실어
    // 파일 하나에 원본과 바꾼 결과가 모두 남게 한다.
    const payload = {
      title,
      questions,
      responses: responses.map((response) => {
        const decision = decisions[response.id] ?? null;
        const serverStatus = response.quality?.status ?? "usable";
        return {
          ...response,
          serverStatus,
          decision,
          includedInAnalysis:
            decision === "exclude"
              ? false
              : decision === "include"
                ? true
                : serverStatus !== "exclude",
        };
      }),
    };
    try {
      if (format === "excel") {
        await downloadSurveyExcel(payload);
      } else if (format === "word") {
        await downloadSurveyWord(payload);
      } else {
        downloadSurveyCsv(payload);
      }
    } catch {
      setExportError("결과 파일을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <ResultsDashboard
      title={title}
      slug={slug}
      responses={responses}
      questions={questions}
      state={
        !slug || !manageToken
          ? "missing"
          : loading
            ? "loading"
            : error
              ? "error"
              : "ready"
      }
      error={error}
      exporting={exporting}
      exportError={exportError}
      shareOpen={shareOpen}
      sharing={sharing}
      shareStatus={shareStatus}
      shareQuestion={shareQuestion}
      shareResult={shareResult}
      sharePath={sharePath}
      onHome={onHome}
      onExport={(format) => void exportResults(format)}
      onOpenShare={() => {
        setShareStatus("");
        setShareOpen(true);
      }}
      onCloseShare={() => setShareOpen(false)}
      onShareToInstagram={() => void shareResultToInstagram()}
      onDownloadShare={() => void downloadInstagramCard()}
      decisions={decisions}
      onDecide={decideResponse}
      onResetDecisions={resetDecisions}
      decisionError={decisionError}
    />
  );
}

type SurveyGenerationReadyPayload = {
  prompt: string;
  blueprint: SurveyBlueprint;
  research: SurveyResearch;
};

type SurveyGenerationClarificationPayload = {
  prompt: string;
  clarification: SurveyClarification;
  research: SurveyResearch;
};

type SurveyGenerationBackgroundPayload = {
  responseId: string;
  jobToken?: string;
};

const surveyGenerationDurationStorageKey =
  "baroform-survey-generation-duration-v1";

type SurveyGenerationDurationHistory = Partial<Record<SurveyMode, number[]>>;

function readSurveyGenerationDurationHistory(): SurveyGenerationDurationHistory {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(surveyGenerationDurationStorageKey) ?? "{}",
    ) as SurveyGenerationDurationHistory;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readSurveyGenerationDurations(surveyMode: SurveyMode) {
  const durations = readSurveyGenerationDurationHistory()[surveyMode];
  return Array.isArray(durations)
    ? durations
        .filter(
          (duration) =>
            Number.isFinite(duration) && duration >= 15 && duration <= 600,
        )
        .slice(-8)
    : [];
}

function recordSurveyGenerationDuration(
  surveyMode: SurveyMode,
  durationSeconds: number,
) {
  if (
    typeof window === "undefined" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 15 ||
    durationSeconds > 600
  ) {
    return;
  }
  const history = readSurveyGenerationDurationHistory();
  history[surveyMode] = [
    ...(Array.isArray(history[surveyMode]) ? history[surveyMode] : []),
    Math.round(durationSeconds),
  ].slice(-8);
  try {
    window.localStorage.setItem(
      surveyGenerationDurationStorageKey,
      JSON.stringify(history),
    );
  } catch {
    // 저장 공간을 사용할 수 없어도 설문 생성은 계속 진행한다.
  }
}

function waitForBackgroundPoll(signal: AbortSignal, delayMs = 2_000) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    const abort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <span className="footer-brand">
          <BrandMark compact />
          <strong>바로폼</strong>
        </span>
        <p>학교의 생각을 가장 빠르게 만나는 곳.</p>
      </div>
      <span>© 2026 BAROFORM</span>
    </footer>
  );
}

function GenerationOverlay({
  surveyMode,
  questionCount,
  attachmentCount,
  onCancel,
}: {
  surveyMode: SurveyMode;
  questionCount: number;
  attachmentCount: number;
  onCancel: () => void;
}) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recentDurations, setRecentDurations] = useState<number[]>([]);

  useEffect(() => {
    const messageTimer = window.setInterval(() => {
      setMessageIndex((current) =>
        Math.min(
          current + 1,
          surveyModeLoadingMessages[surveyMode].length - 1,
        ),
      );
    }, 8_000);
    const startedAt = Date.now();
    const elapsedTimer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1_000));
    }, 1_000);
    const historyTimer = window.setTimeout(() => {
      setRecentDurations(readSurveyGenerationDurations(surveyMode));
    }, 0);

    return () => {
      window.clearInterval(messageTimer);
      window.clearInterval(elapsedTimer);
      window.clearTimeout(historyTimer);
    };
  }, [surveyMode]);

  const phaseTitles = surveyModeLoadingMessages[surveyMode];
  const estimatedTotalSeconds = estimateSurveyGenerationSeconds({
    surveyMode,
    questionCount,
    attachmentCount,
    recentDurations,
  });
  const timing = getSurveyGenerationTiming(
    elapsedSeconds,
    estimatedTotalSeconds,
  );

  return (
    <div
      className="generation-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="survey-generation-status"
    >
      <div className="generation-card research-loading-card">
        <span className="generation-orbit">
          <Search size={24} />
        </span>
        <strong id="survey-generation-status" aria-live="polite">
          {phaseTitles[messageIndex]}
        </strong>
        <p>
          {surveyMode === "research"
            ? "연결을 오래 유지하지 않고 백그라운드에서 한 번만 생성한 뒤 완료 상태를 확인해요."
            : "입력한 내용을 바탕으로 바로 편집할 수 있는 설문을 만들고 있어요."}
        </p>
        <div
          className={`generation-time ${timing.isOverEstimate ? "overtime" : ""}`}
        >
          <span><Clock3 size={15} /> 예상 남은 시간</span>
          <output aria-live="polite">{timing.remainingLabel}</output>
        </div>
        <div className="generation-time-meta">
          경과 {formatSurveyGenerationSeconds(timing.elapsedSeconds)} ·{" "}
          {recentDurations.length > 0
            ? "최근 내 생성 기록 기준"
            : "최근 운영 소요 시간 기준"}
        </div>
        <button type="button" className="generation-cancel" onClick={onCancel}>
          생성 취소
        </button>
      </div>
    </div>
  );
}

export default function Home({
  initialSurvey = null,
}: {
  initialSurvey?: PublicSurvey | null;
} = {}) {
  const [view, setView] = useState<View>(initialSurvey ? "survey" : "landing");
  const [prompt, setPrompt] = useState("");
  const [references, setReferencesState] = useState<SurveyReferences>({
    images: [],
    files: [],
    links: [],
  });
  const [surveyMode, setSurveyMode] = useState<SurveyMode>(defaultSurveyMode);
  const [targetGrade, setTargetGrade] = useState<TargetGrade>("전학년");
  const [questionCount, setQuestionCount] = useState(7);
  const [surveyTitle, setSurveyTitle] = useState(defaultBlueprint.title);
  const [description, setDescription] = useState(
    defaultBlueprint.description,
  );
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [publicSurveys, setPublicSurveys] = useState<PublicSurvey[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(true);
  const [mySurveys, setMySurveys] = useState<OwnedSurvey[]>([]);
  const [loadingMySurveys, setLoadingMySurveys] = useState(false);
  const [mySurveysError, setMySurveysError] = useState("");
  const [activeSurvey, setActiveSurvey] = useState<PublicSurvey | null>(initialSurvey);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [clarification, setClarification] =
    useState<ClarificationState | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [wallet, setWallet] = useState<WalletData>({ balance: 0, transactions: [] });
  const analysisRequestRef = useRef(0);
  const analysisInFlightRef = useRef(false);
  const analysisAbortRef = useRef<AbortController | null>(null);
  const backgroundJobRef = useRef<{
    responseId: string;
    jobToken: string;
  } | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishAfterAuth, setPublishAfterAuth] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishedSlug, setPublishedSlug] = useState("");
  const [publishedInstagramStatus, setPublishedInstagramStatus] = useState("");
  const [manageToken, setManageToken] = useState("");
  const [publishedListingRequested, setPublishedListingRequested] =
    useState(false);
  const [toast, setToast] = useState("");
  const [workspaceSidebarOpen, setWorkspaceSidebarOpen] = useState(false);
  const [workspaceReviewToken, setWorkspaceReviewToken] = useState("");

  useEffect(() => {
    return () => {
      analysisAbortRef.current?.abort();
      analysisAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!workspaceSidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWorkspaceSidebarOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [workspaceSidebarOpen]);

  const loadSurvey = async (slug: string) => {
    const response = await fetch(`/api/surveys/${slug}`, {
      cache: "no-store",
    });
    const result = (await response.json()) as {
      survey?: PublicSurvey;
      error?: string;
    };
    if (!response.ok || !result.survey) {
      throw new Error(result.error || "공개된 설문을 찾을 수 없어요.");
    }
    setActiveSurvey(result.survey);
    setView("survey");
    window.scrollTo({ top: 0 });
  };

  const refreshPublicSurveys = useCallback(async () => {
    setLoadingSurveys(true);
    try {
      const [response, externalResponse] = await Promise.all([
        fetch("/api/surveys?school=yonsei", { cache: "no-store" }),
        fetch("/api/external-surveys?school=yonsei", { cache: "no-store" }),
      ]);
      const result = (await response.json()) as {
        surveys?: PublicSurvey[];
        error?: string;
      };
      const externalResult = (await externalResponse.json()) as { surveys?: PublicSurvey[] };
      if (!response.ok) throw new Error(result.error);
      setPublicSurveys(
        [...(result.surveys ?? []), ...(externalResponse.ok ? externalResult.surveys ?? [] : [])]
          .sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? "")),
      );
    } catch {
      setPublicSurveys([]);
    } finally {
      setLoadingSurveys(false);
    }
  }, []);

  const refreshMySurveys = useCallback(async (token: string) => {
    if (!token) {
      setMySurveys([]);
      setLoadingMySurveys(false);
      return;
    }
    setLoadingMySurveys(true);
    setMySurveysError("");
    try {
      const response = await fetch("/api/surveys?mine=true", {
        cache: "no-store",
        headers: { authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as {
        surveys?: OwnedSurvey[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "내 설문을 불러오지 못했어요.");
      }
      setMySurveys(result.surveys ?? []);
    } catch (loadError) {
      setMySurveys([]);
      setMySurveysError(
        loadError instanceof Error
          ? loadError.message
          : "내 설문을 불러오지 못했어요.",
      );
    } finally {
      setLoadingMySurveys(false);
    }
  }, []);

  const refreshWallet = useCallback(async (token: string) => {
    if (!token) {
      setWallet({ balance: 0, transactions: [] });
      return;
    }
    try {
      const response = await fetch("/api/wallet", {
        cache: "no-store",
        headers: { authorization: `Bearer ${token}` },
      });
      const result = (await response.json()) as Partial<WalletData>;
      if (!response.ok) throw new Error();
      setWallet({
        balance: Number(result.balance ?? 0),
        transactions: Array.isArray(result.transactions) ? result.transactions : [],
      });
    } catch {
      setWallet({ balance: 0, transactions: [] });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    try {
      const storedToken = window.localStorage.getItem(authTokenStorageKey) ?? "";
      if (storedToken) {
        fetch("/api/auth/session", {
          headers: { authorization: `Bearer ${storedToken}` },
          cache: "no-store",
        })
          .then(async (response) => {
            const result = (await response.json()) as { user?: AuthUser };
            if (!response.ok || !result.user) throw new Error();
            return result.user;
          })
          .then((sessionUser) => {
            if (!cancelled) {
              setAuthToken(storedToken);
              setUser(sessionUser);
            }
          })
          .catch(() => {
            window.localStorage.removeItem(authTokenStorageKey);
            if (!cancelled) setAuthToken("");
          });
      }
      const stored = window.localStorage.getItem(managedSurveyStorageKey);
      if (stored) {
        const snapshot = JSON.parse(stored) as Partial<ManagedSurveySnapshot>;
        if (
          typeof snapshot.slug === "string" &&
          /^[a-f0-9]{12}$/.test(snapshot.slug) &&
          typeof snapshot.manageToken === "string" &&
          /^[a-f0-9]{32}$/.test(snapshot.manageToken) &&
          typeof snapshot.title === "string" &&
          Array.isArray(snapshot.questions)
        ) {
          window.queueMicrotask(() => {
            if (cancelled) return;
            setPublishedSlug(snapshot.slug as string);
            setManageToken(snapshot.manageToken as string);
            setSurveyTitle((snapshot.title as string).slice(0, 100));
            setQuestions((snapshot.questions as Question[]).slice(0, 30));
          });
        }
      }
    } catch {
      window.localStorage.removeItem(managedSurveyStorageKey);
    }

    window.queueMicrotask(() => {
      if (!cancelled) void refreshPublicSurveys();
    });

    const pageParams = new URLSearchParams(window.location.search);
    const directSlug = pageParams.get("survey");
    const directWorkspaceReview = pageParams.get("workspaceReview") ?? "";
    if (initialSurvey) {
      window.queueMicrotask(() => {
        if (cancelled) return;
        setActiveSurvey(initialSurvey);
        setView("survey");
        window.scrollTo({ top: 0 });
      });
    } else if (/^[a-f0-9]{32}$/.test(directWorkspaceReview)) {
      window.queueMicrotask(() => {
        if (cancelled) return;
        setWorkspaceReviewToken(directWorkspaceReview);
        setView("workspace-review");
        window.scrollTo({ top: 0 });
      });
    } else if (directSlug) {
      fetch(`/api/surveys/${directSlug}`, { cache: "no-store" })
        .then(async (response) => {
          const result = (await response.json()) as {
            survey?: PublicSurvey;
            error?: string;
          };
          if (!response.ok || !result.survey) {
            throw new Error(result.error || "공개된 설문을 찾을 수 없어요.");
          }
          return result.survey;
        })
        .then((survey) => {
          if (!cancelled) {
            setActiveSurvey(survey);
            setView("survey");
            window.scrollTo({ top: 0 });
          }
        })
        .catch((loadError) => {
          if (!cancelled) {
            setToast(
              loadError instanceof Error
                ? loadError.message
                : "설문을 불러오지 못했어요.",
            );
            window.setTimeout(() => setToast(""), 2400);
          }
        });
    } else if (pageParams.get("app") === "1") {
      window.queueMicrotask(() => {
        if (!cancelled) setView("home");
      });
    }
    return () => {
      cancelled = true;
    };
  }, [initialSurvey, refreshPublicSurveys]);

  useEffect(() => {
    const syncEntryView = () => {
      const params = new URLSearchParams(window.location.search);
      const reviewToken = params.get("workspaceReview") ?? "";
      if (/^[a-f0-9]{32}$/.test(reviewToken)) {
        setWorkspaceReviewToken(reviewToken);
        setView("workspace-review");
        return;
      }
      if (params.get("survey")) return;
      setView(params.get("app") === "1" ? "home" : "landing");
      window.scrollTo({ top: 0 });
    };

    window.addEventListener("popstate", syncEntryView);
    return () => window.removeEventListener("popstate", syncEntryView);
  }, []);

  useEffect(() => {
    if (!authToken) return;

    const connectLatestSurvey = async () => {
      try {
        const stored = window.localStorage.getItem(managedSurveyStorageKey);
        if (stored) {
          const snapshot = JSON.parse(stored) as Partial<ManagedSurveySnapshot>;
          if (
            typeof snapshot.slug === "string" &&
            /^[a-f0-9]{12}$/.test(snapshot.slug) &&
            typeof snapshot.manageToken === "string" &&
            /^[a-f0-9]{32}$/.test(snapshot.manageToken)
          ) {
            await fetch("/api/surveys/claim", {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                slug: snapshot.slug,
                manageToken: snapshot.manageToken,
              }),
            });
          }
        }
      } catch {
        // A locally managed survey may already belong to another account.
      }
      await refreshMySurveys(authToken);
      await refreshWallet(authToken);
    };

    void connectLatestSurvey();
  }, [authToken, refreshMySurveys, refreshWallet]);

  const navigate = (nextView: View) => {
    setWorkspaceSidebarOpen(false);
    setView(nextView);
    if (nextView === "board") void refreshPublicSurveys();
    if (nextView === "mypage" && authToken) {
      void refreshMySurveys(authToken);
    }
    if (nextView !== "survey") {
      const nextUrl =
        nextView === "landing"
          ? window.location.pathname
          : `${window.location.pathname}?app=1`;
      if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        window.history.replaceState({}, "", nextUrl);
      }
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const enterSite = (destination: "home" | "create" | "board" = "home") => {
    setWorkspaceSidebarOpen(false);
    window.history.pushState(
      { baroformEntry: "app" },
      "",
      `${window.location.pathname}?app=1`,
    );
    setView(destination);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updatePrompt = (value: string) => {
    analysisRequestRef.current += 1;
    setPrompt(value);
    setClarification(null);
    setIsAnalyzing(false);
  };

  const updateReferences = (value: SurveyReferences) => {
    analysisRequestRef.current += 1;
    setReferencesState(value);
    setClarification(null);
    setIsAnalyzing(false);
  };

  const startCreate = async (promptOverride?: string) => {
    if (analysisInFlightRef.current) return;
    const enteredPrompt = (promptOverride ?? prompt).trim();
    if (!enteredPrompt && !hasSurveyReferences(references)) {
      setToast("설문 내용을 적거나 참고할 사진·파일·링크를 추가해주세요.");
      window.setTimeout(() => setToast(""), 2200);
      document.getElementById("survey-maker")?.focus();
      return;
    }
    if (enteredPrompt.length > 300) {
      setToast("설문 내용은 300자 이하로 적어주세요.");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    const requestedPrompt =
      enteredPrompt || "첨부 자료를 바탕으로 만족도와 개선점을 조사하고 싶어요.";
    const selectedSurveyMode: SurveyMode =
      surveyMode === "research" ? "research" : defaultSurveyMode;
    const clientRequestId =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const attachmentCount =
      references.images.length +
      references.files.length +
      references.links.length;
    const generationStartedAt = Date.now();
    let failureStage: SurveyGenerationFailureStage = "initial-request";

    const requestId = analysisRequestRef.current + 1;
    analysisRequestRef.current = requestId;
    analysisInFlightRef.current = true;
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    backgroundJobRef.current = null;
    setIsAnalyzing(true);
    setClarification(null);

    if (process.env.NODE_ENV !== "production") {
      console.info("survey-generation-client-request", {
        surveyMode: selectedSurveyMode,
        inputLength: requestedPrompt.length,
        attachmentCount,
        requestId: clientRequestId,
      });
    }

    try {
      const response = await fetch("/api/survey-draft", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-baroform-client-request-id": clientRequestId,
        },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: requestedPrompt,
          userInput: requestedPrompt,
          surveyMode: selectedSurveyMode,
          targetGrade,
          questionCount,
          references: {
            images: references.images.map(({ name, dataUrl }) => ({ name, dataUrl })),
            files: references.files.map(({ fileToken }) => ({ fileToken })),
            links: references.links,
          },
        }),
      });
      let result = await readSurveyGenerationResponse<
        SurveyGenerationReadyPayload,
        SurveyGenerationClarificationPayload,
        SurveyGenerationBackgroundPayload
      >(
        response,
        "AI 초안을 만들지 못했어요. 잠시 후 다시 시도해주세요.",
      );

      if (result.type === "background" && result.jobToken) {
        const backgroundJob = {
          responseId: result.responseId,
          jobToken: result.jobToken,
        };
        backgroundJobRef.current = {
          responseId: backgroundJob.responseId,
          jobToken: backgroundJob.jobToken,
        };
        failureStage = "background-poll";
        while (
          result.type === "background" &&
          (result.status === "queued" || result.status === "in_progress")
        ) {
          await waitForBackgroundPoll(controller.signal);
          const statusUrl = new URL("/api/survey-draft", window.location.origin);
          statusUrl.searchParams.set("responseId", backgroundJob.responseId);
          statusUrl.searchParams.set("jobToken", backgroundJob.jobToken);
          const statusResponse = await fetch(statusUrl, {
            method: "GET",
            signal: controller.signal,
            cache: "no-store",
          });
          result = await readSurveyGenerationResponse<
            SurveyGenerationReadyPayload,
            SurveyGenerationClarificationPayload,
            SurveyGenerationBackgroundPayload
          >(
            statusResponse,
            "정밀·연구 설문 상태를 확인하지 못했어요.",
          );
        }
        backgroundJobRef.current = null;
      }

      if (analysisRequestRef.current !== requestId) return;
      if (result.type === "error") {
        throw new JsonResponseError(
          result.error || "AI 초안을 만들지 못했어요.",
          {
            code: result.code ?? "SERVER_REQUEST_FAILED",
            status: 502,
            requestId: result.requestId,
            stage: result.stage,
            generationSource: result.generationSource,
            fallbackReason: result.fallbackReason,
            responseType: result.type,
            responseStatus: result.status,
          },
        );
      }

      if (result.type === "clarification") {
        setClarification({
          prompt: requestedPrompt,
          clarification: result.clarification,
          research: result.research,
        });
        return;
      }

      if (result.type === "background") {
        throw new JsonResponseError(
          `백그라운드 설문 생성 상태를 적용할 수 없어요: ${result.status}`,
          {
            code: "BACKGROUND_RESPONSE_UNRESOLVED",
            status: 502,
            requestId: result.requestId,
            stage: result.stage,
            generationSource: result.generationSource,
            fallbackReason: result.fallbackReason,
            responseType: result.type,
            responseStatus: result.status,
          },
        );
      }

      failureStage = "response-apply";
      recordSurveyGenerationDuration(
        selectedSurveyMode,
        Math.ceil((Date.now() - generationStartedAt) / 1_000),
      );
      setSurveyTitle(result.blueprint.title);
      setDescription(result.blueprint.description);
      setQuestions(result.blueprint.aiQuestions);
      setQuestionCount(result.blueprint.aiQuestions.length);
      if (prompt !== requestedPrompt) setPrompt(requestedPrompt);
      navigate("editor");
    } catch (analysisError) {
      if (analysisRequestRef.current !== requestId) return;
      console.error(
        "survey-generation-client-error",
        surveyGenerationErrorMetadata(
          analysisError,
          selectedSurveyMode,
          failureStage,
          clientRequestId,
        ),
      );
      setToast(surveyGenerationErrorMessage(analysisError));
      window.setTimeout(() => setToast(""), 5200);
    } finally {
      analysisInFlightRef.current = false;
      if (analysisAbortRef.current === controller) {
        analysisAbortRef.current = null;
      }
      backgroundJobRef.current = null;
      if (analysisRequestRef.current === requestId) setIsAnalyzing(false);
    }
  };

  const cancelSurveyGeneration = () => {
    if (!analysisInFlightRef.current) return;
    const backgroundJob = backgroundJobRef.current;
    analysisRequestRef.current += 1;
    analysisInFlightRef.current = false;
    backgroundJobRef.current = null;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    setIsAnalyzing(false);
    setToast("설문 생성을 취소했어요.");
    window.setTimeout(() => setToast(""), 2400);

    if (backgroundJob) {
      const statusUrl = new URL("/api/survey-draft", window.location.origin);
      statusUrl.searchParams.set("responseId", backgroundJob.responseId);
      statusUrl.searchParams.set("jobToken", backgroundJob.jobToken);
      void fetch(statusUrl, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => undefined);
    }
  };

  const openSurvey = async (survey: PublicSurvey) => {
    if (survey.source === "external" && survey.externalUrl) {
      void fetch(`/api/external-surveys/${encodeURIComponent(survey.slug)}/visit`, {
        method: "POST",
        headers: authToken ? { authorization: `Bearer ${authToken}` } : {},
      }).finally(() => void refreshPublicSurveys());
      window.open(survey.externalUrl, "_blank", "noopener,noreferrer");
      return;
    }
    setToast("설문을 불러오고 있어요.");
    try {
      await loadSurvey(survey.slug);
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}?survey=${survey.slug}`,
      );
      setToast("");
    } catch (loadError) {
      setToast(
        loadError instanceof Error
          ? loadError.message
          : "설문을 불러오지 못했어요.",
      );
      window.setTimeout(() => setToast(""), 2400);
    }
  };

  const reviseSurveyWithAi = async (instruction: string) => {
    const response = await fetch("/api/survey-revise", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: surveyTitle,
        description,
        questions,
        instruction,
        targetGrade,
      }),
    });
    const result = (await response.json()) as {
      title?: string;
      description?: string;
      questions?: Question[];
      message?: string;
      error?: string;
    };
    if (!response.ok || !result.title || !Array.isArray(result.questions)) {
      throw new Error(result.error || "AI가 설문을 수정하지 못했어요.");
    }
    setSurveyTitle(result.title);
    setDescription(result.description ?? "");
    setQuestions(result.questions);
    return result.message || "요청한 내용으로 설문을 수정했어요.";
  };

  const publishSurvey = async (
    ownerName: string,
    listingRequested: boolean,
    category: SurveyCategory,
    shareToInstagram: boolean,
  ) => {
    if (!user || !authToken) {
      setPublishAfterAuth(true);
      setPublishOpen(false);
      setAuthOpen(true);
      return;
    }
    setPublishing(true);
    setPublishError("");
    try {
      const response = await fetch("/api/surveys", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          title: surveyTitle,
          description,
          ownerName,
          questions,
          listingRequested,
          category,
          targetAudience: surveyAudienceLabel(targetGrade),
        }),
      });
      const result = (await response.json()) as {
        survey?: {
          slug: string;
          title: string;
          description: string;
          ownerName: string;
          schoolId: string;
          category: SurveyCategory;
          campus: string;
          durationMinutes: number;
          rewardCash: number;
          targetAudience: string;
          listingRequested: boolean;
          isListed: boolean;
          manageToken: string;
          createdAt: string;
          updatedAt: string;
        };
        error?: string;
      };
      if (!response.ok || !result.survey) {
        if (response.status === 401) {
          setUser(null);
          setAuthToken("");
          window.localStorage.removeItem(authTokenStorageKey);
          setAuthOpen(true);
        }
        throw new Error(result.error || "공개 링크를 만들지 못했어요.");
      }
      const savedSurvey: PublicSurvey = {
        slug: result.survey.slug,
        title: result.survey.title,
        description: result.survey.description,
        ownerName: result.survey.ownerName,
        schoolId: result.survey.schoolId,
        category: result.survey.category,
        campus: result.survey.campus,
        durationMinutes: result.survey.durationMinutes,
        rewardCash: result.survey.rewardCash ?? 30,
        targetAudience:
          result.survey.targetAudience || surveyAudienceLabel(targetGrade),
        createdAt: result.survey.createdAt,
        updatedAt: result.survey.updatedAt,
        questions,
      };
      setActiveSurvey(savedSurvey);
      setPublishedSlug(result.survey.slug);
      setManageToken(result.survey.manageToken);
      setPublishedListingRequested(result.survey.listingRequested);
      window.localStorage.setItem(
        managedSurveyStorageKey,
        JSON.stringify({
          slug: result.survey.slug,
          manageToken: result.survey.manageToken,
          title: result.survey.title,
          questions,
        } satisfies ManagedSurveySnapshot),
      );
      if (result.survey.isListed) {
        setPublicSurveys((current) => [
          savedSurvey,
          ...current.filter((survey) => survey.slug !== savedSurvey.slug),
        ]);
        void refreshPublicSurveys();
      }
      if (authToken) void refreshMySurveys(authToken);
      setPublishedInstagramStatus("");
      if (shareToInstagram) {
        const surveyUrl = new URL(
          surveySharePath(result.survey.slug),
          window.location.origin,
        ).toString();
        const shareStatus = await shareSurveyCardToInstagramApp({
          title: result.survey.title,
          surveyUrl,
        });
        setPublishedInstagramStatus(shareStatus);
      }
      setPublishOpen(false);
      navigate("published");
    } catch (saveError) {
      setPublishError(
        saveError instanceof Error
          ? saveError.message
          : "공개 링크를 만들지 못했어요.",
      );
    } finally {
      setPublishing(false);
    }
  };

  const openOwnedAnalytics = (survey: OwnedSurvey) => {
    setPublishedSlug(survey.slug);
    setManageToken(survey.manageToken);
    setSurveyTitle(survey.title);
    setDescription(survey.description);
    setQuestions(survey.questions ?? []);
    setActiveSurvey(survey);
    navigate("analytics");
  };

  const deleteOwnedSurvey = async (survey: OwnedSurvey) => {
    if (!authToken) {
      setAuthOpen(true);
      throw new Error("설문을 삭제하려면 로그인해주세요.");
    }

    const response = await fetch(`/api/surveys/${encodeURIComponent(survey.slug)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${authToken}` },
    });
    const result = (await response.json()) as {
      deletedSlug?: string;
      error?: string;
    };

    if (!response.ok || result.deletedSlug !== survey.slug) {
      if (response.status === 401) {
        setUser(null);
        setAuthToken("");
        window.localStorage.removeItem(authTokenStorageKey);
        setAuthOpen(true);
      }
      throw new Error(result.error || "설문을 삭제하지 못했어요.");
    }

    setMySurveys((current) => current.filter((item) => item.slug !== survey.slug));
    setPublicSurveys((current) => current.filter((item) => item.slug !== survey.slug));
    if (activeSurvey?.slug === survey.slug) setActiveSurvey(null);
    if (publishedSlug === survey.slug) {
      setPublishedSlug("");
      setManageToken("");
    }

    try {
      const managedSurvey = JSON.parse(
        window.localStorage.getItem(managedSurveyStorageKey) ?? "null",
      ) as ManagedSurveySnapshot | null;
      if (managedSurvey?.slug === survey.slug) {
        window.localStorage.removeItem(managedSurveyStorageKey);
      }
    } catch {
      window.localStorage.removeItem(managedSurveyStorageKey);
    }

    setToast("설문과 저장된 응답을 삭제했어요.");
    window.setTimeout(() => setToast(""), 2200);
    void refreshPublicSurveys();
  };

  const duplicateWorkspaceSurvey = (slug: string) => {
    const source = mySurveys.find((survey) => survey.slug === slug);
    if (!source || !source.questions?.length) {
      setToast("복제할 설문 문항을 불러오지 못했어요.");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    setSurveyTitle(`${source.title} 복사본`.slice(0, 100));
    setDescription(source.description);
    setQuestions(source.questions.map((question, index) => ({ ...question, id: index + 1 })));
    setQuestionCount(source.questions.length);
    navigate("editor");
    setToast("지난 설문을 복제했어요. 수정한 뒤 새 설문으로 배포할 수 있어요.");
    window.setTimeout(() => setToast(""), 2600);
  };

  const logout = () => {
    const token = authToken;
    setUser(null);
    setAuthToken("");
    setMySurveys([]);
    setMySurveysError("");
    setLoadingMySurveys(false);
    setWallet({ balance: 0, transactions: [] });
    window.localStorage.removeItem(authTokenStorageKey);
    if (token) {
      void fetch("/api/auth/session", {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
    }
    if (view === "mypage") navigate("home");
    setToast("로그아웃했어요.");
    window.setTimeout(() => setToast(""), 1800);
  };

  const workspaceSidebarVisible =
    view === "home" ||
    view === "board" ||
    view === "pulses" ||
    view === "community" ||
    view === "workspace" ||
    view === "mypage";

  return (
    <div className="app-shell student-app">
      {view === "landing" && (
        <LandingView
          onEnterSite={() => enterSite("home")}
          surveys={publicSurveys}
          loadingSurveys={loadingSurveys}
        />
      )}
      {workspaceSidebarVisible && (
        <WorkspaceSidebar
          open={workspaceSidebarOpen}
          view={view}
          user={user}
          surveys={mySurveys}
          wallet={wallet}
          onNavigate={navigate}
          onCreate={() => navigate("create")}
          onOpenSurvey={openOwnedAnalytics}
          onAuth={() => setAuthOpen(true)}
          onClose={() => setWorkspaceSidebarOpen(false)}
        />
      )}
      {(view === "home" || view === "board" || view === "pulses" || view === "community" || view === "workspace" || view === "mypage") && (
        <Header
          view={view}
          onNavigate={navigate}
          onMenu={() => setWorkspaceSidebarOpen((open) => !open)}
          user={user}
          onAuth={() => setAuthOpen(true)}
          onProfile={() => navigate("mypage")}
          cashBalance={wallet.balance}
        />
      )}
      {view === "home" && (
        <ProductHomeView
          surveys={publicSurveys}
          ownedSurveys={mySurveys}
          loadingSurveys={loadingSurveys}
          user={user}
          authToken={authToken}
          cashBalance={wallet.balance}
          onAuth={() => setAuthOpen(true)}
          onRefreshSurveys={() => void refreshPublicSurveys()}
          onCreate={(quickPrompt) => {
            if (quickPrompt) updatePrompt(quickPrompt);
            navigate("create");
          }}
          onOpenBoard={() => navigate("board")}
          onOpenSurvey={openSurvey}
          onOpenOwnedSurvey={openOwnedAnalytics}
          onOpenCommunity={() => navigate("community")}
          onOpenPulseBoard={() => navigate("pulses")}
        />
      )}
      {view === "board" && (
        <SchoolBoardView
          surveys={publicSurveys}
          loadingSurveys={loadingSurveys}
          onOpenSurvey={openSurvey}
          onCreate={() => navigate("create")}
        />
      )}
      {view === "pulses" && (
        <CampusPulseBoardView
          user={user}
          authToken={authToken}
          onAuth={() => setAuthOpen(true)}
        />
      )}
      {view === "community" && (
        <>
          <CommunityView
            user={user}
            authToken={authToken}
            onAuth={() => setAuthOpen(true)}
            onCreateSurvey={() => navigate("create")}
          />
          <Footer />
        </>
      )}
      {view === "workspace" && (
        <WorkspaceView
          user={user}
          authToken={authToken}
          ownedSurveys={mySurveys}
          onAuth={() => setAuthOpen(true)}
          onCreateSurvey={() => navigate("create")}
          onOpenSurvey={(slug) => {
            const survey = mySurveys.find((item) => item.slug === slug);
            if (survey) openOwnedAnalytics(survey);
          }}
          onDuplicateSurvey={duplicateWorkspaceSurvey}
        />
      )}
      {view === "workspace-review" && workspaceReviewToken && (
        <WorkspaceReviewView
          token={workspaceReviewToken}
          onBack={() => {
            setWorkspaceReviewToken("");
            window.history.replaceState({}, "", window.location.pathname);
            setView("landing");
            window.scrollTo({ top: 0 });
          }}
        />
      )}
      {view === "mypage" && user && (
        <MyPageView
          user={user}
          surveys={mySurveys}
          loading={loadingMySurveys}
          error={mySurveysError}
          onCreate={() => navigate("create")}
          onOpenSurvey={openSurvey}
          onOpenAnalytics={openOwnedAnalytics}
          onOpenBoard={() => navigate("board")}
          onDeleteSurvey={deleteOwnedSurvey}
          onLogout={logout}
          wallet={wallet}
        />
      )}
      {view === "create" && (
        <CreateView
          prompt={prompt}
          setPrompt={updatePrompt}
          references={references}
          setReferences={updateReferences}
          surveyMode={surveyMode}
          setSurveyMode={setSurveyMode}
          targetGrade={targetGrade}
          setTargetGrade={setTargetGrade}
          questionCount={questionCount}
          setQuestionCount={setQuestionCount}
          onCreate={() => void startCreate()}
          onBack={() => navigate("home")}
          isAnalyzing={isAnalyzing}
        />
      )}
      {view === "editor" && (
        <EditorView
          title={surveyTitle}
          setTitle={setSurveyTitle}
          description={description}
          setDescription={setDescription}
          questions={questions}
          setQuestions={setQuestions}
          onBack={() => navigate("create")}
          onPublish={() => {
            setPublishedInstagramStatus("");
            if (!user || !authToken) {
              setPublishAfterAuth(true);
              setAuthOpen(true);
              return;
            }
            setPublishOpen(true);
          }}
          targetGrade={targetGrade}
          onAiRevise={reviseSurveyWithAi}
        />
      )}
      {view === "published" && (
        <PublishedView
          title={surveyTitle}
          slug={publishedSlug}
          listingRequested={publishedListingRequested}
          onSurvey={() => navigate("survey")}
          onAnalytics={() => navigate("analytics")}
          onHome={() => navigate("home")}
          onBoard={() => navigate("board")}
          initialInstagramStatus={publishedInstagramStatus}
        />
      )}
      {view === "survey" && activeSurvey && (
        <SurveyView
          survey={activeSurvey}
          onBack={() => {
            if (initialSurvey) {
              window.location.assign("/?app=1");
              return;
            }
            navigate("home");
          }}
          user={user}
          authToken={authToken}
          onAuth={() => setAuthOpen(true)}
          onReward={() => void refreshWallet(authToken)}
        />
      )}
      {view === "analytics" && (
        <RealAnalyticsView
          onHome={() => navigate("home")}
          title={publishedSlug ? surveyTitle : ""}
          slug={publishedSlug}
          manageToken={manageToken}
          authToken={authToken}
          questions={publishedSlug ? questions : []}
        />
      )}
      {publishOpen && (
        <PublishModal
          title={surveyTitle}
          onClose={() => setPublishOpen(false)}
          onConfirm={publishSurvey}
          onLogin={() => setAuthOpen(true)}
          user={user}
          saving={publishing}
          error={publishError}
        />
      )}
      {authOpen && (
        <AuthModal
          onClose={() => {
            setAuthOpen(false);
            setPublishAfterAuth(false);
          }}
          onSuccess={(token, signedInUser) => {
            window.localStorage.setItem(authTokenStorageKey, token);
            setAuthToken(token);
            setUser(signedInUser);
            setAuthOpen(false);
            if (publishAfterAuth) {
              setPublishAfterAuth(false);
              setPublishOpen(true);
            } else if (!publishOpen && view !== "survey" && view !== "community" && view !== "workspace") {
              navigate("mypage");
            }
            setToast(`${schoolLabel(signedInUser.schoolId)} 계정으로 로그인했어요.`);
            window.setTimeout(() => setToast(""), 2200);
          }}
        />
      )}
      {isAnalyzing && (
        <GenerationOverlay
          surveyMode={surveyMode}
          questionCount={questionCount}
          attachmentCount={
            references.images.length +
            references.files.length +
            references.links.length
          }
          onCancel={cancelSurveyGeneration}
        />
      )}
      {clarification && !isAnalyzing && (
        <ClarificationModal
          state={clarification}
          onClose={() => {
            setClarification(null);
            window.setTimeout(
              () => document.getElementById("survey-maker")?.focus(),
              80,
            );
          }}
          onChoose={(option) => {
            const nextPrompt = `${clarification.prompt} — 추가 설명: ${option}`;
            setPrompt(nextPrompt);
            setClarification(null);
            void startCreate(nextPrompt);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CircleHelp size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
