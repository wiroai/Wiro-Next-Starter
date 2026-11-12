'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { formatUsd, quote } from '@/lib/catalog/pricing';
import {
  buildParams,
  initialValues,
  primaryFileParam,
  promptParam,
  withDefaults,
  type FormValue,
  type FormValues,
} from '@/lib/catalog/schema';
import type { Tool } from '@/lib/catalog/tools';
import type { ModelDetail, ModelSummary } from '@/lib/catalog/types';
import { useHistory } from '@/lib/history';
import { useConfig } from '@/lib/use-config';
import { useElapsed, useTaskRun } from '@/lib/use-task-run';
import { ModelCover, ModelPicker } from './model-picker';
import { ResultView } from './result-view';
import { SchemaForm } from './schema-form';
import { TaskProgress } from './task-progress';
import { Button, cx, ErrorNote, ExternalIcon, ModelName, Spinner } from './ui';

async function fetchModel(id: string): Promise<ModelDetail> {
  const response = await fetch(`/api/models/${id.split('/').map(encodeURIComponent).join('/')}`);
  const body = (await response.json().catch(() => ({}))) as { model?: ModelDetail; error?: string };
  if (!response.ok || !body.model) throw new Error(body.error ?? 'Could not load the model.');
  return body.model;
}

function firstUrl(value: FormValue | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return typeof value === 'string' && value ? value : undefined;
}

/** Starting values: the tool's defaults and the file it was opened with. */
function startValues(model: ModelDetail, tool: Tool | undefined, file: string | undefined): FormValues {
  const overrides: FormValues = { ...(tool?.defaults ?? {}) };
  const target = file ? primaryFileParam(model.params, tool?.input ?? 'image') : undefined;
  if (target && file) overrides[target.id] = target.file?.multiple ? [file] : file;
  return initialValues(model.params, overrides);
}

/** Values for a newly picked model: the prompt and the main file carry over. */
function carryOver(previous: ModelDetail, values: FormValues, next: ModelDetail, tool?: Tool): FormValues {
  const overrides: FormValues = { ...(tool?.defaults ?? {}) };
  const oldPrompt = promptParam(previous.params);
  const newPrompt = promptParam(next.params);
  const text = oldPrompt ? values[oldPrompt.id] : undefined;
  if (newPrompt && typeof text === 'string' && text) overrides[newPrompt.id] = text;
  const kind = tool?.input ?? 'image';
  const oldFile = primaryFileParam(previous.params, kind);
  const newFile = primaryFileParam(next.params, kind);
  const url = oldFile ? firstUrl(values[oldFile.id]) : undefined;
  if (newFile && url) overrides[newFile.id] = newFile.file?.multiple ? [url] : url;
  return initialValues(next.params, overrides);
}

function RecentRuns({ source }: { source: string }) {
  const runs = useHistory()
    .filter((entry) => entry.source === source && entry.status === 'done')
    .slice(0, 6);
  if (runs.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted">Recent here</p>
        <Link href="/history" className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline">
          All history
        </Link>
      </div>
      <ul className="grid grid-cols-6 gap-2">
        {runs.map((run) => {
          const output = run.outputs[0];
          return (
            <li key={run.id}>
              <a
                href={output?.url ?? '/history'}
                target={output ? '_blank' : undefined}
                rel="noreferrer"
                title={run.prompt ?? run.modelTitle}
                className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-card text-[10px] text-muted"
              >
                {output?.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element -- remote outputs
                  <img src={output.url} alt="" loading="lazy" className="size-full object-cover" />
                ) : output?.kind === 'video' ? (
                  <video src={output.url} muted playsInline preload="metadata" className="size-full object-cover" />
                ) : (
                  <span className="font-mono">{output?.kind === 'audio' ? '♪' : 'Aa'}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Runs one model: its inputs as a form, the price for the current settings, the
 * task's progress and its outputs. On a tool page the model can be changed to
 * any model of the tool's categories.
 */
export function RunPanel({
  modelId: startModel,
  tool,
  initialFile,
  source,
  onModelChange,
}: {
  modelId: string;
  tool?: Tool;
  initialFile?: string;
  source: string;
  onModelChange?: (id: string) => void;
}) {
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switching, setSwitching] = useState<ModelSummary | null>(null);
  const [mediaSeconds, setMediaSeconds] = useState<number | undefined>(undefined);
  const resultRef = useRef<HTMLElement>(null);
  const config = useConfig();
  const { state, start } = useTaskRun();
  const elapsed = useElapsed(
    state.phase === 'idle' ? undefined : state.startedAt,
    state.phase === 'done' || state.phase === 'error' ? state.finishedAt : undefined,
  );

  useEffect(() => {
    let active = true;
    fetchModel(startModel).then(
      (model) => {
        if (!active) return;
        setDetail(model);
        setValues(startValues(model, tool, initialFile));
      },
      (error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Could not load the model.');
      },
    );
    return () => {
      active = false;
    };
  }, [startModel, tool, initialFile]);

  async function changeModel(summary: ModelSummary) {
    if (summary.id === detail?.id) return;
    setSwitching(summary);
    setLoadError(null);
    try {
      const next = await fetchModel(summary.id);
      setValues(detail ? carryOver(detail, values, next, tool) : startValues(next, tool, initialFile));
      setDetail(next);
      onModelChange?.(next.id);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load the model.');
    } finally {
      setSwitching(null);
    }
  }

  const running = state.phase === 'running';
  const built = detail ? buildParams(detail.params, values) : null;
  const prompt = detail ? promptParam(detail.params) : undefined;
  const promptText = prompt && typeof values[prompt.id] === 'string' ? (values[prompt.id] as string) : '';
  const price =
    detail && built
      ? quote(detail.pricing, withDefaults(detail.params, built.params), {
          promptChars: promptText.length || undefined,
          mediaSeconds,
        })
      : null;
  const limit = config?.maxRunPrice ?? null;
  const overLimit = limit !== null && price !== null && (price.amount === undefined || price.amount > limit + 1e-9);
  const problem = !built
    ? null
    : (built.errors[0] ??
      (built.missing.length > 0 ? `Add ${built.missing.join(', ').toLowerCase()} to run.` : null) ??
      (overLimit
        ? price?.amount === undefined
          ? `This model has no price set before the run, and this app runs models up to ${formatUsd(limit)}.`
          : `This run costs ${price?.label}, more than this app's limit of ${formatUsd(limit)}.`
        : null) ??
      (config?.keySet === false ? 'Add WIRO_API_KEY to the server to run models.' : null));

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || running || problem) return;
    if (window.matchMedia('(max-width: 1023px)').matches) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    await start(
      { model: detail.id, values, mediaSeconds },
      { modelTitle: detail.title, source, prompt: promptText || undefined },
      (detail.averageSeconds ?? 0) > 40 ? 3000 : 1500,
    );
  }

  const shown = switching ?? detail;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-start lg:gap-8">
      <form
        onSubmit={onSubmit}
        className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-xs sm:p-6"
      >
        <div className="flex items-start gap-3">
          <ModelCover src={shown?.cover} className="size-12 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {shown ? (
              <ModelName id={shown.id} title={shown.title} />
            ) : (
              <span className="h-9 w-40 animate-pulse rounded bg-foreground/5" />
            )}
            {detail ? (
              <a
                href={`https://wiro.ai/models/${detail.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1 text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Model page
                <ExternalIcon className="size-3" />
              </a>
            ) : null}
          </div>
          {tool ? (
            <ModelPicker
              categories={tool.categories}
              exclude={tool.exclude}
              current={detail?.id ?? startModel}
              onPick={(model) => void changeModel(model)}
            />
          ) : null}
        </div>

        {loadError ? <ErrorNote>{loadError}</ErrorNote> : null}

        {detail && !switching ? (
          <>
            {detail.description ? <p className="-mt-1 line-clamp-2 text-sm text-muted">{detail.description}</p> : null}
            <SchemaForm
              key={detail.id}
              params={detail.params}
              values={values}
              onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
              onMediaSeconds={setMediaSeconds}
              idPrefix={tool?.id ?? 'playground'}
            />
          </>
        ) : !loadError ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted">
            <Spinner /> Loading the model&apos;s inputs…
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-5">
          {price ? (
            <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
              <span className="font-medium tabular-nums">{price.label}</span>
              {price.note ? <span className="text-xs text-muted">{price.note}</span> : null}
            </p>
          ) : null}
          <Button type="submit" className="h-11 w-full" loading={running} disabled={!detail || Boolean(problem)}>
            {running ? 'Running…' : (tool?.action ?? 'Run')}
          </Button>
          {problem && !running ? <p className="text-xs text-muted">{problem}</p> : null}
          <p className="text-xs text-muted">Runs are billed to the Wiro AI account of this app&apos;s API key.</p>
        </div>
      </form>

      <section
        ref={resultRef}
        aria-label="Result"
        className="flex min-w-0 scroll-mt-28 flex-col gap-4 lg:sticky lg:top-20"
      >
        <div
          aria-live="polite"
          className={cx(
            'relative flex min-h-80 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-xs sm:p-6',
          )}
        >
          {state.phase === 'running' ? (
            <TaskProgress
              stage={state.task?.stage ?? null}
              elapsedMs={elapsed}
              expectedSeconds={detail?.averageSeconds}
            />
          ) : state.phase === 'done' ? (
            <div className="w-full">
              <ResultView
                outputs={state.task.outputs}
                text={state.task.text}
                modelTitle={detail?.title ?? ''}
                seconds={state.task.seconds}
                cost={state.task.cost}
                prompt={promptText || undefined}
              />
            </div>
          ) : state.phase === 'error' ? (
            <div role="alert" className="flex max-w-md flex-col items-center gap-3 text-center">
              <p className="text-sm font-medium text-danger">The run did not finish</p>
              <p className="text-sm text-muted">{state.message}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              {detail?.cover ? <ModelCover src={detail.cover} play className="size-28 rounded-2xl shadow-sm" /> : null}
              <p className="max-w-xs text-sm text-muted">
                {detail ? 'Fill in the form and run the model. The result shows up here.' : 'Loading…'}
              </p>
            </div>
          )}
        </div>
        <RecentRuns source={source} />
      </section>
    </div>
  );
}
