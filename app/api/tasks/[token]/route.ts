import { toTaskView, type TaskView } from '@/lib/tasks';
import { describeError, getTask, USER_AGENT } from '@/lib/wiro/client';

const TOKEN = /^[A-Za-z0-9_-]{8,200}$/;
const TEXT_LIMIT = 200_000;

/**
 * Speech-to-text and other text models often return their answer as a small
 * .txt or .srt file. The page shows it inline, so it is read here, once the
 * task is done, and only from the Wiro AI CDN.
 */
async function withTextFile(view: TaskView): Promise<TaskView> {
  if (!view.done || view.text) return view;
  const file = view.outputs.find((output) => output.kind === 'text');
  if (!file || !/^https:\/\/cdn\d*\.wiro\.ai\//.test(file.url)) return view;
  try {
    const response = await fetch(file.url, {
      headers: { 'User-Agent': USER_AGENT },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const length = Number(response.headers.get('content-length') ?? 0);
    if (!response.ok || length > TEXT_LIMIT) return view;
    const text = (await response.text()).slice(0, TEXT_LIMIT).trim();
    return text ? { ...view, text } : view;
  } catch {
    return view;
  }
}

/**
 * Reads a task with POST /Task/Detail. The browser only ever holds the task
 * token, never the numeric task ID, so it can't look up other tasks.
 */
export async function GET(_request: Request, context: RouteContext<'/api/tasks/[token]'>) {
  const { token } = await context.params;
  if (!TOKEN.test(token)) return Response.json({ error: 'The task token is not valid.' }, { status: 400 });

  try {
    const view = await withTextFile(toTaskView(await getTask(token)));
    return Response.json(view, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { status, message } = describeError(error);
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
