import { describe, expect, it } from 'vitest';
import { formatUsd, isLivePricing, matchingRow, parsePriceRows, quote, summaryPrice } from '@/lib/catalog/pricing';
import type { PriceRow } from '@/lib/catalog/types';

const seedance: PriceRow[] = [
  { inputs: { duration: '5', resolution: '480p' }, price: 0.05, priceMethod: 'per-run' },
  { inputs: { duration: '5', resolution: '720p' }, price: 0.11, priceMethod: 'per-run' },
  { inputs: { duration: '10', resolution: '480p' }, price: 0.1, priceMethod: 'per-run' },
];

describe('parsePriceRows', () => {
  it('reads JSON text and arrays, and skips broken rows', () => {
    expect(parsePriceRows('[{"inputs":{},"price":0.005,"priceMethod":"per-run"}]')).toEqual([
      {
        inputs: {},
        price: 0.005,
        priceMethod: 'per-run',
        note: undefined,
        priceExtra: undefined,
        priceInput: undefined,
        maxSeconds: undefined,
      },
    ]);
    expect(
      parsePriceRows([{ price: 0.015, priceMethod: 'per-input-video-second', maxSeconds: '60' }])[0]?.maxSeconds,
    ).toBe(60);
    expect(parsePriceRows([{ price: 'x', priceMethod: 'per-run' }, { price: 1 }, null])).toEqual([]);
    expect(parsePriceRows('not json')).toEqual([]);
    expect(parsePriceRows(undefined)).toEqual([]);
  });
});

describe('summaryPrice', () => {
  it.each([
    [{ rows: [{ price: 0.005, priceMethod: 'per-run' }] }, '$0.005 / run'],
    [{ rows: seedance }, 'from $0.05'],
    [{ rows: [{ price: 0.04, priceMethod: 'per-output-file' }] }, '$0.04 / output'],
    [{ rows: [{ price: 0.00008, priceMethod: 'per-input-character' }] }, '$0.00008 / character'],
    [{ rows: [{ price: 0, priceMethod: 'reported-price' }] }, 'set when the run ends'],
    [{ rows: [{ price: 0.015, priceMethod: 'per-input-video-second', maxSeconds: 60 }] }, '$0.015 / video second'],
    [{ rows: [{ price: 0.0003, priceMethod: 'per-input-audio-second' }] }, '$0.0003 / audio second'],
    [{ rows: [{ price: 0.5, priceMethod: 'cpr' }] }, 'see the model page'],
    [{ rows: [], estimate: 0.0017 }, 'about $0.0017'],
    [{ rows: [], rate: 0.0006 }, '$0.0006 / second'],
    [{ rows: [{ price: 0, priceMethod: 'per-run' }] }, 'Free'],
  ])('labels %o as %s', (info, label) => {
    expect(summaryPrice(info as never).label).toBe(label);
  });

  it('sorts unknown prices last', () => {
    expect(summaryPrice({ rows: [] }).sort).toBe(Number.POSITIVE_INFINITY);
    expect(summaryPrice({ rows: seedance }).sort).toBe(0.05);
  });
});

describe('matchingRow', () => {
  it('picks the first row whose values all match, comparing loosely', () => {
    expect(matchingRow(seedance, { duration: 5, resolution: '720p' })?.price).toBe(0.11);
    expect(matchingRow(seedance, { duration: '15', resolution: '480p' })).toBeUndefined();
  });

  it('picks the valid file-count row with the most files', () => {
    const rows: PriceRow[] = [
      { inputs: { inputImage: 'QUANTITY:0' }, price: 0.1, priceMethod: 'per-run' },
      { inputs: { inputImage: 'QUANTITY:1' }, price: 0.15, priceMethod: 'per-run' },
      { inputs: { inputImage: 'QUANTITY:3' }, price: 0.2, priceMethod: 'per-run' },
    ];
    expect(matchingRow(rows, {})?.price).toBe(0.1);
    expect(matchingRow(rows, { inputImage: ['a', 'b'] })?.price).toBe(0.15);
    expect(matchingRow(rows, { inputImage: ['a', 'b', 'c', 'd'] })?.price).toBe(0.2);
  });
});

describe('quote', () => {
  it('prices a run per run, per output file and per second of output video', () => {
    expect(quote({ rows: seedance }, { duration: '5', resolution: '480p' })).toMatchObject({
      amount: 0.05,
      approximate: false,
      label: '$0.05',
    });
    expect(quote({ rows: [{ price: 0.04, priceMethod: 'per-output-file' }] }, { maxImages: '3' })).toMatchObject({
      amount: 0.12,
    });
    expect(
      quote({ rows: [{ price: 0.1, priceMethod: 'per-output-video-second' }] }, { durationSeconds: '8' }),
    ).toMatchObject({ amount: 0.8, label: '$0.80' });
  });

  it('prices text by its length and audio by its seconds when known', () => {
    const perChar = { rows: [{ price: 0.00008, priceMethod: 'per-input-character' }] };
    expect(quote(perChar, {}, { promptChars: 250 })).toMatchObject({ amount: 0.02 });
    expect(quote(perChar, {}).label).toBe('$0.00008 / character');
    expect(quote(perChar, {}).amount).toBeUndefined();
    const perSecond = { rows: [{ price: 0.0001, priceMethod: 'per-input-audio-second' }] };
    expect(quote(perSecond, {}, { mediaSeconds: 60 })).toMatchObject({
      approximate: true,
      label: 'about $0.006',
      note: '60 seconds of input audio at $0.0001 per second.',
    });
  });

  it('prices input video by its seconds, each input at most maxSeconds', () => {
    const vsr: PriceRow[] = [
      { inputs: { resolution: '720p' }, price: 0.015, priceMethod: 'per-input-video-second', maxSeconds: 60 },
      { inputs: { resolution: '1080p' }, price: 0.025, priceMethod: 'per-input-video-second', maxSeconds: 60 },
    ];
    expect(quote({ rows: vsr }, { resolution: '1080p' })).toEqual({
      approximate: true,
      label: '$0.025 / video second',
      note: 'Each input counts at most 60 seconds.',
    });
    expect(quote({ rows: vsr }, { resolution: '720p' }, { mediaSeconds: 20 })).toMatchObject({
      approximate: true,
      label: 'about $0.30',
      note: '20 seconds of input video at $0.015 per second.',
    });
    const long = quote({ rows: vsr }, { resolution: '720p' }, { mediaSeconds: 300 });
    expect(long.amount).toBeCloseTo(0.9, 10);
    expect(long.note).toBe(
      '60 seconds of input video at $0.015 per second. Only the first 60 seconds of each input are processed and billed.',
    );
  });

  it('bills an old price-method id by run time', () => {
    for (const old of [
      'cpr',
      'cps',
      'cpo',
      'cpt',
      'cp-pixel',
      'cp-promptlength',
      'cp-audiosecondslength',
      'cp-outputVideoLength',
      'cp-realtimeturn',
      'cp-readoutput',
      'cp',
      'cp-request',
      'cp-image',
      'cp-frame',
      'cp-byte',
    ]) {
      expect(quote({ rows: [{ price: 0.5, priceMethod: old }] }, {}), old).toMatchObject({ label: 'by run time' });
      expect(isLivePricing({ rows: [{ price: 0.5, priceMethod: old }] }), old).toBe(false);
    }
    expect(isLivePricing({ rows: [{ price: 0, priceMethod: 'per-realtime-turn' }] })).toBe(true);
  });

  it('falls back to run time when no row matches', () => {
    expect(quote({ rows: seedance, estimate: 0.07 }, { duration: '99' })).toMatchObject({
      amount: 0.07,
      label: 'about $0.07',
    });
    expect(quote({ rows: [] }, {}).label).toBe('by run time');
    expect(quote({ rows: [] }, {}).amount).toBeUndefined();
  });
});

describe('formatUsd', () => {
  it.each([
    [0, '$0'],
    [0.005, '$0.005'],
    [0.05, '$0.05'],
    [0.2, '$0.20'],
    [1.5, '$1.50'],
    [0.00008, '$0.00008'],
    [0.0017349, '$0.0017'],
  ])('formats %s as %s', (amount, text) => {
    expect(formatUsd(amount)).toBe(text);
  });
});
