import { z } from 'zod';
import { buildRunParams, findMediaModel, InputError } from '@/lib/models';
import { describeError, runModel } from '@/lib/wiro';

const RunRequest = z.object({
  kind: z.enum(['image', 'video']),
  model: z.string().max(200),
  prompt: z.string().max(10_000),
  settings: z.record(z.string(), z.string().max(100)).optional(),
  imageUrl: z.string().max(2048).optional(),
});

/**
 * Starts an image or video task with POST /Run/{owner}/{model} and returns its
 * token. The browser then polls /api/tasks/{token}.
 */
export async function POST(request: Request) {
  const parsed = RunRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'The request is not valid.' }, { status: 400 });

  const { kind, model: modelId, prompt, settings, imageUrl } = parsed.data;
  const model = findMediaModel(kind, modelId);
  if (!model) return Response.json({ error: `${modelId} is not one of this app's ${kind} models.` }, { status: 400 });

  let params: Record<string, string>;
  try {
    params = buildRunParams(model, { prompt, settings, imageUrl: imageUrl || undefined });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }

  try {
    const { token } = await runModel(model.id, params);
    return Response.json({ token });
  } catch (error) {
    const { status, message } = describeError(error);
    return Response.json({ error: message }, { status });
  }
}
