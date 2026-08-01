import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  createPasswordSalt,
  createSession,
  passwordHash,
} from "@/db/auth";
import { members } from "@/db/schema";
import { isSchoolId } from "@/app/survey-board";

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
    const payload = (await request.json()) as {
      email?: unknown;
      name?: unknown;
      password?: unknown;
      schoolId?: unknown;
    };
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const schoolId = typeof payload.schoolId === "string" ? payload.schoolId : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) {
      return Response.json({ error: "사용할 이메일을 정확히 입력해주세요." }, { status: 400, headers });
    }
    if (name.length < 2 || name.length > 30) {
      return Response.json({ error: "이름은 2자 이상 30자 이하로 입력해주세요." }, { status: 400, headers });
    }
    if (password.length < 8 || password.length > 100) {
      return Response.json({ error: "비밀번호는 8자 이상으로 입력해주세요." }, { status: 400, headers });
    }
    if (!isSchoolId(schoolId)) {
      return Response.json({ error: "현재 가입 가능한 학교를 선택해주세요." }, { status: 400, headers });
    }

    const db = await getDb();
    const [existing] = await db.select({ id: members.id }).from(members).where(eq(members.email, email)).limit(1);
    if (existing) {
      return Response.json({ error: "이미 가입된 이메일이에요. 로그인해주세요." }, { status: 409, headers });
    }

    const id = crypto.randomUUID();
    const salt = createPasswordSalt();
    const hash = await passwordHash(password, salt);
    await db.insert(members).values({
      id,
      email,
      name,
      schoolId,
      passwordHash: hash,
      passwordSalt: salt,
    });
    const token = await createSession(id);
    return Response.json(
      { token, user: { id, email, name, schoolId } },
      { status: 201, headers },
    );
  } catch {
    return Response.json({ error: "가입 정보를 저장하지 못했어요. 잠시 후 다시 시도해주세요." }, { status: 503, headers });
  }
}
