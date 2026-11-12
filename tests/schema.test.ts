import { describe, expect, it } from 'vitest';
import {
  buildParams,
  fileKindOf,
  initialValues,
  normalizeParams,
  primaryFileParam,
  promptParam,
  withDefaults,
} from '@/lib/catalog/schema';

const groups = [
  {
    title: 'Inputs',
    items: [
      {
        id: 'inputImage',
        type: 'combinefileinput',
        label: 'Input Image',
        required: true,
        defaultvalue: 'https://cdn.wiro.ai/uploads/sampleinputs/a.jpg',
      },
      { id: 'inputAudio', type: 'fileinput', label: 'Input Audio', required: false },
      { id: 'inputAudioUrl', type: 'text', label: 'Input audio URL' },
      { id: 'inputDocumentMultiple', type: 'multifileinput', label: 'Documents' },
      { id: 'inputDocumentUrlMultiple', type: 'text', label: 'Document URLs' },
      { id: 'prompt', type: 'textarea', label: 'Prompt', required: true, defaultvalue: 'A sample prompt' },
      {
        id: 'resolution',
        type: 'select',
        label: 'Resolution',
        required: true,
        defaultvalue: '480p',
        options: [
          { value: '480p', label: '480p' },
          { value: '720p', label: '720p' },
        ],
      },
      { id: 'outscale', type: 'float', label: 'Outscale', defaultvalue: '2.0', minvalue: '1', maxvalue: '4' },
      { id: 'faceEnhance', type: 'checkbox', label: 'Face enhance', defaultvalue: '--face_enhance' },
      { id: 'watermark', type: 'checkbox', label: 'Watermark', value: false },
      { id: 'seed', type: 'number', label: 'Seed', defaultvalue: '0', advanced: true },
      { id: 'messages', type: 'textarea', label: 'Messages' },
    ],
  },
];

const params = normalizeParams(groups);
const byId = (id: string) => params.find((param) => param.id === id)!;

describe('normalizeParams', () => {
  it('reads types, defaults, ranges and options', () => {
    expect(byId('resolution')).toMatchObject({ type: 'select', required: true, default: '480p', sample: false });
    expect(byId('resolution').options).toEqual([
      { value: '480p', label: '480p' },
      { value: '720p', label: '720p' },
    ]);
    expect(byId('outscale')).toMatchObject({ type: 'float', min: 1, max: 4, default: '2.0' });
    expect(byId('seed')).toMatchObject({ advanced: true });
  });

  it('marks samples: files, ids with "input" and the prompt', () => {
    expect(byId('inputImage').sample).toBe(true);
    expect(byId('prompt').sample).toBe(true);
    expect(byId('resolution').sample).toBe(false);
  });

  it('pairs file inputs with their URL fields and hides the URL fields', () => {
    expect(byId('inputAudio')).toMatchObject({ urlField: 'inputAudioUrl', file: { kind: 'audio', multiple: false } });
    expect(byId('inputAudioUrl').hidden).toBe(true);
    expect(byId('inputDocumentMultiple')).toMatchObject({
      urlField: 'inputDocumentUrlMultiple',
      file: { multiple: true },
    });
    expect(byId('inputDocumentUrlMultiple').hidden).toBe(true);
    expect(byId('inputImage')).toMatchObject({ file: { kind: 'image', multiple: true } });
  });

  it('keeps checkbox values: a flag, or off', () => {
    expect(byId('faceEnhance').default).toBe('--face_enhance');
    expect(byId('watermark').default).toBe('false');
  });

  it('hides structured LLM fields', () => {
    expect(byId('messages').hidden).toBe(true);
  });

  it('survives odd input', () => {
    expect(normalizeParams(null)).toEqual([]);
    expect(normalizeParams([{ items: [{ type: 'text' }, null, { id: 'a' }] }])).toHaveLength(1);
  });
});

describe('form helpers', () => {
  it('finds the prompt and the main file input', () => {
    expect(promptParam(params)?.id).toBe('prompt');
    expect(primaryFileParam(params, 'image')?.id).toBe('inputImage');
    expect(primaryFileParam(params, 'audio')?.id).toBe('inputAudio');
    expect(fileKindOf('first_frame_image')).toBe('image');
    expect(fileKindOf('inputVideo')).toBe('video');
  });

  it('starts empty for samples and with defaults for the rest', () => {
    const values = initialValues(params, { resolution: '720p', prompt: 'A boat' });
    expect(values).toMatchObject({
      inputImage: [],
      inputAudio: '',
      prompt: 'A boat',
      resolution: '720p',
      outscale: '2.0',
      faceEnhance: true,
      watermark: false,
    });
    expect(values).not.toHaveProperty('inputAudioUrl');
    expect(initialValues(params, { resolution: '4k' }).resolution).toBe('480p');
  });
});

describe('buildParams', () => {
  const base = {
    inputImage: ['https://cdn1.wiro.ai/a.png'],
    prompt: 'A boat',
    resolution: '720p',
    faceEnhance: true,
    watermark: false,
  };

  it('sends files the way each input type takes them', () => {
    const {
      params: built,
      errors,
      missing,
    } = buildParams(params, {
      ...base,
      inputAudio: 'https://cdn1.wiro.ai/a.mp3',
      inputDocumentMultiple: ['https://x.test/a.pdf', 'https://x.test/b.pdf'],
    });
    expect(errors).toEqual([]);
    expect(missing).toEqual([]);
    expect(built.inputImage).toEqual(['https://cdn1.wiro.ai/a.png']);
    expect(built.inputAudioUrl).toBe('https://cdn1.wiro.ai/a.mp3');
    expect(built).not.toHaveProperty('inputAudio');
    expect(built.inputDocumentUrlMultiple).toBe('https://x.test/a.pdf,https://x.test/b.pdf');
  });

  it('turns checkboxes into their flag or an empty value', () => {
    const { params: built } = buildParams(params, base);
    expect(built.faceEnhance).toBe('--face_enhance');
    expect(built.watermark).toBe('');
    expect(buildParams(params, { ...base, faceEnhance: false, watermark: true }).params).toMatchObject({
      faceEnhance: '',
      watermark: 'true',
    });
  });

  it('refuses a choice outside the options and clamps numbers to the range', () => {
    expect(buildParams(params, { ...base, resolution: '8k' }).errors[0]).toMatch(/Resolution can't be "8k"/);
    expect(buildParams(params, { ...base, outscale: '9' }).params.outscale).toBe('4');
    expect(buildParams(params, { ...base, outscale: 'big' }).errors[0]).toMatch(/must be a number/);
  });

  it('fills required settings with their default but asks for required samples', () => {
    const { params: built, missing } = buildParams(params, { ...base, resolution: '', prompt: '  ', inputImage: [] });
    expect(built.resolution).toBe('480p');
    expect(missing).toEqual(['Input Image', 'Prompt']);
  });

  it('leaves out empty optional inputs, so Wiro applies its defaults', () => {
    const { params: built } = buildParams(params, { ...base, seed: '' });
    expect(built).not.toHaveProperty('seed');
    expect(built).not.toHaveProperty('messages');
  });

  it('only sends http(s) file URLs, and one file where one is taken', () => {
    expect(buildParams(params, { ...base, inputImage: ['javascript:alert(1)'] }).errors[0]).toMatch(/public http/);
    expect(
      buildParams(params, { ...base, inputAudio: ['https://x.test/a.mp3', 'https://x.test/b.mp3'] }).errors[0],
    ).toMatch(/takes one file/);
  });

  it('drops values for inputs the model does not have', () => {
    expect(buildParams(params, { ...base, callbackUrl: 'https://evil.test' }).params).not.toHaveProperty('callbackUrl');
  });

  it('refuses very long text', () => {
    expect(buildParams(params, { ...base, prompt: 'x'.repeat(20_001) }).errors[0]).toMatch(/at most/);
  });
});

describe('withDefaults', () => {
  it('adds catalog values and counts files under the input id', () => {
    const full = withDefaults(params, { prompt: 'A boat', inputAudioUrl: 'https://x.test/a.mp3' });
    expect(full).toMatchObject({ resolution: '480p', outscale: '2.0', inputAudio: ['https://x.test/a.mp3'] });
    expect(full).not.toHaveProperty('inputImage');
  });
});
