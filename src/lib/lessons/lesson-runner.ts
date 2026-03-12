import type { Lesson, Step } from '@/types/lesson';
import { getLesson } from './content';

export interface LessonRunnerState {
  lesson: Lesson | null;
  currentStepIndex: number;
  totalSteps: number;
  isComplete: boolean;
}

export function loadLesson(topicSlug: string, lessonSlug: string): LessonRunnerState {
  const lesson = getLesson(topicSlug, lessonSlug);
  if (!lesson) {
    return { lesson: null, currentStepIndex: 0, totalSteps: 0, isComplete: false };
  }
  return {
    lesson,
    currentStepIndex: 0,
    totalSteps: lesson.steps.length,
    isComplete: false,
  };
}

export function getCurrentStep(state: LessonRunnerState): Step | null {
  if (!state.lesson || state.currentStepIndex >= state.lesson.steps.length) return null;
  return state.lesson.steps[state.currentStepIndex];
}

export function goToStep(state: LessonRunnerState, index: number): LessonRunnerState {
  if (!state.lesson) return state;
  const clamped = Math.max(0, Math.min(index, state.lesson.steps.length - 1));
  return {
    ...state,
    currentStepIndex: clamped,
    isComplete: clamped === state.lesson.steps.length - 1,
  };
}

export function nextStep(state: LessonRunnerState): LessonRunnerState {
  return goToStep(state, state.currentStepIndex + 1);
}

export function prevStep(state: LessonRunnerState): LessonRunnerState {
  return goToStep(state, state.currentStepIndex - 1);
}
