import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const surveys = pgTable(
  "surveys",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    ownerName: text("owner_name").notNull().default(""),
    campus: text("campus")
      .notNull()
      .default("연세대학교 신촌캠퍼스"),
    questionsJson: text("questions_json").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(2),
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
    index("surveys_public_listing_idx").on(
      table.isListed,
      table.isPublic,
      table.createdAt,
    ),
  ],
);

export const responses = pgTable(
  "responses",
  {
    id: text("id").primaryKey(),
    surveyId: text("survey_id")
      .notNull()
      .references(() => surveys.id, { onDelete: "cascade" }),
    answersJson: text("answers_json").notNull(),
    completionSeconds: integer("completion_seconds").notNull().default(0),
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
  ],
);
