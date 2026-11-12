'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { CATEGORY_GROUPS, categoryLabel, CATEGORY_PATTERN } from '@/lib/catalog/tools';
import type { ModelSummary } from '@/lib/catalog/types';
import { ModelCover } from './model-picker';
import { Button, cx, inputClass, Select, Spinner } from './ui';

type ListState = { key: string; models?: ModelSummary[]; error?: string };

function sortModels(models: ModelSummary[], sort: string): ModelSummary[] {
  if (sort !== 'price') return models;
  return [...models].sort((a, b) => a.priceSort - b.priceSort);
}

/** Browse the Wiro AI catalog by category, or search it, and open any model. */
export function Playground() {
  const params = useSearchParams();
  const router = useRouter();
  const requested = params.get('category') ?? '';
  const category = CATEGORY_PATTERN.test(requested) ? requested : 'text-to-image';
  const search = (params.get('q') ?? '').trim();
  const [draft, setDraft] = useState(search);
  const [sort, setSort] = useState('popular');
  const [list, setList] = useState<ListState>({ key: '' });
  const [attempt, setAttempt] = useState(0);
  const key = search ? `search:${search}` : `category:${category}`;

  useEffect(() => {
    let active = true;
    const query = search ? `search=${encodeURIComponent(search)}` : `categories=${encodeURIComponent(category)}`;
    fetch(`/api/models?${query}`)
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { models?: ModelSummary[]; error?: string };
        if (!response.ok || !body.models) throw new Error(body.error ?? 'Could not load the models.');
        if (active) setList({ key, models: body.models });
      })
      .catch((error: unknown) => {
        if (active) setList({ key, error: error instanceof Error ? error.message : 'Could not load the models.' });
      });
    return () => {
      active = false;
    };
  }, [key, search, category, attempt]);

  const loading = list.key !== key;
  const models = sortModels(list.models ?? [], sort);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = draft.trim();
    router.push(value ? `/playground?q=${encodeURIComponent(value)}` : `/playground?category=${category}`);
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <div className="flex gap-6 lg:flex-col lg:gap-5">
            {CATEGORY_GROUPS.map((group) => (
              <div key={group.label} className="flex shrink-0 flex-col gap-1">
                <p className="px-2.5 text-xs font-medium tracking-wide text-subtle uppercase">{group.label}</p>
                <ul className="flex gap-1 lg:flex-col">
                  {group.categories.map((item) => {
                    const active = !search && item.id === category;
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/playground?category=${item.id}`}
                          scroll={false}
                          aria-current={active ? 'page' : undefined}
                          className={cx(
                            'block rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                            active ? 'bg-foreground/[0.07] font-medium' : 'text-muted hover:text-foreground',
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
      </aside>

      <section aria-label="Models" className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {search ? `Models matching "${search}"` : categoryLabel(category)}
            </h2>
            <p className="text-sm text-muted">
              {loading ? 'Loading…' : list.models ? `${list.models.length} models` : ' '}
            </p>
          </div>
          <div className="flex gap-2">
            <form onSubmit={submitSearch} className="flex-1 sm:w-64 sm:flex-none" role="search">
              <label htmlFor="playground-search" className="sr-only">
                Search all models
              </label>
              <input
                id="playground-search"
                type="search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Search all models"
                autoComplete="off"
                className={cx(inputClass, 'h-9')}
              />
            </form>
            <label htmlFor="playground-sort" className="sr-only">
              Sort
            </label>
            <Select
              id="playground-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              choices={[
                { value: 'popular', label: 'Popular' },
                { value: 'price', label: 'Lowest price' },
              ]}
              className="h-9 w-36"
            />
          </div>
        </div>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Loading models from Wiro AI…
          </p>
        ) : list.error ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-danger">{list.error}</p>
            <Button variant="secondary" className="h-8 px-3" onClick={() => setAttempt((count) => count + 1)}>
              Try again
            </Button>
          </div>
        ) : models.length === 0 ? (
          <p className="text-sm text-muted">No models here yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {models.map((model) => (
              <li key={model.id}>
                <Link
                  href={`/playground/${model.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <ModelCover src={model.cover} className="aspect-[16/10] w-full" />
                  <span className="flex flex-1 flex-col gap-2 p-4">
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate font-mono text-[13px] font-medium">{model.id}</span>
                        <span className="truncate text-xs text-muted">{model.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted tabular-nums">{model.price}</span>
                    </span>
                    {model.description ? (
                      <span className="line-clamp-2 text-sm text-pretty text-muted">{model.description}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
