'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clearHistory, entryFromTask, removeEntry, updateEntry, useHistory, type HistoryEntry } from '@/lib/history';
import { formatCost, type OutputKind } from '@/lib/tasks';
import { fetchTask } from '@/lib/use-task-run';
import { nextSteps } from './result-view';
import { Badge, Button, buttonClass, cx, ExternalIcon } from './ui';

const FILTERS: { id: 'all' | OutputKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
  { id: 'text', label: 'Text' },
];

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Keeps running entries up to date while the page is open. */
function useFollowRunning(entries: HistoryEntry[]) {
  const running = entries
    .filter((entry) => entry.status === 'running')
    .map((entry) => entry.id)
    .join(',');
  useEffect(() => {
    if (!running) return;
    const ids = running.split(',');
    let active = true;
    const timer = setInterval(() => {
      for (const id of ids) {
        void fetchTask(id).then((result) => {
          if (active && result.task?.done) updateEntry(id, entryFromTask(result.task));
        });
      }
    }, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [running]);
}

function kindOf(entry: HistoryEntry): OutputKind {
  return entry.outputs[0]?.kind ?? (entry.text ? 'text' : 'file');
}

function Thumb({ entry }: { entry: HistoryEntry }) {
  const output = entry.outputs[0];
  const base = 'flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-foreground/[0.04]';
  if (entry.status === 'running') {
    return <div className={cx(base, 'text-sm text-muted')}>Running…</div>;
  }
  if (output?.kind === 'image') {
    return (
      <div className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element -- remote outputs */}
        <img src={output.url} alt={entry.prompt ?? ''} loading="lazy" className="size-full object-cover" />
      </div>
    );
  }
  if (output?.kind === 'video') {
    return (
      <div className={base}>
        <video src={output.url} muted playsInline preload="metadata" controls className="size-full object-cover" />
      </div>
    );
  }
  if (output?.kind === 'audio') {
    return (
      <div className={cx(base, 'px-4')}>
        <audio src={output.url} controls preload="none" className="w-full" />
      </div>
    );
  }
  if (entry.text) {
    return (
      <div className={cx(base, 'items-start p-4')}>
        <p className="line-clamp-6 text-left text-xs leading-relaxed text-muted">{entry.text}</p>
      </div>
    );
  }
  return <div className={cx(base, 'text-sm text-muted')}>{entry.status === 'done' ? 'No preview' : 'No result'}</div>;
}

/** Runs from this browser, newest first, with their outputs and costs. */
export function HistoryView() {
  const entries = useHistory();
  const [filter, setFilter] = useState<'all' | OutputKind>('all');
  const [confirming, setConfirming] = useState(false);
  useFollowRunning(entries);

  const shown = filter === 'all' ? entries : entries.filter((entry) => kindOf(entry) === filter);
  const spent = entries.reduce((sum, entry) => sum + (entry.cost ?? 0), 0);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border p-8">
        <p className="text-muted">
          Nothing here yet. Runs from the Playground and the Image, Video and Audio pages show up here.
        </p>
        <Link href="/image" className={buttonClass('primary')}>
          Make an image
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={cx(
                'rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                filter === item.id
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted hover:text-foreground',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="tabular-nums">
            {entries.length} runs · {formatCost(spent) ?? '$0'} in total
          </span>
          {confirming ? (
            <>
              <Button
                variant="secondary"
                className="h-8 px-3 text-danger"
                onClick={() => {
                  clearHistory();
                  setConfirming(false);
                }}
              >
                Clear all
              </Button>
              <Button variant="ghost" className="h-8 px-3" onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="ghost" className="h-8 px-3" onClick={() => setConfirming(true)}>
              Clear history
            </Button>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((entry) => {
          const output = entry.outputs[0];
          const steps = output ? nextSteps(output) : [];
          return (
            <li
              key={entry.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs"
            >
              <Thumb entry={entry} />
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[13px] font-medium">{entry.model}</p>
                    <p className="truncate text-xs text-muted">{entry.source}</p>
                  </div>
                  {entry.status === 'done' ? (
                    <span className="shrink-0 text-xs text-muted tabular-nums">{formatCost(entry.cost) ?? ''}</span>
                  ) : (
                    <Badge className={entry.status === 'running' ? '' : 'text-danger'}>{entry.status}</Badge>
                  )}
                </div>
                {entry.prompt ? <p className="line-clamp-2 text-sm text-pretty">{entry.prompt}</p> : null}
                {entry.error ? <p className="line-clamp-2 text-xs text-danger">{entry.error}</p> : null}
                <div className="mt-auto flex items-center gap-2 pt-1">
                  <span className="mr-auto text-xs whitespace-nowrap text-muted">{DATE.format(entry.createdAt)}</span>
                  {steps.slice(0, 2).map((step) => (
                    <Link key={step.label} href={step.href} className={buttonClass('secondary', 'h-7 px-2.5 text-xs')}>
                      {step.label}
                    </Link>
                  ))}
                  {output ? (
                    <a
                      href={output.url}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonClass('secondary', 'h-7 px-2.5 text-xs')}
                      aria-label="Open the output"
                    >
                      <ExternalIcon />
                    </a>
                  ) : null}
                  <Button
                    variant="ghost"
                    className="h-7 px-1.5"
                    onClick={() => removeEntry(entry.id)}
                    aria-label="Remove from history"
                    title="Remove from history"
                  >
                    <svg className="size-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">
        History lives in this browser only. Your Wiro AI dashboard lists every task of the project.
      </p>
    </div>
  );
}
