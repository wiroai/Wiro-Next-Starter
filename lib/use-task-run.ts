'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormValues } from './catalog/schema';
import { entryFromTask, saveEntry, updateEntry } from './history';
import type { TaskView } from './tasks';

export type RunRequest = {
  model: string;
  values: FormValues;
  /** Length of the input audio, for prices per audio second. */
  mediaSeconds?: number;
};

/** What the History page shows for the run. */
export type RunLabel = { modelTitle: string; source: string; prompt?: string };

export type RunState =
  | { phase: 'idle' }
  | { phase: 'running'; startedAt: number; task: TaskView | null }
  | { phase: 'done'; startedAt: number; finishedAt: number; task: TaskView }
  | { phase: 'error'; startedAt: number; finishedAt: number; message: string; task: TaskView | null };

/** Stop polling after this long; the task may still finish on Wiro AI. */
const MAX_WAIT_MS = 30 * 60 * 1000;
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

/** Reads a task once. Returns null when the read failed. */
export async function fetchTask(token: string, signal?: AbortSignal): Promise<{ task?: TaskView; error?: string }> {
  const response = await fetch(`/api/tasks/${encodeURIComponent(token)}`, { cache: 'no-store', signal });
  const body = await readJson(response);
  if (!response.ok) return { error: typeof body.error === 'string' ? body.error : 'Could not read the task.' };
  return { task: body as unknown as TaskView };
}

/**
 * Starts a task through /api/runs, then polls /api/tasks/{token} until it ends.
 * Each run is kept in the History page from the moment it starts. Starting a
 * new run abandons the one before it in this view; it keeps running on Wiro AI.
 */
export function useTaskRun() {
  const [state, setState] = useState<RunState>({ phase: 'idle' });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = useCallback(async (request: RunRequest, label: RunLabel, pollMs = 2000): Promise<TaskView | null> => {
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

      saveEntry({
        id: token,
        model: request.model,
        modelTitle: label.modelTitle,
        source: label.source,
        prompt: label.prompt?.slice(0, 500),
        status: 'running',
        outputs: [],
        createdAt: startedAt,
      });

      let task: TaskView | null = null;
      let failures = 0;
      while (Date.now() - startedAt < MAX_WAIT_MS) {
        await sleep(pollMs, signal);
        let result: { task?: TaskView; error?: string };
        try {
          result = await fetchTask(token, signal);
        } catch (error) {
          if (signal.aborted) throw error;
          result = { error: 'Lost the connection while waiting for the task.' };
        }
        if (!result.task) {
          failures += 1;
          if (failures >= MAX_POLL_FAILURES) return fail(result.error ?? 'Could not read the task.', task);
          continue;
        }
        failures = 0;
        task = result.task;
        if (task.done) {
          updateEntry(token, entryFromTask(task));
          if (task.stage === 'done') {
            setState({ phase: 'done', startedAt, finishedAt: Date.now(), task });
            return task;
          }
          return fail(task.error ?? 'The task did not finish.', task);
        }
        setState({ phase: 'running', startedAt, task });
      }
      return fail('This is taking longer than expected. The task may still finish; it stays in History.', task);
    } catch (error) {
      if (signal.aborted) return null;
      return fail(error instanceof Error ? error.message : 'Something went wrong.', null);
    }
  }, []);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    setState({ phase: 'idle' });
  }, []);

  return { state, start, reset };
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
