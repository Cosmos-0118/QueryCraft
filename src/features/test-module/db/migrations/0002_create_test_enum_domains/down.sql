-- Development rollback for Phase 2, Step 1 enum domain migration.
DROP TYPE IF EXISTS violation_action;
DROP TYPE IF EXISTS violation_event_type;
DROP TYPE IF EXISTS evaluation_mode;
DROP TYPE IF EXISTS evaluation_type;
DROP TYPE IF EXISTS attempt_status;
DROP TYPE IF EXISTS question_mode;
DROP TYPE IF EXISTS test_status;
DROP TYPE IF EXISTS question_status;
DROP TYPE IF EXISTS question_type;
DROP TYPE IF EXISTS test_role;