import { describe, expect, it } from 'vitest';
import { formatCost, formatElapsed, toTaskView } from '@/lib/tasks';

const IMAGE = { name: '0.png', contenttype: 'image/png', url: 'https://cdn1.wiro.ai/x/0.png' };

describe('toTaskView', () => {
  it.each([
    ['task_queue', 'queued'],
    ['task_accept', 'preparing'],
    ['task_assign', 'preparing'],
    ['task_start', 'generating'],
    ['task_output', 'generating'],
    ['task_end', 'saving'],
    ['task_postprocess_start', 'saving'],
    ['task_something_new', 'preparing'],
  ])('maps %s to %s and keeps waiting', (status, stage) => {
    expect(toTaskView({ status })).toMatchObject({ status, stage, done: false, cost: null, error: null });
  });

  it('keeps waiting on a persisted task_error, which Wiro AI retries', () => {
    expect(toTaskView({ status: 'task_error', debugerror: 'worker lost' })).toMatchObject({
      stage: 'preparing',
      done: false,
      error: null,
    });
  });

  it('reports a finished task with its outputs, time and cost', () => {
    expect(
      toTaskView({
        status: 'task_postprocess_end',
        pexit: '0',
        outputs: [IMAGE],
        totalcost: '0.005000000000',
        elapsedseconds: '6.0000',
      }),
    ).toEqual({
      status: 'task_postprocess_end',
      stage: 'done',
      done: true,
      outputs: [{ url: IMAGE.url, contentType: 'image/png', name: '0.png', kind: 'image' }],
      text: null,
      cost: 0.005,
      seconds: 6,
      error: null,
    });
  });

  it('reports a failed task with its error', () => {
    expect(
      toTaskView({
        status: 'task_postprocess_end',
        pexit: '1',
        debugerror: '  Prompt was\nrejected  ',
        totalcost: '0',
      }),
    ).toMatchObject({ stage: 'failed', done: true, error: 'Prompt was rejected', cost: 0 });
  });

  it('treats a successful exit without an output file as a failure', () => {
    expect(toTaskView({ status: 'task_postprocess_end', pexit: '0', outputs: [] })).toMatchObject({
      stage: 'failed',
      error: 'The model finished without an output.',
    });
  });

  it('reports a cancelled task', () => {
    expect(toTaskView({ status: 'task_cancel' })).toMatchObject({ stage: 'cancelled', done: true });
  });

  it('drops outputs without an https URL and shortens long errors', () => {
    const view = toTaskView({
      status: 'task_postprocess_end',
      pexit: '1',
      outputs: [{ url: 'javascript:alert(1)' }, IMAGE],
      debugerror: 'x'.repeat(500),
    });
    expect(view.outputs.map((output) => output.url)).toEqual([IMAGE.url]);
    expect(view.error).toHaveLength(300);
  });
});

describe('text answers', () => {
  it('reads structured LLM content', () => {
    const view = toTaskView({
      status: 'task_postprocess_end',
      pexit: '0',
      outputs: [{ contenttype: 'raw', content: { raw: 'Hello there.', segments: [] } }],
      debugoutput: 'Hello there.',
    });
    expect(view).toMatchObject({ stage: 'done', text: 'Hello there.', outputs: [] });
  });

  it('reads answer segments when raw is empty', () => {
    const view = toTaskView({
      status: 'task_postprocess_end',
      pexit: '0',
      outputs: [
        {
          contenttype: 'raw',
          content: {
            segments: [
              { type: 'thinking', text: 'Hmm' },
              { type: 'answer', text: 'Yes.' },
            ],
          },
        },
      ],
    });
    expect(view.text).toBe('Yes.');
  });

  it('uses debugoutput as the answer only when the task made no files', () => {
    expect(toTaskView({ status: 'task_postprocess_end', pexit: '0', debugoutput: ' The transcript. ' }).text).toBe(
      'The transcript.',
    );
    expect(
      toTaskView({ status: 'task_postprocess_end', pexit: '0', debugoutput: '100% done', outputs: [IMAGE] }).text,
    ).toBeNull();
  });

  it('tells output kinds apart by type and name', () => {
    const view = toTaskView({
      status: 'task_postprocess_end',
      pexit: '0',
      outputs: [
        { url: 'https://cdn1.wiro.ai/a.mp3', contenttype: 'audio/mpeg', name: 'a.mp3' },
        { url: 'https://cdn1.wiro.ai/b.txt', contenttype: '', name: 'b.txt' },
        { url: 'https://cdn1.wiro.ai/c.glb', contenttype: 'model/gltf-binary', name: 'c.glb' },
      ],
    });
    expect(view.outputs.map((output) => output.kind)).toEqual(['audio', 'text', 'file']);
  });
});

describe('formatCost', () => {
  it.each([
    [0.005, '$0.005'],
    [0.05, '$0.05'],
    [0.42, '$0.42'],
    [0.0000482, '$0.000048'],
    [0, '$0'],
  ])('formats %s as %s', (cost, text) => {
    expect(formatCost(cost)).toBe(text);
  });

  it('returns null when there is no cost', () => {
    expect(formatCost(null)).toBeNull();
    expect(formatCost(undefined)).toBeNull();
  });
});

describe('formatElapsed', () => {
  it('formats minutes and seconds', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(7_400)).toBe('0:07');
    expect(formatElapsed(84_000)).toBe('1:24');
  });
});
