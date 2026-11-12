import { describe, expect, it } from 'vitest';
import {
  aspectRatioOf,
  buildRunParams,
  chatModels,
  defaultSettings,
  findChatModel,
  findMediaModel,
  imageModels,
  InputError,
  PROMPT_MAX_LENGTH,
  videoModels,
} from '@/lib/models';

const pImage = findMediaModel('image', 'pruna/p-image')!;
const gptImage = findMediaModel('image', 'openai/gpt-image-2')!;
const seedance = findMediaModel('video', 'bytedance/seedance-v1-pro-fast')!;

describe('model catalog', () => {
  it('has unique IDs in owner/model form', () => {
    for (const list of [imageModels, videoModels, chatModels]) {
      const ids = list.map((model) => model.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+\/[a-z0-9.-]+$/);
    }
  });

  it('defaults every setting to one of its choices', () => {
    for (const model of [...imageModels, ...videoModels]) {
      for (const setting of model.settings) {
        expect(setting.choices.map((choice) => choice.value)).toContain(setting.default);
      }
    }
  });

  it('keeps image and video models apart', () => {
    expect(findMediaModel('video', 'pruna/p-image')).toBeUndefined();
    expect(findMediaModel('image', 'klingai/kling-v3')).toBeUndefined();
    expect(findChatModel('openai/gpt-5-4-nano')?.name).toBe('GPT-5.4 Nano');
    expect(findChatModel('openai/unknown')).toBeUndefined();
  });
});

describe('buildRunParams', () => {
  it('sends the prompt and the default settings', () => {
    expect(buildRunParams(pImage, { prompt: '  a paper boat  ' })).toEqual({
      prompt: 'a paper boat',
      aspectRatio: '1:1',
    });
  });

  it('adds the fixed parameters a model needs', () => {
    expect(buildRunParams(gptImage, { prompt: 'a boat', settings: { ratio: '16:9', quality: 'medium' } })).toEqual({
      prompt: 'a boat',
      ratio: '16:9',
      quality: 'medium',
      resolution: '1k',
      samples: '1',
    });
  });

  it('refuses a value outside the choices', () => {
    expect(() => buildRunParams(gptImage, { prompt: 'a boat', settings: { quality: 'ultra' } })).toThrow(InputError);
    expect(() => buildRunParams(seedance, { prompt: 'a boat', settings: { resolution: '4k' } })).toThrow(
      /Resolution can't be "4k"/,
    );
  });

  it('drops settings the model does not have', () => {
    const params = buildRunParams(pImage, { prompt: 'a boat', settings: { seed: '7', callbackUrl: 'https://x.test' } });
    expect(params).not.toHaveProperty('seed');
    expect(params).not.toHaveProperty('callbackUrl');
  });

  it('refuses an empty or very long prompt', () => {
    expect(() => buildRunParams(pImage, { prompt: '   ' })).toThrow('Write a prompt first.');
    expect(() => buildRunParams(pImage, { prompt: 'x'.repeat(PROMPT_MAX_LENGTH + 1) })).toThrow(InputError);
  });

  it('sends a start image to the video model input that takes it', () => {
    const params = buildRunParams(seedance, { prompt: 'a boat', imageUrl: 'https://cdn1.wiro.ai/a/0.png' });
    expect(params.inputImage).toBe('https://cdn1.wiro.ai/a/0.png');
  });

  it('only takes https start images, and only for video models', () => {
    expect(() => buildRunParams(seedance, { prompt: 'a boat', imageUrl: 'http://example.com/a.png' })).toThrow(/https/);
    expect(() => buildRunParams(seedance, { prompt: 'a boat', imageUrl: 'not a url' })).toThrow(/https/);
    expect(() => buildRunParams(pImage, { prompt: 'a boat', imageUrl: 'https://example.com/a.png' })).toThrow(
      /doesn't take a start image/,
    );
  });
});

describe('aspectRatioOf', () => {
  it('reads the ratio setting', () => {
    expect(aspectRatioOf(seedance, { ...defaultSettings(seedance), ratio: '9:16' })).toBe('9 / 16');
    expect(aspectRatioOf(pImage, defaultSettings(pImage))).toBe('1 / 1');
  });
});
