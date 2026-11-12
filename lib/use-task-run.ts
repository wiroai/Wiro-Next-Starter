'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaKind } from './models';
import type { TaskView } from './tasks';

export type RunRequest = {
  kind: MediaKind;
  model: string;
  prompt: string;
  settings: Record<string, string>;
  imageUrl?: string;
};

export type RunState =
  | { phase: 'idle' }
  | { phase: 'running'; startedAt: number; task: TaskView | null }
  | { phase: 'done'; startedAt: number; finishedAt: number; task: TaskView }
  | { phase: 'error'; startedAt: number; finishedAt: number; message: string; task: TaskView | null };

/** Stop polling after this long; the task may still finish on Wiro AI. */
const MAX_WAIT_MS = 20 * 60 * 1000;

/** Consecutive failed polls before giving up. */
const MAX_POLL_FAILURES = 5;

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Starts a task through /api/runs, then polls /api/tasks/{token} until it ends.
 * Starting a new run abandons the one before it.
 */
export function useTaskRun(pollMs: number) {
  const [state, setState] = useState<RunState>({ phase: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = useCallback(
    async (request: RunRequest): Promise<TaskView | null> => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const { signal } = controller;
      const startedAt = Date.now();
      setState({ phase: 'running', startedAt, task: null });

      const fail = (message: string, task: TaskView | null) => {
        if (!signal.aborted) setState({ phase: 'error', startedAt, finishedAt: Date.now(), message, task });
        return null;
      };

      try {
        const response = await fetch('/api/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal,
        });
        const started = await readJson(response);
        const token = typeof started.token === 'string' ? started.token : null;
        if (!response.ok || !token) {
          return fail(
            typeof started.error === 'string' ? started.error : `The run did not start (HTTP ${response.status}).`,
            null,
          );
        }

        let task: TaskView | null = null;
        let failures = 0;
        while (Date.now() - startedAt < MAX_WAIT_MS) {
          await sleep(pollMs, signal);
          let poll: Response;
          try {
            poll = await fetch(`/api/tasks/${encodeURIComponent(token)}`, { cache: 'no-store', signal });
          } catch (error) {
            if (signal.aborted) throw error;
            failures += 1;
            if (failures >= MAX_POLL_FAILURES) return fail('Lost the connection while waiting for the task.', task);
            continue;
          }
          const body = await readJson(poll);
          if (!poll.ok) {
            failures += 1;
            if (failures >= MAX_POLL_FAILURES) {
              return fail(typeof body.error === 'string' ? body.error : 'Could not read the task.', task);
            }
            continue;
          }
          failures = 0;
          task = body as unknown as TaskView;
          if (task.done) {
            if (task.stage === 'done') {
              setState({ phase: 'done', startedAt, finishedAt: Date.now(), task });
              return task;
            }
            return fail(task.error ?? 'The task did not finish.', task);
          }
          setState({ phase: 'running', startedAt, task });
        }
        return fail(
          'This is taking longer than expected. The task may still finish; check your Wiro AI dashboard.',
          task,
        );
      } catch (error) {
        if (signal.aborted) return null;
        return fail(error instanceof Error ? error.message : 'Something went wrong.', null);
      }
    },
    [pollMs],
  );

  return { state, start };
}

/** Milliseconds since `startedAt`, ticking until `finishedAt` is set. */
export function useElapsed(startedAt?: number, finishedAt?: number): number {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (startedAt === undefined || finishedAt !== undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [startedAt, finishedAt]);

  if (startedAt === undefined) return 0;
  const end = finishedAt ?? (now !== null && now > startedAt ? now : startedAt);
  return end - startedAt;
}
