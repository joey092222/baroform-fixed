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
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  listing_requested BOOLEAN NOT NULL DEFAULT FALSE,
  is_listed BOOLEAN NOT NULL DEFAULT FALSE,
  manage_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS surveys_owner_created_idx
  ON surveys (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS surveys_public_listing_idx
  ON surveys (is_listed, is_public, created_at DESC);

CREATE TABLE IF NOT EXISTS responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  member_id TEXT,
  answers_json TEXT NOT NULL,
  completion_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS responses_survey_created_idx
  ON responses (survey_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_rate_limits (
  fingerprint TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (fingerprint, window_start)
);

CREATE INDEX IF NOT EXISTS ai_rate_limits_expiry_idx
  ON ai_rate_limits (expires_at);

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  school_id TEXT NOT NULL DEFAULT 'yonsei',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auth_sessions_member_idx
  ON auth_sessions (member_id);

ALTER TABLE surveys ADD COLUMN IF NOT EXISTS reward_cash INTEGER NOT NULL DEFAULT 30;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS member_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS responses_member_survey_unique
  ON responses (member_id, survey_id);

CREATE TABLE IF NOT EXISTS cash_transactions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  survey_id TEXT NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, survey_id)
);

CREATE INDEX IF NOT EXISTS cash_transactions_member_created_idx
  ON cash_transactions (member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  school_id TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'all',
  category TEXT NOT NULL DEFAULT 'free',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS community_posts_scope_created_idx
  ON community_posts (visibility, school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS community_posts_member_created_idx
  ON community_posts (member_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS community_comments_post_created_idx
  ON community_comments (post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS community_likes (
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, member_id)
);

CREATE INDEX IF NOT EXISTS community_likes_post_idx
  ON community_likes (post_id);
