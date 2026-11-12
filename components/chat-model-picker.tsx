'use client';

import { useRef, useState } from 'react';
import type { ChatModel } from '@/lib/catalog/types';
import { Badge, Button, cx, inputClass } from './ui';

/** "$0.20 / $1.25 per 1M tokens" */
export function chatPrice(model: ChatModel): string | null {
  if (model.inputPrice === undefined && model.outputPrice === undefined) return null;
  const amount = (value: number | undefined) => (value === undefined ? '?' : `$${Number(value.toPrecision(3))}`);
  return `${amount(model.inputPrice)} / ${amount(model.outputPrice)} per 1M tokens`;
}

/** A dialog with every chat model on the Wiro LLM gateway, grouped by provider. */
export function ChatModelPicker({
  models,
  current,
  onPick,
}: {
  models: ChatModel[];
  current: string;
  onPick: (model: ChatModel) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = models.filter((model) =>
    words.every((word) => `${model.id} ${model.name}`.toLowerCase().includes(word)),
  );
  const owners = [...new Set(shown.map((model) => model.owner))];

  return (
    <>
      <Button
        variant="secondary"
        className="h-9 px-3"
        onClick={() => {
          dialog.current?.showModal();
          search.current?.focus();
        }}
        disabled={models.length === 0}
      >
        Change model
      </Button>
      <dialog
        ref={dialog}
        aria-label="Choose a chat model"
        className="m-auto max-h-[min(85dvh,760px)] w-[min(640px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="flex max-h-[min(85dvh,760px)] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="font-semibold">Choose a chat model</h2>
              <p className="text-xs text-muted">{models.length} models on the Wiro LLM gateway</p>
            </div>
            <Button variant="ghost" className="h-8 px-2" onClick={() => dialog.current?.close()} aria-label="Close">
              <svg className="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Button>
          </div>
          <div className="border-b border-border px-5 py-3">
            <label htmlFor="chat-model-search" className="sr-only">
              Search chat models
            </label>
            <input
              id="chat-model-search"
              ref={search}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search GPT, Claude, Gemini, DeepSeek…"
              autoComplete="off"
              className={cx(inputClass, 'h-9')}
            />
          </div>
          <div className="min-h-40 flex-1 overflow-y-auto overscroll-contain p-2">
            {owners.length === 0 ? <p className="p-4 text-sm text-muted">No models match.</p> : null}
            {owners.map((owner) => (
              <div key={owner} className="flex flex-col gap-0.5 pb-2">
                <p className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-subtle uppercase">{owner}</p>
                <ul>
                  {shown
                    .filter((model) => model.owner === owner)
                    .map((model) => (
                      <li key={model.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onPick(model);
                            dialog.current?.close();
                          }}
                          aria-current={model.id === current ? 'true' : undefined}
                          className={cx(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                            model.id === current && 'bg-foreground/[0.06]',
                          )}
                        >
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate font-mono text-[13px] font-medium">{model.id}</span>
                            <span className="truncate text-xs text-muted">{model.name}</span>
                          </span>
                          <span className="hidden shrink-0 gap-1 sm:flex">
                            {model.vision ? <Badge>vision</Badge> : null}
                            {model.reasoning ? <Badge>reasoning</Badge> : null}
                          </span>
                          <span className="w-36 shrink-0 text-right text-[11px] text-muted tabular-nums">
                            {chatPrice(model) ?? ''}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
