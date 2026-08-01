import {
  createHash,
  pbkdf2 as pbkdf2Callback,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from ".";
import { authSessions, members } from "./schema";

const pbkdf2 = promisify(pbkdf2Callback);
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  schoolId: string;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function passwordHash(password: string, salt: string) {
  const derived = await pbkdf2(password, salt, 120_000, 32, "sha256");
  return Buffer.from(derived).toString("hex");
}

export function createPasswordSalt() {
  return randomBytes(18).toString("hex");
}

export async function passwordMatches(
  password: string,
  salt: string,
  expectedHash: string,
) {
  const actual = Buffer.from(await passwordHash(password, salt), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(memberId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + sessionLifetimeMs).toISOString();
  const db = await getDb();
  await db.insert(authSessions).values({
    tokenHash: tokenHash(token),
    memberId,
    expiresAt,
  });
  return token;
}

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+([a-f0-9]{64})$/i);
  return match?.[1] ?? "";
}

export async function getSessionUser(request: Request): Promise<AuthUser | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const db = await getDb();
  const [row] = await db
    .select({
      id: members.id,
      email: members.email,
      name: members.name,
      schoolId: members.schoolId,
    })
    .from(authSessions)
    .innerJoin(members, eq(authSessions.memberId, members.id))
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash(token)),
        gt(authSessions.expiresAt, new Date().toISOString()),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function deleteSession(request: Request) {
  const token = bearerToken(request);
  if (!token) return;
  const db = await getDb();
  await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash(token)));
}
