import { vi } from 'vitest';

export type FetchCall = { url: string; method: string; init: RequestInit };

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Replaces global fetch with one that answers with `responses` in order and records each call. */
export function mockFetch(...responses: Response[]) {
  return routeFetch(() => {
    const response = responses.shift();
    if (!response) throw new Error('Unexpected fetch');
    return response;
  });
}

/** Replaces global fetch with a handler that picks the answer from the request, and records each call. */
export function routeFetch(handler: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const call = {
        url: String(input instanceof Request ? input.url : input),
        method: (init.method ?? 'GET').toUpperCase(),
        init,
      };
      calls.push(call);
      return handler(call);
    }),
  );
  return calls;
}

export function headersOf(call: FetchCall): Headers {
  return new Headers(call.init.headers);
}

export function bodyOf(call: FetchCall): Record<string, unknown> {
  return JSON.parse(String(call.init.body)) as Record<string, unknown>;
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

/** A Tool/Detail item the way the catalog sends it, for a small image model. */
export function toolItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    cleanslugowner: 'pruna',
    cleanslugproject: 'p-image',
    title: 'P-Image',
    seodescription: 'Fast text to image.',
    categories: ['tool', 'text-to-image'],
    image: 'https://cdn.wiro.ai/uploads/models/p-image-cover.webp',
    dynamicprice: '[{"inputs":{},"price":0.005,"priceMethod":"cpr"}]',
    cps: '0',
    approximatelycost: '0',
    taskstat: { runcount: '100', successcount: '100', elapsedseconds: '900' },
    parameters: [
      {
        title: 'Inputs',
        items: [
          { id: 'prompt', type: 'textarea', label: 'Prompt', required: true, defaultvalue: 'A sample prompt' },
          {
            id: 'aspectRatio',
            type: 'select',
            label: 'Aspect ratio',
            defaultvalue: '16:9',
            options: [
              { value: '1:1', label: '1:1' },
              { value: '16:9', label: '16:9' },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}
