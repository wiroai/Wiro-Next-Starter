import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { SiteHeader } from '@/components/site';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

/** The public URL on Vercel or Railway, so link previews get absolute image URLs. */
function siteUrl(): URL {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.RAILWAY_PUBLIC_DOMAIN;
  return new URL(host ? `https://${host}` : `http://localhost:${process.env.PORT ?? 3000}`);
}

const description =
  'Generate images and video and chat with LLMs on Wiro AI, from a Next.js app that keeps your API key on the server.';

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: 'Wiro AI Next.js Starter', template: '%s · Wiro AI Next.js Starter' },
  description,
  openGraph: { title: 'Wiro AI Next.js Starter', description, type: 'website' },
  twitter: { card: 'summary_large_image', title: 'Wiro AI Next.js Starter', description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f8f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0c' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
