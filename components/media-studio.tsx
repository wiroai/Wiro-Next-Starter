'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  aspectRatioOf,
  defaultSettings,
  mediaModels,
  PROMPT_MAX_LENGTH,
  type MediaKind,
  type MediaModel,
} from '@/lib/models';
import { formatCost, PROGRESS_STAGES, type TaskOutput } from '@/lib/tasks';
import { useElapsed, useTaskRun } from '@/lib/use-task-run';
import { TaskProgress } from './task-progress';
import { Button, buttonClass, cx, ExternalIcon, Field, inputClass, Select } from './ui';

type Result = {
  id: string;
  modelName: string;
  prompt: string;
  ratio: string;
  output: TaskOutput;
  cost: number | null;
  seconds: number | null;
};

const EXAMPLES: Record<MediaKind, string[]> = {
  image: [
    'A small paper boat on a calm lake at sunrise, soft light',
    'A cozy reading corner by a large window on a rainy afternoon, warm lamp light',
    'Product photo of a ceramic coffee mug on a wooden table, morning light',
  ],
  video: [
    'A paper boat drifts across a calm lake at sunrise, gentle ripples, slow push in',
    'Steam rises from a cup of coffee on a wooden table, morning light, close up',
    'A red fox walks through fresh snow in a quiet forest, soft daylight, tracking shot',
  ],
};

const NOUN: Record<MediaKind, string> = { image: 'image', video: 'video' };

function pickOutput(kind: MediaKind, outputs: TaskOutput[]): TaskOutput | undefined {
  return outputs.find((output) => output.contentType.startsWith(`${kind}/`)) ?? outputs[0];
}

/** Starts every model that offers this aspect ratio on it, for the Animate button. */
function presetRatio(models: MediaModel[], ratio: string): Record<string, Record<string, string>> {
  const chosen: Record<string, Record<string, string>> = {};
  for (const model of models) {
    const setting = model.settings.find(
      (item) =>
        item.choices.every((choice) => /^\d+:\d+$/.test(choice.value)) &&
        item.choices.some((choice) => choice.value === ratio),
    );
    if (setting) chosen[model.id] = { [setting.id]: ratio };
  }
  return chosen;
}

/** `16 / 9` as numbers, for sizing the result frame. */
function ratioParts(ratio: string): [number, number] {
  const [width, height] = ratio.split('/').map((part) => Number(part.trim()));
  return width > 0 && height > 0 ? [width, height] : [1, 1];
}

export function MediaStudio({
  kind,
  initialImageUrl = '',
  initialRatio = '',
}: {
  kind: MediaKind;
  initialImageUrl?: string;
  initialRatio?: string;
}) {
  const models = mediaModels(kind);
  const [modelId, setModelId] = useState(models[0].id);
  const model: MediaModel = models.find((item) => item.id === modelId) ?? models[0];
  const [chosen, setChosen] = useState(() => presetRatio(models, initialRatio));
  const resultRef = useRef<HTMLElement>(null);
  const settings = { ...defaultSettings(model), ...chosen[model.id] };

  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
  const [results, setResults] = useState<Result[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showRun, setShowRun] = useState(false);

  const { state, start } = useTaskRun(kind === 'image' ? 1500 : 3000);
  const elapsed = useElapsed(
    state.phase === 'idle' ? undefined : state.startedAt,
    state.phase === 'done' || state.phase === 'error' ? state.finishedAt : undefined,
  );
  const running = state.phase === 'running';
  const active = results.find((result) => result.id === activeId) ?? results[0];
  const showingRun = showRun && (state.phase === 'running' || state.phase === 'error');

  const frameRatio = showingRun || !active ? aspectRatioOf(model, settings) : active.ratio;
  const [ratioWidth, ratioHeight] = ratioParts(frameRatio);

  async function run() {
    const text = prompt.trim();
    if (!text || running) return;
    const runModel = model;
    const ratio = aspectRatioOf(runModel, settings);
    setShowRun(true);
    const task = await start({
      kind,
      model: runModel.id,
      prompt: text,
      settings,
      imageUrl: kind === 'video' && imageUrl.trim() ? imageUrl.trim() : undefined,
    });
    const output = task ? pickOutput(kind, task.outputs) : undefined;
    if (task && output) {
      const result: Result = {
        id: output.url,
        modelName: runModel.name,
        prompt: text,
        ratio,
        output,
        cost: task.cost,
        seconds: task.seconds,
      };
      setResults((list) => [result, ...list].slice(0, 12));
      setActiveId(result.id);
      setShowRun(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // In the one-column layout the result sits below the form, so bring it into view.
    if (prompt.trim() && !running && window.matchMedia('(max-width: 1023px)').matches) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    void run();
  }

  function onPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function setSetting(id: string, value: string) {
    setChosen((current) => ({ ...current, [model.id]: { ...current[model.id], [id]: value } }));
  }

  const liveMessage =
    state.phase === 'running'
      ? `${PROGRESS_STAGES.find((step) => step.stage === state.task?.stage)?.label ?? 'Starting'}`
      : state.phase === 'done'
        ? `The ${NOUN[kind]} is ready.`
        : state.phase === 'error'
          ? state.message
          : '';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <form
        onSubmit={onSubmit}
        className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
      >
        <Field
          label="Prompt"
          htmlFor={`${kind}-prompt`}
          hint={
            <span className="flex justify-between gap-3">
              <span>Ctrl or ⌘ + Enter to generate</span>
              <span className="tabular-nums">
                {prompt.length.toLocaleString('en-US')} / {PROMPT_MAX_LENGTH.toLocaleString('en-US')}
              </span>
            </span>
          }
        >
          <textarea
            id={`${kind}-prompt`}
            name="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={onPromptKeyDown}
            rows={5}
            maxLength={PROMPT_MAX_LENGTH}
            required
            placeholder={`Describe the ${NOUN[kind]} you want`}
            className={cx(inputClass, 'min-h-32 resize-y leading-relaxed')}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted" id={`${kind}-examples`}>
            Try one
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${kind}-examples`}>
            {EXAMPLES[kind].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setPrompt(example)}
                className="max-w-full truncate rounded-full border border-border px-3 py-1 text-left text-xs text-muted transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                title={example}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <Field
          label="Model"
          htmlFor={`${kind}-model`}
          hint={
            <>
              {model.description}{' '}
              <a
                href={`https://wiro.ai/models/${model.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-foreground underline-offset-2 hover:underline"
              >
                Model page
                <ExternalIcon className="size-3" />
              </a>
            </>
          }
        >
          <Select
            id={`${kind}-model`}
            value={model.id}
            onChange={(event) => setModelId(event.target.value)}
            choices={models.map((item) => ({ value: item.id, label: item.name }))}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {model.settings.map((setting) => (
            <Field key={setting.id} label={setting.label} htmlFor={`${kind}-${setting.id}`}>
              <Select
                id={`${kind}-${setting.id}`}
                value={settings[setting.id]}
                onChange={(event) => setSetting(setting.id, event.target.value)}
                choices={setting.choices}
              />
            </Field>
          ))}
        </div>

        {kind === 'video' && model.imageInput ? (
          <Field
            label="Start image"
            htmlFor="video-start-image"
            hint="Optional. A public image URL to use as the first frame."
          >
            <div className="flex items-center gap-3">
              <input
                id="video-start-image"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://"
                className={cx(inputClass, 'h-10')}
              />
              {imageUrl.startsWith('https://') ? (
                // eslint-disable-next-line @next/next/no-img-element -- a remote preview of any size
                <img src={imageUrl} alt="" className="size-10 shrink-0 rounded-md border border-border object-cover" />
              ) : null}
            </div>
          </Field>
        ) : null}

        <Button type="submit" loading={running} disabled={!prompt.trim()} className="h-11 w-full">
          {running ? 'Generating…' : `Generate ${NOUN[kind]}`}
        </Button>
        <p className="-mt-2 text-xs text-muted">
          Each run is billed to your Wiro AI account at the model&apos;s price.
        </p>
      </form>

      <section ref={resultRef} aria-label="Result" className="flex min-w-0 scroll-mt-20 flex-col gap-4">
        <p className="sr-only" aria-live="polite">
          {liveMessage}
        </p>
        <div
          className="relative mx-auto flex items-center justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-xs"
          style={{
            aspectRatio: `${ratioWidth} / ${ratioHeight}`,
            width: `min(100%, calc(70vh * ${ratioWidth} / ${ratioHeight}))`,
          }}
        >
          {showingRun && state.phase === 'running' ? (
            <div className="flex size-full items-center justify-center bg-foreground/[0.02] p-6">
              <TaskProgress stage={state.task?.stage ?? null} elapsedMs={elapsed} />
            </div>
          ) : showingRun && state.phase === 'error' ? (
            <div role="alert" className="flex max-w-sm flex-col items-center gap-3 p-6 text-center">
              <p className="text-sm font-medium text-danger">The {NOUN[kind]} could not be made</p>
              <p className="text-sm text-muted">{state.message}</p>
              <Button variant="secondary" onClick={() => void run()} disabled={!prompt.trim()}>
                Try again
              </Button>
            </div>
          ) : active ? (
            kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote outputs, shown at their own size
              <img src={active.output.url} alt={active.prompt} className="size-full object-contain" />
            ) : (
              <video
                key={active.output.url}
                src={active.output.url}
                className="size-full object-contain"
                controls
                autoPlay
                loop
                muted
                playsInline
              />
            )
          ) : (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-foreground/5 text-muted">
                {kind === 'image' ? <ImageIcon /> : <VideoIcon />}
              </span>
              <p className="text-sm text-muted">Your {NOUN[kind]} shows up here.</p>
            </div>
          )}
        </div>

        {active && !showingRun ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">{active.modelName}</span>
                {active.seconds !== null ? <> · {Math.round(active.seconds)} s</> : null}
                {formatCost(active.cost) ? <> · {formatCost(active.cost)}</> : null}
              </p>
              <div className="flex gap-2">
                {kind === 'image' ? (
                  <Link
                    href={`/video?image=${encodeURIComponent(active.output.url)}&ratio=${encodeURIComponent(active.ratio.replace(/\s*\/\s*/, ':'))}`}
                    className={buttonClass('secondary', 'h-9 px-3')}
                  >
                    Animate
                  </Link>
                ) : null}
                <a
                  href={active.output.url}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass('secondary', 'h-9 px-3')}
                >
                  Open
                  <ExternalIcon />
                </a>
              </div>
            </div>
            <p className="line-clamp-2 text-sm text-muted">{active.prompt}</p>
          </div>
        ) : null}

        {results.length > 1 ? (
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Earlier results">
            {results.map((result, index) => (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(result.id);
                    setShowRun(false);
                  }}
                  aria-pressed={!showingRun && active?.id === result.id}
                  aria-label={`Show result ${results.length - index}`}
                  className={cx(
                    'block aspect-square w-full overflow-hidden rounded-lg border bg-card transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    !showingRun && active?.id === result.id ? 'border-foreground' : 'border-border hover:opacity-80',
                  )}
                >
                  {kind === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote outputs
                    <img src={result.output.url} alt="" className="size-full object-cover" />
                  ) : (
                    <video
                      src={result.output.url}
                      className="size-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

function ImageIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="10" r="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="12.5" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m16 10 4.5-2.5v9L16 14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
