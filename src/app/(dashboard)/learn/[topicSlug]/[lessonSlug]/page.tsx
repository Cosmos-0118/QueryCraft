'use client';

import { use, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLesson } from '@/hooks/use-lesson';
import { useSessionPersistence } from '@/hooks/use-session-persistence';
import { getTopic } from '@/lib/lessons/content';
import { snapshotToRecords } from '@/lib/lessons/step-builder';
import {
  StepNavigator,
  ExplanationPanel,
  QueryDisplay,
  TableViewer,
  ExecutionTimeline,
} from '@/components/visual';
import {
  ArrowLeft, CheckCircle2, Code2, BookOpen, Lightbulb, Layers,
} from 'lucide-react';

const STEP_TYPE_ICON: Record<string, typeof Code2> = {
  sql: Code2,
  algebra: Code2,
  explanation: Lightbulb,
  diagram: Layers,
  normalization: Layers,
};

const STEP_TYPE_LABEL: Record<string, string> = {
  sql: 'SQL',
  algebra: 'Algebra',
  explanation: 'Concept',
  diagram: 'Diagram',
  normalization: 'Normalization',
};

export default function LessonPage({
  params,
}: {
  params: Promise<{ topicSlug: string; lessonSlug: string }>;
}) {
  const { topicSlug, lessonSlug } = use(params);
  const router = useRouter();
  const topic = getTopic(topicSlug);
  const {
    lesson,
    currentStep,
    stepIndex,
    totalSteps,
    isPlaying,
    playbackSpeed,
    completedSteps,
    progress,
    next,
    prev,
    togglePlay,
    setSpeed,
    goToStep,
  } = useLesson(topicSlug, lessonSlug);

  // Auto-save session on step change
  const { save } = useSessionPersistence();
  useEffect(() => {
    save({ lastPage: 'lesson', lastTopicSlug: topicSlug, lastLessonSlug: lessonSlug, lastLessonStep: stepIndex });
  }, [save, topicSlug, lessonSlug, stepIndex]);

  if (!lesson || !topic) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-zinc-200">Lesson Not Found</h2>
          <Link href="/learn" className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300">
            ← Back to Learn
          </Link>
        </div>
      </div>
    );
  }

  // Find next lesson in topic
  const lessonIdx = topic.lessons.findIndex((l) => l.slug === lessonSlug);
  const nextLesson = lessonIdx >= 0 && lessonIdx < topic.lessons.length - 1
    ? topic.lessons[lessonIdx + 1]
    : null;

  const StepIcon = currentStep ? (STEP_TYPE_ICON[currentStep.type] ?? Lightbulb) : Lightbulb;
  const isLastStep = stepIndex === totalSteps - 1;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 lg:p-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/learn/${topicSlug}`)}
          className="flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft size={14} /> {topic.title}
        </button>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <BookOpen size={12} />
          Lesson {lessonIdx + 1} of {topic.lessons.length}
        </div>
      </div>

      {/* Lesson Title + Progress */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h1 className="text-xl font-bold text-zinc-100">{lesson.title}</h1>
        <p className="mt-1 text-sm text-zinc-400">{lesson.description}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-medium text-zinc-500">{progress}%</span>
        </div>
      </div>

      {/* Timeline */}
      <ExecutionTimeline
        steps={lesson.steps.map((s) => ({
          label: s.title,
          description: STEP_TYPE_LABEL[s.type],
        }))}
        currentStep={stepIndex}
        onStepClick={goToStep}
        className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
      />

      {/* Step Content */}
      {currentStep && (
        <div className="space-y-4">
          {/* Step Header */}
          <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
              <StepIcon size={18} className="text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-zinc-100">{currentStep.title}</h2>
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-500">
                  {STEP_TYPE_LABEL[currentStep.type]}
                </span>
                {completedSteps.has(stepIndex) && (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                )}
              </div>
            </div>
          </div>

          {/* Explanation */}
          <ExplanationPanel
            title="Explanation"
            explanation={currentStep.explanation}
            className="border-zinc-800 bg-zinc-900/50"
          />

          {/* Command (SQL / Algebra) */}
          {currentStep.command && (
            <QueryDisplay
              query={currentStep.command}
              language={currentStep.type === 'algebra' ? 'algebra' : 'sql'}
              className="border-zinc-800"
            />
          )}

          {/* Before State Tables */}
          {currentStep.beforeTables.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Before
              </h3>
              {currentStep.beforeTables.map((table, ti) => {
                const { columns, rows } = snapshotToRecords(table);
                const highlightRows = currentStep.highlightedRows
                  .filter((h) => h.tableIndex === ti)
                  .flatMap((h) => h.rowIndices);
                return (
                  <TableViewer
                    key={ti}
                    columns={columns}
                    rows={rows}
                    caption={table.name}
                    highlightRows={highlightRows}
                    className="border-zinc-800"
                  />
                );
              })}
            </div>
          )}

          {/* After State Tables */}
          {currentStep.afterTables.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-500/70">
                {currentStep.beforeTables.length > 0 ? 'After' : 'Result'}
              </h3>
              {currentStep.afterTables.map((table, ti) => {
                const { columns, rows } = snapshotToRecords(table);
                return (
                  <TableViewer
                    key={ti}
                    columns={columns}
                    rows={rows}
                    caption={table.name}
                    className="border-zinc-800"
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <StepNavigator
        currentStep={stepIndex}
        totalSteps={totalSteps}
        isPlaying={isPlaying}
        playbackSpeed={playbackSpeed}
        onPrev={prev}
        onNext={next}
        onTogglePlay={togglePlay}
        onSpeedChange={setSpeed}
        className="sticky bottom-4 border-zinc-800 bg-zinc-900/95 shadow-xl backdrop-blur"
      />

      {/* Next Lesson CTA */}
      {isLastStep && nextLesson && (
        <Link
          href={`/learn/${topicSlug}/${nextLesson.slug}`}
          className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
        >
          <CheckCircle2 size={16} />
          Next Lesson: {nextLesson.title}
        </Link>
      )}
    </div>
  );
}
