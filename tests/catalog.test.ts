import { describe, expect, it } from 'vitest';
import { getModel, listCategory, listModels, searchModels } from '@/lib/wiro/catalog';
import { bodyOf, headersOf, jsonResponse, routeFetch, toolItem } from './helpers';

describe('listCategory', () => {
  it('lists a category from Tool/List, without a key, leaving out hidden and live models', async () => {
    const calls = routeFetch(() =>
      jsonResponse({
        result: true,
        total: 4,
        tool: [
          toolItem(),
          toolItem({ cleanslugproject: 'p-image-uncensored', title: 'P-Image Uncensored' }),
          toolItem({
            cleanslugproject: 'voice-live',
            dynamicprice: '[{"price":0.01,"priceMethod":"cp-realtimeturn"}]',
          }),
          toolItem({
            cleanslugowner: 'wiro',
            cleanslugproject: 'flux',
            dynamicprice: null,
            approximatelycost: '0.0021',
          }),
        ],
      }),
    );

    const models = await listCategory('test-category-a');
    expect(models.map((model) => model.id)).toEqual(['pruna/p-image', 'wiro/flux']);
    expect(models[0]).toMatchObject({
      title: 'P-Image',
      description: 'Fast text to image.',
      categories: ['text-to-image'],
      cover: 'https://cdn.wiro.ai/uploads/models/p-image-cover.webp',
      price: '$0.005 / run',
      averageSeconds: 9,
    });
    expect(models[1].price).toBe('about $0.0021');

    expect(calls[0].url).toBe('https://api.wiro.ai/v1/Tool/List');
    expect(headersOf(calls[0]).get('x-api-key')).toBeNull();
    expect(bodyOf(calls[0])).toMatchObject({
      categories: ['test-category-a'],
      sort: 'ratedusercount',
      hideworkflows: true,
      summary: true,
      start: '0',
      limit: '100',
    });
  });

  it('keeps the answer for a while', async () => {
    const calls = routeFetch(() => jsonResponse({ result: true, total: 1, tool: [toolItem()] }));
    await listCategory('test-category-b');
    await listCategory('test-category-b');
    expect(calls).toHaveLength(1);
  });

  it('reads more pages when the category has them', async () => {
    const page = Array.from({ length: 100 }, (_, index) => toolItem({ cleanslugproject: `model-${index}` }));
    const calls = routeFetch((call) => {
      const start = Number(bodyOf(call).start);
      return jsonResponse({ result: true, total: 120, tool: start === 0 ? page : page.slice(0, 20) });
    });
    expect(await listCategory('test-category-c')).toHaveLength(120);
    expect(calls.map((call) => bodyOf(call).start)).toEqual(['0', '100']);
  });
});

describe('listModels and searchModels', () => {
  it('merges categories without repeats and leaves out excluded ones', async () => {
    routeFetch((call) => {
      const [category] = bodyOf(call).categories as string[];
      return jsonResponse({
        result: true,
        total: 2,
        tool:
          category === 'test-merge-a'
            ? [toolItem(), toolItem({ cleanslugproject: 'video-upscaler', categories: ['upscale', 'video-to-video'] })]
            : [toolItem(), toolItem({ cleanslugproject: 'restorer' })],
      });
    });
    const models = await listModels(['test-merge-a', 'test-merge-b'], ['video-to-video']);
    expect(models.map((model) => model.id)).toEqual(['pruna/p-image', 'pruna/restorer']);
  });

  it('searches the whole catalog', async () => {
    const calls = routeFetch(() => jsonResponse({ result: true, total: 1, tool: [toolItem()] }));
    await searchModels('  boat  ');
    expect(bodyOf(calls[0])).toMatchObject({ search: 'boat', categories: [], sort: 'relevance' });
  });
});

describe('getModel', () => {
  it('reads one model with its inputs and prices from Tool/Detail', async () => {
    const calls = routeFetch(() => jsonResponse({ result: true, tool: [toolItem()] }));
    const model = await getModel('pruna/p-image');
    expect(bodyOf(calls[0])).toEqual({ slugowner: 'pruna', slugproject: 'p-image' });
    expect(model?.params.map((param) => param.id)).toEqual(['prompt', 'aspectRatio']);
    expect(model?.pricing.rows).toHaveLength(1);
  });

  it('returns null for models that are unknown, hidden or not a slug', async () => {
    routeFetch((call) => {
      const { slugproject } = bodyOf(call);
      if (slugproject === 'missing')
        return jsonResponse({ result: false, errors: [{ message: 'slug-owner-project-not-exist' }] });
      return jsonResponse({
        result: true,
        tool: [toolItem({ cleanslugproject: String(slugproject), title: 'NSFW Generator' })],
      });
    });
    expect(await getModel('pruna/missing')).toBeNull();
    expect(await getModel('pruna/nsfw-generator')).toBeNull();
    expect(await getModel('../Task/Detail')).toBeNull();
    expect(await getModel('a/b/c')).toBeNull();
  });
});
