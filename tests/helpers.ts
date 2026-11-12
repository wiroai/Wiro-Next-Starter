import { vi } from 'vitest';

export type FetchCall = { url: string; init: RequestInit };

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Replaces global fetch with one that answers with `responses` in order and records each call. */
export function mockFetch(...responses: Response[]) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input instanceof Request ? input.url : input), init });
    const response = responses.shift();
    if (!response) throw new Error(`Unexpected fetch to ${String(input)}`);
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

export function headersOf(call: FetchCall): Headers {
  return new Headers(call.init.headers);
}

export function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** An OpenAI-style streamed chat completion, as the Wiro LLM gateway sends it. */
export function chatStream(text: string, cost: number): Response {
  const chunks = [
    {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'openai/gpt-5-4-nano',
      choices: [{ index: 0, delta: { role: 'assistant', content: text }, finish_reason: null }],
    },
    {
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 1,
      model: 'openai/gpt-5-4-nano',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 12, completion_tokens: 3, total_tokens: 15, cost },
    },
  ];
  const body = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

/** The JSON events of a UI message stream response. */
export async function uiStreamEvents(response: Response): Promise<Record<string, unknown>[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice('data: '.length)) as Record<string, unknown>);
}
