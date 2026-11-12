'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from './ui';

export const NAV_LINKS = [
  { href: '/playground', label: 'Playground' },
  { href: '/image', label: 'Image' },
  { href: '/video', label: 'Video' },
  { href: '/audio', label: 'Audio' },
  { href: '/chat', label: 'Chat' },
  { href: '/history', label: 'History' },
];

/** The links of the header; the current page is marked once the path is known. */
export function NavLinks({ className }: { className?: string }) {
  return <NavList className={className} pathname={usePathname()} />;
}

export function NavList({ className, pathname }: { className?: string; pathname: string | null }) {
  return (
    <nav aria-label="Main" className={className}>
      <ul className="flex items-center gap-1">
        {NAV_LINKS.map((link) => {
          const active = pathname !== null && (pathname === link.href || pathname.startsWith(`${link.href}/`));
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'block rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  active ? 'bg-foreground/[0.07] font-medium text-foreground' : 'text-muted hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
