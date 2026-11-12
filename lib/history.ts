'use client';

import { useSyncExternalStore } from 'react';
import type { TaskOutput, TaskView } from './tasks';

/**
 * Recent runs, kept in this browser only (localStorage). Nothing here is sent
 * anywhere; clearing site data removes it.
 */

export type HistoryStatus = 'running' | 'done' | 'failed' | 'cancelled';

export type HistoryEntry = {
  /** The task token. */
  id: string;
  model: string;
  modelTitle: string;
  /** The tool or page the run came from, such as "Image · Edit". */
  source: string;
  prompt?: string;
  status: HistoryStatus;
  outputs: TaskOutput[];
  text?: string | null;
  cost?: number | null;
  seconds?: number | null;
  error?: string | null;
  createdAt: number;
  finishedAt?: number;
};

const KEY = 'wiro-next-starter:history:v1';
const MAX_ENTRIES = 100;
const EVENT = 'wiro-history-change';
const EMPTY: HistoryEntry[] = [];

let snapshot: HistoryEntry[] | null = null;

function read(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? (parsed as HistoryEntry[]).filter((entry) => entry && typeof entry.id === 'string')
      : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]) {
  snapshot = entries.slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Storage is full or blocked (private windows): keep the list for this page only.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      snapshot = null;
      onChange();
    }
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot(): HistoryEntry[] {
  if (snapshot === null) snapshot = read();
  return snapshot;
}

export function useHistory(): HistoryEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

/** Adds a run, or updates it when it is already there. */
export function saveEntry(entry: HistoryEntry) {
  const entries = getSnapshot().filter((item) => item.id !== entry.id);
  write([entry, ...entries]);
}

export function updateEntry(id: string, change: Partial<HistoryEntry>) {
  const entries = getSnapshot();
  if (!entries.some((item) => item.id === id)) return;
  write(entries.map((item) => (item.id === id ? { ...item, ...change } : item)));
}

export function removeEntry(id: string) {
  write(getSnapshot().filter((item) => item.id !== id));
}

export function clearHistory() {
  write([]);
}

/** The history fields that follow a task's state. */
export function entryFromTask(task: TaskView): Partial<HistoryEntry> {
  const status: HistoryStatus = !task.done
    ? 'running'
    : task.stage === 'done'
      ? 'done'
      : task.stage === 'cancelled'
        ? 'cancelled'
        : 'failed';
  return {
    status,
    outputs: task.outputs,
    text: task.text,
    cost: task.cost,
    seconds: task.seconds,
    error: task.error,
    finishedAt: task.done ? Date.now() : undefined,
  };
}
