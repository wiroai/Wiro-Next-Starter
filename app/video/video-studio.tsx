'use client';

import { useSearchParams } from 'next/navigation';
import { MediaStudio } from '@/components/media-studio';

/** The video page, started from an image when it comes from the image page's Animate button. */
export function VideoStudio() {
  const params = useSearchParams();
  const image = params.get('image') ?? '';
  return (
    <MediaStudio
      key={image}
      kind="video"
      initialImageUrl={image.startsWith('https://') ? image : ''}
      initialRatio={params.get('ratio') ?? ''}
    />
  );
}
