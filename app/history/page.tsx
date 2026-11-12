import type { Metadata } from 'next';
import { HistoryView } from '@/components/history-view';
import { PageIntro, SiteFooter } from '@/components/site';

export const metadata: Metadata = {
  title: 'History',
  description: 'Your recent runs in this browser, with their outputs and what each one cost.',
};

export default function HistoryPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <PageIntro title="History">
          Every run you start in this browser, with its output and what it cost. Runs that are still going update here.
        </PageIntro>
        <HistoryView />
      </main>
      <SiteFooter />
    </>
  );
}
