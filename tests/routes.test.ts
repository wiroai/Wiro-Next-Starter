import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as runPost } from '@/app/api/runs/route';
import { GET as taskGet } from '@/app/api/tasks/[token]/route';
import { jsonRequest, jsonResponse, mockFetch } from './helpers';

beforeEach(() => {
  vi.stubEnv('WIRO_API_KEY', 'test-key');
  vi.stubEnv('WIRO_API_SECRET', '');
});

const RUNS = 'http://localhost/api/runs';

describe('POST /api/runs', () => {
  it('starts a task and returns only its token', async () => {
    const calls = mockFetch(jsonResponse({ result: true, taskid: '12345', socketaccesstoken: 'tok_abc123' }));
    const response = await runPost(
      jsonRequest(RUNS, {
        kind: 'video',
        model: 'bytedance/seedance-v1-pro-fast',
        prompt: 'A paper boat drifts across a lake',
        settings: { ratio: '9:16' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ token: 'tok_abc123' });
    expect(calls[0].url).toBe('https://api.wiro.ai/v1/Run/bytedance/seedance-v1-pro-fast');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      prompt: 'A paper boat drifts across a lake',
      ratio: '9:16',
      resolution: '480p',
      duration: '5',
    });
  });

  it('refuses a model that is not in lib/models.ts', async () => {
    const calls = mockFetch();
    const response = await runPost(jsonRequest(RUNS, { kind: 'image', model: 'google/veo3-1', prompt: 'a boat' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/not one of/) });
    expect(calls).toHaveLength(0);
  });

  it('refuses a setting outside the choices', async () => {
    const calls = mockFetch();
    const response = await runPost(
      jsonRequest(RUNS, { kind: 'image', model: 'openai/gpt-image-2', prompt: 'a boat', settings: { quality: 'max' } }),
    );
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('refuses a body that is not valid', async () => {
    mockFetch();
    expect((await runPost(jsonRequest(RUNS, '{not json'))).status).toBe(400);
    expect((await runPost(jsonRequest(RUNS, { kind: 'audio', model: 'x', prompt: 'y' }))).status).toBe(400);
  });

  it('says when the key is missing', async () => {
    vi.stubEnv('WIRO_API_KEY', '');
    const calls = mockFetch();
    const response = await runPost(jsonRequest(RUNS, { kind: 'image', model: 'pruna/p-image', prompt: 'a boat' }));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/WIRO_API_KEY/) });
    expect(calls).toHaveLength(0);
  });

  it('passes on a low balance as 402', async () => {
    mockFetch(jsonResponse({ result: false, errors: [{ code: 97, message: 'Insufficient balance' }] }));
    const response = await runPost(jsonRequest(RUNS, { kind: 'image', model: 'pruna/p-image', prompt: 'a boat' }));
    expect(response.status).toBe(402);
  });
});

describe('GET /api/tasks/[token]', () => {
  const context = (token: string) => ({ params: Promise.resolve({ token }) });

  it('returns the task stage and outputs', async () => {
    const calls = mockFetch(
      jsonResponse({
        result: true,
        tasklist: [
          {
            id: '12345',
            status: 'task_postprocess_end',
            pexit: '0',
            totalcost: '0.05',
            elapsedseconds: '35.0000',
            outputs: [{ name: '0.mp4', contenttype: 'video/mp4', url: 'https://cdn1.wiro.ai/x/0.mp4' }],
          },
        ],
      }),
    );
    const response = await taskGet(new Request('http://localhost/api/tasks/tok_abc123'), context('tok_abc123'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({ stage: 'done', done: true, cost: 0.05, seconds: 35 });
    expect(body).not.toHaveProperty('id');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ tasktoken: 'tok_abc123' });
  });

  it('refuses a token with unexpected characters', async () => {
    const calls = mockFetch();
    const response = await taskGet(new Request('http://localhost/api/tasks/x'), context('../Task/List'));
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('passes on an unknown task as 404', async () => {
    mockFetch(jsonResponse({ result: false, errors: [{ code: 0, message: 'There is no task yet.' }] }));
    const response = await taskGet(new Request('http://localhost/api/tasks/tok_abc123'), context('tok_abc123'));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'There is no task yet.' });
  });
});
