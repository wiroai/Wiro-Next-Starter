'use client';

import { useRef, useState } from 'react';
import type { ModelSummary } from '@/lib/catalog/types';
import { Button, cx, inputClass, ModelName, Select, Spinner } from './ui';

function matches(model: ModelSummary, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${model.id} ${model.title} ${model.description}`.toLowerCase();
  return words.every((word) => text.includes(word));
}

/** A model's cover from the catalog: an image, or a short video for some models. */
export function ModelCover({ src, className, play = false }: { src?: string; className?: string; play?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <span aria-hidden="true" className={cx('shrink-0 bg-foreground/5', className)} />;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(src)) {
    return (
      <video
        src={play ? src : `${src}#t=0.5`}
        muted
        playsInline
        loop={play}
        autoPlay={play}
        preload="metadata"
        aria-hidden="true"
        onError={() => setBroken(true)}
        className={cx('shrink-0 bg-foreground/5 object-cover', className)}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- catalog covers come from the Wiro CDN in many sizes
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setBroken(true)}
      className={cx('shrink-0 bg-foreground/5 object-cover', className)}
    />
  );
}

/** A dialog that lists the models of some Wiro categories, with search and sorting. */
export function ModelPicker({
  categories,
  exclude = [],
  current,
  onPick,
  label = 'Change model',
}: {
  categories: string[];
  exclude?: string[];
  current: string;
  onPick: (model: ModelSummary) => void;
  label?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [models, setModels] = useState<ModelSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('popular');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ categories: categories.join(',') });
      if (exclude.length > 0) params.set('exclude', exclude.join(','));
      const response = await fetch(`/api/models?${params}`);
      const body = (await response.json().catch(() => ({}))) as { models?: ModelSummary[]; error?: string };
      if (!response.ok || !body.models) throw new Error(body.error ?? 'Could not load the models.');
      setModels(body.models);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the models.');
    } finally {
      setLoading(false);
    }
  }

  function open() {
    dialog.current?.showModal();
    search.current?.focus();
    if (models === null && !loading) void load();
  }

  function pick(model: ModelSummary) {
    onPick(model);
    dialog.current?.close();
  }

  const shown = (models ?? []).filter((model) => matches(model, query));
  if (sort === 'price') shown.sort((a, b) => a.priceSort - b.priceSort);

  return (
    <>
      <Button variant="secondary" className="h-8 px-3" onClick={open}>
        {label}
      </Button>
      <dialog
        ref={dialog}
        aria-label="Choose a model"
        className="m-auto max-h-[min(85dvh,760px)] w-[min(680px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="flex max-h-[min(85dvh,760px)] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Choose a model</h2>
              <p className="text-xs text-muted">
                {models ? `${models.length} models` : 'Loading the catalog'} from Wiro AI
              </p>
            </div>
            <Button variant="ghost" className="h-8 px-2" onClick={() => dialog.current?.close()} aria-label="Close">
              <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Button>
          </div>
          <div className="flex gap-2 border-b border-border px-5 py-3">
            <label htmlFor="model-search" className="sr-only">
              Search models
            </label>
            <input
              id="model-search"
              ref={search}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or owner"
              autoComplete="off"
              className={cx(inputClass, 'h-9')}
            />
            <label htmlFor="model-sort" className="sr-only">
              Sort
            </label>
            <Select
              id="model-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              choices={[
                { value: 'popular', label: 'Popular' },
                { value: 'price', label: 'Lowest price' },
              ]}
              className="h-9 w-36"
            />
          </div>
          <div className="min-h-40 flex-1 overflow-y-auto overscroll-contain p-2">
            {loading ? (
              <p className="flex items-center gap-2 p-4 text-sm text-muted">
                <Spinner /> Loading models…
              </p>
            ) : error ? (
              <div className="flex flex-col items-start gap-2 p-4">
                <p className="text-sm text-danger">{error}</p>
                <Button variant="secondary" className="h-8 px-3" onClick={() => void load()}>
                  Try again
                </Button>
              </div>
            ) : shown.length === 0 ? (
              <p className="p-4 text-sm text-muted">No models match.</p>
            ) : (
              <ul className="flex flex-col">
                {shown.map((model) => (
                  <li key={model.id}>
                    <button
                      type="button"
                      onClick={() => pick(model)}
                      aria-current={model.id === current ? 'true' : undefined}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        model.id === current && 'bg-foreground/[0.06]',
                      )}
                    >
                      <ModelCover src={model.cover} className="size-10 rounded-md" />
                      <ModelName id={model.id} title={model.title} className="flex-1" />
                      <span className="shrink-0 text-xs text-muted tabular-nums">{model.price}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
