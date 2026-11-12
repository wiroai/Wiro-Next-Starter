import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/chat/route';
import { GET as modelsGet } from '@/app/api/chat/models/route';
import {
  chatStream,
  headersOf,
  jsonRequest,
  jsonResponse,
  routeFetch,
  uiStreamEvents,
  type FetchCall,
} from './helpers';

const CHAT = 'http://localhost/api/chat';

const GATEWAY_MODELS = {
  data: [
    {
      id: 'openai/gpt-5-4-nano',
      name: '(Wiro) GPT-5.4 Nano (OpenAI)',
      pricing: { prompt: '0.0000002', completion: '0.00000125' },
      supported_parameters: ['reasoning_effort', 'tools'],
      architecture: { input_modalities: ['text', 'image'] },
      capabilities: { endpoints: ['chat', 'responses'] },
    },
    { id: 'qwen/qwen3-32b', name: '(Wiro) Qwen3-32B', capabilities: { endpoints: ['chat'] } },
    { id: 'acme/tiny-uncensored', name: 'Tiny Uncensored', capabilities: { endpoints: ['chat'] } },
    { id: 'acme/embedder', name: 'Embedder', capabilities: { endpoints: ['embeddings'] } },
  ],
};

/** The gateway: its model list, and a streamed reply for completions. */
function gateway(reply: () => Response = () => chatStream('Fine.', 0.00001)) {
  const calls = routeFetch((call) => (call.url.endsWith('/v1/models') ? jsonResponse(GATEWAY_MODELS) : reply()));
  return () => calls.filter((call: FetchCall) => call.url.endsWith('/chat/completions'));
}

function userMessage(text: string, id = 'm1') {
  return { id, role: 'user', parts: [{ type: 'text', text }] };
}

beforeEach(() => {
  vi.stubEnv('WIRO_API_KEY', 'test-key');
  vi.stubEnv('WIRO_API_SECRET', '');
});

describe('GET /api/chat/models', () => {
  it('lists the chat models with prices per million tokens, without the "(Wiro)" prefix', async () => {
    gateway();
    const body = await (await modelsGet()).json();
    expect(body.defaultModel).toBe('openai/gpt-5-4-nano');
    expect(body.models).toEqual([
      {
        id: 'openai/gpt-5-4-nano',
        name: 'GPT-5.4 Nano (OpenAI)',
        owner: 'openai',
        inputPrice: 0.2,
        outputPrice: 1.25,
        reasoning: true,
        vision: true,
      },
      { id: 'qwen/qwen3-32b', name: 'Qwen3-32B', owner: 'qwen', reasoning: false, vision: false },
    ]);
  });
});

describe('POST /api/chat', () => {
  it('streams the reply from the gateway with the model and its cost', async () => {
    const completions = gateway(() => chatStream('Hello there.', 0.0000123));
    const response = await POST(
      jsonRequest(CHAT, { model: 'openai/gpt-5-4-nano', messages: [userMessage('Say hello.')] }),
    );

    expect(response.status).toBe(200);
    const events = await uiStreamEvents(response);
    const text = events
      .filter((event) => event.type === 'text-delta')
      .map((event) => event.delta)
      .join('');
    expect(text).toBe('Hello there.');
    expect(events.find((event) => event.type === 'start')).toMatchObject({
      messageMetadata: { model: 'openai/gpt-5-4-nano' },
    });
    expect(events.find((event) => event.type === 'finish')).toMatchObject({
      messageMetadata: { model: 'openai/gpt-5-4-nano', cost: 0.0000123 },
    });

    const [call] = completions();
    expect(call.url).toBe('https://llm.wiro.ai/v1/chat/completions');
    expect(headersOf(call).get('authorization')).toBe('Bearer test-key');
    const body = JSON.parse(String(call.init.body));
    expect(body).toMatchObject({ model: 'openai/gpt-5-4-nano', stream: true, reasoning_effort: 'low' });
    expect(body.messages[0]).toMatchObject({ role: 'system' });
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Say hello.' });
  });

  it('sends no reasoning effort to models without it', async () => {
    const completions = gateway();
    await (await POST(jsonRequest(CHAT, { model: 'qwen/qwen3-32b', messages: [userMessage('Hi')] }))).text();
    expect(JSON.parse(String(completions()[0].init.body))).not.toHaveProperty('reasoning_effort');
  });

  it('uses key:secret on the gateway for signature projects', async () => {
    vi.stubEnv('WIRO_API_SECRET', 'test-secret');
    const completions = gateway();
    await (await POST(jsonRequest(CHAT, { model: 'openai/gpt-5-4-nano', messages: [userMessage('Hi')] }))).text();
    expect(headersOf(completions()[0]).get('authorization')).toBe('Bearer test-key:test-secret');
  });

  it('sends text only and drops a leading assistant message', async () => {
    const completions = gateway();
    const messages = [
      { id: 'a0', role: 'assistant', parts: [{ type: 'text', text: 'Welcome!' }] },
      {
        id: 'u1',
        role: 'user',
        parts: [
          { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,AAAA' },
          { type: 'text', text: 'How are you?' },
        ],
      },
    ];
    await (await POST(jsonRequest(CHAT, { model: 'openai/gpt-5-4-nano', messages }))).text();
    const body = JSON.parse(String(completions()[0].init.body));
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1]).toEqual({ role: 'user', content: 'How are you?' });
  });

  it('refuses models the gateway does not list, and hidden ones', async () => {
    const completions = gateway();
    for (const model of ['openai/gpt-0', 'acme/tiny-uncensored', 'acme/embedder']) {
      const response = await POST(jsonRequest(CHAT, { model, messages: [userMessage('Hi')] }));
      expect(response.status).toBe(400);
    }
    expect(completions()).toHaveLength(0);
  });

  it('refuses a very long message', async () => {
    const completions = gateway();
    const response = await POST(
      jsonRequest(CHAT, { model: 'openai/gpt-5-4-nano', messages: [userMessage('x'.repeat(8001))] }),
    );
    expect(response.status).toBe(400);
    expect(completions()).toHaveLength(0);
  });

  it('says when the key is missing', async () => {
    vi.stubEnv('WIRO_API_KEY', '');
    gateway();
    const response = await POST(jsonRequest(CHAT, { model: 'openai/gpt-5-4-nano', messages: [userMessage('Hi')] }));
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toMatch(/WIRO_API_KEY/);
  });
});
