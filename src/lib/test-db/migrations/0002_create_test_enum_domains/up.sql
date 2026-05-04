-- Phase 2, Step 1: enum domain layer for Test module schema.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_role') THEN
    CREATE TYPE test_role AS ENUM ('teacher', 'student');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type') THEN
    CREATE TYPE question_type AS ENUM ('mcq', 'sql_fill');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_status') THEN
    CREATE TYPE question_status AS ENUM ('draft', 'review', 'approved', 'retired');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'test_status') THEN
    CREATE TYPE test_status AS ENUM ('draft', 'published', 'closed', 'archived');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_mode') THEN
    CREATE TYPE question_mode AS ENUM ('mcq_only', 'sql_only', 'mixed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attempt_status') THEN
    CREATE TYPE attempt_status AS ENUM ('in_progress', 'submitted', 'terminated_violation', 'terminated_timeout');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evaluation_type') THEN
    CREATE TYPE evaluation_type AS ENUM ('mcq_auto', 'sql_syntax', 'sql_semantic', 'manual');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evaluation_mode') THEN
    CREATE TYPE evaluation_mode AS ENUM ('syntax_only', 'semantic_expected_result');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'violation_event_type') THEN
    CREATE TYPE violation_event_type AS ENUM ('tab_switch', 'blur', 'copy', 'paste', 'cut', 'context_menu');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'violation_action') THEN
    CREATE TYPE violation_action AS ENUM ('logged', 'warned', 'blocked', 'force_submitted');
  END IF;
END $$;