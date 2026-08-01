import { and, eq, isNull, or } from "drizzle-orm";
import { databaseErrorMessage, getDb } from "@/db";
import { getSessionUser } from "@/db/auth";
import { surveys } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
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

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json(
      { error: "이 사이트에서 다시 시도해주세요." },
      { status: 403, headers: noStoreHeaders },
    );
  }

  try {
    const user = await getSessionUser(request);
    if (!user) {
      return Response.json(
        { error: "로그인이 필요해요." },
        { status: 401, headers: noStoreHeaders },
      );
    }

    const payload = (await request.json()) as {
      slug?: string;
      manageToken?: string;
    };
    const slug = payload.slug?.trim() ?? "";
    const manageToken = payload.manageToken?.trim() ?? "";
    if (!/^[a-f0-9]{12}$/.test(slug) || !/^[a-f0-9]{32}$/.test(manageToken)) {
      return Response.json(
        { error: "연결할 설문 정보를 확인해주세요." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const db = await getDb();
    const updated = await db
      .update(surveys)
      .set({ ownerId: user.id })
      .where(
        and(
          eq(surveys.slug, slug),
          eq(surveys.manageToken, manageToken),
          or(isNull(surveys.ownerId), eq(surveys.ownerId, user.id)),
        ),
      )
      .returning({ slug: surveys.slug });

    if (updated.length === 0) {
      return Response.json(
        { error: "이 계정에 연결할 수 없는 설문이에요." },
        { status: 409, headers: noStoreHeaders },
      );
    }

    return Response.json({ claimed: true }, { headers: noStoreHeaders });
  } catch (error) {
    return Response.json(
      { error: databaseErrorMessage(error) },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
