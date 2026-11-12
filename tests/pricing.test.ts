import { describe, expect, it } from 'vitest';
import { formatUsd, matchingRow, parsePriceRows, quote, summaryPrice } from '@/lib/catalog/pricing';
import type { PriceRow } from '@/lib/catalog/types';

const seedance: PriceRow[] = [
  { inputs: { duration: '5', resolution: '480p' }, price: 0.05, priceMethod: 'cpr' },
  { inputs: { duration: '5', resolution: '720p' }, price: 0.11, priceMethod: 'cpr' },
  { inputs: { duration: '10', resolution: '480p' }, price: 0.1, priceMethod: 'cpr' },
];

describe('parsePriceRows', () => {
  it('reads JSON text and arrays, and skips broken rows', () => {
    expect(parsePriceRows('[{"inputs":{},"price":0.005,"priceMethod":"cpr"}]')).toEqual([
      { inputs: {}, price: 0.005, priceMethod: 'cpr', note: undefined, priceExtra: undefined, priceInput: undefined },
    ]);
    expect(parsePriceRows([{ price: 'x', priceMethod: 'cpr' }, { price: 1 }, null])).toEqual([]);
    expect(parsePriceRows('not json')).toEqual([]);
    expect(parsePriceRows(undefined)).toEqual([]);
  });
});

describe('summaryPrice', () => {
  it.each([
    [{ rows: [{ price: 0.005, priceMethod: 'cpr' }] }, '$0.005 / run'],
    [{ rows: seedance }, 'from $0.05'],
    [{ rows: [{ price: 0.04, priceMethod: 'cpo' }] }, '$0.04 / output'],
    [{ rows: [{ price: 0.00008, priceMethod: 'cp-promptlength' }] }, '$0.00008 / character'],
    [{ rows: [{ price: 0, priceMethod: 'cp-readoutput' }] }, 'set by the run'],
    [{ rows: [], estimate: 0.0017 }, 'about $0.0017'],
    [{ rows: [], rate: 0.0006 }, '$0.0006 / second'],
    [{ rows: [{ price: 0, priceMethod: 'cpr' }] }, 'Free'],
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
      { inputs: { inputImage: 'QUANTITY:0' }, price: 0.1, priceMethod: 'cpr' },
      { inputs: { inputImage: 'QUANTITY:1' }, price: 0.15, priceMethod: 'cpr' },
      { inputs: { inputImage: 'QUANTITY:3' }, price: 0.2, priceMethod: 'cpr' },
    ];
    expect(matchingRow(rows, {})?.price).toBe(0.1);
    expect(matchingRow(rows, { inputImage: ['a', 'b'] })?.price).toBe(0.15);
    expect(matchingRow(rows, { inputImage: ['a', 'b', 'c', 'd'] })?.price).toBe(0.2);
  });
});

describe('quote', () => {
  it('prices a run per run, per output and per second of video', () => {
    expect(quote({ rows: seedance }, { duration: '5', resolution: '480p' })).toMatchObject({
      amount: 0.05,
      approximate: false,
      label: '$0.05',
    });
    expect(quote({ rows: [{ price: 0.04, priceMethod: 'cpo' }] }, { maxImages: '3' })).toMatchObject({ amount: 0.12 });
    expect(
      quote({ rows: [{ price: 0.1, priceMethod: 'cp-outputVideoLength' }] }, { durationSeconds: '8' }),
    ).toMatchObject({ amount: 0.8, label: '$0.80' });
  });

  it('prices text by its length and audio by its seconds when known', () => {
    const perChar = { rows: [{ price: 0.00008, priceMethod: 'cp-promptlength' }] };
    expect(quote(perChar, {}, { promptChars: 250 })).toMatchObject({ amount: 0.02 });
    expect(quote(perChar, {}).label).toBe('$0.00008 / character');
    expect(quote(perChar, {}).amount).toBeUndefined();
    const perSecond = { rows: [{ price: 0.0001, priceMethod: 'cp-audiosecondslength' }] };
    expect(quote(perSecond, {}, { mediaSeconds: 60 })).toMatchObject({ approximate: true, label: 'about $0.006' });
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
