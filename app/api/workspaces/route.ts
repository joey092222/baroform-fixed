import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { databaseErrorMessage, getDb, isDatabaseConfigured } from "@/db";
import { getSessionUser } from "@/db/auth";
import {
  members,
  
  surveys,
  workspaceComments,
  workspaceMembers,
  workspaceProjects,
  workspaces,
  workspaceVersions,
} from "@/db/schema";
import {
  canApproveWorkspace,
  canManageWorkspace,
  isWorkspaceProjectStatus,
  isWorkspaceRole,
  isWorkspaceType,
  normalizeWorkspaceText,
} from "@/app/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

async function publicReview(reviewToken: string) {
  const db = await getDb();
  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      type: workspaces.type,
      createdAt: workspaces.createdAt,
    })
    .from(workspaces)
    .where(eq(workspaces.reviewToken, reviewToken))
    .limit(1);
  if (!workspace) return null;

  const [memberRows, projectRows, versionRows] = await Promise.all([
    db
      .select({
        id: workspaceMembers.id,
        role: workspaceMembers.role,
        status: workspaceMembers.status,
        displayName: workspaceMembers.displayName,
        accountName: members.name,
      })
      .from(workspaceMembers)
      .leftJoin(members, eq(workspaceMembers.memberId, members.id))
      .where(eq(workspaceMembers.workspaceId, workspace.id))
      .orderBy(asc(workspaceMembers.createdAt)),
    db
      .select({
        id: workspaceProjects.id,
        title: workspaceProjects.title,
        status: workspaceProjects.status,
        assignmentLabel: workspaceProjects.assignmentLabel,
        surveySlug: surveys.slug,
        questionCount: sql<number>`json_array_length(${surveys.questionsJson}::json)`.mapWith(Number),
        responseCount: sql<number>`(
          SELECT COUNT(*)::int FROM responses
          WHERE responses.survey_id = surveys.id
        )`.mapWith(Number),
        updatedAt: workspaceProjects.updatedAt,
      })
      .from(workspaceProjects)
      .innerJoin(surveys, eq(workspaceProjects.surveyId, surveys.id))
      .where(eq(workspaceProjects.workspaceId, workspace.id))
      .orderBy(desc(workspaceProjects.updatedAt)),
    db
      .select({
        id: workspaceVersions.id,
        versionNumber: workspaceVersions.versionNumber,
        summary: workspaceVersions.summary,
        createdAt: workspaceVersions.createdAt,
        authorName: members.name,
      })
      .from(workspaceVersions)
      .innerJoin(members, eq(workspaceVersions.memberId, members.id))
      .where(eq(workspaceVersions.workspaceId, workspace.id))
      .orderBy(desc(workspaceVersions.createdAt))
      .limit(20),
  ]);

  return {
    ...workspace,
    members: memberRows.map((member) => ({
      id: member.id,
      name: member.accountName ?? (member.displayName || "초대된 팀원"),
      role: member.role,
      status: member.status,
    })),
    projects: projectRows,
    versions: versionRows,
  };
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return Response.json(
      { error: "협업 저장소를 연결하는 중이에요." },
      { status: 503, headers },
    );
  }

  try {
    const reviewToken = new URL(request.url).searchParams.get("reviewToken")?.trim() ?? "";
    if (reviewToken) {
      if (!/^[a-f0-9]{32}$/.test(reviewToken)) {
        return Response.json({ error: "검토 링크가 올바르지 않아요." }, { status: 400, headers });
      }
      const review = await publicReview(reviewToken);
      return review
        ? Response.json({ review }, { headers })
        : Response.json({ error: "검토할 워크스페이스를 찾지 못했어요." }, { status: 404, headers });
    }

    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json({ error: "협업 공간을 보려면 로그인해주세요." }, { status: 401, headers });
    }

    const db = await getDb();
    const workspaceRows = await db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        description: workspaces.description,
        type: workspaces.type,
        reviewToken: workspaces.reviewToken,
        ownerId: workspaces.ownerId,
        createdAt: workspaces.createdAt,
        myRole: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaceMembers.memberId, sessionUser.id),
          eq(workspaceMembers.status, "active"),
        ),
      )
      .orderBy(desc(workspaces.createdAt));

    const workspaceIds = workspaceRows.map((workspace) => workspace.id);
    if (workspaceIds.length === 0) {
      return Response.json({ workspaces: [] }, { headers });
    }

    const [memberRows, projectRows, commentRows, versionRows] = await Promise.all([
      db
        .select({
          id: workspaceMembers.id,
          workspaceId: workspaceMembers.workspaceId,
          memberId: workspaceMembers.memberId,
          inviteEmail: workspaceMembers.inviteEmail,
          displayName: workspaceMembers.displayName,
          role: workspaceMembers.role,
          status: workspaceMembers.status,
          accountName: members.name,
          accountEmail: members.email,
        })
        .from(workspaceMembers)
        .leftJoin(members, eq(workspaceMembers.memberId, members.id))
        .where(inArray(workspaceMembers.workspaceId, workspaceIds))
        .orderBy(asc(workspaceMembers.createdAt)),
      db
        .select({
          id: workspaceProjects.id,
          workspaceId: workspaceProjects.workspaceId,
          title: workspaceProjects.title,
          status: workspaceProjects.status,
          assignedMemberId: workspaceProjects.assignedMemberId,
          assignmentLabel: workspaceProjects.assignmentLabel,
          surveySlug: surveys.slug,
          questionCount: sql<number>`json_array_length(${surveys.questionsJson}::json)`.mapWith(Number),
          responseCount: sql<number>`(
            SELECT COUNT(*)::int FROM responses
            WHERE responses.survey_id = surveys.id
          )`.mapWith(Number),
          updatedAt: workspaceProjects.updatedAt,
        })
        .from(workspaceProjects)
        .innerJoin(surveys, eq(workspaceProjects.surveyId, surveys.id))
        .where(inArray(workspaceProjects.workspaceId, workspaceIds))
        .orderBy(desc(workspaceProjects.updatedAt)),
      db
        .select({
          id: workspaceComments.id,
          workspaceId: workspaceComments.workspaceId,
          projectId: workspaceComments.projectId,
          content: workspaceComments.content,
          createdAt: workspaceComments.createdAt,
          authorName: members.name,
        })
        .from(workspaceComments)
        .innerJoin(members, eq(workspaceComments.memberId, members.id))
        .where(inArray(workspaceComments.workspaceId, workspaceIds))
        .orderBy(desc(workspaceComments.createdAt))
        .limit(100),
      db
        .select({
          id: workspaceVersions.id,
          workspaceId: workspaceVersions.workspaceId,
          projectId: workspaceVersions.projectId,
          versionNumber: workspaceVersions.versionNumber,
          summary: workspaceVersions.summary,
          createdAt: workspaceVersions.createdAt,
          authorName: members.name,
        })
        .from(workspaceVersions)
        .innerJoin(members, eq(workspaceVersions.memberId, members.id))
        .where(inArray(workspaceVersions.workspaceId, workspaceIds))
        .orderBy(desc(workspaceVersions.createdAt))
        .limit(100),
    ]);

    return Response.json(
      {
        workspaces: workspaceRows.map((workspace) => ({
          ...workspace,
          members: memberRows
            .filter((member) => member.workspaceId === workspace.id)
            .map((member) => ({
              id: member.id,
              memberId: member.memberId,
              name:
                member.accountName ??
                (member.displayName || member.inviteEmail.split("@")[0]),
              email: member.accountEmail ?? member.inviteEmail,
              role: member.role,
              status: member.status,
            })),
          projects: projectRows.filter((project) => project.workspaceId === workspace.id),
          comments: commentRows.filter((comment) => comment.workspaceId === workspace.id),
          versions: versionRows.filter((version) => version.workspaceId === workspace.id),
        })),
      },
      { headers },
    );
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "이 사이트에서 다시 시도해주세요." }, { status: 403, headers });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 16_000) {
    return Response.json({ error: "협업 요청 내용이 너무 커요." }, { status: 413, headers });
  }

  try {
    const sessionUser = await getSessionUser(request);
    if (!sessionUser) {
      return Response.json({ error: "협업 기능을 사용하려면 로그인해주세요." }, { status: 401, headers });
    }
    const payload = (await request.json()) as Record<string, unknown>;
    const action = normalizeWorkspaceText(payload.action, 40) || "create";
    const db = await getDb();

    if (action === "create") {
      const name = normalizeWorkspaceText(payload.name, 60);
      const description = normalizeWorkspaceText(payload.description, 240);
      const type = isWorkspaceType(payload.type) ? payload.type : "team";
      if (name.length < 2) {
        return Response.json({ error: "워크스페이스 이름을 2자 이상 적어주세요." }, { status: 400, headers });
      }
      const workspaceId = crypto.randomUUID();
      await db.insert(workspaces).values({
        id: workspaceId,
        ownerId: sessionUser.id,
        schoolId: sessionUser.schoolId,
        name,
        description,
        type,
        reviewToken: crypto.randomUUID().replaceAll("-", ""),
      });
      await db.insert(workspaceMembers).values({
        id: crypto.randomUUID(),
        workspaceId,
        memberId: sessionUser.id,
        inviteEmail: sessionUser.email.toLocaleLowerCase("en-US"),
        displayName: sessionUser.name,
        role: "owner",
        status: "active",
        invitedById: sessionUser.id,
      });
      return Response.json({ ok: true, workspaceId }, { status: 201, headers });
    }

    const workspaceId = normalizeWorkspaceText(payload.workspaceId, 50);
    const [access] = await db
      .select({
        role: workspaceMembers.role,
        ownerId: workspaces.ownerId,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.memberId, sessionUser.id),
          eq(workspaceMembers.status, "active"),
        ),
      )
      .limit(1);
    if (!access) {
      return Response.json({ error: "이 협업 공간에 접근할 수 없어요." }, { status: 403, headers });
    }

    if (action === "invite") {
      if (access.role !== "owner") {
        return Response.json({ error: "관리자만 팀원을 초대할 수 있어요." }, { status: 403, headers });
      }
      const email = normalizeWorkspaceText(payload.email, 120).toLocaleLowerCase("en-US");
      const displayName = normalizeWorkspaceText(payload.displayName, 40);
      const role = payload.role === "reviewer" ? "reviewer" : "editor";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return Response.json({ error: "팀원의 이메일을 확인해주세요." }, { status: 400, headers });
      }
      const [account] = await db
        .select({ id: members.id, name: members.name })
        .from(members)
        .where(eq(members.email, email))
        .limit(1);
      const [existing] = await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.inviteEmail, email),
          ),
        )
        .limit(1);
      if (existing) {
        await db
          .update(workspaceMembers)
          .set({
            memberId: account?.id ?? null,
            displayName: account?.name ?? displayName,
            role,
            status: account ? "active" : "pending",
          })
          .where(eq(workspaceMembers.id, existing.id));
      } else {
        await db.insert(workspaceMembers).values({
          id: crypto.randomUUID(),
          workspaceId,
          memberId: account?.id ?? null,
          inviteEmail: email,
          displayName: account?.name ?? displayName,
          role,
          status: account ? "active" : "pending",
          invitedById: sessionUser.id,
        });
      }
      return Response.json({ ok: true, pending: !account }, { headers });
    }

    if (action === "linkSurvey") {
      if (!canManageWorkspace(access.role)) {
        return Response.json({ error: "편집 권한이 필요해요." }, { status: 403, headers });
      }
      const surveySlug = normalizeWorkspaceText(payload.surveySlug, 20);
      const [survey] = await db
        .select({ id: surveys.id, title: surveys.title })
        .from(surveys)
        .where(and(eq(surveys.slug, surveySlug), eq(surveys.ownerId, sessionUser.id)))
        .limit(1);
      if (!survey) {
        return Response.json({ error: "연결할 내 설문을 찾지 못했어요." }, { status: 404, headers });
      }
      const [existing] = await db
        .select({ id: workspaceProjects.id })
        .from(workspaceProjects)
        .where(
          and(
            eq(workspaceProjects.workspaceId, workspaceId),
            eq(workspaceProjects.surveyId, survey.id),
          ),
        )
        .limit(1);
      if (existing) {
        return Response.json({ error: "이미 이 워크스페이스에 연결된 설문이에요." }, { status: 409, headers });
      }
      const projectId = crypto.randomUUID();
      await db.insert(workspaceProjects).values({
        id: projectId,
        workspaceId,
        surveyId: survey.id,
        title: survey.title,
        createdById: sessionUser.id,
      });
      await db.insert(workspaceVersions).values({
        id: crypto.randomUUID(),
        workspaceId,
        projectId,
        memberId: sessionUser.id,
        versionNumber: 1,
        summary: "설문을 팀 폴더에 연결했어요.",
      });
      return Response.json({ ok: true }, { status: 201, headers });
    }

    if (action === "comment") {
      const content = normalizeWorkspaceText(payload.content, 800);
      const projectId = normalizeWorkspaceText(payload.projectId, 50) || null;
      if (content.length < 1) {
        return Response.json({ error: "댓글 내용을 적어주세요." }, { status: 400, headers });
      }
      if (projectId) {
        const [project] = await db
          .select({ id: workspaceProjects.id })
          .from(workspaceProjects)
          .where(
            and(
              eq(workspaceProjects.id, projectId),
              eq(workspaceProjects.workspaceId, workspaceId),
            ),
          )
          .limit(1);
        if (!project) {
          return Response.json({ error: "댓글을 남길 설문을 찾지 못했어요." }, { status: 404, headers });
        }
      }
      await db.insert(workspaceComments).values({
        id: crypto.randomUUID(),
        workspaceId,
        projectId,
        memberId: sessionUser.id,
        content,
      });
      return Response.json({ ok: true }, { status: 201, headers });
    }

    if (action === "assign") {
      if (!canManageWorkspace(access.role)) {
        return Response.json({ error: "편집 권한이 필요해요." }, { status: 403, headers });
      }
      const projectId = normalizeWorkspaceText(payload.projectId, 50);
      const assignedMemberId = normalizeWorkspaceText(payload.memberId, 50);
      const assignmentLabel = normalizeWorkspaceText(payload.assignmentLabel, 60) || "전체 문항";
      const [assignee] = await db
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.memberId, assignedMemberId),
            eq(workspaceMembers.status, "active"),
          ),
        )
        .limit(1);
      if (!assignee) {
        return Response.json({ error: "배정할 팀원을 선택해주세요." }, { status: 400, headers });
      }
      await db
        .update(workspaceProjects)
        .set({ assignedMemberId, assignmentLabel, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(workspaceProjects.id, projectId),
            eq(workspaceProjects.workspaceId, workspaceId),
          ),
        );
      return Response.json({ ok: true }, { headers });
    }

    if (action === "status") {
      const projectId = normalizeWorkspaceText(payload.projectId, 50);
      const status = isWorkspaceProjectStatus(payload.status) ? payload.status : "draft";
      if (status === "approved" ? !canApproveWorkspace(access.role) : !canManageWorkspace(access.role)) {
        return Response.json({ error: "이 단계를 변경할 권한이 없어요." }, { status: 403, headers });
      }
      const [project] = await db
        .select({ id: workspaceProjects.id, title: workspaceProjects.title })
        .from(workspaceProjects)
        .where(
          and(
            eq(workspaceProjects.id, projectId),
            eq(workspaceProjects.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (!project) {
        return Response.json({ error: "설문 작업을 찾지 못했어요." }, { status: 404, headers });
      }
      await db
        .update(workspaceProjects)
        .set({ status, updatedAt: new Date().toISOString() })
        .where(eq(workspaceProjects.id, projectId));
      const [latest] = await db
        .select({ value: sql<number>`COALESCE(MAX(${workspaceVersions.versionNumber}), 0)::int`.mapWith(Number) })
        .from(workspaceVersions)
        .where(eq(workspaceVersions.projectId, projectId));
      const summary =
        status === "approved"
          ? "최종 승인했어요."
          : status === "review"
            ? "팀 검토를 요청했어요."
            : "초안 작업으로 되돌렸어요.";
      await db.insert(workspaceVersions).values({
        id: crypto.randomUUID(),
        workspaceId,
        projectId,
        memberId: sessionUser.id,
        versionNumber: Number(latest?.value ?? 0) + 1,
        summary,
      });
      return Response.json({ ok: true }, { headers });
    }

    if (action === "role") {
      if (access.role !== "owner") {
        return Response.json({ error: "관리자만 역할을 바꿀 수 있어요." }, { status: 403, headers });
      }
      const workspaceMemberId = normalizeWorkspaceText(payload.workspaceMemberId, 50);
      const role = isWorkspaceRole(payload.role) && payload.role !== "owner" ? payload.role : "editor";
      const [target] = await db
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.id, workspaceMemberId),
            eq(workspaceMembers.workspaceId, workspaceId),
          ),
        )
        .limit(1);
      if (!target || target.role === "owner") {
        return Response.json({ error: "관리자 역할은 변경할 수 없어요." }, { status: 400, headers });
      }
      await db.update(workspaceMembers).set({ role }).where(eq(workspaceMembers.id, workspaceMemberId));
      return Response.json({ ok: true }, { headers });
    }

    return Response.json({ error: "지원하지 않는 협업 요청이에요." }, { status: 400, headers });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503, headers });
  }
}
