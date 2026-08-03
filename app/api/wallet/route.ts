import { desc, eq, sql } from "drizzle-orm";
import { databaseErrorMessage, getDb } from "@/db";
import { getSessionUser } from "@/db/auth";
import { cashTransactions } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "cache-control": "no-store, max-age=0", "x-content-type-options": "nosniff" };

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ error: "캐시를 보려면 로그인해주세요." }, { status: 401, headers });
    const db = await getDb();
    const [summary] = await db
      .select({ balance: sql<number>`COALESCE(SUM(${cashTransactions.amount}), 0)::int`.mapWith(Number) })
      .from(cashTransactions)
      .where(eq(cashTransactions.memberId, user.id));
    const transactions = await db
      .select({
        id: cashTransactions.id,
        amount: cashTransactions.amount,
        description: cashTransactions.description,
        createdAt: cashTransactions.createdAt,
      })
      .from(cashTransactions)
      .where(eq(cashTransactions.memberId, user.id))
      .orderBy(desc(cashTransactions.createdAt))
      .limit(30);
    return Response.json({ balance: Number(summary?.balance ?? 0), transactions }, { headers });
  } catch (error) {
    return Response.json({ error: databaseErrorMessage(error) }, { status: 503, headers });
  }
}
