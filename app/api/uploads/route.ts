import { describeError, uploadFile } from '@/lib/wiro/client';
import { maxUploadBytes } from '@/lib/wiro/limits';

export const maxDuration = 120;

const ACCEPTED = /^(image|video|audio)\//;

/**
 * Stores a file from the browser with Wiro AI (POST /File/Upload) and returns
 * its URL, which the form then sends as a file input.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return Response.json({ error: 'Send one file in the "file" field.' }, { status: 400 });
  if (file.size === 0) return Response.json({ error: 'The file is empty.' }, { status: 400 });

  const limit = maxUploadBytes();
  if (file.size > limit) {
    return Response.json(
      { error: `The file is larger than ${Math.round(limit / 1024 / 1024)} MB. Paste a link to it instead.` },
      { status: 413 },
    );
  }
  if (!ACCEPTED.test(file.type)) {
    return Response.json({ error: 'Upload an image, a video or an audio file.' }, { status: 415 });
  }

  const name = (file.name || 'upload').replace(/[^\w.-]+/g, '_').slice(-120) || 'upload';
  try {
    return Response.json({ file: await uploadFile(file, name) });
  } catch (error) {
    const { status, message } = describeError(error);
    return Response.json({ error: message }, { status });
  }
}
