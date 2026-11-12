import 'server-only';

import { isHiddenModel } from '../catalog/filters';
import { isLivePricing, parsePriceRows, summaryPrice } from '../catalog/pricing';
import { normalizeParams } from '../catalog/schema';
import type { ModelDetail, ModelSummary, PriceInfo } from '../catalog/types';
import { wiroPost } from './client';

/**
 * The Wiro AI model catalog: Tool/List for a category's models and Tool/Detail
 * for one model's inputs and prices (https://wiro.ai/docs/models). Both are
 * public, so the catalog works before a key is set. Answers are kept for ten
 * minutes in this server process.
 */

type ToolItem = {
  cleanslugowner?: string;
  cleanslugproject?: string;
  slugowner?: string;
  slugproject?: string;
  title?: string;
  description?: string;
  seodescription?: string;
  categories?: unknown;
  image?: string;
  dynamicprice?: unknown;
  cps?: unknown;
  quegroupcps?: unknown;
  approximatelycost?: unknown;
  taskstat?: { runcount?: unknown; successcount?: unknown; elapsedseconds?: unknown } | null;
  parameters?: unknown;
};

export type ListSort = 'ratedusercount' | 'time' | 'relevance';

const TTL_MS = 10 * 60_000;
const PAGE_SIZE = 100;
const MAX_PER_LIST = 300;
const MAX_CACHED = 500;

/** Slugs are short, plain path segments. */
export const SLUG_PART = /^[a-z0-9][a-z0-9._-]{0,99}$/i;

type Entry<T> = { at: number; value: Promise<T> };
const lists = new Map<string, Entry<ModelSummary[]>>();
const details = new Map<string, Entry<ModelDetail | null>>();

function cached<T>(map: Map<string, Entry<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = map.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  if (map.size >= MAX_CACHED) map.delete(map.keys().next().value as string);
  const value = load();
  map.set(key, { at: Date.now(), value });
  value.catch(() => map.delete(key));
  return value;
}

function positive(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function idOf(item: ToolItem): string {
  return `${item.cleanslugowner ?? item.slugowner ?? ''}/${item.cleanslugproject ?? item.slugproject ?? ''}`;
}

function pricingOf(item: ToolItem): PriceInfo {
  return {
    rows: parsePriceRows(item.dynamicprice),
    estimate: positive(item.approximatelycost),
    // Models without a price list are billed per second of run time at the cps rate, or the queue's rate.
    rate: positive(item.cps) ?? positive(item.quegroupcps),
  };
}

function shorten(value: string | undefined, max = 220): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[,.;:]$/, '')}...`;
}

function summaryOf(item: ToolItem, pricing: PriceInfo): ModelSummary {
  const price = summaryPrice(pricing);
  const runs = positive(item.taskstat?.successcount) ?? positive(item.taskstat?.runcount);
  const seconds = positive(item.taskstat?.elapsedseconds);
  return {
    id: idOf(item),
    title: (item.title ?? '').trim() || idOf(item),
    description: shorten(item.seodescription || item.description),
    categories: (Array.isArray(item.categories) ? item.categories : []).map(String).filter((c) => c !== 'tool'),
    cover: typeof item.image === 'string' && item.image.startsWith('https://') ? item.image : undefined,
    price: price.label,
    priceSort: price.sort,
    averageSeconds: runs && seconds ? Math.round(seconds / runs) : undefined,
  };
}

function listable(item: ToolItem): ModelSummary | null {
  if (!item?.cleanslugowner && !item?.slugowner) return null;
  const pricing = pricingOf(item);
  const summary = summaryOf(item, pricing);
  if (isHiddenModel(summary) || isLivePricing(pricing)) return null;
  return summary;
}

async function fetchList(body: Record<string, unknown>): Promise<ModelSummary[]> {
  const models: ModelSummary[] = [];
  for (let start = 0; start < MAX_PER_LIST; start += PAGE_SIZE) {
    const page = await wiroPost<{ tool?: ToolItem[]; total?: unknown }>(
      '/Tool/List',
      { ...body, start: String(start), limit: String(PAGE_SIZE), hideworkflows: true, summary: true },
      { auth: false },
    );
    const items = Array.isArray(page.tool) ? page.tool : [];
    for (const item of items) {
      const summary = listable(item);
      if (summary) models.push(summary);
    }
    if (items.length < PAGE_SIZE || start + PAGE_SIZE >= Number(page.total ?? 0)) break;
  }
  return models;
}

/** The models of one category, most popular first. */
export function listCategory(category: string, sort: ListSort = 'ratedusercount'): Promise<ModelSummary[]> {
  return cached(lists, `category:${category}:${sort}`, () => fetchList({ search: '', categories: [category], sort }));
}

/** Models matching a search, across the catalog. */
export function searchModels(search: string): Promise<ModelSummary[]> {
  const query = search.trim().slice(0, 100);
  return cached(lists, `search:${query.toLowerCase()}`, () =>
    fetchList({ search: query, categories: [], sort: 'relevance' }),
  );
}

/** The models of several categories, without repeats, leaving out models that carry an excluded category. */
export async function listModels(categories: string[], exclude: string[] = []): Promise<ModelSummary[]> {
  const seen = new Map<string, ModelSummary>();
  for (const list of await Promise.all(categories.map((category) => listCategory(category)))) {
    for (const model of list) if (!seen.has(model.id)) seen.set(model.id, model);
  }
  return [...seen.values()].filter((model) => !model.categories.some((category) => exclude.includes(category)));
}

/** One model with its inputs and prices, or null when Wiro has no such model or this app doesn't list it. */
export function getModel(id: string): Promise<ModelDetail | null> {
  const [owner, project, ...rest] = id.split('/');
  if (rest.length > 0 || !SLUG_PART.test(owner ?? '') || !SLUG_PART.test(project ?? '')) return Promise.resolve(null);
  return cached(details, id.toLowerCase(), async () => {
    let data: { tool?: ToolItem[] };
    try {
      data = await wiroPost<{ tool?: ToolItem[] }>(
        '/Tool/Detail',
        { slugowner: owner, slugproject: project },
        { auth: false },
      );
    } catch (error) {
      // Tool/Detail refuses unknown and private models with result: false.
      if (error instanceof Error && /not-exist|not-accessible|not found/i.test(error.message)) return null;
      throw error;
    }
    const item = data.tool?.[0];
    if (!item) return null;
    const pricing = pricingOf(item);
    const summary = summaryOf(item, pricing);
    if (isHiddenModel(summary) || isLivePricing(pricing)) return null;
    return { ...summary, params: normalizeParams(item.parameters), pricing };
  });
}
