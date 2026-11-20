import { createWiro } from '@wiro-ai/wiro-llm';
import { APICallError, convertToModelMessages, streamText } from 'ai';
import { z } from 'zod';
import { MAX_CHAT_MESSAGES, MAX_MESSAGE_LENGTH, type ChatMessage } from '@/lib/chat';
import { describeError, gatewayApiKey } from '@/lib/wiro/client';
import { listChatModels } from '@/lib/wiro/gateway';

export const maxDuration = 60;

const SYSTEM_PROMPT =
  'You are a helpful assistant in a demo app built with Next.js and Wiro AI. ' +
  'Answer clearly and keep answers short unless the user asks for more. Use Markdown for lists, tables and code.';

const ChatRequest = z.object({
  model: z.string().max(200),
  messages: z
    .array(
      z.object({
        id: z.string().max(200),
        role: z.enum(['user', 'assistant']),
        parts: z.array(z.looseObject({ type: z.string(), text: z.string().optional() })).max(100),
      }),
    )
    .min(1)
    .max(500),
});

function text(message: string, status: number) {
  return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

type GatewayErrorBody = { code?: unknown; message?: unknown };

/** The gateway's `{ code, message }` for a failed call, or for an error frame inside a stream. */
function gatewayError(error: unknown): { code?: string; message?: string } {
  let body: GatewayErrorBody | undefined;
  if (APICallError.isInstance(error)) {
    body = (error.data as { error?: GatewayErrorBody } | undefined)?.error;
    if (!body && error.responseBody) {
      try {
        body = (JSON.parse(error.responseBody) as { error?: GatewayErrorBody } | null)?.error;
      } catch {
        // Not a JSON body.
      }
    }
  } else if (error && typeof error === 'object' && 'code' in error) {
    body = error as GatewayErrorBody;
  }
  return {
    code: typeof body?.code === 'string' ? body.code : undefined,
    message: typeof body?.message === 'string' && body.message.trim() ? body.message.trim() : undefined,
  };
}

function streamErrorMessage(error: unknown): string {
  const { code, message } = gatewayError(error);
  // A spend limit or a Model Access rule of the key's workspace stopped the call before it ran. Wiro's
  // message names the limit (and when it resets) or the rule. More funds or another key change nothing.
  if (code === 'spend_limit_reached') {
    return message ?? 'A spend limit of this Wiro AI workspace is reached.';
  }
  if (code === 'model_not_allowed') {
    return message ?? 'A Model Access rule of this Wiro AI workspace blocks this model.';
  }
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return 'Wiro AI did not accept the API key. Check WIRO_API_KEY, and WIRO_API_SECRET for signature projects.';
    }
    if (error.statusCode === 402) return 'The Wiro AI balance is too low. Add funds at wiro.ai/panel/billing.';
    if (error.statusCode === 429) return 'Too many requests at once. Try again in a moment.';
  }
  console.error('Chat request failed:', error instanceof Error ? error.message : error);
  return 'The model could not answer. Try again.';
}

/** Streams a chat reply from the Wiro LLM gateway with the AI SDK. */
export async function POST(request: Request) {
  const parsed = ChatRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return text('The request is not valid.', 400);

  let model;
  try {
    model = (await listChatModels()).find((item) => item.id === parsed.data.model);
  } catch (error) {
    const { status, message } = describeError(error);
    return text(message, status);
  }
  if (!model) return text(`${parsed.data.model} is not a chat model on the Wiro LLM gateway.`, 400);

  // Text only, and only the latest messages, starting with a user message.
  const recent = parsed.data.messages
    .map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => ({ type: 'text' as const, text: part.text as string })),
    }))
    .filter((message) => message.parts.length > 0)
    .slice(-MAX_CHAT_MESSAGES);
  while (recent.length > 0 && recent[0].role !== 'user') recent.shift();
  if (recent.length === 0) return text('Send a message first.', 400);
  if (recent.some((message) => message.parts.some((part) => part.text.length > MAX_MESSAGE_LENGTH))) {
    return text(`A message can be at most ${MAX_MESSAGE_LENGTH.toLocaleString('en-US')} characters.`, 400);
  }

  let apiKey: string;
  try {
    apiKey = gatewayApiKey();
  } catch (error) {
    const { status, message } = describeError(error);
    return text(message, status);
  }

  const wiro = createWiro({ apiKey });
  const result = streamText({
    model: wiro(model.id),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages<ChatMessage>(recent),
    maxOutputTokens: 4096,
    // Low effort keeps answers quick on models that think before they answer.
    providerOptions: model.reasoning ? { wiro: { reasoningEffort: 'low' } } : undefined,
    abortSignal: request.signal,
  });

  // A reply can take more than one step; each step reports its own cost.
  let cost = 0;
  return result.toUIMessageStreamResponse<ChatMessage>({
    messageMetadata: ({ part }) => {
      if (part.type === 'start') return { model: model.id };
      if (part.type === 'finish-step') {
        const stepCost = Number(part.providerMetadata?.wiro?.cost ?? 0);
        if (Number.isFinite(stepCost)) cost += stepCost;
      }
      if (part.type === 'finish') return { model: model.id, cost };
      return undefined;
    },
    onError: streamErrorMessage,
  });
}
