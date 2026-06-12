-- Phase 2, Step 8: extra indexes to keep attempt-time hot paths cheap when
-- 100-120 students attempt a test concurrently.

-- Speed up the LATERAL lookup in getTestRowById for the active test invite.
CREATE INDEX IF NOT EXISTS idx_test_invites_test_active_created
  ON test_invites (test_id, is_active, created_at DESC);

-- Speed up the NOT EXISTS subquery used by addRandomQuestionsFromBankToTest
-- when faculty fills a test from the question bank.
CREATE INDEX IF NOT EXISTS idx_test_questions_test_bank
  ON test_questions (test_id, question_bank_id);

-- Help the question-bank random selection narrow down by approval state and
-- type before the random() ordering kicks in.
CREATE INDEX IF NOT EXISTS idx_question_bank_status_type_difficulty
  ON question_bank (status, question_type, difficulty);

-- Common filter when teachers review submissions or students reload an attempt:
-- attempts by student inside a single test.
CREATE INDEX IF NOT EXISTS idx_attempts_test_student_profile
  ON attempts (test_id, student_profile_id);

-- Order attempts by recency for review screens.
CREATE INDEX IF NOT EXISTS idx_attempts_test_started_at
  ON attempts (test_id, started_at DESC);
