import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { createSession, passwordMatches } from "@/db/auth";
import { members } from "@/db/schema";

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

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "이 사이트에서 다시 시도해주세요." }, { status: 403, headers });
  }
  try {
    const payload = (await request.json()) as { email?: unknown; password?: unknown };
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const db = await getDb();
    const [member] = await db.select().from(members).where(eq(members.email, email)).limit(1);
    if (!member || !(await passwordMatches(password, member.passwordSalt, member.passwordHash))) {
      return Response.json({ error: "이메일 또는 비밀번호가 맞지 않아요." }, { status: 401, headers });
    }
    const token = await createSession(member.id);
    return Response.json({
      token,
      user: { id: member.id, email: member.email, name: member.name, schoolId: member.schoolId },
    }, { headers });
  } catch {
    return Response.json({ error: "로그인하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503, headers });
  }
}
