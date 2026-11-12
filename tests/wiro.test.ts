import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authHeaders,
  ConfigError,
  describeError,
  gatewayApiKey,
  getCredentials,
  getTask,
  nextNonce,
  runModel,
  WiroApiError,
} from '@/lib/wiro';
import { headersOf, jsonResponse, mockFetch } from './helpers';

beforeEach(() => {
  vi.stubEnv('WIRO_API_KEY', 'test-key');
  vi.stubEnv('WIRO_API_SECRET', '');
});

describe('credentials', () => {
  it('reads the key, and the secret when it is set', () => {
    expect(getCredentials()).toEqual({ apiKey: 'test-key', apiSecret: undefined });
    vi.stubEnv('WIRO_API_SECRET', 'test-secret');
    expect(getCredentials()).toEqual({ apiKey: 'test-key', apiSecret: 'test-secret' });
  });

  it('explains a missing key', () => {
    vi.stubEnv('WIRO_API_KEY', '  ');
    expect(() => getCredentials()).toThrow(ConfigError);
    expect(() => getCredentials()).toThrow(/WIRO_API_KEY is not set/);
  });

  it('joins key and secret for the LLM gateway', () => {
    expect(gatewayApiKey({ apiKey: 'k' })).toBe('k');
    expect(gatewayApiKey({ apiKey: 'k', apiSecret: 's' })).toBe('k:s');
  });
});

describe('authHeaders', () => {
  it('sends only the key for API key projects', () => {
    expect(authHeaders({ apiKey: 'k' })).toEqual({ 'x-api-key': 'k' });
  });

  it('signs with HMAC-SHA256 of secret + nonce, keyed with the API key', () => {
    const expected = createHmac('sha256', 'k').update('s1700000000000').digest('hex');
    expect(authHeaders({ apiKey: 'k', apiSecret: 's' }, '1700000000000')).toEqual({
      'x-api-key': 'k',
      'x-nonce': '1700000000000',
      'x-signature': expected,
    });
  });

  it('never repeats a nonce', () => {
    const first = Number(nextNonce(5));
    const second = Number(nextNonce(5));
    expect(second).toBeGreaterThan(first);
  });
});

describe('runModel', () => {
  it('posts the parameters to /Run/{owner}/{model} and returns the task token', async () => {
    const calls = mockFetch(jsonResponse({ result: true, errors: [], taskid: '42', socketaccesstoken: 'tok_abc123' }));

    await expect(runModel('pruna/p-image', { prompt: 'a boat', aspectRatio: '1:1' })).resolves.toEqual({
      token: 'tok_abc123',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.wiro.ai/v1/Run/pruna/p-image');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ prompt: 'a boat', aspectRatio: '1:1' });
    expect(headersOf(calls[0]).get('x-api-key')).toBe('test-key');
    expect(headersOf(calls[0]).get('x-signature')).toBeNull();
  });

  it('signs requests for signature projects', async () => {
    vi.stubEnv('WIRO_API_SECRET', 'test-secret');
    const calls = mockFetch(jsonResponse({ result: true, taskid: '1', socketaccesstoken: 'tok_abc123' }));
    await runModel('pruna/p-image', { prompt: 'a boat' });
    const headers = headersOf(calls[0]);
    const nonce = headers.get('x-nonce')!;
    expect(headers.get('x-signature')).toBe(
      createHmac('sha256', 'test-key').update(`test-secret${nonce}`).digest('hex'),
    );
  });

  it('turns result: false into an error with the code', async () => {
    mockFetch(jsonResponse({ result: false, errors: [{ code: 97, message: 'Insufficient balance' }] }));
    const error = await runModel('pruna/p-image', { prompt: 'a boat' }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WiroApiError);
    expect(error).toMatchObject({ message: 'Insufficient balance', code: 97, status: 200 });
  });

  it('fails clearly on a body that is not JSON', async () => {
    mockFetch(new Response('<html>Bad gateway</html>', { status: 502 }));
    await expect(runModel('pruna/p-image', { prompt: 'a boat' })).rejects.toThrow('HTTP 502 without JSON');
  });
});

describe('getTask', () => {
  it('reads a task by its token', async () => {
    const calls = mockFetch(jsonResponse({ result: true, tasklist: [{ status: 'task_start' }] }));
    await expect(getTask('tok_abc123')).resolves.toEqual({ status: 'task_start' });
    expect(calls[0].url).toBe('https://api.wiro.ai/v1/Task/Detail');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ tasktoken: 'tok_abc123' });
  });

  it('fails when the list is empty', async () => {
    mockFetch(jsonResponse({ result: true, tasklist: [] }));
    await expect(getTask('tok_abc123')).rejects.toMatchObject({ status: 404 });
  });
});

describe('describeError', () => {
  it.each([
    [new ConfigError('WIRO_API_KEY is not set.'), 500, /WIRO_API_KEY/],
    [new WiroApiError('Insufficient balance', 200, 97), 402, /balance is too low/],
    [new WiroApiError('Concurrency limit', 200, 96), 429, /Too many tasks/],
    [new WiroApiError('Project authorization is not founded.', 200), 502, /did not accept the API key/],
    [new WiroApiError('Request parameter [prompt] required', 200), 502, /Request parameter/],
    [Object.assign(new Error('timed out'), { name: 'TimeoutError' }), 504, /too long/],
    [new TypeError('fetch failed'), 502, /Could not reach Wiro AI/],
  ])('maps %s', (error, status, message) => {
    const described = describeError(error);
    expect(described.status).toBe(status);
    expect(described.message).toMatch(message);
  });
});
