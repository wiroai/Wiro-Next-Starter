import type { Metadata } from 'next';
import { ToolPage } from '@/components/tool-page';

export const metadata: Metadata = {
  title: 'Video',
  description: 'Generate video from text or from an image with Seedance, Kling, Veo and other Wiro AI models.',
};

export default function VideoPage() {
  return (
    <ToolPage page="video" title="Video">
      Describe a scene, or start from an image. Video takes longer than images, so the page shows each stage of the task
      while it runs.
    </ToolPage>
  );
}
