'use client';

import { useProgressStore } from '@/stores/progress-store';
import { units, lessonRegistry } from '@/lib/lessons/content';
import { exercises } from '@/lib/exercises/exercise-bank';

export function useProgress() {
  const store = useProgressStore();

  const unitProgress = units.map((unit) => {
    const topicSlugs = unit.topics.map((t) => t.slug);
    const unitLessons = lessonRegistry.filter((l) => topicSlugs.includes(l.topicSlug));
    const completedLessons = unitLessons.filter((l) => {
      const p = store.getLessonProgress(l.topicSlug, l.slug);
      return p && p.completedSteps.length >= p.totalSteps;
    });
    return {
      unit,
      totalLessons: unitLessons.length,
      completedLessons: completedLessons.length,
      percent:
        unitLessons.length > 0
          ? Math.round((completedLessons.length / unitLessons.length) * 100)
          : 0,
    };
  });

  const totalLessons = lessonRegistry.length;
  const completedLessons = Object.values(store.lessons).filter(
    (lp) => lp.completedSteps.length >= lp.totalSteps,
  ).length;

  const totalExercises = exercises.length;
  const solvedExercises = Object.values(store.exercises).filter((ep) => ep.isCorrect).length;

  const exerciseStats = store.getExerciseStats();
  const recentActivity = store.getRecentActivity(30);
  const streak = store.getStreak();

  return {
    unitProgress,
    totalLessons,
    completedLessons,
    totalExercises,
    solvedExercises,
    exerciseStats,
    recentActivity,
    streak,
    totalXp: store.totalXp,
    markLessonStepComplete: store.markLessonStepComplete,
    recordExerciseAttempt: store.recordExerciseAttempt,
    logActivity: store.logActivity,
    resetProgress: store.resetProgress,
  };
}
