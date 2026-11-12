'use client';

import { useId, useRef, useState, type DragEvent } from 'react';
import { isFileUrl } from '@/lib/catalog/schema';
import type { FileKind, ModelParam } from '@/lib/catalog/types';
import { Button, cx, inputClass } from './ui';

const ACCEPT: Record<FileKind, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  file: 'image/*,video/*,audio/*',
};

const NOUN: Record<FileKind, string> = { image: 'image', video: 'video', audio: 'audio file', file: 'file' };
const ONE: Record<FileKind, string> = { image: 'an image', video: 'a video', audio: 'an audio file', file: 'a file' };
const MANY: Record<FileKind, string> = { image: 'images', video: 'videos', audio: 'audio files', file: 'files' };

/** Sends a file to /api/uploads, which stores it with Wiro AI, and returns its URL. */
async function upload(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const response = await fetch('/api/uploads', { method: 'POST', body: form });
  const body = (await response.json().catch(() => ({}))) as { file?: { url?: string }; error?: string };
  if (!response.ok || !body.file?.url) {
    throw new Error(body.error ?? (response.status === 413 ? 'The file is too large.' : 'The upload failed.'));
  }
  return body.file.url;
}

/** Length of an audio or video file in seconds, read by the browser. */
function mediaSeconds(src: string, kind: 'audio' | 'video'): Promise<number | undefined> {
  return new Promise((resolve) => {
    const element = document.createElement(kind);
    element.preload = 'metadata';
    element.onloadedmetadata = () => resolve(Number.isFinite(element.duration) ? element.duration : undefined);
    element.onerror = () => resolve(undefined);
    element.src = src;
  });
}

function Preview({ url, kind }: { url: string; kind: FileKind }) {
  if (kind === 'audio') return <audio src={url} controls preload="metadata" className="h-9 w-full max-w-xs" />;
  if (kind === 'video') {
    return (
      <video
        src={url}
        muted
        playsInline
        preload="metadata"
        className="size-16 rounded-md bg-foreground/5 object-cover"
      />
    );
  }
  if (kind === 'image') {
    // eslint-disable-next-line @next/next/no-img-element -- a remote preview of any size
    return <img src={url} alt="" className="size-16 rounded-md bg-foreground/5 object-cover" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="truncate text-sm underline underline-offset-2">
      {url.split('/').pop()}
    </a>
  );
}

/**
 * A file input of a model: upload a file, paste a link, or try the sample the
 * model page uses. Several files when the input takes them.
 */
export function FileField({
  param,
  value,
  onChange,
  onMediaSeconds,
}: {
  param: ModelParam;
  value: string[];
  onChange: (urls: string[]) => void;
  onMediaSeconds?: (seconds: number | undefined) => void;
}) {
  const kind = param.file?.kind ?? 'file';
  const multiple = param.file?.multiple ?? false;
  const inputId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [dragging, setDragging] = useState(false);

  const sample = param.default
    ?.replace(/^\[|\]$/g, '')
    .split(',')
    .map((item) => item.trim().replace(/^"|"$/g, ''))
    .find((item) => isFileUrl(item));
  const full = !multiple && value.length > 0;

  function add(urls: string[]) {
    const next = multiple ? [...value, ...urls].slice(0, 8) : urls.slice(0, 1);
    onChange(next);
    if ((kind === 'audio' || kind === 'video') && next[0]) {
      void mediaSeconds(next[0], kind).then((seconds) => onMediaSeconds?.(seconds));
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const picked = Array.from(files).slice(0, multiple ? 8 - value.length : 1);
      add(await Promise.all(picked.map(upload)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The upload failed.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy && !full) void onFiles(event.dataTransfer.files);
  }

  function addLink() {
    const url = link.trim();
    if (!isFileUrl(url)) {
      setError('Paste a full link that starts with https://');
      return;
    }
    setError(null);
    add([url]);
    setLink('');
    setLinkOpen(false);
  }

  return (
    <div
      className={cx(
        'flex flex-col gap-3 rounded-xl border border-dashed p-3 transition-colors',
        dragging ? 'border-foreground/50 bg-foreground/[0.03]' : 'border-border',
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {value.length > 0 ? (
        <ul className="flex flex-wrap items-center gap-2">
          {value.map((url, index) => (
            <li key={`${url}-${index}`} className="flex max-w-full items-center gap-2">
              <Preview url={url} kind={kind} />
              <button
                type="button"
                onClick={() => {
                  onChange(value.filter((_, item) => item !== index));
                  if (index === 0) onMediaSeconds?.(undefined);
                }}
                className="rounded-md px-1.5 py-1 text-xs text-muted hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                aria-label={`Remove ${NOUN[kind]} ${index + 1}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Drop {multiple ? MANY[kind] : ONE[kind]} here, or use the buttons below.</p>
      )}

      {!full ? (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            id={inputId}
            type="file"
            accept={ACCEPT[kind]}
            multiple={multiple}
            className="sr-only"
            onChange={(event) => void onFiles(event.target.files)}
          />
          <Button variant="secondary" className="h-8 px-3" loading={busy} onClick={() => fileInput.current?.click()}>
            {busy ? 'Uploading…' : 'Upload'}
          </Button>
          <Button variant="secondary" className="h-8 px-3" onClick={() => setLinkOpen((open) => !open)}>
            Paste a link
          </Button>
          {sample && value.length === 0 ? (
            <Button variant="ghost" className="h-8 px-3" onClick={() => add([sample])}>
              Try the sample
            </Button>
          ) : null}
        </div>
      ) : null}

      {linkOpen && !full ? (
        <div className="flex gap-2">
          <label htmlFor={`${inputId}-link`} className="sr-only">
            Link to the {NOUN[kind]}
          </label>
          <input
            id={`${inputId}-link`}
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={link}
            onChange={(event) => setLink(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addLink();
              }
            }}
            placeholder="https://"
            className={cx(inputClass, 'h-9')}
          />
          <Button variant="secondary" className="h-9 px-3" onClick={addLink}>
            Add
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
