import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  action?: ToastAction;
}

function createToasts() {
  const { subscribe, update } = writable<Toast[]>([]);
  let nextId = 1;

  function dismiss(id: number): void {
    update((list) => list.filter((t) => t.id !== id));
  }

  function show(message: string, kind: ToastKind = 'info', durationMs = 3500, action?: ToastAction): number {
    const id = nextId++;
    update((list) => [...list, { id, message, kind, action }]);
    if (browser && durationMs > 0) window.setTimeout(() => dismiss(id), durationMs);
    return id;
  }

  return { subscribe, show, dismiss };
}

export const toasts = createToasts();
