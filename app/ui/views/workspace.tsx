"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  History,
  Layers,
  Link2,
  MessageCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { surveySharePath } from "../../survey-share";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  canApproveWorkspace,
  canManageWorkspace,
  workspaceRoleLabel,
  workspaceStatusLabel,
  workspaceTypeLabel,
  workspaceTypeOptions,
} from "../../workspace";
import type {
  CollaborationWorkspace,
  ReviewWorkspace,
} from "../../ux/workspace-types";
import {
  fetchWorkspaceReview,
  fetchWorkspaces,
  runWorkspaceAction,
} from "../../ux/data/workspaces";

type OwnedSurveyOption = {
  slug: string;
  title: string;
  description: string;
  questionCount?: number;
};

type WorkspaceViewProps = {
  user: { name: string; email: string } | null;
  authToken: string;
  ownedSurveys: OwnedSurveyOption[];
  onAuth: () => void;
  onCreateSurvey: () => void;
  onOpenSurvey: (slug: string) => void;
  onDuplicateSurvey: (slug: string) => void;
};

type Modal = "create" | "invite" | "survey" | null;

function formatRelativeDate(value: string) {
  const timestamp = new Date(value).getTime();
  const difference = Date.now() - timestamp;
  if (!Number.isFinite(timestamp)) return "방금";
  if (difference < 60_000) return "방금";
  if (difference < 3_600_000) return `${Math.max(1, Math.floor(difference / 60_000))}분 전`;
  if (difference < 86_400_000) return `${Math.max(1, Math.floor(difference / 3_600_000))}시간 전`;
  return new Date(value).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

function WorkspaceModal({
  title,
  eyebrow,
  children,
  onClose,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="collab-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="collab-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="collab-modal-head">
          <div>
            <span>{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="창 닫기"><X size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function WorkspaceView({
  user,
  authToken,
  ownedSurveys,
  onAuth,
  onCreateSurvey,
  onOpenSurvey,
  onDuplicateSurvey,
}: WorkspaceViewProps) {
  const [workspaces, setWorkspaces] = useState<CollaborationWorkspace[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(Boolean(authToken));
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [message, setMessage] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceDescription, setWorkspaceDescription] = useState("");
  const [workspaceType, setWorkspaceType] = useState("team");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [surveySlug, setSurveySlug] = useState("");
  const [comment, setComment] = useState("");
  const [commentProjectId, setCommentProjectId] = useState("");
  const [assignmentMembers, setAssignmentMembers] = useState<Record<string, string>>({});
  const [assignmentLabels, setAssignmentLabels] = useState<Record<string, string>>({});

  const loadWorkspaces = useCallback(async (preferredId = "") => {
    if (!authToken) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchWorkspaces(authToken);
      setWorkspaces(next);
      setSelectedId((current) => {
        const candidate = preferredId || current;
        return next.some((workspace) => workspace.id === candidate)
          ? candidate
          : next[0]?.id ?? "";
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "협업 공간을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    window.queueMicrotask(() => void loadWorkspaces());
  }, [loadWorkspaces]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedId) ?? workspaces[0] ?? null,
    [selectedId, workspaces],
  );

  const runAction = async (
    payload: Record<string, unknown>,
    successMessage: string,
    preferredId = activeWorkspace?.id ?? "",
  ) => {
    setBusy(true);
    setMessage("");
    try {
      const result = await runWorkspaceAction(authToken, payload);
      const nextId = result.workspaceId || preferredId;
      await loadWorkspaces(nextId);
      setMessage(result.pending ? "초대 대기 중이에요. 가입하면 바로 팀에 연결돼요." : successMessage);
      window.setTimeout(() => setMessage(""), 2600);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "요청을 처리하지 못했어요.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createWorkspace = async () => {
    const completed = await runAction(
      {
        action: "create",
        name: workspaceName,
        description: workspaceDescription,
        type: workspaceType,
      },
      "새 협업 공간을 만들었어요.",
      "",
    );
    if (completed) {
      setModal(null);
      setWorkspaceName("");
      setWorkspaceDescription("");
      setWorkspaceType("team");
    }
  };

  const inviteMember = async () => {
    if (!activeWorkspace) return;
    const completed = await runAction({
      action: "invite",
      workspaceId: activeWorkspace.id,
      email: inviteEmail,
      displayName: inviteName,
      role: inviteRole,
    }, "팀원을 초대했어요.");
    if (completed) {
      setModal(null);
      setInviteEmail("");
      setInviteName("");
      setInviteRole("editor");
    }
  };

  const linkSurvey = async () => {
    if (!activeWorkspace) return;
    const completed = await runAction({
      action: "linkSurvey",
      workspaceId: activeWorkspace.id,
      surveySlug,
    }, "설문을 팀 폴더에 연결했어요.");
    if (completed) {
      setModal(null);
      setSurveySlug("");
    }
  };

  const copyReviewLink = async () => {
    if (!activeWorkspace) return;
    const url = `${window.location.origin}/?workspaceReview=${activeWorkspace.reviewToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("교수·조교 검토 링크를 복사했어요.");
      window.setTimeout(() => setMessage(""), 2200);
    } catch {
      setMessage("링크를 복사하지 못했어요.");
    }
  };

  const addComment = async () => {
    if (!activeWorkspace || !comment.trim()) return;
    const completed = await runAction({
      action: "comment",
      workspaceId: activeWorkspace.id,
      projectId: commentProjectId || undefined,
      content: comment,
    }, "댓글을 남겼어요.");
    if (completed) setComment("");
  };

  if (!user || !authToken) {
    return (
      <main className="collab-page collab-login-page">
        <section className="collab-login-card">
          <span className="collab-login-icon"><UsersRound size={28} /></span>
          <div>
            <span className="eyebrow">TEAM WORKSPACE</span>
            <h1>설문을 팀과 함께 완성하세요</h1>
            <p>팀원 초대부터 공동 검토, 최종 승인과 버전 기록까지 한 공간에서 이어집니다.</p>
          </div>
          <div className="collab-login-features">
            <span><CheckCircle2 size={17} />문항별 담당 배정</span>
            <span><CheckCircle2 size={17} />댓글과 검토 요청</span>
            <span><CheckCircle2 size={17} />교수·조교 검토 링크</span>
          </div>
          <button type="button" onClick={onAuth}>로그인하고 협업 시작 <ArrowRight size={17} /></button>
        </section>
      </main>
    );
  }

  const activeMembers = activeWorkspace?.members.filter((member) => member.status === "active") ?? [];
  const approvedCount = activeWorkspace?.projects.filter((project) => project.status === "approved").length ?? 0;
  const reviewCount = activeWorkspace?.projects.filter((project) => project.status === "review").length ?? 0;

  return (
    <main className="collab-page">
      <section className="collab-hero">
        <div>
          <span className="eyebrow">TEAM WORKSPACE</span>
          <h1>같이 만들고, 한 번에 승인해요.</h1>
          <p>팀플과 수업 설문을 폴더로 모으고 역할·댓글·버전을 깔끔하게 관리하세요.</p>
        </div>
        <button type="button" className="collab-primary" onClick={() => setModal("create")}>
          <Plus size={18} />새 워크스페이스
        </button>
      </section>

      {message && <div className="collab-toast" role="status"><Check size={16} />{message}</div>}

      {loading ? (
        <section className="collab-loading"><span /><strong>협업 공간을 정리하고 있어요</strong></section>
      ) : workspaces.length === 0 ? (
        <section className="collab-empty">
          <span><Folder size={30} /></span>
          <h2>첫 팀 공간을 만들어볼까요?</h2>
          <p>수업명이나 팀명을 적고, 기존 설문을 연결하면 바로 협업을 시작할 수 있어요.</p>
          <button type="button" onClick={() => setModal("create")}><Plus size={17} />2분 만에 만들기</button>
        </section>
      ) : activeWorkspace ? (
        <div className="collab-shell">
          <aside className="collab-switcher" aria-label="워크스페이스 목록">
            <div className="collab-panel-title">
              <span>내 워크스페이스</span>
              <button type="button" onClick={() => setModal("create")} aria-label="워크스페이스 추가"><Plus size={16} /></button>
            </div>
            <div className="collab-workspace-list">
              {workspaces.map((workspace) => (
                <button
                  type="button"
                  key={workspace.id}
                  className={workspace.id === activeWorkspace.id ? "active" : ""}
                  onClick={() => setSelectedId(workspace.id)}
                >
                  <span className="collab-workspace-avatar">{workspace.name.slice(0, 1)}</span>
                  <span><strong>{workspace.name}</strong><small>{workspaceTypeLabel(workspace.type)} · {workspace.members.length}명</small></span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
            <div className="collab-help-card">
              <BookOpen size={18} />
              <strong>지난 설문 재사용</strong>
              <p>내 설문을 복제해 다음 학기 팀플을 빠르게 시작하세요.</p>
            </div>
          </aside>

          <section className="collab-board">
            <header className="collab-board-head">
              <div>
                <span className="collab-type-chip"><Layers size={14} />{workspaceTypeLabel(activeWorkspace.type)}</span>
                <h2>{activeWorkspace.name}</h2>
                <p>{activeWorkspace.description || "팀 설문과 검토 기록을 한곳에서 관리해요."}</p>
              </div>
              <div className="collab-board-actions">
                {activeWorkspace.myRole === "owner" && (
                  <button type="button" onClick={() => setModal("invite")}><UserPlus size={16} />팀원 초대</button>
                )}
                <button type="button" onClick={() => void copyReviewLink()}><Link2 size={16} />검토 링크</button>
                {canManageWorkspace(activeWorkspace.myRole) && (
                  <button type="button" className="accent" onClick={() => setModal("survey")}><Plus size={16} />설문 연결</button>
                )}
              </div>
            </header>

            <div className="collab-progress" aria-label="협업 진행 현황">
              <article><span><FileText size={17} /></span><div><small>전체 설문</small><strong>{activeWorkspace.projects.length}</strong></div></article>
              <article className="review"><span><Clock3 size={17} /></span><div><small>검토 중</small><strong>{reviewCount}</strong></div></article>
              <article className="approved"><span><ShieldCheck size={17} /></span><div><small>승인 완료</small><strong>{approvedCount}</strong></div></article>
              <div className="collab-progress-guide"><span>초안</span><i /><span>팀 검토</span><i /><span>최종 승인</span></div>
            </div>

            <div className="collab-section-head">
              <div><span>TEAM SURVEYS</span><h3>함께 만드는 설문</h3></div>
              <small>{activeWorkspace.projects.length}개의 설문</small>
            </div>

            {activeWorkspace.projects.length > 0 ? (
              <div className="collab-project-list">
                {activeWorkspace.projects.map((project) => {
                  const assignee = activeWorkspace.members.find((member) => member.memberId === project.assignedMemberId);
                  return (
                    <article className={`collab-project ${project.status}`} key={project.id}>
                      <div className="collab-project-main">
                        <div className="collab-project-topline">
                          <span className={`collab-status ${project.status}`}><i />{workspaceStatusLabel(project.status)}</span>
                          <small>{formatRelativeDate(project.updatedAt)} 업데이트</small>
                        </div>
                        <h4>{project.title}</h4>
                        <div className="collab-project-meta">
                          <span>{project.questionCount}문항</span>
                          <span>응답 {project.responseCount}개</span>
                          <span>{assignee ? `${assignee.name} · ${project.assignmentLabel}` : "담당 미배정"}</span>
                        </div>
                      </div>
                      <div className="collab-assignment">
                        <select
                          aria-label={`${project.title} 담당 팀원`}
                          value={assignmentMembers[project.id] ?? project.assignedMemberId ?? ""}
                          onChange={(event) => setAssignmentMembers((current) => ({ ...current, [project.id]: event.target.value }))}
                        >
                          <option value="">담당 팀원</option>
                          {activeMembers.filter((member) => member.memberId).map((member) => <option key={member.id} value={member.memberId ?? ""}>{member.name}</option>)}
                        </select>
                        <input
                          aria-label={`${project.title} 담당 문항`}
                          placeholder="예: 1~5번 문항"
                          value={assignmentLabels[project.id] ?? project.assignmentLabel}
                          onChange={(event) => setAssignmentLabels((current) => ({ ...current, [project.id]: event.target.value }))}
                        />
                        <button
                          type="button"
                          disabled={busy || !canManageWorkspace(activeWorkspace.myRole)}
                          onClick={() => void runAction({
                            action: "assign",
                            workspaceId: activeWorkspace.id,
                            projectId: project.id,
                            memberId: assignmentMembers[project.id] ?? project.assignedMemberId,
                            assignmentLabel: assignmentLabels[project.id] ?? project.assignmentLabel,
                          }, "담당 문항을 배정했어요.")}
                        >배정</button>
                      </div>
                      <div className="collab-project-actions">
                        <button type="button" onClick={() => onOpenSurvey(project.surveySlug)}><ExternalLink size={15} />열기</button>
                        <button type="button" onClick={() => onDuplicateSurvey(project.surveySlug)}><RotateCcw size={15} />복제</button>
                        {project.status === "draft" && canManageWorkspace(activeWorkspace.myRole) && (
                          <button type="button" className="review-action" disabled={busy} onClick={() => void runAction({ action: "status", workspaceId: activeWorkspace.id, projectId: project.id, status: "review" }, "팀 검토를 요청했어요.")}>
                            검토 요청 <ArrowRight size={15} />
                          </button>
                        )}
                        {project.status === "review" && canApproveWorkspace(activeWorkspace.myRole) && (
                          <button type="button" className="approve-action" disabled={busy} onClick={() => void runAction({ action: "status", workspaceId: activeWorkspace.id, projectId: project.id, status: "approved" }, "최종 승인했어요.")}>
                            <Check size={15} />승인
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="collab-project-empty">
                <span><FileText size={23} /></span>
                <div><strong>아직 연결된 설문이 없어요</strong><p>내 설문을 연결하거나, 새 설문을 만든 뒤 팀 폴더에 추가하세요.</p></div>
                <button type="button" onClick={() => ownedSurveys.length > 0 ? setModal("survey") : onCreateSurvey()}>{ownedSurveys.length > 0 ? "내 설문 연결" : "새 설문 만들기"}<ArrowRight size={16} /></button>
              </div>
            )}
          </section>

          <aside className="collab-rail">
            <section className="collab-rail-section">
              <div className="collab-panel-title"><span>팀원</span><small>{activeWorkspace.members.length}명</small></div>
              <div className="collab-member-list">
                {activeWorkspace.members.map((member) => (
                  <div key={member.id}>
                    <span className="collab-member-avatar">{member.name.slice(0, 1)}</span>
                    <span><strong>{member.name}</strong><small>{member.status === "pending" ? "초대 대기" : member.email}</small></span>
                    {activeWorkspace.myRole === "owner" && member.role !== "owner" ? (
                      <select
                        value={member.role}
                        aria-label={`${member.name} 역할`}
                        onChange={(event) => void runAction({ action: "role", workspaceId: activeWorkspace.id, workspaceMemberId: member.id, role: event.target.value }, "역할을 변경했어요.")}
                      >
                        <option value="editor">편집자</option>
                        <option value="reviewer">검토자</option>
                      </select>
                    ) : <em>{workspaceRoleLabel(member.role)}</em>}
                  </div>
                ))}
              </div>
            </section>

            <section className="collab-rail-section collab-comments">
              <div className="collab-panel-title"><span>문항 댓글</span><MessageCircle size={15} /></div>
              <div className="collab-comment-list">
                {activeWorkspace.comments.slice(0, 4).map((item) => (
                  <article key={item.id}>
                    <div><strong>{item.authorName}</strong><small>{formatRelativeDate(item.createdAt)}</small></div>
                    <p>{item.content}</p>
                  </article>
                ))}
                {activeWorkspace.comments.length === 0 && <p className="collab-rail-empty">첫 의견을 남겨 팀 검토를 시작하세요.</p>}
              </div>
              <div className="collab-comment-compose">
                <select value={commentProjectId} onChange={(event) => setCommentProjectId(event.target.value)} aria-label="댓글을 남길 설문">
                  <option value="">워크스페이스 전체</option>
                  {activeWorkspace.projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select>
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="수정 의견이나 확인할 점을 적어주세요" maxLength={800} />
                <button type="button" disabled={busy || !comment.trim()} onClick={() => void addComment()}>댓글 남기기</button>
              </div>
            </section>

            <section className="collab-rail-section collab-history">
              <div className="collab-panel-title"><span>버전 기록</span><History size={15} /></div>
              {activeWorkspace.versions.slice(0, 4).map((version) => (
                <div key={version.id}><span>v{version.versionNumber}</span><p><strong>{version.summary}</strong><small>{version.authorName} · {formatRelativeDate(version.createdAt)}</small></p></div>
              ))}
              {activeWorkspace.versions.length === 0 && <p className="collab-rail-empty">설문을 연결하면 버전이 자동으로 기록돼요.</p>}
            </section>
          </aside>
        </div>
      ) : null}

      {modal === "create" && (
        <WorkspaceModal eyebrow="NEW WORKSPACE" title="새 협업 공간 만들기" onClose={() => setModal(null)}>
          <div className="collab-modal-body">
            <label><span>공간 유형</span><div className="collab-type-options">{workspaceTypeOptions.map((option) => <button type="button" key={option.id} className={workspaceType === option.id ? "active" : ""} onClick={() => setWorkspaceType(option.id)}>{option.id === "course" ? <BookOpen size={16} /> : option.id === "team" ? <UsersRound size={16} /> : <Folder size={16} />}{option.label}</button>)}</div></label>
            <label><span>이름</span><input autoFocus value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="예) 소비자행동론 3조" maxLength={60} /></label>
            <label><span>간단한 설명 <small>선택</small></span><textarea value={workspaceDescription} onChange={(event) => setWorkspaceDescription(event.target.value)} placeholder="이번 팀 프로젝트의 목표를 적어주세요" maxLength={240} /></label>
            <button type="button" className="collab-modal-submit" disabled={busy || workspaceName.trim().length < 2} onClick={() => void createWorkspace()}>워크스페이스 만들기 <ArrowRight size={17} /></button>
          </div>
        </WorkspaceModal>
      )}

      {modal === "invite" && activeWorkspace && (
        <WorkspaceModal eyebrow="INVITE MEMBER" title="팀원 초대하기" onClose={() => setModal(null)}>
          <div className="collab-modal-body">
            <div className="collab-invite-note"><UserPlus size={19} /><p><strong>가입된 팀원은 바로 연결돼요.</strong><span>아직 가입하지 않았다면 이메일이 초대 대기 목록에 저장됩니다.</span></p></div>
            <label><span>이메일</span><input autoFocus type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@yonsei.ac.kr" /></label>
            <label><span>이름 <small>선택</small></span><input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="팀원이 알아보기 쉬운 이름" /></label>
            <label><span>역할</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="editor">편집자 · 설문 연결, 담당 배정</option><option value="reviewer">검토자 · 최종 승인</option></select></label>
            <button type="button" className="collab-modal-submit" disabled={busy || !inviteEmail.includes("@")} onClick={() => void inviteMember()}>초대 보내기 <ArrowRight size={17} /></button>
          </div>
        </WorkspaceModal>
      )}

      {modal === "survey" && activeWorkspace && (
        <WorkspaceModal eyebrow="ADD SURVEY" title="내 설문 연결하기" onClose={() => setModal(null)}>
          <div className="collab-modal-body">
            {ownedSurveys.length > 0 ? (
              <>
                <label><span>연결할 설문</span><select autoFocus value={surveySlug} onChange={(event) => setSurveySlug(event.target.value)}><option value="">설문을 선택하세요</option>{ownedSurveys.map((survey) => <option key={survey.slug} value={survey.slug}>{survey.title}</option>)}</select></label>
                <div className="collab-survey-reuse"><Copy size={18} /><p><strong>지난 설문을 다시 쓰고 싶나요?</strong><span>연결 후 ‘복제’를 누르면 문항을 그대로 가져와 새 설문으로 편집할 수 있어요.</span></p></div>
                <button type="button" className="collab-modal-submit" disabled={busy || !surveySlug} onClick={() => void linkSurvey()}>팀 폴더에 연결 <ArrowRight size={17} /></button>
              </>
            ) : (
              <div className="collab-modal-empty"><FileText size={25} /><strong>먼저 설문을 하나 만들어주세요</strong><p>설문을 만든 뒤 이 공간에 연결하면 협업 기능을 사용할 수 있어요.</p><button type="button" onClick={onCreateSurvey}>새 설문 만들기</button></div>
            )}
          </div>
        </WorkspaceModal>
      )}
    </main>
  );
}

export function WorkspaceReviewView({ token, onBack }: { token: string; onBack: () => void }) {
  const [review, setReview] = useState<ReviewWorkspace | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchWorkspaceReview(token)
      .then((result) => { if (!cancelled) setReview(result); })
      .catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "검토 공간을 불러오지 못했어요."); });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <main className="collab-review-page">
      <header className="collab-review-nav">
        <button type="button" onClick={onBack}><ArrowLeft size={17} />바로폼으로</button>
        <span><span className="brand-mark compact" aria-hidden><span /><span /></span><strong>바로폼 검토</strong></span>
      </header>
      {error ? (
        <section className="collab-review-state"><X size={24} /><h1>검토 링크를 열지 못했어요</h1><p>{error}</p></section>
      ) : !review ? (
        <section className="collab-review-state"><span className="collab-review-spinner" /><h1>검토 자료를 준비하고 있어요</h1></section>
      ) : (
        <div className="collab-review-wrap">
          <section className="collab-review-hero">
            <span className="collab-type-chip"><BookOpen size={14} />{workspaceTypeLabel(review.type)}</span>
            <h1>{review.name}</h1>
            <p>{review.description || "팀이 함께 준비한 설문과 검토 상태입니다."}</p>
            <div><span><UsersRound size={16} />참여 팀원 {review.members.filter((member) => member.status === "active").length}명</span><span><FileText size={16} />설문 {review.projects.length}개</span><span><ShieldCheck size={16} />승인 {review.projects.filter((project) => project.status === "approved").length}개</span></div>
          </section>
          <section className="collab-review-content">
            <div className="collab-review-projects">
              <div className="collab-section-head"><div><span>REVIEW LIST</span><h2>검토할 설문</h2></div></div>
              {review.projects.map((project) => (
                <article key={project.id}>
                  <div><span className={`collab-status ${project.status}`}><i />{workspaceStatusLabel(project.status)}</span><h3>{project.title}</h3><p>{project.questionCount}문항 · 응답 {project.responseCount}개 · {project.assignmentLabel}</p></div>
                  <a href={surveySharePath(project.surveySlug)} target="_blank" rel="noreferrer">설문 보기 <ExternalLink size={15} /></a>
                </article>
              ))}
              {review.projects.length === 0 && <div className="collab-review-empty">아직 검토할 설문이 연결되지 않았어요.</div>}
            </div>
            <aside className="collab-review-history">
              <div className="collab-panel-title"><span>최근 버전</span><History size={15} /></div>
              {review.versions.slice(0, 8).map((version) => <div key={version.id}><span>v{version.versionNumber}</span><p><strong>{version.summary}</strong><small>{version.authorName} · {formatRelativeDate(version.createdAt)}</small></p></div>)}
              {review.versions.length === 0 && <p>아직 버전 기록이 없어요.</p>}
            </aside>
          </section>
        </div>
      )}
    </main>
  );
}
