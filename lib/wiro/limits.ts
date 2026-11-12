import 'server-only';

/** Optional limits a deployment can set; see the README. */

/** Largest run this deployment starts, in USD (`MAX_RUN_PRICE`). Unset means no limit. */
export function maxRunPrice(): number | undefined {
  const value = Number(process.env.MAX_RUN_PRICE);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Largest file the upload route takes. Vercel functions accept request bodies up to 4.5 MB. */
export function maxUploadBytes(): number {
  const megabytes = Number(process.env.MAX_UPLOAD_MB);
  return (Number.isFinite(megabytes) && megabytes > 0 ? megabytes : 25) * 1024 * 1024;
}

/** Audio length assumed for the price limit when the browser sent none. */
export const ASSUMED_MEDIA_SECONDS = 300;
