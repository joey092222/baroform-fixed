export const workspaceTypeOptions = [
  { id: "team", label: "팀 프로젝트" },
  { id: "course", label: "수업 폴더" },
  { id: "department", label: "학과 워크스페이스" },
  { id: "club", label: "동아리 워크스페이스" },
] as const;

export type WorkspaceType = (typeof workspaceTypeOptions)[number]["id"];
export type WorkspaceRole = "owner" | "editor" | "reviewer";
export type WorkspaceProjectStatus = "draft" | "review" | "approved";

export function isWorkspaceType(value: unknown): value is WorkspaceType {
  return workspaceTypeOptions.some((option) => option.id === value);
}

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return value === "owner" || value === "editor" || value === "reviewer";
}

export function isWorkspaceProjectStatus(
  value: unknown,
): value is WorkspaceProjectStatus {
  return value === "draft" || value === "review" || value === "approved";
}

export function workspaceTypeLabel(type: string) {
  return workspaceTypeOptions.find((option) => option.id === type)?.label ?? "팀 프로젝트";
}

export function workspaceRoleLabel(role: string) {
  if (role === "owner") return "관리자";
  if (role === "reviewer") return "검토자";
  return "편집자";
}

export function workspaceStatusLabel(status: string) {
  if (status === "approved") return "승인 완료";
  if (status === "review") return "검토 중";
  return "초안 작업";
}

export function canManageWorkspace(role: string) {
  return role === "owner" || role === "editor";
}

export function canApproveWorkspace(role: string) {
  return role === "owner" || role === "reviewer";
}

export function normalizeWorkspaceText(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maximum)
    : "";
}
