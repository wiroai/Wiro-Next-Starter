import { Suspense, type ReactNode } from 'react';
import type { ToolPage as Page } from '@/lib/catalog/tools';
import { PageIntro, SiteFooter } from './site';
import { ToolTabs } from './tool-tabs';
import { Spinner } from './ui';

/** The frame of the Image, Video and Audio pages: intro, tool tabs and the run panel. */
export function ToolPage({ page, title, children }: { page: Page; title: string; children: ReactNode }) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <PageIntro title={title}>{children}</PageIntro>
        <Suspense
          fallback={
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Loading…
            </p>
          }
        >
          <ToolTabs page={page} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
