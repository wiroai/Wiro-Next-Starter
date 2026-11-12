import 'server-only';

import { createHmac } from 'node:crypto';
import type { WiroTask } from '../tasks';

/**
 * A small client for the Wiro AI Run API (https://wiro.ai/docs/run-a-model).
 * It runs on the server only, so the API key never reaches the browser.
 */

export const RUN_API_URL = 'https://api.wiro.ai/v1';
export const LLM_API_URL = 'https://llm.wiro.ai/v1';

export const USER_AGENT = 'wiro-next-starter/0.2.0';

export type Credentials = { apiKey: string; apiSecret?: string };

export class ConfigError extends Error {}

export class WiroApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message);
  }
}

/** Reads the key at request time, so builds work without it. */
export function getCredentials(): Credentials {
  const apiKey = process.env.WIRO_API_KEY?.trim();
  if (!apiKey) {
    throw new ConfigError('WIRO_API_KEY is not set. Add it to .env.local or to your host and restart the app.');
  }
  const apiSecret = process.env.WIRO_API_SECRET?.trim() || undefined;
  return { apiKey, apiSecret };
}

/** The LLM gateway takes the key, or `API_KEY:API_SECRET` for signature projects. */
export function gatewayApiKey({ apiKey, apiSecret }: Credentials = getCredentials()): string {
  return apiSecret ? `${apiKey}:${apiSecret}` : apiKey;
}

let lastNonce = 0;

/** Milliseconds since the epoch, never repeated within one server process. */
export function nextNonce(now = Date.now()): string {
  lastNonce = Math.max(now, lastNonce + 1);
  return String(lastNonce);
}

/**
 * `x-api-key` for every project. Signature projects also send a nonce and
 * HMAC-SHA256(key = API key, message = API secret + nonce), as described in
 * https://wiro.ai/docs/authentication
 */
export function authHeaders({ apiKey, apiSecret }: Credentials, nonce = nextNonce()): Record<string, string> {
  const headers: Record<string, string> = { 'x-api-key': apiKey };
  if (apiSecret) {
    headers['x-nonce'] = nonce;
    headers['x-signature'] = createHmac('sha256', apiKey)
      .update(apiSecret + nonce)
      .digest('hex');
  }
  return headers;
}

type ApiError = string | { message?: string; code?: number };

/**
 * One POST to the Run API. `auth: false` is for the public catalog (Tool/List,
 * Tool/Detail), which needs no key. Wiro answers HTTP 200 with `result: false`
 * for refused requests, so the body decides.
 */
export async function wiroPost<T>(
  path: string,
  body: unknown,
  { auth = true, timeoutMs = 30_000 }: { auth?: boolean; timeoutMs?: number } = {},
): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(`${RUN_API_URL}${path}`, {
    method: 'POST',
    headers: {
      ...(auth ? authHeaders(getCredentials()) : {}),
      Accept: 'application/json',
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      'User-Agent': USER_AGENT,
    },
    body: isForm ? body : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  });

  let data: { result?: boolean; errors?: ApiError[] } & T;
  try {
    data = await response.json();
  } catch {
    throw new WiroApiError(`Wiro AI answered HTTP ${response.status} without JSON.`, response.status);
  }

  if (data?.result !== true) {
    const errors = Array.isArray(data?.errors) ? data.errors : [];
    const message =
      errors
        .map((error) => (typeof error === 'string' ? error : error?.message))
        .filter(Boolean)
        .join('; ') || `Wiro AI answered HTTP ${response.status}.`;
    const code = errors.find((error): error is { code: number } => typeof error === 'object' && !!error?.code)?.code;
    throw new WiroApiError(message, response.status, code);
  }
  return data;
}

/** Starts a model run and returns the task token used to follow it. */
export async function runModel(modelId: string, params: Record<string, unknown>): Promise<{ token: string }> {
  const [owner, project] = modelId.split('/');
  const data = await wiroPost<{ taskid?: string; socketaccesstoken?: string }>(
    `/Run/${encodeURIComponent(owner)}/${encodeURIComponent(project)}`,
    params,
  );
  if (!data.socketaccesstoken) throw new WiroApiError('Wiro AI started no task.', 502);
  return { token: String(data.socketaccesstoken) };
}

/** Reads a task by its token (https://wiro.ai/docs/tasks). */
export async function getTask(token: string): Promise<WiroTask> {
  const data = await wiroPost<{ tasklist?: WiroTask[] }>('/Task/Detail', { tasktoken: token });
  const task = data.tasklist?.[0];
  if (!task) throw new WiroApiError('There is no task with this token.', 404);
  return task;
}

export type UploadedFile = { url: string; name: string; contentType: string; size: number };

/** Stores a file with Wiro AI and returns its URL, which runs can take as a file input. */
export async function uploadFile(file: Blob, name: string): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file, name);
  const data = await wiroPost<{ list?: { url?: string; name?: string; contenttype?: string; size?: string }[] }>(
    '/File/Upload',
    form,
    { timeoutMs: 120_000 },
  );
  const item = data.list?.[0];
  if (!item?.url) throw new WiroApiError('Wiro AI stored no file.', 502);
  return {
    url: item.url,
    name: item.name ?? name,
    contentType: item.contenttype ?? file.type,
    size: Number(item.size) || file.size,
  };
}

/** Turns any error into a status code and a message that is safe to show. */
export function describeError(error: unknown): { status: number; message: string } {
  if (error instanceof ConfigError) return { status: 500, message: error.message };
  if (error instanceof WiroApiError) {
    if (error.code === 97) {
      return {
        status: 402,
        message: 'The Wiro AI balance is too low for this run. Add funds at wiro.ai/panel/billing.',
      };
    }
    if (error.code === 96) {
      return { status: 429, message: 'Too many tasks are running at once. Try again in a moment.' };
    }
    if (error.status === 401 || error.status === 403 || /authorization/i.test(error.message)) {
      return {
        status: 502,
        message: 'Wiro AI did not accept the API key. Check WIRO_API_KEY, and WIRO_API_SECRET for signature projects.',
      };
    }
    if (/spend limit/i.test(error.message)) return { status: 402, message: error.message };
    if (error.status === 404 || /no task/i.test(error.message)) return { status: 404, message: error.message };
    return { status: 502, message: error.message };
  }
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
    return { status: 504, message: 'Wiro AI took too long to answer. Try again.' };
  }
  return { status: 502, message: 'Could not reach Wiro AI. Try again.' };
}
