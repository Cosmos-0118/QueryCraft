'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useLessonStore } from '@/stores/lesson-store';
import { getLesson } from '@/lib/lessons/content';
import { buildVisualStep, type VisualStep } from '@/lib/lessons/step-builder';

export function useLesson(topicSlug: string, lessonSlug: string) {
  const store = useLessonStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const lesson = getLesson(topicSlug, lessonSlug);
    if (lesson) store.setLesson(lesson);
    return () => store.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicSlug, lessonSlug]);

  // Auto-advance when playing
  useEffect(() => {
    if (store.isPlaying && store.lesson) {
      timerRef.current = setInterval(() => {
        const s = useLessonStore.getState();
        if (s.currentStepIndex < (s.lesson?.steps.length ?? 1) - 1) {
          s.nextStep();
        } else {
          s.togglePlay();
        }
      }, 3000 / store.playbackSpeed);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [store.isPlaying, store.playbackSpeed, store.lesson]);

  const currentStep: VisualStep | null =
    store.lesson && store.currentStepIndex < store.lesson.steps.length
      ? buildVisualStep(store.lesson.steps[store.currentStepIndex])
      : null;

  const progress = store.lesson
    ? Math.round((store.completedSteps.size / store.lesson.steps.length) * 100)
    : 0;

  const goToStep = useCallback((i: number) => store.setStep(i), [store]);

  return {
    lesson: store.lesson,
    currentStep,
    stepIndex: store.currentStepIndex,
    totalSteps: store.lesson?.steps.length ?? 0,
    isPlaying: store.isPlaying,
    playbackSpeed: store.playbackSpeed,
    completedSteps: store.completedSteps,
    progress,
    next: store.nextStep,
    prev: store.prevStep,
    togglePlay: store.togglePlay,
    setSpeed: store.setSpeed,
    goToStep,
  };
}
