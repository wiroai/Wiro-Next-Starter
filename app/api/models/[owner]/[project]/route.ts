import { getModel } from '@/lib/wiro/catalog';
import { describeError } from '@/lib/wiro/client';

/** One model's inputs and prices, from Tool/Detail. */
export async function GET(_request: Request, context: RouteContext<'/api/models/[owner]/[project]'>) {
  const { owner, project } = await context.params;
  try {
    const model = await getModel(`${owner}/${project}`);
    if (!model) {
      return Response.json(
        { error: `Wiro AI has no model ${owner}/${project}, or this app doesn't list it.` },
        { status: 404 },
      );
    }
    return Response.json(
      { model },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
    );
  } catch (error) {
    const { status, message } = describeError(error);
    return Response.json({ error: message }, { status });
  }
}
