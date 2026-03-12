CREATE TABLE "exercise_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" varchar(100) NOT NULL,
	"submitted_answer" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"topic_slug" varchar(100) NOT NULL,
	"lesson_slug" varchar(100),
	"current_step" integer DEFAULT 0,
	"completed" boolean DEFAULT false,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rate_limit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"action" varchar(100) NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"revoked" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "saved_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_type" varchar(50) NOT NULL,
	"session_name" varchar(200),
	"state_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"is_locked" boolean DEFAULT false,
	"failed_attempts" integer DEFAULT 0,
	"locked_until" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "exercise_submissions" ADD CONSTRAINT "exercise_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_sessions" ADD CONSTRAINT "saved_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_submissions_user" ON "exercise_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_submissions_exercise" ON "exercise_submissions" USING btree ("exercise_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_progress_user_topic_lesson" ON "progress" USING btree ("user_id","topic_slug","lesson_slug");--> statement-breakpoint
CREATE INDEX "idx_progress_user" ON "progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_rate_limit" ON "rate_limit_log" USING btree ("identifier","action","attempted_at");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "saved_sessions" USING btree ("user_id");