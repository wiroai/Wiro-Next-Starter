'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RunPanel } from '@/components/run-panel';

/** One model of the catalog with the form built from its inputs. */
export function PlaygroundModel() {
  const { owner, project } = useParams<{ owner: string; project: string }>();
  const id = `${decodeURIComponent(owner)}/${decodeURIComponent(project)}`;
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/playground" className="underline-offset-2 hover:text-foreground hover:underline">
          Playground
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="font-mono text-foreground">{id}</span>
      </nav>
      <RunPanel key={id} modelId={id} source="Playground" />
    </div>
  );
}
