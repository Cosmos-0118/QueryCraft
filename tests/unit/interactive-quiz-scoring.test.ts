import { describe, expect, it } from 'vitest';
import { calculateInteractiveAttemptScore } from '@/lib/test/interactive-quiz';

describe('interactive quiz scoring', () => {
  it('supports totals above legacy numeric(5,2) limits', () => {
    const results = Array.from({ length: 12 }, (_, index) => ({
      question_id: `q_${index + 1}`,
      is_correct: true,
    }));

    const timingByQuestion = Object.fromEntries(results.map((item) => [item.question_id, 0]));

    const scoring = calculateInteractiveAttemptScore({
      results,
      timing_by_question: timingByQuestion,
      settings: {
        question_timer_seconds: 40,
        max_points_per_question: 2000,
        randomize_questions: true,
        randomize_options: true,
        difficulty_profile: 'mixed',
      },
    });

    expect(scoring.total_points).toBe(24000);
    expect(scoring.total_points).toBeGreaterThan(999);
    expect(scoring.breakdown).toHaveLength(12);
    expect(scoring.breakdown.every((entry) => entry.points === 2000)).toBe(true);
  });
});
