-- Phase 2, Step 2: core Test module tables (Section 14.4).

-- 14.4.1 users_test_profile (identity)
CREATE TABLE users_test_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id text NOT NULL UNIQUE,
  role test_role NOT NULL,
  display_name text NOT NULL,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 14.4.2 topics (identity)
CREATE TABLE topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 14.4.3 question_bank (authoring)
CREATE TABLE question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES topics(id),
  question_type question_type NOT NULL,
  prompt text NOT NULL,
  difficulty text NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  marks numeric(5,2) NOT NULL DEFAULT 1.00,
  expected_time_sec integer,
  answer_key jsonb NOT NULL,
  syntax_rules jsonb,
  explanation text,
  tags jsonb,
  status question_status NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users_test_profile(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 14.4.4 question_options (authoring)
CREATE TABLE question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  option_key text NOT NULL,
  option_text text NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, option_key),
  UNIQUE (question_id, display_order)
);

-- 14.4.5 tests (authoring)
CREATE TABLE tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES users_test_profile(id),
  title text NOT NULL,
  description text,
  question_mode question_mode NOT NULL,
  mix_mcq_percent integer,
  mix_sql_fill_percent integer,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  anti_cheat_policy jsonb NOT NULL,
  status test_status NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tests_schedule_window_valid CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT tests_mixed_mode_rules CHECK (
    (
      question_mode = 'mixed'
      AND mix_mcq_percent IS NOT NULL
      AND mix_sql_fill_percent IS NOT NULL
      AND mix_mcq_percent BETWEEN 70 AND 85
      AND mix_sql_fill_percent BETWEEN 15 AND 30
      AND (mix_mcq_percent + mix_sql_fill_percent) = 100
    )
    OR (
      question_mode <> 'mixed'
      AND mix_mcq_percent IS NULL
      AND mix_sql_fill_percent IS NULL
    )
  )
);

-- 14.4.6 test_questions (authoring)
CREATE TABLE test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question_bank_id uuid NOT NULL REFERENCES question_bank(id),
  question_snapshot jsonb NOT NULL,
  marks numeric(5,2) NOT NULL,
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, display_order)
);

-- 14.4.7 test_invites (authoring)
CREATE TABLE test_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE,
  expires_at timestamptz,
  max_attempts_per_student integer NOT NULL DEFAULT 1,
  allowed_cohorts jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT test_invites_max_attempts_positive CHECK (max_attempts_per_student > 0)
);

-- 14.4.8 attempts (runtime)
CREATE TABLE attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id),
  student_profile_id uuid NOT NULL REFERENCES users_test_profile(id),
  attempt_number integer NOT NULL DEFAULT 1,
  status attempt_status NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  submitted_at timestamptz,
  violation_count integer NOT NULL DEFAULT 0,
  auto_score numeric(5,2),
  manual_score numeric(5,2),
  final_score numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_id, student_profile_id, attempt_number),
  CONSTRAINT attempts_attempt_number_positive CHECK (attempt_number >= 1),
  CONSTRAINT attempts_violation_count_non_negative CHECK (violation_count >= 0)
);

-- 14.4.9 attempt_answers (runtime)
CREATE TABLE attempt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  test_question_id uuid NOT NULL REFERENCES test_questions(id),
  question_type question_type NOT NULL,
  selected_option_key text,
  sql_text text,
  is_final boolean NOT NULL DEFAULT false,
  answered_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, test_question_id),
  CONSTRAINT attempt_answers_shape_check CHECK (
    (question_type = 'mcq' AND sql_text IS NULL)
    OR (question_type = 'sql_fill' AND selected_option_key IS NULL)
  )
);

-- 14.4.10 answer_evaluations (runtime)
CREATE TABLE answer_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_answer_id uuid NOT NULL REFERENCES attempt_answers(id) ON DELETE CASCADE,
  evaluation_type evaluation_type NOT NULL,
  evaluation_mode evaluation_mode NOT NULL,
  syntax_score numeric(5,2),
  semantic_score numeric(5,2),
  awarded_score numeric(5,2) NOT NULL,
  max_score numeric(5,2) NOT NULL,
  is_valid boolean,
  diagnostics jsonb,
  evaluated_by uuid REFERENCES users_test_profile(id),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT answer_evaluations_v1_sql_fill_rule CHECK (
    evaluation_type <> 'sql_syntax'
    OR (evaluation_mode = 'syntax_only' AND semantic_score IS NULL)
  )
);

-- 14.4.11 violation_events (runtime)
CREATE TABLE violation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  event_type violation_event_type NOT NULL,
  action_taken violation_action NOT NULL,
  event_payload jsonb,
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 14.4.12 grades (runtime)
CREATE TABLE grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL UNIQUE REFERENCES attempts(id) ON DELETE CASCADE,
  auto_score numeric(5,2) NOT NULL DEFAULT 0.00,
  manual_adjustment numeric(5,2) NOT NULL DEFAULT 0.00,
  final_score numeric(5,2) NOT NULL DEFAULT 0.00,
  feedback text,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  graded_by uuid REFERENCES users_test_profile(id),
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 14.4.13 audit_logs (logs)
CREATE TABLE audit_logs (
  id bigserial PRIMARY KEY,
  actor_profile_id uuid REFERENCES users_test_profile(id),
  actor_role text,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);