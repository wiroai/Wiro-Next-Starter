/**
 * Task statuses from https://wiro.ai/docs/tasks, folded into the few stages the
 * UI shows. Shared by the route handlers and the browser.
 */

export type Stage = 'queued' | 'preparing' | 'generating' | 'saving' | 'done' | 'failed' | 'cancelled';

/** The stages a running task moves through, in order. */
export const PROGRESS_STAGES: { stage: Stage; label: string }[] = [
  { stage: 'queued', label: 'Queued' },
  { stage: 'preparing', label: 'Preparing' },
  { stage: 'generating', label: 'Generating' },
  { stage: 'saving', label: 'Saving' },
];

const STAGE_BY_STATUS: Record<string, Stage> = {
  task_queue: 'queued',
  task_accept: 'preparing',
  task_preprocess_start: 'preparing',
  task_preprocess_end: 'preparing',
  task_assign: 'preparing',
  // A persisted task_error is a setup failure that Wiro AI retries; the task is still open.
  task_error: 'preparing',
  task_start: 'generating',
  task_output: 'generating',
  task_output_full: 'generating',
  task_error_full: 'generating',
  task_end: 'saving',
  task_postprocess_start: 'saving',
};

/** One task as `Task/Detail` returns it. Only the fields this app reads. */
export type WiroTask = {
  status?: string;
  pexit?: string;
  debugerror?: string;
  elapsedseconds?: string;
  totalcost?: string;
  outputs?: { name?: string; contenttype?: string; url?: string }[];
};

export type TaskOutput = { url: string; contentType: string; name: string };

/** What the browser gets back when it polls a task. */
export type TaskView = {
  status: string;
  stage: Stage;
  done: boolean;
  outputs: TaskOutput[];
  /** Billed amount in USD, once the task is done. */
  cost: number | null;
  seconds: number | null;
  error: string | null;
};

function toNumber(value: string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function shortError(text: string | undefined): string | null {
  const message = text?.replace(/\s+/g, ' ').trim();
  if (!message) return null;
  return message.length > 300 ? `${message.slice(0, 297)}...` : message;
}

export function toTaskView(task: WiroTask): TaskView {
  const status = task.status ?? 'task_queue';
  const outputs: TaskOutput[] = (task.outputs ?? [])
    .filter((output) => typeof output.url === 'string' && output.url.startsWith('https://'))
    .map((output) => ({
      url: output.url as string,
      contentType: output.contenttype ?? '',
      name: output.name ?? '',
    }));
  const base = { status, outputs, seconds: toNumber(task.elapsedseconds), cost: null, error: null };

  if (status === 'task_cancel') {
    return { ...base, stage: 'cancelled', done: true, error: 'The task was cancelled.' };
  }
  if (status === 'task_postprocess_end') {
    if (task.pexit === '0' && outputs.length > 0) {
      return { ...base, stage: 'done', done: true, cost: toNumber(task.totalcost) };
    }
    return {
      ...base,
      stage: 'failed',
      done: true,
      cost: toNumber(task.totalcost),
      error:
        shortError(task.debugerror) ??
        (task.pexit === '0' ? 'The model finished without an output file.' : 'The model could not finish this task.'),
    };
  }
  return { ...base, stage: STAGE_BY_STATUS[status] ?? 'preparing', done: false };
}

/** `$0.005`, `$0.05`, `$0.42`: enough digits to show small amounts. */
export function formatCost(cost: number | null | undefined): string | null {
  if (cost === null || cost === undefined || !Number.isFinite(cost)) return null;
  if (cost === 0) return '$0';
  const digits = cost < 0.001 ? 6 : cost < 0.01 ? 4 : 3;
  return `$${cost.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')}`;
}

/** `0:07`, `1:24` */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}
