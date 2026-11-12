import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as configGet } from '@/app/api/config/route';
import { GET as modelGet } from '@/app/api/models/[owner]/[project]/route';
import { GET as modelsGet } from '@/app/api/models/route';
import { POST as runPost } from '@/app/api/runs/route';
import { GET as taskGet } from '@/app/api/tasks/[token]/route';
import { POST as uploadPost } from '@/app/api/uploads/route';
import { bodyOf, headersOf, jsonRequest, jsonResponse, routeFetch, toolItem } from './helpers';

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: async () => undefined,
}));

beforeEach(() => {
  vi.stubEnv('WIRO_API_KEY', 'test-key');
  vi.stubEnv('WIRO_API_SECRET', '');
  vi.stubEnv('MAX_RUN_PRICE', '');
});

const RUNS = 'http://localhost/api/runs';

const seedance = toolItem({
  cleanslugowner: 'bytedance',
  cleanslugproject: 'seedance-v1-pro-fast',
  title: 'Seedance V1 Pro Fast',
  categories: ['text-to-video', 'image-to-video'],
  dynamicprice: [
    { inputs: { duration: '5', resolution: '480p' }, price: 0.05, priceMethod: 'cpr' },
    { inputs: { duration: '10', resolution: '480p' }, price: 0.1, priceMethod: 'cpr' },
    { inputs: { duration: '5', resolution: '1080p' }, price: 0.24, priceMethod: 'cpr' },
  ],
  parameters: [
    {
      title: 'Inputs',
      items: [
        {
          id: 'inputImage',
          type: 'combinefileinput',
          label: 'Input Image',
          defaultvalue: 'https://cdn.wiro.ai/uploads/sampleinputs/s.jpg',
        },
        { id: 'prompt', type: 'textarea', label: 'Prompt', defaultvalue: 'A sample' },
        {
          id: 'resolution',
          type: 'select',
          label: 'Resolution',
          required: true,
          defaultvalue: '480p',
          options: [{ value: '480p' }, { value: '1080p' }],
        },
        {
          id: 'duration',
          type: 'select',
          label: 'Duration',
          required: true,
          defaultvalue: '5',
          options: [{ value: '5' }, { value: '10' }],
        },
      ],
    },
  ],
});

/** Answers Tool/Detail with the Seedance item and Run with a task. */
function wiroApi(
  run: () => Response = () => jsonResponse({ result: true, taskid: '12345', socketaccesstoken: 'tok_abc123' }),
) {
  return routeFetch((call) => {
    if (call.url.endsWith('/Tool/Detail')) return jsonResponse({ result: true, tool: [seedance] });
    if (call.url.includes('/Run/')) return run();
    throw new Error(`Unexpected fetch to ${call.url}`);
  });
}

describe('POST /api/runs', () => {
  it('checks the values against the model, starts the task and returns only its token and price', async () => {
    const calls = wiroApi();
    const response = await runPost(
      jsonRequest(RUNS, {
        model: 'bytedance/seedance-v1-pro-fast',
        values: {
          prompt: 'A paper boat',
          inputImage: ['https://cdn1.wiro.ai/a.png'],
          resolution: '480p',
          duration: '10',
          extra: 'x',
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ token: 'tok_abc123', price: '$0.10' });
    const run = calls.find((call) => call.url.includes('/Run/'))!;
    expect(run.url).toBe('https://api.wiro.ai/v1/Run/bytedance/seedance-v1-pro-fast');
    expect(headersOf(run).get('x-api-key')).toBe('test-key');
    expect(bodyOf(run)).toEqual({
      prompt: 'A paper boat',
      inputImage: ['https://cdn1.wiro.ai/a.png'],
      resolution: '480p',
      duration: '10',
    });
  });

  it('refuses values the model does not accept, before anything runs', async () => {
    const calls = wiroApi();
    const response = await runPost(
      jsonRequest(RUNS, { model: 'bytedance/seedance-v1-pro-fast', values: { prompt: 'x', resolution: '8k' } }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Resolution can\'t be "8k".' });
    expect(calls.some((call) => call.url.includes('/Run/'))).toBe(false);
  });

  it('keeps runs under MAX_RUN_PRICE', async () => {
    vi.stubEnv('MAX_RUN_PRICE', '0.1');
    const calls = wiroApi();
    const response = await runPost(
      jsonRequest(RUNS, { model: 'bytedance/seedance-v1-pro-fast', values: { prompt: 'x', resolution: '1080p' } }),
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringMatching(/\$0\.24, more than .* \$0\.10/),
    });
    expect(calls.some((call) => call.url.includes('/Run/'))).toBe(false);

    const allowed = await runPost(
      jsonRequest(RUNS, { model: 'bytedance/seedance-v1-pro-fast', values: { prompt: 'x', resolution: '480p' } }),
    );
    expect(allowed.status).toBe(200);
  });

  it('refuses models without a fixed price when MAX_RUN_PRICE is set', async () => {
    vi.stubEnv('MAX_RUN_PRICE', '1');
    routeFetch(() =>
      jsonResponse({ result: true, tool: [toolItem({ cleanslugproject: 'by-time', dynamicprice: null })] }),
    );
    const response = await runPost(jsonRequest(RUNS, { model: 'pruna/by-time', values: { prompt: 'x' } }));
    expect(response.status).toBe(403);
  });

  it('says which required inputs are missing', async () => {
    routeFetch(() => jsonResponse({ result: true, tool: [toolItem({ cleanslugproject: 'needs-prompt' })] }));
    const response = await runPost(jsonRequest(RUNS, { model: 'pruna/needs-prompt', values: {} }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Fill in Prompt first.' });
  });

  it('answers 404 for a model the catalog does not have', async () => {
    routeFetch(() => jsonResponse({ result: false, errors: [{ message: 'slug-owner-project-not-exist' }] }));
    const response = await runPost(jsonRequest(RUNS, { model: 'nobody/nothing', values: {} }));
    expect(response.status).toBe(404);
  });

  it('refuses a body that is not valid', async () => {
    routeFetch(() => jsonResponse({}));
    expect((await runPost(jsonRequest(RUNS, '{not json'))).status).toBe(400);
    expect((await runPost(jsonRequest(RUNS, { model: 'a/b', values: { x: { nested: true } } }))).status).toBe(400);
  });

  it('says when the key is missing', async () => {
    vi.stubEnv('WIRO_API_KEY', '');
    wiroApi();
    const response = await runPost(
      jsonRequest(RUNS, { model: 'bytedance/seedance-v1-pro-fast', values: { prompt: 'x' } }),
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/WIRO_API_KEY/) });
  });

  it('passes on a low balance as 402', async () => {
    wiroApi(() => jsonResponse({ result: false, errors: [{ code: 97, message: 'Insufficient balance' }] }));
    const response = await runPost(
      jsonRequest(RUNS, { model: 'bytedance/seedance-v1-pro-fast', values: { prompt: 'x' } }),
    );
    expect(response.status).toBe(402);
  });
});

describe('GET /api/models', () => {
  it('lists categories with a CDN cache header', async () => {
    routeFetch(() => jsonResponse({ result: true, total: 1, tool: [toolItem({ cleanslugproject: 'listed' })] }));
    const response = await modelsGet(new Request('http://localhost/api/models?categories=route-test-category'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toMatch(/s-maxage/);
    const body = await response.json();
    expect(body.models[0]).toMatchObject({ id: 'pruna/listed', price: '$0.005 / run' });
  });

  it('refuses requests without categories or with odd ones', async () => {
    routeFetch(() => jsonResponse({}));
    expect((await modelsGet(new Request('http://localhost/api/models'))).status).toBe(400);
    expect((await modelsGet(new Request('http://localhost/api/models?categories=../x'))).status).toBe(400);
  });
});

describe('GET /api/models/[owner]/[project]', () => {
  it('returns the model, or 404', async () => {
    routeFetch((call) =>
      bodyOf(call).slugproject === 'gone'
        ? jsonResponse({ result: false, errors: [{ message: 'slug-owner-project-not-exist' }] })
        : jsonResponse({ result: true, tool: [toolItem({ cleanslugproject: 'route-detail' })] }),
    );
    const ok = await modelGet(new Request('http://localhost/x'), {
      params: Promise.resolve({ owner: 'pruna', project: 'route-detail' }),
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).model.params).toHaveLength(2);
    const missing = await modelGet(new Request('http://localhost/x'), {
      params: Promise.resolve({ owner: 'pruna', project: 'gone' }),
    });
    expect(missing.status).toBe(404);
  });
});

describe('POST /api/uploads', () => {
  function upload(file?: File) {
    const form = new FormData();
    if (file) form.append('file', file);
    return uploadPost(new Request('http://localhost/api/uploads', { method: 'POST', body: form }));
  }

  it('stores the file with Wiro AI and returns its URL', async () => {
    const calls = routeFetch(() =>
      jsonResponse({
        result: true,
        list: [{ url: 'https://cdn1.wiro.ai/u/photo.png', name: 'photo.png', contenttype: 'image/png', size: '4' }],
      }),
    );
    const response = await upload(new File([new Uint8Array([1, 2, 3, 4])], 'my photo.png', { type: 'image/png' }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      file: { url: 'https://cdn1.wiro.ai/u/photo.png', name: 'photo.png', contentType: 'image/png', size: 4 },
    });
    expect(calls[0].url).toBe('https://api.wiro.ai/v1/File/Upload');
    expect(headersOf(calls[0]).get('x-api-key')).toBe('test-key');
    expect(calls[0].init.body).toBeInstanceOf(FormData);
  });

  it('refuses no file, an empty file, other file types and files over the limit', async () => {
    vi.stubEnv('MAX_UPLOAD_MB', '0.000001');
    const calls = routeFetch(() => jsonResponse({}));
    expect((await upload()).status).toBe(400);
    expect((await upload(new File([], 'empty.png', { type: 'image/png' }))).status).toBe(400);
    expect((await upload(new File(['x'], 'a.exe', { type: 'application/x-msdownload' }))).status).toBe(415);
    expect((await upload(new File([new Uint8Array(10)], 'big.png', { type: 'image/png' }))).status).toBe(413);
    expect(calls).toHaveLength(0);
  });
});

describe('GET /api/config', () => {
  it('tells the page the limits, never the key', async () => {
    vi.stubEnv('MAX_RUN_PRICE', '0.25');
    const body = await (await configGet()).json();
    expect(body).toEqual({ maxRunPrice: 0.25, maxUploadMb: 25, keySet: true });
    expect(JSON.stringify(body)).not.toContain('test-key');
  });
});

describe('GET /api/tasks/[token]', () => {
  const context = (token: string) => ({ params: Promise.resolve({ token }) });

  it('returns the task stage and outputs, never the task id', async () => {
    const calls = routeFetch(() =>
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
    expect(body.outputs[0]).toMatchObject({ kind: 'video' });
    expect(body).not.toHaveProperty('id');
    expect(bodyOf(calls[0])).toEqual({ tasktoken: 'tok_abc123' });
  });

  it('shows a small text output, such as a transcript, as the answer', async () => {
    routeFetch((call) =>
      call.url.endsWith('/Task/Detail')
        ? jsonResponse({
            result: true,
            tasklist: [
              {
                status: 'task_postprocess_end',
                pexit: '0',
                outputs: [{ name: 'out.txt', contenttype: 'text/plain', url: 'https://cdn1.wiro.ai/x/out.txt' }],
              },
            ],
          })
        : new Response(' Hello from the transcript. ', { status: 200 }),
    );
    const response = await taskGet(new Request('http://localhost/api/tasks/tok_text123'), context('tok_text123'));
    await expect(response.json()).resolves.toMatchObject({ stage: 'done', text: 'Hello from the transcript.' });
  });

  it('never reads text files from other hosts', async () => {
    const calls = routeFetch(() =>
      jsonResponse({
        result: true,
        tasklist: [
          {
            status: 'task_postprocess_end',
            pexit: '0',
            outputs: [{ name: 'a.txt', url: 'https://example.com/a.txt' }],
          },
        ],
      }),
    );
    const response = await taskGet(new Request('http://localhost/api/tasks/tok_text456'), context('tok_text456'));
    await expect(response.json()).resolves.toMatchObject({ text: null });
    expect(calls).toHaveLength(1);
  });

  it('refuses a token with unexpected characters', async () => {
    const calls = routeFetch(() => jsonResponse({}));
    const response = await taskGet(new Request('http://localhost/api/tasks/x'), context('../Task/List'));
    expect(response.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('passes on an unknown task as 404', async () => {
    routeFetch(() => jsonResponse({ result: false, errors: [{ code: 0, message: 'There is no task yet.' }] }));
    const response = await taskGet(new Request('http://localhost/api/tasks/tok_abc123'), context('tok_abc123'));
    expect(response.status).toBe(404);
  });
});
