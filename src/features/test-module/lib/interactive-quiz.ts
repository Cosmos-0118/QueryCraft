export type TestModuleType = 'classic' | 'interactive_quiz';

export type InteractiveDifficulty = 'basic' | 'medium' | 'hard' | 'mixed';

export interface InteractiveQuizSettings {
  question_timer_seconds: number;
  max_points_per_question: number;
  randomize_questions: boolean;
  randomize_options: boolean;
  difficulty_profile: InteractiveDifficulty;
}

export interface InteractiveScoreBreakdownItem {
  question_id: string;
  is_correct: boolean;
  elapsed_seconds: number;
  points: number;
}

export interface InteractiveAttemptScoringInput {
  results: Array<{
    question_id: string;
    is_correct: boolean;
  }>;
  timing_by_question?: Record<string, number>;
  settings: InteractiveQuizSettings;
}

export const DEFAULT_INTERACTIVE_QUIZ_SETTINGS: InteractiveQuizSettings = {
  question_timer_seconds: 40,
  max_points_per_question: 500,
  randomize_questions: true,
  randomize_options: true,
  difficulty_profile: 'mixed',
};

const MIN_TIMER_SECONDS = 10;
const MAX_TIMER_SECONDS = 300;
const MIN_POINTS_PER_QUESTION = 50;
const MAX_POINTS_PER_QUESTION = 2000;
const MIN_CORRECT_MULTIPLIER = 0.2;

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

function normalizeInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return fallback;
  }

  const rounded = Math.round(numeric);
  return Math.max(minimum, Math.min(maximum, rounded));
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  return fallback;
}

function normalizeDifficulty(value: unknown, fallback: InteractiveDifficulty): InteractiveDifficulty {
  if (value === 'basic' || value === 'medium' || value === 'hard' || value === 'mixed') {
    return value;
  }

  return fallback;
}

function clampElapsedSeconds(elapsedSeconds: unknown, timerSeconds: number): number {
  const numeric = toFiniteNumber(elapsedSeconds);
  if (numeric === null) {
    return timerSeconds;
  }

  if (numeric <= 0) {
    return 0;
  }

  return Math.min(timerSeconds, numeric);
}

export function normalizeInteractiveQuizSettings(
  settings: Partial<InteractiveQuizSettings> | null | undefined,
): InteractiveQuizSettings {
  return {
    question_timer_seconds: normalizeInteger(
      settings?.question_timer_seconds,
      DEFAULT_INTERACTIVE_QUIZ_SETTINGS.question_timer_seconds,
      MIN_TIMER_SECONDS,
      MAX_TIMER_SECONDS,
    ),
    max_points_per_question: normalizeInteger(
      settings?.max_points_per_question,
      DEFAULT_INTERACTIVE_QUIZ_SETTINGS.max_points_per_question,
      MIN_POINTS_PER_QUESTION,
      MAX_POINTS_PER_QUESTION,
    ),
    randomize_questions: normalizeBoolean(
      settings?.randomize_questions,
      DEFAULT_INTERACTIVE_QUIZ_SETTINGS.randomize_questions,
    ),
    randomize_options: normalizeBoolean(
      settings?.randomize_options,
      DEFAULT_INTERACTIVE_QUIZ_SETTINGS.randomize_options,
    ),
    difficulty_profile: normalizeDifficulty(
      settings?.difficulty_profile,
      DEFAULT_INTERACTIVE_QUIZ_SETTINGS.difficulty_profile,
    ),
  };
}

export function parseModuleTypeFromPolicy(policy: unknown): TestModuleType {
  if (!isObject(policy)) {
    return 'classic';
  }

  return policy.module_type === 'interactive_quiz' ? 'interactive_quiz' : 'classic';
}

export function parseInteractiveQuizSettingsFromPolicy(policy: unknown): InteractiveQuizSettings {
  if (!isObject(policy)) {
    return normalizeInteractiveQuizSettings(null);
  }

  const raw = isObject(policy.interactive_quiz) ? policy.interactive_quiz : null;
  return normalizeInteractiveQuizSettings(raw);
}

export function buildTestModulePolicy(options: {
  currentPolicy?: unknown;
  moduleType?: TestModuleType;
  interactiveSettings?: Partial<InteractiveQuizSettings> | null;
}): Record<string, unknown> {
  const basePolicy = isObject(options.currentPolicy)
    ? { ...options.currentPolicy }
    : {};

  const moduleType = options.moduleType ?? parseModuleTypeFromPolicy(basePolicy);
  const existingInteractiveSettings = parseInteractiveQuizSettingsFromPolicy(basePolicy);

  const interactiveSettings = options.interactiveSettings === undefined
    ? existingInteractiveSettings
    : normalizeInteractiveQuizSettings({
      ...existingInteractiveSettings,
      ...options.interactiveSettings,
    });

  return {
    ...basePolicy,
    module_type: moduleType,
    interactive_quiz: interactiveSettings,
  };
}

export function calculateInteractiveQuestionPoints(options: {
  isCorrect: boolean;
  elapsedSeconds: number;
  settings: InteractiveQuizSettings;
}): number {
  if (!options.isCorrect) {
    return 0;
  }

  const timerSeconds = Math.max(1, options.settings.question_timer_seconds);
  const normalizedElapsed = clampElapsedSeconds(options.elapsedSeconds, timerSeconds);
  const speedRatio = (timerSeconds - normalizedElapsed) / timerSeconds;
  const multiplier = MIN_CORRECT_MULTIPLIER + speedRatio * (1 - MIN_CORRECT_MULTIPLIER);

  return Math.max(1, Math.round(options.settings.max_points_per_question * multiplier));
}

export function calculateInteractiveAttemptScore(
  input: InteractiveAttemptScoringInput,
): {
  total_points: number;
  breakdown: InteractiveScoreBreakdownItem[];
} {
  const breakdown = input.results.map((result) => {
    const elapsed = clampElapsedSeconds(
      input.timing_by_question?.[result.question_id],
      input.settings.question_timer_seconds,
    );

    const points = calculateInteractiveQuestionPoints({
      isCorrect: result.is_correct,
      elapsedSeconds: elapsed,
      settings: input.settings,
    });

    return {
      question_id: result.question_id,
      is_correct: result.is_correct,
      elapsed_seconds: elapsed,
      points,
    };
  });

  const totalPoints = breakdown.reduce((sum, entry) => sum + entry.points, 0);

  return {
    total_points: totalPoints,
    breakdown,
  };
}
