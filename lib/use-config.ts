'use client';

import { useEffect, useState } from 'react';

/** The limits this deployment runs with, from /api/config. */
export type AppConfig = { maxRunPrice: number | null; maxUploadMb: number; keySet: boolean };

let pending: Promise<AppConfig | null> | null = null;

function loadConfig(): Promise<AppConfig | null> {
  pending ??= fetch('/api/config', { cache: 'no-store' })
    .then((response) => (response.ok ? (response.json() as Promise<AppConfig>) : null))
    .catch(() => null);
  return pending;
}

export function useConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(null);
  useEffect(() => {
    let active = true;
    void loadConfig().then((value) => {
      if (active) setConfig(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return config;
}
