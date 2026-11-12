import { DEFAULT_CHAT_MODEL } from '@/lib/chat';
import { describeError } from '@/lib/wiro/client';
import { listChatModels } from '@/lib/wiro/gateway';

/** The chat models on the Wiro LLM gateway, with their prices per million tokens. */
export async function GET() {
  try {
    const models = await listChatModels();
    return Response.json(
      { models, defaultModel: DEFAULT_CHAT_MODEL },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
    );
  } catch (error) {
    const { status, message } = describeError(error);
    return Response.json({ error: message }, { status });
  }
}
