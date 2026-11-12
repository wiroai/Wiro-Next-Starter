import type { Metadata } from 'next';
import { ToolPage } from '@/components/tool-page';

export const metadata: Metadata = {
  title: 'Image',
  description: 'Generate images, edit them with a prompt, upscale them and remove backgrounds with Wiro AI models.',
};

export default function ImagePage() {
  return (
    <ToolPage page="image" title="Image">
      Generate an image, edit one by describing the change, upscale it or cut out the background. Every tool lists the
      models of its category in the Wiro AI catalog.
    </ToolPage>
  );
}
