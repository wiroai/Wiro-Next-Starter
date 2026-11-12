'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { isFileUrl } from '@/lib/catalog/schema';
import { toolsFor, type ToolPage } from '@/lib/catalog/tools';
import { RunPanel } from './run-panel';
import { cx } from './ui';

const PAGE_LABEL: Record<ToolPage, string> = { image: 'Image', video: 'Video', audio: 'Audio' };
const SLUG = /^[a-z0-9][a-z0-9._-]{0,99}\/[a-z0-9][a-z0-9._-]{0,99}$/i;

/**
 * The tools of a page as tabs. `?tab=` picks the tool, `?model=` the model, and
 * `?image=`, `?video=` or `?audio=` the file it starts from.
 */
export function ToolTabs({ page }: { page: ToolPage }) {
  const params = useSearchParams();
  const tools = toolsFor(page);
  const tool = tools.find((item) => item.tab === params.get('tab')) ?? tools[0];
  const file = tool.input ? (params.get(tool.input) ?? params.get('image') ?? '') : '';
  const requested = params.get('model') ?? '';
  const model = SLUG.test(requested) ? requested : tool.defaultModel;
  const initialFile = isFileUrl(file) ? file : undefined;

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={`${PAGE_LABEL[page]} tools`} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-1 rounded-xl border border-border bg-card p-1 shadow-xs">
          {tools.map((item) => {
            const active = item.id === tool.id;
            return (
              <li key={item.id}>
                <Link
                  href={`/${page}?tab=${item.tab}`}
                  scroll={false}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'block rounded-lg px-3.5 py-2 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    active ? 'bg-accent font-medium text-accent-foreground' : 'text-muted hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="-mt-2 text-sm text-muted">{tool.description}</p>
      <RunPanel
        key={`${tool.id}|${model}|${initialFile ?? ''}`}
        modelId={model}
        tool={tool}
        initialFile={initialFile}
        source={`${PAGE_LABEL[page]} · ${tool.label}`}
      />
    </div>
  );
}
