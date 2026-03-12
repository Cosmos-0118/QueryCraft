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
