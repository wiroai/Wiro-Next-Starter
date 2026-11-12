import type { Metadata } from 'next';
import { Chat } from '@/components/chat';

export const metadata: Metadata = {
  title: 'Chat',
  description: 'Chat with GPT, Gemini, DeepSeek and Claude models on the Wiro LLM gateway with the AI SDK.',
};

export default function ChatPage() {
  return (
    <main className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <Chat />
    </main>
  );
}
