import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Playground } from '@/components/playground';
import { PageIntro, SiteFooter } from '@/components/site';
import { Spinner } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Playground',
  description: 'Browse the Wiro AI catalog by category and run any model with a form built from its inputs.',
};

export default function PlaygroundPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <PageIntro title="Playground">
          Browse the 1,000+ models in the Wiro AI catalog and run any of them. The form is built from the model&apos;s
          own inputs, and the price shows before you run.
        </PageIntro>
        <Suspense
          fallback={
            <p className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Loading…
            </p>
          }
        >
          <Playground />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
