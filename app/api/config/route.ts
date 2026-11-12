import { connection } from 'next/server';
import { maxRunPrice, maxUploadBytes } from '@/lib/wiro/limits';

/** The limits this deployment runs with, so the page can show them before a run. */
export async function GET() {
  await connection();
  return Response.json(
    {
      maxRunPrice: maxRunPrice() ?? null,
      maxUploadMb: Math.round(maxUploadBytes() / 1024 / 1024),
      keySet: Boolean(process.env.WIRO_API_KEY?.trim()),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
