/** Shapes returned by /api/workspaces. Shared by the UX data layer and any UI. */

export type WorkspaceMember = {
  id: string;
  memberId: string | null;
  name: string;
  email: string;
  role: string;
  status: string;
};

export type WorkspaceProject = {
  id: string;
  title: string;
  status: string;
  assignedMemberId: string | null;
  assignmentLabel: string;
  surveySlug: string;
  questionCount: number;
  responseCount: number;
  updatedAt: string;
};

export type WorkspaceComment = {
  id: string;
  projectId: string | null;
  content: string;
  createdAt: string;
  authorName: string;
};

export type WorkspaceVersion = {
  id: string;
  projectId: string | null;
  versionNumber: number;
  summary: string;
  createdAt: string;
  authorName: string;
};

export type CollaborationWorkspace = {
  id: string;
  name: string;
  description: string;
  type: string;
  reviewToken: string;
  ownerId: string;
  myRole: string;
  createdAt: string;
  members: WorkspaceMember[];
  projects: WorkspaceProject[];
  comments: WorkspaceComment[];
  versions: WorkspaceVersion[];
};

/** What a reviewer sees through a share token — no owner-only fields. */
export type ReviewWorkspace = {
  id: string;
  name: string;
  description: string;
  type: string;
  members: Array<{ id: string; name: string; role: string; status: string }>;
  projects: WorkspaceProject[];
  versions: WorkspaceVersion[];
};
