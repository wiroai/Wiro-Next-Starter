import Link from 'next/link';
import type { ReactNode } from 'react';
import { REPO_URL, SiteFooter } from '@/components/site';
import { buttonClass } from '@/components/ui';

const FEATURES: { href: string; title: string; body: ReactNode; action: string; icon: ReactNode }[] = [
  {
    href: '/image',
    title: 'Text to image',
    body: 'Pick P-Image, GPT Image 2, Nano Banana 2 or Seedream 4.5, write a prompt and choose a shape. The server starts a task and the page polls it until the image is ready.',
    action: 'Make an image',
    icon: (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9" cy="10" r="1.75" stroke="currentColor" strokeWidth="1.5" />
        <path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/video',
    title: 'Text to video',
    body: 'Seedance, Kling and Veo turn a prompt or a start image into a clip. The page shows each stage of the task while it runs, then plays the result.',
    action: 'Make a video',
    icon: (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5.5" width="12.5" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="m16 10 4.5-2.5v9L16 14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: '/chat',
    title: 'Chat',
    body: (
      <>
        Stream answers from GPT, Gemini, DeepSeek and Claude models with the AI SDK and{' '}
        <code className="font-mono text-[0.9em]">@wiro-ai/wiro-llm</code>, and see what each reply cost.
      </>
    ),
    action: 'Start a chat',
    icon: (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

const FILES = [
  {
    path: 'app/api/runs/route.ts',
    body: 'Checks the request against lib/models.ts and starts a task with POST /Run/{owner}/{model}.',
  },
  {
    path: 'app/api/tasks/[token]/route.ts',
    body: 'Reads the task with POST /Task/Detail and returns its stage, output URLs and cost.',
  },
  {
    path: 'app/api/chat/route.ts',
    body: 'Streams a reply from the Wiro LLM gateway with streamText.',
  },
];

const SNIPPET = `import { createWiro } from '@wiro-ai/wiro-llm';
import { convertToModelMessages, streamText } from 'ai';

export async function POST(request: Request) {
  const { messages } = await request.json();
  const wiro = createWiro({ apiKey: process.env.WIRO_API_KEY });

  const result = streamText({
    model: wiro('openai/gpt-5-4-nano'),
    messages: await convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse();
}`;

export default function Home() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-12 sm:px-6 sm:py-20">
        <section className="flex max-w-3xl flex-col gap-6">
          <p className="text-sm font-medium text-muted">Next.js starter for Wiro AI</p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Images, video and chat in one Next.js app
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted">
            Three working pages on the Wiro AI API: text to image, text to video with live progress, and a streaming
            chat on the Wiro LLM gateway. Every call runs in a route handler, so your API key stays on the server.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/image" className={buttonClass('primary', 'h-11 px-5')}>
              Make an image
            </Link>
            <a href={REPO_URL} className={buttonClass('secondary', 'h-11 px-5')}>
              View the code
            </a>
          </div>
        </section>

        <section aria-label="Pages" className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-foreground/5">
                {feature.icon}
              </span>
              <span className="flex flex-col gap-2">
                <span className="text-lg font-semibold tracking-tight">{feature.title}</span>
                <span className="text-sm leading-relaxed text-pretty text-muted">{feature.body}</span>
              </span>
              <span className="mt-auto flex items-center gap-1 text-sm font-medium">
                {feature.action}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </Link>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
              <p className="text-pretty text-muted">
                The browser only talks to this app. Three route handlers call Wiro AI with the key from{' '}
                <code className="font-mono text-[0.9em]">WIRO_API_KEY</code>.
              </p>
            </div>
            <ul className="flex flex-col gap-4">
              {FILES.map((file) => (
                <li key={file.path} className="flex flex-col gap-1">
                  <code className="font-mono text-sm">{file.path}</code>
                  <span className="text-sm text-muted">{file.body}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-pretty text-muted">
              To offer another model, add it to <code className="font-mono text-[0.9em]">lib/models.ts</code>. The{' '}
              <a href="https://wiro.ai/models" className="text-foreground underline underline-offset-2">
                Wiro AI catalog
              </a>{' '}
              has 1,000+ models for images, video, audio and text.
            </p>
          </div>
          <figure className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <figcaption className="border-b border-border px-4 py-2.5 font-mono text-xs text-muted">
              A minimal version of app/api/chat/route.ts
            </figcaption>
            <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
              <code>{SNIPPET}</code>
            </pre>
          </figure>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
