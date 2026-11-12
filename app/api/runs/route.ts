import { z } from 'zod';
import { formatUsd, quote } from '@/lib/catalog/pricing';
import { buildParams, MAX_FILES, MAX_TEXT_LENGTH, promptParam, withDefaults } from '@/lib/catalog/schema';
import { getModel } from '@/lib/wiro/catalog';
import { describeError, runModel } from '@/lib/wiro/client';
import { ASSUMED_MEDIA_SECONDS, maxRunPrice } from '@/lib/wiro/limits';

const RunRequest = z.object({
  model: z.string().max(201),
  values: z.record(
    z.string().max(200),
    z.union([z.string().max(MAX_TEXT_LENGTH + 1), z.array(z.string().max(4096)).max(MAX_FILES + 1), z.boolean()]),
  ),
  /** Length of the input audio, measured in the browser, for prices per audio second. */
  mediaSeconds: z.number().positive().max(86_400).optional(),
});

/**
 * Starts a task with POST /Run/{owner}/{model} and returns its token. The form
 * values are checked against the model's inputs from the catalog, and the run is
 * priced the way Wiro bills it before it starts.
 */
export async function POST(request: Request) {
  const parsed = RunRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'The request is not valid.' }, { status: 400 });
  const { values, mediaSeconds } = parsed.data;

  try {
    const model = await getModel(parsed.data.model);
    if (!model) {
      return Response.json(
        { error: `Wiro AI has no model ${parsed.data.model}, or this app doesn't list it.` },
        { status: 404 },
      );
    }

    const built = buildParams(model.params, values);
    if (built.errors.length > 0) return Response.json({ error: built.errors[0] }, { status: 400 });
    if (built.missing.length > 0) {
      return Response.json({ error: `Fill in ${built.missing.join(', ')} first.` }, { status: 400 });
    }

    const prompt = promptParam(model.params);
    const promptValue = prompt ? built.params[prompt.id] : undefined;
    const price = quote(model.pricing, withDefaults(model.params, built.params), {
      promptChars: typeof promptValue === 'string' ? promptValue.length : undefined,
      mediaSeconds: mediaSeconds ?? ASSUMED_MEDIA_SECONDS,
    });

    const limit = maxRunPrice();
    if (limit !== undefined) {
      if (price.amount === undefined) {
        return Response.json(
          {
            error: `This model has no price set before the run, and this app only starts runs up to ${formatUsd(limit)}.`,
          },
          { status: 403 },
        );
      }
      if (price.amount > limit + 1e-9) {
        return Response.json(
          { error: `This run costs ${price.label}, more than this app's limit of ${formatUsd(limit)} per run.` },
          { status: 403 },
        );
      }
    }

    const { token } = await runModel(model.id, built.params);
    return Response.json({ token, price: price.label });
  } catch (error) {
    const { status, message } = describeError(error);
    return Response.json({ error: message }, { status });
  }
}
