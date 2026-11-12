import type { Metadata } from 'next';
import { MediaStudio } from '@/components/media-studio';
import { PageIntro, SiteFooter } from '@/components/site';

export const metadata: Metadata = {
  title: 'Text to image',
  description: 'Generate images with P-Image, GPT Image 2, Nano Banana 2 and Seedream 4.5 on Wiro AI.',
};

export default function ImagePage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <PageIntro title="Text to image">
          Write a prompt, pick a model and a shape. The image arrives in a few seconds.
        </PageIntro>
        <MediaStudio kind="image" />
      </main>
      <SiteFooter />
    </>
  );
}
