import { and, eq } from "drizzle-orm";
import { databaseErrorMessage, getDb } from "@/db";
import { getSessionUser } from "@/db/auth";
import { responseDecisions, responses, surveys } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "cache-control": "no-store, max-age=0",
  "x-content-type-options": "nosniff",
};

/** 서버 품질 판정을 사람이 덮어쓴 값. 그 외 문자열은 받지 않는다. */
const allowedDecisions = new Set(["include", "exclude"]);

type RouteContext = { params: Promise<{ slug: string }> };

function forbidden() {
  return Response.json(
    { error: "결과를 볼 권한이 없어요." },
    { status: 403, headers: noStoreHeaders },
  );
}

/**
 * 이 설문의 주인 계정인지 확인한다.
 *
 * 결과 조회(responses)는 manageToken으로 판정하지만, 판단 기록은 계정에 남는 자산이라
 * 세션 소유자 확인까지 요구한다. 설문 생성은 로그인이 필수라(app/api/surveys/route.ts에서
 * requiresLogin으로 401) 모든 설문에 ownerId가 있으므로 이 검사로 막히는 정상 사용자는 없다.
 */
async function loadOwnedSurvey(request: Request, slug: string) {
  if (!/^[a-f0-9]{12}$/.test(slug)) return null;

  const sessionUser = await getSessionUser(request);
  if (!sessionUser) return null;

  const db = await getDb();
  const [survey] = await db
    .select({ id: surveys.id, ownerId: surveys.ownerId })
    .from(surveys)
    .where(eq(surveys.slug, slug))
    .limit(1);

  if (!survey || !survey.ownerId || survey.ownerId !== sessionUser.id) {
    return null;
  }

  return { db, survey, sessionUser };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const owned = await loadOwnedSurvey(request, slug);
    if (!owned) return forbidden();

    const rows = await owned.db
      .select({
        responseId: responseDecisions.responseId,
        decision: responseDecisions.decision,
      })
      .from(responseDecisions)
      .where(eq(responseDecisions.surveyId, owned.survey.id));

    return Response.json(
      {
        decisions: Object.fromEntries(
          rows.map((row) => [row.responseId, row.decision]),
        ),
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const owned = await loadOwnedSurvey(request, slug);
    if (!owned) return forbidden();

    const payload = (await request.json()) as {
      responseId?: unknown;
      decision?: unknown;
    };
    const responseId =
      typeof payload.responseId === "string" ? payload.responseId.trim() : "";
    if (!responseId) {
      return Response.json(
        { error: "어떤 응답인지 알 수 없어요." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    // decision이 없으면 사람이 내린 판단을 지우고 서버 판정으로 되돌린다.
    const decision =
      typeof payload.decision === "string" ? payload.decision.trim() : "";
    if (decision && !allowedDecisions.has(decision)) {
      return Response.json(
        { error: "알 수 없는 판단이에요." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    // 다른 설문의 응답 id를 밀어 넣지 못하게 소속을 확인한다.
    const [target] = await owned.db
      .select({ id: responses.id })
      .from(responses)
      .where(
        and(eq(responses.id, responseId), eq(responses.surveyId, owned.survey.id)),
      )
      .limit(1);
    if (!target) {
      return Response.json(
        { error: "이 설문의 응답이 아니에요." },
        { status: 404, headers: noStoreHeaders },
      );
    }

    if (!decision) {
      await owned.db
        .delete(responseDecisions)
        .where(
          and(
            eq(responseDecisions.surveyId, owned.survey.id),
            eq(responseDecisions.responseId, responseId),
          ),
        );
      return Response.json({ responseId, decision: null }, { headers: noStoreHeaders });
    }

    await owned.db
      .insert(responseDecisions)
      .values({
        surveyId: owned.survey.id,
        responseId,
        decision,
        decidedById: owned.sessionUser.id,
      })
      .onConflictDoUpdate({
        target: [responseDecisions.surveyId, responseDecisions.responseId],
        set: { decision, decidedById: owned.sessionUser.id },
      });

    return Response.json({ responseId, decision }, { headers: noStoreHeaders });
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const owned = await loadOwnedSurvey(request, slug);
    if (!owned) return forbidden();

    await owned.db
      .delete(responseDecisions)
      .where(eq(responseDecisions.surveyId, owned.survey.id));

    return Response.json({ cleared: true }, { headers: noStoreHeaders });
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

