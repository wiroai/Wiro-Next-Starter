import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SiteFooter } from '@/components/site';
import { Spinner } from '@/components/ui';
import { PlaygroundModel } from './playground-model';

export const metadata: Metadata = {
  title: 'Playground',
  description: 'Run a Wiro AI model with a form built from its inputs.',
};

export default function PlaygroundModelPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        <Suspense
          fallback={
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Loading…
            </p>
          }
        >
          <PlaygroundModel />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
