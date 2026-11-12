import { toTaskView } from '@/lib/tasks';
import { describeError, getTask } from '@/lib/wiro';

const TOKEN = /^[A-Za-z0-9_-]{8,200}$/;

/**
 * Reads a task with POST /Task/Detail. The browser only ever holds the task
 * token, never the numeric task ID, so it can't look up other tasks.
 */
export async function GET(_request: Request, context: RouteContext<'/api/tasks/[token]'>) {
  const { token } = await context.params;
  if (!TOKEN.test(token)) return Response.json({ error: 'The task token is not valid.' }, { status: 400 });

  try {
    const task = await getTask(token);
    return Response.json(toTaskView(task), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { status, message } = describeError(error);
    return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
