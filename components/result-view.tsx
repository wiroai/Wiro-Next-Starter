'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatCost, type TaskOutput } from '@/lib/tasks';
import { buttonClass, ExternalIcon } from './ui';

/** Where an output can go next: other tools that take it as their input. */
export function nextSteps(output: TaskOutput): { label: string; href: string }[] {
  const url = encodeURIComponent(output.url);
  if (output.kind === 'image') {
    return [
      { label: 'Edit', href: `/image?tab=edit&image=${url}` },
      { label: 'Upscale', href: `/image?tab=upscale&image=${url}` },
      { label: 'Remove background', href: `/image?tab=remove-background&image=${url}` },
      { label: 'Animate', href: `/video?tab=image&image=${url}` },
    ];
  }
  if (output.kind === 'audio') return [{ label: 'Transcribe', href: `/audio?tab=transcribe&audio=${url}` }];
  return [];
}

function TextAnswer({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <pre className="max-h-[50vh] overflow-auto rounded-xl border border-border bg-background p-4 text-sm leading-relaxed whitespace-pre-wrap">
        {text}
      </pre>
      <div>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className={buttonClass('secondary', 'h-8 px-3')}
        >
          {copied ? 'Copied' : 'Copy text'}
        </button>
      </div>
    </div>
  );
}

/** The outputs of a finished task: images, video, audio, text and other files. */
export function ResultView({
  outputs,
  text,
  modelTitle,
  seconds,
  cost,
  prompt,
}: {
  outputs: TaskOutput[];
  text: string | null | undefined;
  modelTitle: string;
  seconds: number | null | undefined;
  cost: number | null | undefined;
  prompt?: string;
}) {
  const images = outputs.filter((output) => output.kind === 'image');
  const videos = outputs.filter((output) => output.kind === 'video');
  const audios = outputs.filter((output) => output.kind === 'audio');
  const files = outputs.filter((output) => output.kind === 'text' || output.kind === 'file');
  const first = images[0] ?? audios[0];
  const steps = first ? nextSteps(first) : [];
  const price = formatCost(cost);

  return (
    <div className="flex flex-col gap-4">
      {images.length > 0 ? (
        <div className={images.length > 1 ? 'grid grid-cols-2 gap-3' : 'flex justify-center'}>
          {images.map((image) => (
            <a
              key={image.url}
              href={image.url}
              target="_blank"
              rel="noreferrer"
              className="checkerboard block overflow-hidden rounded-xl border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote outputs, shown at their own size */}
              <img src={image.url} alt={prompt ?? 'Generated image'} className="max-h-[70vh] w-full object-contain" />
            </a>
          ))}
        </div>
      ) : null}

      {videos.map((video) => (
        <video
          key={video.url}
          src={video.url}
          className="max-h-[70vh] w-full rounded-xl border border-border bg-black object-contain"
          controls
          autoPlay
          loop
          muted
          playsInline
        />
      ))}

      {audios.map((audio) => (
        <div key={audio.url} className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <p className="truncate text-xs text-muted">{audio.name || 'Audio'}</p>
          <audio src={audio.url} controls className="w-full" />
        </div>
      ))}

      {text ? <TextAnswer text={text} /> : null}

      {files.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {files.map((file) => (
            <li key={file.url}>
              <a
                href={file.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
              >
                {file.name || 'Download the file'}
                <ExternalIcon />
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">{modelTitle}</span>
          {seconds !== null && seconds !== undefined ? <> · {Math.max(1, Math.round(seconds))} s</> : null}
          {price ? <> · {price}</> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          {steps.map((step) => (
            <Link key={step.label} href={step.href} className={buttonClass('secondary', 'h-8 px-3')}>
              {step.label}
            </Link>
          ))}
          {first ? (
            <a href={first.url} target="_blank" rel="noreferrer" className={buttonClass('secondary', 'h-8 px-3')}>
              Open
              <ExternalIcon />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
