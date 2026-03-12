export type Difficulty = 'easy' | 'medium' | 'hard';
export type ExerciseType = 'sql' | 'algebra' | 'normalization' | 'er-diagram';

export interface Exercise {
  id: string;
  title: string;
  description: string;
  type: ExerciseType;
  difficulty: Difficulty;
  topicSlug: string;
  setupSql?: string;
  expectedResult?: string[][];
  hints: string[];
}

export interface Submission {
  exerciseId: string;
  answer: string;
}

export interface GradingResult {
  isCorrect: boolean;
  feedback: string;
  expected?: string[][];
  actual?: string[][];
}
