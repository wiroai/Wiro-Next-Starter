import type { Metadata } from 'next';
import { ToolPage } from '@/components/tool-page';

export const metadata: Metadata = {
  title: 'Audio',
  description: 'Text to speech with a choice of voices, music from a prompt and transcription with Wiro AI models.',
};

export default function AudioPage() {
  return (
    <ToolPage page="audio" title="Audio">
      Turn text into speech in the voice you pick, make music from a description, or transcribe an audio file.
    </ToolPage>
  );
}
