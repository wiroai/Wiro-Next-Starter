import { CATEGORY_PATTERN } from '@/lib/catalog/tools';
import { listModels, searchModels } from '@/lib/wiro/catalog';
import { describeError } from '@/lib/wiro/client';

const CACHE = 'public, s-maxage=600, stale-while-revalidate=3600';

function list(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Models from the Wiro AI catalog: `?categories=text-to-image,image-editing`
 * lists those categories, `?search=flux` searches every model.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const categories = list(url.searchParams.get('categories'));
  const exclude = list(url.searchParams.get('exclude'));
  const search = (url.searchParams.get('search') ?? '').trim();

  if ([...categories, ...exclude].some((category) => !CATEGORY_PATTERN.test(category)) || categories.length > 8) {
    return Response.json({ error: 'The categories are not valid.' }, { status: 400 });
  }
  if (categories.length === 0 && !search) {
    return Response.json({ error: 'Name at least one category, or a search.' }, { status: 400 });
  }

  try {
    let models = search ? await searchModels(search) : await listModels(categories, exclude);
    if (search && categories.length > 0) {
      models = models.filter((model) => model.categories.some((category) => categories.includes(category)));
    }
    return Response.json({ models }, { headers: { 'Cache-Control': CACHE } });
  } catch (error) {
    const { status, message } = describeError(error);
    return Response.json({ error: message }, { status });
  }
}
