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
      owner_id TEXT,
      school_id TEXT NOT NULL DEFAULT 'yonsei',
      category TEXT NOT NULL DEFAULT 'campus',
      campus TEXT NOT NULL DEFAULT '연세대학교 신촌캠퍼스',
      questions_json TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 2,
      reward_cash INTEGER NOT NULL DEFAULT 30,
      target_audience TEXT NOT NULL DEFAULT '',
      is_public BOOLEAN NOT NULL DEFAULT TRUE,
      listing_requested BOOLEAN NOT NULL DEFAULT FALSE,
      is_listed BOOLEAN NOT NULL DEFAULT FALSE,
      manage_token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    ALTER TABLE surveys ADD COLUMN IF NOT EXISTS owner_id TEXT
  `);
  await database.execute(sql`
    ALTER TABLE surveys ADD COLUMN IF NOT EXISTS school_id TEXT NOT NULL DEFAULT 'yonsei'
  `);
  await database.execute(sql`
    ALTER TABLE surveys ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'campus'
  `);
  await database.execute(sql`
    ALTER TABLE surveys ADD COLUMN IF NOT EXISTS reward_cash INTEGER NOT NULL DEFAULT 30
  `);
  await database.execute(sql`
    ALTER TABLE surveys ADD COLUMN IF NOT EXISTS target_audience TEXT NOT NULL DEFAULT ''
  `);
  await database.execute(sql`
    ALTER TABLE surveys ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS surveys_owner_created_idx
      ON surveys (owner_id, created_at DESC)
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
  await database.execute(sql`
    ALTER TABLE responses ADD COLUMN IF NOT EXISTS member_id TEXT
  `);
  await database.execute(sql`
    ALTER TABLE responses ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT
  `);
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS responses_member_survey_unique
      ON responses (member_id, survey_id)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS cash_transactions (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (member_id, survey_id)
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS cash_transactions_member_created_idx
      ON cash_transactions (member_id, created_at DESC)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS community_posts (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'all',
      category TEXT NOT NULL DEFAULT 'free',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS community_posts_scope_created_idx
      ON community_posts (visibility, school_id, created_at DESC)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS community_posts_member_created_idx
      ON community_posts (member_id, created_at DESC)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS community_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS community_comments_post_created_idx
      ON community_comments (post_id, created_at ASC)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS community_likes (
      post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (post_id, member_id)
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS community_likes_post_idx
      ON community_likes (post_id)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS external_surveys (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL DEFAULT 'yonsei',
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      external_url TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'external',
      category TEXT NOT NULL DEFAULT 'campus',
      campus TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 3,
      target_responses INTEGER NOT NULL DEFAULT 50,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS external_surveys_school_created_idx
      ON external_surveys (school_id, created_at DESC)
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS external_surveys_owner_created_idx
      ON external_surveys (owner_id, created_at DESC)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS external_survey_visits (
      id TEXT PRIMARY KEY,
      external_survey_id TEXT NOT NULL REFERENCES external_surveys(id) ON DELETE CASCADE,
      member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS external_survey_visits_survey_idx
      ON external_survey_visits (external_survey_id)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS campus_pulses (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL DEFAULT 'yonsei',
      question TEXT NOT NULL,
      options_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS campus_pulses_school_created_idx
      ON campus_pulses (school_id, created_at DESC)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS campus_pulse_votes (
      id TEXT PRIMARY KEY,
      pulse_id TEXT NOT NULL REFERENCES campus_pulses(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      option_index INTEGER NOT NULL,
      grade TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (pulse_id, member_id)
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS campus_pulse_votes_pulse_idx
      ON campus_pulse_votes (pulse_id)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      school_id TEXT NOT NULL DEFAULT 'yonsei',
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'team',
      review_token TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS workspaces_owner_created_idx
      ON workspaces (owner_id, created_at DESC)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      invite_email TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'editor',
      status TEXT NOT NULL DEFAULT 'pending',
      invited_by_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, invite_email),
      UNIQUE (workspace_id, member_id)
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS workspace_members_user_status_idx
      ON workspace_members (member_id, status)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS workspace_projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      assigned_member_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      assignment_label TEXT NOT NULL DEFAULT '전체 문항',
      created_by_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (workspace_id, survey_id)
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS workspace_projects_workspace_updated_idx
      ON workspace_projects (workspace_id, updated_at DESC)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS workspace_comments (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES workspace_projects(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS workspace_comments_workspace_created_idx
      ON workspace_comments (workspace_id, created_at DESC)
  `);
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS workspace_versions (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES workspace_projects(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL DEFAULT 1,
      summary TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS workspace_versions_workspace_created_idx
      ON workspace_versions (workspace_id, created_at DESC)
  `);
  // 설문 주인이 개별 응답을 집계에 넣을지 뺄지 직접 정한 기록.
  // 소유자별이 아니라 설문별로 한 벌만 둔다(워크스페이스 공유 시 숫자가 갈리지 않게).
  await database.execute(sql`
    CREATE TABLE IF NOT EXISTS response_decisions (
      survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
      response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
      decision TEXT NOT NULL,
      decided_by_id TEXT REFERENCES members(id) ON DELETE SET NULL,
      decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (survey_id, response_id)
    )
  `);
  await database.execute(sql`
    CREATE INDEX IF NOT EXISTS response_decisions_survey_idx
      ON response_decisions (survey_id)
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
