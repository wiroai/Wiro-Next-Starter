import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MediaStudio } from '@/components/media-studio';
import { PageIntro, SiteFooter } from '@/components/site';
import { VideoStudio } from './video-studio';

export const metadata: Metadata = {
  title: 'Text to video',
  description: 'Generate video with Seedance, Kling and Veo on Wiro AI, with live progress.',
};

export default function VideoPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <PageIntro title="Text to video">
          Describe a scene, or start from an image. Video takes longer than images, so the page shows each stage of the
          task while it runs.
        </PageIntro>
        <Suspense fallback={<MediaStudio kind="video" />}>
          <VideoStudio />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
