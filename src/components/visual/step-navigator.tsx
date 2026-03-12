'use client';

import { cn } from '@/lib/utils/helpers';

interface StepNavigatorProps {
  currentStep: number;
  totalSteps: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onSpeedChange: (speed: number) => void;
  className?: string;
}

const SPEED_OPTIONS = [0.5, 1, 1.5, 2];

export function StepNavigator({
  currentStep,
  totalSteps,
  isPlaying,
  playbackSpeed,
  onPrev,
  onNext,
  onTogglePlay,
  onSpeedChange,
  className,
}: StepNavigatorProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={currentStep <= 0}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
          aria-label="Previous step"
        >
          ◀
        </button>

        <button
          onClick={onTogglePlay}
          className="rounded-lg bg-primary/10 p-2 text-primary transition-colors hover:bg-primary/20"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          onClick={onNext}
          disabled={currentStep >= totalSteps - 1}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
          aria-label="Next step"
        >
          ▶
        </button>
      </div>

      <span className="text-sm font-medium tabular-nums text-muted-foreground">
        Step {currentStep + 1} / {totalSteps}
      </span>

      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs text-muted-foreground">Speed:</span>
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            onClick={() => onSpeedChange(speed)}
            className={cn(
              'rounded px-2 py-1 text-xs transition-colors',
              playbackSpeed === speed
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}
