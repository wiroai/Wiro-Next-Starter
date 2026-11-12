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
  debugoutput?: string;
  debugerror?: string;
  elapsedseconds?: string;
  totalcost?: string;
  outputs?: { name?: string; contenttype?: string; url?: string; content?: unknown }[];
};

export type OutputKind = 'image' | 'video' | 'audio' | 'text' | 'file';

export type TaskOutput = { url: string; contentType: string; name: string; kind: OutputKind };

/** What the browser gets back when it polls a task. */
export type TaskView = {
  status: string;
  stage: Stage;
  done: boolean;
  outputs: TaskOutput[];
  /** Text answer: an LLM reply, a transcript, a caption. */
  text: string | null;
  /** Billed amount in USD, once the task is done. */
  cost: number | null;
  seconds: number | null;
  error: string | null;
};

const MAX_TEXT = 50_000;

export function outputKind(contentType: string, name: string): OutputKind {
  const type = contentType.toLowerCase();
  const file = name.toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|bmp)$/.test(file)) return 'image';
  if (type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(file)) return 'video';
  if (type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac|aac)$/.test(file)) return 'audio';
  if (type.startsWith('text/') || /\.(txt|srt|vtt|md|json)$/.test(file)) return 'text';
  return 'file';
}

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

/** The text answer: structured LLM content first, then debugoutput when the task made no files. */
function textOf(task: WiroTask, files: number): string | null {
  for (const output of task.outputs ?? []) {
    if (String(output.contenttype).toLowerCase() !== 'raw') continue;
    const content = output.content;
    if (typeof content === 'string' && content.trim()) return content.trim().slice(0, MAX_TEXT);
    if (content && typeof content === 'object') {
      const record = content as { raw?: unknown; segments?: { type?: string; text?: string }[] };
      if (typeof record.raw === 'string' && record.raw.trim()) return record.raw.trim().slice(0, MAX_TEXT);
      const answer = (record.segments ?? [])
        .filter((segment) => segment?.type === 'answer')
        .map((segment) => segment.text ?? '')
        .join('')
        .trim();
      if (answer) return answer.slice(0, MAX_TEXT);
    }
  }
  // Models that make files also log progress to debugoutput, so it only counts when there are no files.
  const output = task.debugoutput?.trim();
  return files === 0 && output ? output.slice(0, MAX_TEXT) : null;
}

export function toTaskView(task: WiroTask): TaskView {
  const status = task.status ?? 'task_queue';
  const outputs: TaskOutput[] = (task.outputs ?? [])
    .filter((output) => typeof output.url === 'string' && output.url.startsWith('https://'))
    .map((output) => {
      const contentType = output.contenttype ?? '';
      const name = output.name ?? '';
      return { url: output.url as string, contentType, name, kind: outputKind(contentType, name) };
    });
  const base = {
    status,
    outputs,
    text: null,
    seconds: toNumber(task.elapsedseconds),
    cost: null,
    error: null,
  };

  if (status === 'task_cancel') {
    return { ...base, stage: 'cancelled', done: true, error: 'The task was cancelled.' };
  }
  if (status === 'task_postprocess_end') {
    const text = textOf(task, outputs.length);
    if (task.pexit === '0' && (outputs.length > 0 || text)) {
      return { ...base, text, stage: 'done', done: true, cost: toNumber(task.totalcost) };
    }
    return {
      ...base,
      stage: 'failed',
      done: true,
      cost: toNumber(task.totalcost),
      error:
        shortError(task.debugerror) ??
        (task.pexit === '0' ? 'The model finished without an output.' : 'The model could not finish this task.'),
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
