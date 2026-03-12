import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LessonProgress {
  topicSlug: string;
  lessonSlug: string;
  completedSteps: number[];
  totalSteps: number;
  completedAt?: string; // ISO date
  lastAccessedAt: string;
}

export interface ExerciseProgress {
  exerciseId: string;
  type: string;
  difficulty: string;
  topicSlug: string;
  isCorrect: boolean;
  attempts: number;
  completedAt?: string;
  lastAttemptAt: string;
}

export interface ActivityEntry {
  date: string; // YYYY-MM-DD
  lessonsCompleted: number;
  exercisesSolved: number;
  minutesSpent: number;
}

interface ProgressStore {
  lessons: Record<string, LessonProgress>; // key: "topicSlug/lessonSlug"
  exercises: Record<string, ExerciseProgress>; // key: exerciseId
  activity: Record<string, ActivityEntry>; // key: YYYY-MM-DD
  streak: number;
  totalXp: number;

  // Lesson progress
  markLessonStepComplete: (
    topicSlug: string,
    lessonSlug: string,
    stepIndex: number,
    totalSteps: number,
  ) => void;

  // Exercise progress
  recordExerciseAttempt: (
    exerciseId: string,
    type: string,
    difficulty: string,
    topicSlug: string,
    isCorrect: boolean,
  ) => void;

  // Activity
  logActivity: (minutes: number) => void;

  // Computed helpers
  getLessonProgress: (topicSlug: string, lessonSlug: string) => LessonProgress | undefined;
  getTopicCompletion: (topicSlug: string) => { completed: number; total: number };
  getExerciseStats: () => {
    total: number;
    correct: number;
    byType: Record<string, { total: number; correct: number }>;
  };
  getStreak: () => number;
  getRecentActivity: (days: number) => ActivityEntry[];

  // Reset
  resetProgress: () => void;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function computeStreak(activity: Record<string, ActivityEntry>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const entry = activity[key];
    if (entry && (entry.lessonsCompleted > 0 || entry.exercisesSolved > 0)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

export const useProgressStore = create<ProgressStore>()(
  persist(
    (set, get) => ({
      lessons: {},
      exercises: {},
      activity: {},
      streak: 0,
      totalXp: 0,

      markLessonStepComplete: (topicSlug, lessonSlug, stepIndex, totalSteps) => {
        const key = `${topicSlug}/${lessonSlug}`;
        set((s) => {
          const existing = s.lessons[key] ?? {
            topicSlug,
            lessonSlug,
            completedSteps: [],
            totalSteps,
            lastAccessedAt: new Date().toISOString(),
          };
          const steps = new Set(existing.completedSteps);
          steps.add(stepIndex);
          const completedSteps = Array.from(steps).sort((a, b) => a - b);
          const isFullyComplete = completedSteps.length >= totalSteps;

          const today = todayKey();
          const dayEntry = s.activity[today] ?? {
            date: today,
            lessonsCompleted: 0,
            exercisesSolved: 0,
            minutesSpent: 0,
          };
          const wasComplete = existing.completedSteps.length >= totalSteps;

          const newActivity = { ...s.activity };
          if (isFullyComplete && !wasComplete) {
            newActivity[today] = { ...dayEntry, lessonsCompleted: dayEntry.lessonsCompleted + 1 };
          }

          const xpGain = isFullyComplete && !wasComplete ? 20 : 2;

          return {
            lessons: {
              ...s.lessons,
              [key]: {
                ...existing,
                completedSteps,
                totalSteps,
                lastAccessedAt: new Date().toISOString(),
                completedAt: isFullyComplete
                  ? (existing.completedAt ?? new Date().toISOString())
                  : undefined,
              },
            },
            activity: newActivity,
            totalXp: s.totalXp + xpGain,
            streak: computeStreak(newActivity),
          };
        });
      },

      recordExerciseAttempt: (exerciseId, type, difficulty, topicSlug, isCorrect) => {
        set((s) => {
          const existing = s.exercises[exerciseId];
          const attempts = (existing?.attempts ?? 0) + 1;
          const wasCorrect = existing?.isCorrect ?? false;

          const today = todayKey();
          const dayEntry = s.activity[today] ?? {
            date: today,
            lessonsCompleted: 0,
            exercisesSolved: 0,
            minutesSpent: 0,
          };
          const newActivity = { ...s.activity };
          if (isCorrect && !wasCorrect) {
            newActivity[today] = { ...dayEntry, exercisesSolved: dayEntry.exercisesSolved + 1 };
          }

          const xpGain =
            isCorrect && !wasCorrect ? ({ easy: 10, medium: 20, hard: 30 }[difficulty] ?? 10) : 1;

          return {
            exercises: {
              ...s.exercises,
              [exerciseId]: {
                exerciseId,
                type,
                difficulty,
                topicSlug,
                isCorrect: isCorrect || wasCorrect,
                attempts,
                completedAt:
                  isCorrect || wasCorrect
                    ? (existing?.completedAt ?? new Date().toISOString())
                    : undefined,
                lastAttemptAt: new Date().toISOString(),
              },
            },
            activity: newActivity,
            totalXp: s.totalXp + xpGain,
            streak: computeStreak(newActivity),
          };
        });
      },

      logActivity: (minutes) => {
        set((s) => {
          const today = todayKey();
          const dayEntry = s.activity[today] ?? {
            date: today,
            lessonsCompleted: 0,
            exercisesSolved: 0,
            minutesSpent: 0,
          };
          const newActivity = {
            ...s.activity,
            [today]: { ...dayEntry, minutesSpent: dayEntry.minutesSpent + minutes },
          };
          return { activity: newActivity };
        });
      },

      getLessonProgress: (topicSlug, lessonSlug) => {
        return get().lessons[`${topicSlug}/${lessonSlug}`];
      },

      getTopicCompletion: (topicSlug) => {
        const lessons = get().lessons;
        let completed = 0;
        let total = 0;
        for (const lp of Object.values(lessons)) {
          if (lp.topicSlug === topicSlug) {
            total++;
            if (lp.completedSteps.length >= lp.totalSteps) completed++;
          }
        }
        return { completed, total };
      },

      getExerciseStats: () => {
        const exercises = get().exercises;
        let total = 0;
        let correct = 0;
        const byType: Record<string, { total: number; correct: number }> = {};
        for (const ep of Object.values(exercises)) {
          total++;
          if (ep.isCorrect) correct++;
          if (!byType[ep.type]) byType[ep.type] = { total: 0, correct: 0 };
          byType[ep.type].total++;
          if (ep.isCorrect) byType[ep.type].correct++;
        }
        return { total, correct, byType };
      },

      getStreak: () => {
        return computeStreak(get().activity);
      },

      getRecentActivity: (days) => {
        const activity = get().activity;
        const entries: ActivityEntry[] = [];
        const today = new Date();
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          entries.push(
            activity[key] ?? {
              date: key,
              lessonsCompleted: 0,
              exercisesSolved: 0,
              minutesSpent: 0,
            },
          );
        }
        return entries;
      },

      resetProgress: () => set({ lessons: {}, exercises: {}, activity: {}, streak: 0, totalXp: 0 }),
    }),
    {
      name: 'querycraft-progress',
    },
  ),
);
