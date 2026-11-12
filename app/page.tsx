import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { REPO_URL, SiteFooter } from '@/components/site';
import { buttonClass } from '@/components/ui';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      {children}
    </svg>
  );
}

const PAGES: { href: string; title: string; body: ReactNode; icon: ReactNode }[] = [
  {
    href: '/playground',
    title: 'Playground',
    body: 'Browse the catalog by category or search it, then run any model. The form is built from the model’s own inputs.',
    icon: (
      <Icon>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </Icon>
    ),
  },
  {
    href: '/image',
    title: 'Image',
    body: 'Generate, edit with a prompt, upscale and remove backgrounds. Send any result on to the next tool.',
    icon: (
      <Icon>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
        <circle cx="9" cy="10" r="1.75" />
        <path d="m4 17 5-4.5 4 3.5 2.5-2 4.5 3.5" strokeLinejoin="round" />
      </Icon>
    ),
  },
  {
    href: '/video',
    title: 'Video',
    body: 'Text to video and image to video with Seedance, Kling, Veo and more, with each stage of the task shown.',
    icon: (
      <Icon>
        <rect x="3.5" y="5.5" width="12.5" height="13" rx="2.5" />
        <path d="m16 10 4.5-2.5v9L16 14" strokeLinejoin="round" />
      </Icon>
    ),
  },
  {
    href: '/audio',
    title: 'Audio',
    body: 'Speech in the voice you pick, music from a description, and transcripts of your audio files.',
    icon: (
      <Icon>
        <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: '/chat',
    title: 'Chat',
    body: (
      <>
        Every chat model on the Wiro LLM gateway, streamed with the AI SDK and{' '}
        <code className="font-mono text-[0.9em]">@wiro-ai/wiro-llm</code>, with the cost of each reply.
      </>
    ),
    icon: (
      <Icon>
        <path
          d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z"
          strokeLinejoin="round"
        />
      </Icon>
    ),
  },
  {
    href: '/history',
    title: 'History',
    body: 'Your recent runs with their outputs and costs, kept in this browser. Runs still going update on their own.',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
      </Icon>
    ),
  },
];

/** Made with this app; the prompts are the ones shown. */
const EXAMPLES = [
  { src: '/examples/paper-boat.webp', model: 'pruna/p-image', prompt: 'A small paper boat on a calm lake at sunrise' },
  {
    src: '/examples/watercolor.webp',
    model: 'google/nano-banana-2',
    prompt: 'Turn this photo into a soft watercolor painting',
  },
  {
    src: '/examples/reading-corner.webp',
    model: 'openai/gpt-image-2',
    prompt: 'A cozy reading corner on a rainy afternoon',
  },
  { src: '/examples/lighthouse.webp', model: 'pruna/p-image', prompt: 'A lighthouse on a rocky coast at dusk' },
];

const ROUTES = [
  { path: 'app/api/models', body: 'Lists a category of the Wiro AI catalog (Tool/List).' },
  { path: 'app/api/models/[owner]/[project]', body: 'Reads one model’s inputs and price list (Tool/Detail).' },
  {
    path: 'app/api/runs',
    body: 'Checks the form against the model’s inputs, prices the run and starts it (POST /Run).',
  },
  { path: 'app/api/tasks/[token]', body: 'Reads the task’s stage, outputs and cost (Task/Detail).' },
  { path: 'app/api/uploads', body: 'Stores a file from the browser for a run (File/Upload).' },
  { path: 'app/api/chat', body: 'Streams a reply from the Wiro LLM gateway with streamText.' },
];

const SNIPPET = `// app/api/runs/route.ts, shortened
const model = await getModel('pruna/p-image');        // Tool/Detail
const built = buildParams(model.params, values);      // checked against the schema
const price = quote(model.pricing, built.params);     // as Wiro bills it
const { token } = await runModel(model.id, built.params); // POST /Run

// The browser then polls /api/tasks/{token} for the stage and the outputs.`;

export default function Home() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-12 sm:px-6 sm:py-20">
        <section className="grid items-center gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="flex max-w-3xl flex-col gap-6">
            <p className="text-sm font-medium text-muted">Next.js starter for Wiro AI</p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Images, video, audio and chat in one Next.js app
            </h1>
            <p className="max-w-2xl text-lg text-pretty text-muted">
              Run any of the 1,000+ models in the Wiro AI catalog from a form built from the model’s own inputs, and see
              the price before each run. Every call goes through a route handler, so your API key stays on the server.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/playground" className={buttonClass('primary', 'h-11 px-5')}>
                Open the Playground
              </Link>
              <a href={REPO_URL} className={buttonClass('secondary', 'h-11 px-5')}>
                View the code
              </a>
            </div>
          </div>
          <ul className="hidden grid-cols-2 gap-3 sm:grid" aria-label="Made with this app">
            {EXAMPLES.map((example) => (
              <li
                key={example.src}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-xs"
              >
                <Image
                  src={example.src}
                  alt={example.prompt}
                  width={640}
                  height={640}
                  sizes="(min-width: 1024px) 220px, 40vw"
                  className="aspect-square w-full object-cover"
                />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2 font-mono text-[11px] text-white">
                  {example.model}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Pages" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAGES.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-xs transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-foreground/5">{page.icon}</span>
              <span className="flex flex-col gap-2">
                <span className="flex items-center gap-1 text-lg font-semibold tracking-tight">
                  {page.title}
                  <span aria-hidden="true" className="text-muted transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
                <span className="text-sm leading-relaxed text-pretty text-muted">{page.body}</span>
              </span>
            </Link>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
              <p className="text-pretty text-muted">
                The browser only talks to this app. Route handlers call Wiro AI with the key from{' '}
                <code className="font-mono text-[0.9em]">WIRO_API_KEY</code>.
              </p>
            </div>
            <ul className="flex flex-col gap-4">
              {ROUTES.map((route) => (
                <li key={route.path} className="flex flex-col gap-1">
                  <code className="font-mono text-sm">{route.path}</code>
                  <span className="text-sm text-muted">{route.body}</span>
                </li>
              ))}
            </ul>
          </div>
          <figure className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
            <figcaption className="border-b border-border px-4 py-2.5 font-mono text-xs text-muted">
              Starting a run
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
