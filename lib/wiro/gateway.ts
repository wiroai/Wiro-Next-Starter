import 'server-only';

import { isHiddenModel } from '../catalog/filters';
import type { ChatModel } from '../catalog/types';
import { LLM_API_URL, USER_AGENT } from './client';

/**
 * The chat models on the Wiro LLM gateway, from `GET /v1/models`, which needs
 * no key (https://wiro.ai/docs/completions-api). Kept for ten minutes.
 */

type GatewayModel = {
  id?: string;
  name?: string;
  owned_by?: string;
  context_length?: number;
  pricing?: { prompt?: string | number; completion?: string | number };
  supported_parameters?: string[];
  architecture?: { input_modalities?: string[] };
  capabilities?: { endpoints?: string[] };
};

const TTL_MS = 10 * 60_000;
let cache: { at: number; value: Promise<ChatModel[]> } | undefined;

function perMillion(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 1_000_000 * 1000) / 1000 : undefined;
}

function toChatModel(model: GatewayModel): ChatModel | null {
  if (!model.id || !/^[a-z0-9-]+\/[a-z0-9._-]+$/i.test(model.id)) return null;
  if (model.capabilities?.endpoints && !model.capabilities.endpoints.includes('chat')) return null;
  // The gateway prefixes names with "(Wiro) " so they stand apart in other apps' model pickers.
  const name = (model.name ?? model.id).replace(/^\(Wiro\)\s*/, '').trim() || model.id;
  if (isHiddenModel({ id: model.id, title: name })) return null;
  return {
    id: model.id,
    name,
    owner: model.id.split('/')[0],
    inputPrice: perMillion(model.pricing?.prompt),
    outputPrice: perMillion(model.pricing?.completion),
    contextLength: typeof model.context_length === 'number' ? model.context_length : undefined,
    reasoning: (model.supported_parameters ?? []).includes('reasoning_effort'),
    vision: (model.architecture?.input_modalities ?? []).includes('image'),
  };
}

async function load(): Promise<ChatModel[]> {
  const response = await fetch(`${LLM_API_URL}/models`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`The LLM gateway answered HTTP ${response.status}.`);
  const body = (await response.json()) as { data?: GatewayModel[] };
  return (body.data ?? []).flatMap((model) => {
    const chat = toChatModel(model);
    return chat ? [chat] : [];
  });
}

export function listChatModels(): Promise<ChatModel[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = load();
  cache = { at: Date.now(), value };
  value.catch(() => {
    if (cache?.value === value) cache = undefined;
  });
  return value;
}
