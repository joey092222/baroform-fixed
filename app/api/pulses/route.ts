import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { databaseErrorMessage, getDb, isDatabaseConfigured } from "@/db";
import { getSessionUser } from "@/db/auth";
import { campusPulses, campusPulseVotes } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "cache-control": "no-store, max-age=0", "x-content-type-options": "nosniff" };

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try { return origin === new URL(request.url).origin; } catch { return false; }
}

function countsFor(votes: Array<{ optionIndex: number }>, optionCount: number) {
  return Array.from({ length: optionCount }, (_, index) =>
    votes.filter((vote) => vote.optionIndex === index).length,
  );
}

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) return Response.json({ pulses: [] }, { headers: noStoreHeaders });
  try {
    const user = await getSessionUser(request);
    const requestedSchool = new URL(request.url).searchParams.get("school")?.slice(0, 30) || "yonsei";
    const schoolId = user?.schoolId ?? requestedSchool;
    const db = await getDb();
    const pulseRows = await db
      .select()
      .from(campusPulses)
      .where(and(
        eq(campusPulses.schoolId, schoolId),
        eq(campusPulses.status, "active"),
        gt(campusPulses.expiresAt, new Date().toISOString()),
      ))
      .orderBy(desc(campusPulses.createdAt))
      .limit(6);
    const ids = pulseRows.map((pulse) => pulse.id);
    const voteRows = ids.length > 0
      ? await db.select().from(campusPulseVotes).where(inArray(campusPulseVotes.pulseId, ids))
      : [];
    const pulses = pulseRows.map((pulse) => {
      const options = JSON.parse(pulse.optionsJson) as string[];
      const votes = voteRows.filter((vote) => vote.pulseId === pulse.id);
      return {
        id: pulse.id,
        question: pulse.question,
        options,
        createdAt: pulse.createdAt,
        expiresAt: pulse.expiresAt,
        totalVotes: votes.length,
        myVote: user ? votes.find((vote) => vote.memberId === user.id)?.optionIndex ?? null : null,
        overall: countsFor(votes, options.length),
      };
    });
    return Response.json({ pulses }, { headers: noStoreHeaders });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503, headers: noStoreHeaders });
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "이 사이트에서 다시 시도해주세요." }, { status: 403 });
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "캠퍼스 투표를 만들려면 로그인해주세요." }, { status: 401 });
    const payload = (await request.json()) as { question?: string; options?: string[]; expiresHours?: number };
    const question = payload.question?.replace(/\s+/g, " ").trim() ?? "";
    const options = Array.isArray(payload.options)
      ? payload.options.map((option) => option.replace(/\s+/g, " ").trim()).filter(Boolean)
      : [];
    const expiresHours = Math.round(Number(payload.expiresHours ?? 24));
    if (question.length < 5 || question.length > 120) {
      return Response.json({ error: "질문은 5~120자로 입력해주세요." }, { status: 400 });
    }
    if (options.length < 2 || options.length > 4 || new Set(options).size !== options.length || options.some((option) => option.length > 40)) {
      return Response.json({ error: "서로 다른 선택지를 2~4개 입력해주세요." }, { status: 400 });
    }
    if (expiresHours < 1 || expiresHours > 168) {
      return Response.json({ error: "투표 기간은 1시간~7일로 설정해주세요." }, { status: 400 });
    }
    const db = await getDb();
    const id = crypto.randomUUID();
    await db.insert(campusPulses).values({
      id,
      ownerId: user.id,
      schoolId: user.schoolId,
      question,
      optionsJson: JSON.stringify(options),
      expiresAt: new Date(Date.now() + expiresHours * 3_600_000).toISOString(),
    });
    return Response.json({ pulse: { id } }, { status: 201, headers: noStoreHeaders });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503, headers: noStoreHeaders });
  }
}
