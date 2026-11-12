import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/chat/route';
import { chatStream, headersOf, jsonRequest, mockFetch, uiStreamEvents } from './helpers';

const CHAT = 'http://localhost/api/chat';

function userMessage(text: string, id = 'm1') {
  return { id, role: 'user', parts: [{ type: 'text', text }] };
}

beforeEach(() => {
  vi.stubEnv('WIRO_API_KEY', 'test-key');
  vi.stubEnv('WIRO_API_SECRET', '');
});

describe('POST /api/chat', () => {
  it('streams the reply from the gateway with the model and its cost', async () => {
    const calls = mockFetch(chatStream('Hello there.', 0.0000123));
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

    expect(calls[0].url).toBe('https://llm.wiro.ai/v1/chat/completions');
    expect(headersOf(calls[0]).get('authorization')).toBe('Bearer test-key');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ model: 'openai/gpt-5-4-nano', stream: true, reasoning_effort: 'low' });
    expect(body.messages[0]).toMatchObject({ role: 'system' });
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'Say hello.' });
  });

  it('uses key:secret on the gateway for signature projects', async () => {
    vi.stubEnv('WIRO_API_SECRET', 'test-secret');
    const calls = mockFetch(chatStream('Hi.', 0.00001));
    await (await POST(jsonRequest(CHAT, { model: 'openai/gpt-5-4-nano', messages: [userMessage('Hi')] }))).text();
    expect(headersOf(calls[0]).get('authorization')).toBe('Bearer test-key:test-secret');
  });

  it('sends text only and drops a leading assistant message', async () => {
    const calls = mockFetch(chatStream('Fine.', 0.00001));
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
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1]).toEqual({ role: 'user', content: 'How are you?' });
  });

  it('refuses a model that is not in lib/models.ts', async () => {
    const calls = mockFetch();
    const response = await POST(jsonRequest(CHAT, { model: 'openai/gpt-6-astra', messages: [userMessage('Hi')] }));
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('refuses a very long message', async () => {
    const calls = mockFetch();
    const response = await POST(
      jsonRequest(CHAT, { model: 'openai/gpt-5-4-nano', messages: [userMessage('x'.repeat(8001))] }),
    );
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('says when the key is missing', async () => {
    vi.stubEnv('WIRO_API_KEY', '');
    const response = await POST(jsonRequest(CHAT, { model: 'openai/gpt-5-4-nano', messages: [userMessage('Hi')] }));
    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toMatch(/WIRO_API_KEY/);
  });
});
