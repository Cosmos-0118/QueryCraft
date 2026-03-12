import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  bigserial,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

// ==================== USERS ====================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  isLocked: boolean('is_locked').default(false),
  failedAttempts: integer('failed_attempts').default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
});

// ==================== REFRESH TOKENS ====================
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    revoked: boolean('revoked').default(false),
  },
  (table) => [index('idx_refresh_tokens_user').on(table.userId)],
);

// ==================== TOPIC PROGRESS ====================
export const progress = pgTable(
  'progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    topicSlug: varchar('topic_slug', { length: 100 }).notNull(),
    lessonSlug: varchar('lesson_slug', { length: 100 }),
    currentStep: integer('current_step').default(0),
    completed: boolean('completed').default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('idx_progress_user_topic_lesson').on(
      table.userId,
      table.topicSlug,
      table.lessonSlug,
    ),
    index('idx_progress_user').on(table.userId),
  ],
);

// ==================== SAVED SESSIONS ====================
export const savedSessions = pgTable(
  'saved_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    sessionType: varchar('session_type', { length: 50 }).notNull(),
    sessionName: varchar('session_name', { length: 200 }),
    stateJson: jsonb('state_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_sessions_user').on(table.userId)],
);

// ==================== EXERCISE SUBMISSIONS ====================
export const exerciseSubmissions = pgTable(
  'exercise_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    exerciseId: varchar('exercise_id', { length: 100 }).notNull(),
    submittedAnswer: text('submitted_answer').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    attemptNumber: integer('attempt_number').notNull().default(1),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_submissions_user').on(table.userId),
    index('idx_submissions_exercise').on(table.exerciseId),
  ],
);

// ==================== RATE LIMITING ====================
export const rateLimitLog = pgTable(
  'rate_limit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    identifier: varchar('identifier', { length: 255 }).notNull(),
    action: varchar('action', { length: 100 }).notNull(),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_rate_limit').on(table.identifier, table.action, table.attemptedAt)],
);
