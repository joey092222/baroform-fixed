import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const surveys = pgTable(
  "surveys",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    ownerName: text("owner_name").notNull().default(""),
    ownerId: text("owner_id"),
    schoolId: text("school_id").notNull().default("yonsei"),
    category: text("category").notNull().default("campus"),
    campus: text("campus")
      .notNull()
      .default("연세대학교 신촌캠퍼스"),
    questionsJson: text("questions_json").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(2),
    rewardCash: integer("reward_cash").notNull().default(30),
    isPublic: boolean("is_public").notNull().default(true),
    listingRequested: boolean("listing_requested").notNull().default(false),
    isListed: boolean("is_listed").notNull().default(false),
    manageToken: text("manage_token").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("surveys_owner_created_idx").on(table.ownerId, table.createdAt),
    index("surveys_public_listing_idx").on(
      table.isListed,
      table.isPublic,
      table.createdAt,
    ),
  ],
);

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  schoolId: text("school_id").notNull().default("yonsei"),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  createdAt: timestamp("created_at", {
    withTimezone: true,
    mode: "string",
  })
    .notNull()
    .defaultNow(),
});

export const authSessions = pgTable(
  "auth_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("auth_sessions_member_idx").on(table.memberId)],
);

export const responses = pgTable(
  "responses",
  {
    id: text("id").primaryKey(),
    surveyId: text("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    memberId: text("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    answersJson: text("answers_json").notNull(),
    completionSeconds: integer("completion_seconds").notNull().default(0),
    fingerprintHash: text("fingerprint_hash"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("responses_survey_created_idx").on(
      table.surveyId,
      table.createdAt,
    ),
    uniqueIndex("responses_member_survey_unique").on(
      table.memberId,
      table.surveyId,
    ),
  ],
);

export const externalSurveys = pgTable(
  "external_surveys",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    schoolId: text("school_id").notNull().default("yonsei"),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    externalUrl: text("external_url").notNull(),
    platform: text("platform").notNull().default("external"),
    category: text("category").notNull().default("campus"),
    campus: text("campus").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(3),
    targetResponses: integer("target_responses").notNull().default(50),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("external_surveys_school_created_idx").on(
      table.schoolId,
      table.createdAt,
    ),
    index("external_surveys_owner_created_idx").on(
      table.ownerId,
      table.createdAt,
    ),
  ],
);

export const externalSurveyVisits = pgTable(
  "external_survey_visits",
  {
    id: text("id").primaryKey(),
    externalSurveyId: text("external_survey_id")
      .notNull()
      .references(() => externalSurveys.id, { onDelete: "cascade" }),
    memberId: text("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("external_survey_visits_survey_idx").on(table.externalSurveyId),
  ],
);

export const campusPulses = pgTable(
  "campus_pulses",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    schoolId: text("school_id").notNull().default("yonsei"),
    question: text("question").notNull(),
    optionsJson: text("options_json").notNull(),
    status: text("status").notNull().default("active"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("campus_pulses_school_created_idx").on(
      table.schoolId,
      table.createdAt,
    ),
  ],
);

export const campusPulseVotes = pgTable(
  "campus_pulse_votes",
  {
    id: text("id").primaryKey(),
    pulseId: text("pulse_id")
      .notNull()
      .references(() => campusPulses.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    optionIndex: integer("option_index").notNull(),
    grade: text("grade").notNull().default(""),
    department: text("department").notNull().default(""),
    gender: text("gender").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("campus_pulse_votes_member_unique").on(
      table.pulseId,
      table.memberId,
    ),
    index("campus_pulse_votes_pulse_idx").on(table.pulseId),
  ],
);

export const cashTransactions = pgTable(
  "cash_transactions",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    surveyId: text("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    responseId: text("response_id")
      .notNull()
      .references(() => responses.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("cash_transactions_member_survey_unique").on(
      table.memberId,
      table.surveyId,
    ),
    index("cash_transactions_member_created_idx").on(
      table.memberId,
      table.createdAt,
    ),
  ],
);

export const communityPosts = pgTable(
  "community_posts",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    schoolId: text("school_id").notNull(),
    visibility: text("visibility").notNull().default("all"),
    category: text("category").notNull().default("free"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("community_posts_scope_created_idx").on(
      table.visibility,
      table.schoolId,
      table.createdAt,
    ),
    index("community_posts_member_created_idx").on(
      table.memberId,
      table.createdAt,
    ),
  ],
);

export const communityComments = pgTable(
  "community_comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("community_comments_post_created_idx").on(
      table.postId,
      table.createdAt,
    ),
  ],
);

export const communityLikes = pgTable(
  "community_likes",
  {
    postId: text("post_id")
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("community_likes_post_member_unique").on(
      table.postId,
      table.memberId,
    ),
    index("community_likes_post_idx").on(table.postId),
  ],
);
