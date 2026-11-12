import type { PriceInfo, PriceRow } from './types';

/**
 * The price shown before a run, worked out the way Wiro bills it. Adapted from
 * the price engine of the Wiro AI browser extensions (Wiro-Extension-Core).
 *
 * - The row: Wiro bills with the first row whose values all match the run's
 *   settings. When a row counts files (QUANTITY:n), it bills with the valid row
 *   that has the highest total count at or below what the run sends.
 * - The charge: cpr is per run, cpo per output, cp-promptlength per prompt
 *   character, cp-audiosecondslength per second of input audio,
 *   cp-outputVideoLength per second of output video, cp-pixel per 1024 x 1024
 *   block. A run that matches no row is billed for its run time.
 */

export type Quote = {
  /** The charge for these settings, when it can be worked out before the run. */
  amount?: number;
  /** True when the amount is an estimate or a starting price. */
  approximate: boolean;
  /** "$0.05", "about $0.002", "from $0.04", "$0.0006 / second", "Free". */
  label: string;
  /** One sentence on how the run is billed. */
  note?: string;
};

export type QuoteContext = {
  /** Characters of the prompt, for prices per character. */
  promptChars?: number;
  /** Seconds of the input audio or video, when known. */
  mediaSeconds?: number;
};

export function formatUsd(amount: number): string {
  if (amount === 0) return '$0';
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  if (amount >= 0.01) return `$${trimZeros(amount.toFixed(3))}`;
  return `$${trimZeros(amount.toPrecision(2))}`;
}

function trimZeros(value: string): string {
  if (!value.includes('.')) return value;
  const trimmed = value.replace(/0+$/, '').replace(/\.$/, '');
  return /\.\d$/.test(trimmed) ? `${trimmed}0` : trimmed;
}

function positive(value: unknown): number | undefined {
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

/** Price rows from `dynamicprice`, which Tool/List sends as JSON text and Tool/Detail as an array. */
export function parsePriceRows(value: unknown): PriceRow[] {
  let rows = value;
  if (typeof rows === 'string') {
    try {
      rows = JSON.parse(rows);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row): PriceRow[] => {
    if (!row || typeof row !== 'object') return [];
    const record = row as Record<string, unknown>;
    const price = Number(record.price);
    if (!Number.isFinite(price) || typeof record.priceMethod !== 'string') return [];
    return [
      {
        price,
        priceMethod: record.priceMethod,
        inputs:
          record.inputs && typeof record.inputs === 'object' ? (record.inputs as Record<string, unknown>) : undefined,
        note: typeof record.note === 'string' && record.note.trim() ? record.note.trim() : undefined,
        priceExtra: positive(record.priceExtra),
        priceInput: positive(record.priceInput),
      },
    ];
  });
}

const UNITS: Record<string, string> = {
  cpr: 'run',
  cpo: 'output',
  cps: 'second',
  cpt: 'token',
  'cp-promptlength': 'character',
  'cp-audiosecondslength': 'audio second',
  'cp-outputVideoLength': 'video second',
};

export const isLivePricing = (info: PriceInfo): boolean =>
  info.rows.some((row) => row.priceMethod === 'cp-realtimeturn');

/** Short price text for model lists, and a number to sort by. */
export function summaryPrice(info: PriceInfo): { label: string; sort: number } {
  const rows = info.rows;
  if (isLivePricing(info)) return { label: 'live, per turn', sort: Number.POSITIVE_INFINITY };

  const fixed = rows.filter((row) => row.priceMethod === 'cpr' || row.priceMethod === 'cpo');
  if (fixed.length > 0) {
    const prices = [...new Set(fixed.map((row) => row.price))].sort((a, b) => a - b);
    const unit = UNITS[fixed[0].priceMethod];
    if (prices.length === 1 && prices[0] === 0) return { label: 'Free', sort: 0 };
    const label = prices.length === 1 ? `${formatUsd(prices[0])} / ${unit}` : `from ${formatUsd(prices[0])}`;
    return { label, sort: prices[0] };
  }
  const pixel = rows.find((row) => row.priceMethod === 'cp-pixel');
  if (pixel) return { label: `from ${formatUsd(pixel.price)} / image`, sort: pixel.price };
  const metered = rows.find((row) => UNITS[row.priceMethod] && row.price > 0);
  if (metered) {
    return { label: `${formatUsd(metered.price)} / ${UNITS[metered.priceMethod]}`, sort: metered.price };
  }
  const readOutput = rows.find((row) => row.priceMethod === 'cp-readoutput');
  if (readOutput) {
    return readOutput.price > 0
      ? { label: `about ${formatUsd(readOutput.price)}`, sort: readOutput.price }
      : { label: 'set by the run', sort: Number.POSITIVE_INFINITY };
  }
  if (info.estimate !== undefined) return { label: `about ${formatUsd(info.estimate)}`, sort: info.estimate };
  if (info.rate !== undefined) return { label: `${formatUsd(info.rate)} / second`, sort: Number.POSITIVE_INFINITY };
  return { label: 'see the model page', sort: Number.POSITIVE_INFINITY };
}

// ---------------------------------------------------------------------------
// Picking the row Wiro bills with.

function quantityOf(value: unknown): number | null {
  const match = /^QUANTITY:(\d+)$/.exec(String(value));
  return match ? Number(match[1]) : null;
}

function countOf(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null && item !== '').length;
  return 1;
}

// Wiro compares loosely: 5 matches "5".
function sameValue(expected: unknown, actual: unknown): boolean {
  if (actual === undefined || actual === null) return false;
  if (typeof expected === 'number') return Number(actual) === expected;
  return String(actual) === String(expected);
}

const countsFiles = (row: PriceRow): boolean =>
  Object.values(row.inputs ?? {}).some((value) => quantityOf(value) !== null);

/** The row Wiro bills these settings with, or undefined when none applies. */
export function matchingRow(rows: PriceRow[], params: Record<string, unknown>): PriceRow | undefined {
  if (!rows.some(countsFiles)) {
    return rows.find((row) =>
      Object.entries(row.inputs ?? {}).every(([key, expected]) => sameValue(expected, params[key])),
    );
  }
  let best: PriceRow | undefined;
  let bestScore = -1;
  for (const row of rows) {
    let score = 0;
    let valid = true;
    for (const [key, expected] of Object.entries(row.inputs ?? {})) {
      const quantity = quantityOf(expected);
      if (quantity === null ? !sameValue(expected, params[key]) : quantity > countOf(params[key])) {
        valid = false;
        break;
      }
      score += quantity ?? 0;
    }
    if (valid && score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------

const COUNT_KEYS = [
  'n',
  'numberOfImages',
  'numImages',
  'numOutputs',
  'numberOfOutputs',
  'count',
  'batchSize',
  'numberOfVideos',
  'maxImages',
  'samples',
];
const DURATION_KEYS = ['duration', 'durationSeconds', 'length', 'seconds', 'videoLength', 'videoDuration'];

function firstNumber(params: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = Number(params[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return undefined;
}

function runTimeQuote(info: PriceInfo): Quote {
  if (info.estimate !== undefined) {
    return {
      amount: info.estimate,
      approximate: true,
      label: `about ${formatUsd(info.estimate)}`,
      note: `Billed by run time; past runs averaged ${formatUsd(info.estimate)}.`,
    };
  }
  if (info.rate !== undefined) {
    return { approximate: true, label: `${formatUsd(info.rate)} / second`, note: 'Billed by run time.' };
  }
  return { approximate: true, label: 'by run time', note: 'Billed by run time.' };
}

function rowQuote(row: PriceRow, params: Record<string, unknown>, context: QuoteContext): Quote {
  const price = row.price;
  const note = row.note;
  switch (row.priceMethod) {
    case 'cpr':
      return price === 0
        ? { amount: 0, approximate: false, label: 'Free', note }
        : { amount: price, approximate: false, label: formatUsd(price), note: note ?? 'Per run.' };
    case 'cpo': {
      if (price === 0) return { amount: 0, approximate: false, label: 'Free', note };
      const count = firstNumber(params, COUNT_KEYS) ?? 1;
      const amount = price * count;
      return {
        amount,
        approximate: false,
        label: formatUsd(amount),
        note: note ?? (count > 1 ? `${formatUsd(price)} per output, ${count} outputs.` : 'Per output.'),
      };
    }
    case 'cp-promptlength': {
      const chars = context.promptChars ?? 0;
      if (chars === 0) return { approximate: true, label: `${formatUsd(price)} / character`, note };
      const amount = price * chars;
      return {
        amount,
        approximate: false,
        label: formatUsd(amount),
        note: note ?? `${chars.toLocaleString('en-US')} characters at ${formatUsd(price)} each.`,
      };
    }
    case 'cp-audiosecondslength': {
      const length = context.mediaSeconds;
      if (length === undefined) return { approximate: true, label: `${formatUsd(price)} / audio second`, note };
      const amount = price * length;
      return {
        amount,
        approximate: true,
        label: `about ${formatUsd(amount)}`,
        note: note ?? `${Math.round(length)} seconds of audio at ${formatUsd(price)} per second.`,
      };
    }
    case 'cp-outputVideoLength': {
      const length = firstNumber(params, DURATION_KEYS);
      if (length === undefined) return { approximate: true, label: `${formatUsd(price)} / video second`, note };
      const amount = price * length;
      return {
        amount,
        approximate: false,
        label: formatUsd(amount),
        note: note ?? `${length} seconds of video at ${formatUsd(price)} per second.`,
      };
    }
    case 'cp-pixel':
      return {
        amount: price,
        approximate: true,
        label: `from ${formatUsd(price)}`,
        note: note ?? `${formatUsd(price)} for an output image up to 1024 x 1024 pixels, more for larger ones.`,
      };
    case 'cps':
      return { approximate: true, label: `${formatUsd(price)} / second`, note: note ?? 'Billed by run time.' };
    case 'cpt':
      return { approximate: true, label: 'by tokens', note: note ?? `${formatUsd(price)} per token.` };
    case 'cp-readoutput':
      return price > 0
        ? {
            amount: price,
            approximate: true,
            label: `about ${formatUsd(price)}`,
            note: note ?? 'Set when the run ends.',
          }
        : { approximate: true, label: 'set by the run', note: note ?? 'Set when the run ends.' };
    default:
      return { approximate: true, label: 'by run time', note: 'Billed by run time.' };
  }
}

/** The price of a run with these parameters (catalog values filled in, see `withDefaults`). */
export function quote(info: PriceInfo, params: Record<string, unknown>, context: QuoteContext = {}): Quote {
  if (info.rows.length === 0) return runTimeQuote(info);
  const row = matchingRow(info.rows, params);
  return row ? rowQuote(row, params, context) : runTimeQuote(info);
}
