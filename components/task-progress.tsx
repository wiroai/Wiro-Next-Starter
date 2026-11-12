import { formatElapsed, PROGRESS_STAGES, type Stage } from '@/lib/tasks';
import { cx } from './ui';

function roughDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} seconds`;
  const minutes = Math.round(seconds / 60);
  return minutes === 1 ? 'a minute' : `${minutes} minutes`;
}

/** The stages of a running task, with the current one highlighted. */
export function TaskProgress({
  stage,
  elapsedMs,
  expectedSeconds,
}: {
  stage: Stage | null;
  elapsedMs: number;
  /** How long runs of this model usually take. */
  expectedSeconds?: number;
}) {
  const current = Math.max(
    0,
    PROGRESS_STAGES.findIndex((step) => step.stage === (stage ?? 'queued')),
  );
  const label = stage === null ? 'Starting' : (PROGRESS_STAGES[current]?.label ?? 'Working');

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium">{label}…</p>
        <p className="font-mono text-sm text-muted tabular-nums" aria-label="Elapsed time">
          {formatElapsed(elapsedMs)}
        </p>
      </div>
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Task progress">
        {PROGRESS_STAGES.map((step, index) => {
          const state =
            stage === null ? 'pending' : index < current ? 'done' : index === current ? 'current' : 'pending';
          return (
            <li
              key={step.stage}
              className="flex flex-col gap-2"
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span
                className={cx(
                  'h-1 overflow-hidden rounded-full',
                  state === 'done' ? 'bg-foreground' : 'bg-foreground/10',
                )}
              >
                {state === 'current' ? (
                  <span className="block h-full w-full origin-left bg-foreground motion-safe:animate-[progress_1.6s_ease-in-out_infinite] motion-reduce:opacity-60" />
                ) : null}
              </span>
              <span className={cx('text-xs', state === 'pending' ? 'text-subtle' : 'text-foreground')}>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      {expectedSeconds ? (
        <p className="text-xs text-muted">Runs of this model usually take about {roughDuration(expectedSeconds)}.</p>
      ) : null}
    </div>
  );
}
