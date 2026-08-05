import { and, eq, gt } from "drizzle-orm";
import { databaseErrorMessage, getDb } from "@/db";
import { getSessionUser } from "@/db/auth";
import { campusPulses, campusPulseVotes } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try { return origin === new URL(request.url).origin; } catch { return false; }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return Response.json({ error: "이 사이트에서 다시 시도해주세요." }, { status: 403 });
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "투표하려면 로그인해주세요." }, { status: 401 });
    const { id } = await context.params;
    const payload = (await request.json()) as {
      optionIndex?: number;
      grade?: string;
      department?: string;
      gender?: string;
    };
    const db = await getDb();
    const [pulse] = await db
      .select({ optionsJson: campusPulses.optionsJson })
      .from(campusPulses)
      .where(and(
        eq(campusPulses.id, id),
        eq(campusPulses.status, "active"),
        gt(campusPulses.expiresAt, new Date().toISOString()),
      ))
      .limit(1);
    const optionCount = pulse ? (JSON.parse(pulse.optionsJson) as string[]).length : 0;
    const optionIndex = Math.round(Number(payload.optionIndex));
    if (!pulse || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= optionCount) {
      return Response.json({ error: "선택 가능한 투표 항목을 골라주세요." }, { status: 400 });
    }
    const grade = ["1", "2", "3", "4", "graduate"].includes(payload.grade ?? "") ? payload.grade ?? "" : "";
    const gender = ["female", "male", "other"].includes(payload.gender ?? "") ? payload.gender ?? "" : "";
    const department = payload.department?.replace(/\s+/g, " ").trim().slice(0, 40) ?? "";
    await db.insert(campusPulseVotes).values({
      id: crypto.randomUUID(),
      pulseId: id,
      memberId: user.id,
      optionIndex,
      grade,
      department,
      gender,
    }).onConflictDoUpdate({
      target: [campusPulseVotes.pulseId, campusPulseVotes.memberId],
      set: { optionIndex, grade, department, gender, createdAt: new Date().toISOString() },
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503 });
  }
}
