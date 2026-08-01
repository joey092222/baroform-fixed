import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseEnvironmentKeys = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "NEON_DATABASE_URL",
] as const;

function readDatabaseUrl() {
  for (const key of databaseEnvironmentKeys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function createDatabase(url: string) {
  return drizzle(url, { schema });
}

type Database = ReturnType<typeof createDatabase>;

let cachedUrl = "";
let cachedDatabase: Database | null = null;
let schemaPromise: Promise<void> | null = null;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not configured");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function isDatabaseConfigured() {
  return Boolean(readDatabaseUrl());
}

export function databaseErrorMessage(error: unknown) {
  if (error instanceof DatabaseNotConfiguredError) {
    return "설문 저장 기능을 사용하려면 Vercel에서 Neon 데이터베이스를 연결해주세요.";
  }
  return "설문 저장소에 잠시 연결하지 못했어요. 잠시 후 다시 시도해주세요.";
}

async function ensureSchema(database: Database) {
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      owner_name TEXT NOT NULL DEFAULT '',
      school_id TEXT NOT NULL DEFAULT 'yonsei',
      category TEXT NOT NULL DEFAULT 'campus',
      campus TEXT NOT NULL DEFAULT '연세대학교 신촌캠퍼스',
      questions_json TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 2,
      is_public BOOLEAN NOT NULL DEFAULT TRUE,
      listing_requested BOOLEAN NOT NULL DEFAULT FALSE,
      is_listed BOOLEAN NOT NULL DEFAULT FALSE,
      manage_token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    ALTER TABLE surveys ADD COLUMN IF NOT EXISTS school_id TEXT NOT NULL DEFAULT 'yonsei'
  `);
  await database.execute(sql`
    ALTER TABLE surveys ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'campus'
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS surveys_public_listing_idx
      ON surveys (is_listed, is_public, created_at DESC)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      answers_json TEXT NOT NULL,
      completion_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS responses_survey_created_idx
      ON responses (survey_id, created_at DESC)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS ai_rate_limits (
      fingerprint TEXT NOT NULL,
      window_start BIGINT NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 1,
      expires_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (fingerprint, window_start)
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS ai_rate_limits_expiry_idx
      ON ai_rate_limits (expires_at)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      school_id TEXT NOT NULL DEFAULT 'yonsei',
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS auth_sessions_member_idx
      ON auth_sessions (member_id)
  `);
}

export async function getDb() {
  const url = readDatabaseUrl();
  if (!url) throw new DatabaseNotConfiguredError();

  if (!cachedDatabase || cachedUrl !== url) {
    cachedUrl = url;
    cachedDatabase = createDatabase(url);
    schemaPromise = null;
  }

  const database = cachedDatabase;
  schemaPromise ??= ensureSchema(database).catch((error) => {
    schemaPromise = null;
    throw error;
  });
  await schemaPromise;
  return database;
}

export async function consumePersistentAiRateLimit(
  fingerprint: string,
  maximum: number,
) {
  if (!isDatabaseConfigured()) return null;

  const database = await getDb();
  const windowStart = Math.floor(Date.now() / 3_600_000);
  const result = (await database.execute(sql`
    INSERT INTO ai_rate_limits (
      fingerprint,
      window_start,
      request_count,
      expires_at
    )
    VALUES (
      ${fingerprint},
      ${windowStart},
      1,
      NOW() + INTERVAL '2 hours'
    )
    ON CONFLICT (fingerprint, window_start)
    DO UPDATE SET
      request_count = ai_rate_limits.request_count + 1,
      expires_at = EXCLUDED.expires_at
    RETURNING request_count
  `)) as unknown as { rows: Array<{ request_count: number }> };

  const count = Number(result.rows[0]?.request_count ?? maximum + 1);
  return count <= maximum;
}
