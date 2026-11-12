import { createWiro } from '@wiro-ai/wiro-llm';
import { APICallError, convertToModelMessages, streamText } from 'ai';
import { z } from 'zod';
import { MAX_CHAT_MESSAGES, MAX_MESSAGE_LENGTH, type ChatMessage } from '@/lib/chat';
import { findChatModel } from '@/lib/models';
import { describeError, gatewayApiKey } from '@/lib/wiro';

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

function streamErrorMessage(error: unknown): string {
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

  const model = findChatModel(parsed.data.model);
  if (!model) return text(`${parsed.data.model} is not one of this app's chat models.`, 400);

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
    providerOptions: model.reasoningEffort ? { wiro: { reasoningEffort: model.reasoningEffort } } : undefined,
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
