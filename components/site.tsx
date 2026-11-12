import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { NavLinks } from './nav-links';

export const REPO_URL = 'https://github.com/wiroai/Wiro-Next-Starter';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Image src="/brand/wiro-icon-black.png" width={22} height={22} alt="" className="dark:hidden" priority />
          <Image
            src="/brand/wiro-icon-white.png"
            width={22}
            height={22}
            alt=""
            className="hidden dark:block"
            priority
          />
          <span className="font-semibold tracking-tight">Wiro AI</span>
          <span className="hidden text-sm text-muted md:inline">Next.js Starter</span>
        </Link>
        <NavLinks />
        <a
          href={REPO_URL}
          className="ml-auto flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label="Source code on GitHub"
        >
          <GitHubIcon />
        </a>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const links = [
    { href: 'https://wiro.ai/docs', label: 'Docs' },
    { href: 'https://wiro.ai/models', label: 'Models' },
    { href: 'https://wiro.ai/panel', label: 'Dashboard' },
    { href: REPO_URL, label: 'GitHub' },
  ];
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Built with Next.js and the{' '}
          <a href="https://wiro.ai" className="text-foreground underline-offset-2 hover:underline">
            Wiro AI
          </a>{' '}
          API.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}

/** Title and intro of a tool page. */
export function PageIntro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
      <p className="max-w-2xl text-pretty text-muted">{children}</p>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49l-.01-1.9c-2.78.62-3.37-1.21-3.37-1.21-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.37 9.37 0 0 1 12 6.98c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9l-.01 2.81c0 .27.18.6.69.49A10.1 10.1 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}
