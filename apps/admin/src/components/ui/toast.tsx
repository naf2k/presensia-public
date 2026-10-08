"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./icon";

export interface ToastItem {
  id: number;
  tone: "success" | "error";
  message: string;
}

let items: ToastItem[] = [];
let seq = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export const toast = {
  success(message: string) {
    const id = seq++;
    items = [...items, { id, tone: "success", message }];
    emit();
    window.setTimeout(() => {
      items = items.filter((t) => t.id !== id);
      emit();
    }, 3600);
  },
  error(message: string) {
    const id = seq++;
    items = [...items, { id, tone: "error", message }];
    emit();
    window.setTimeout(() => {
      items = items.filter((t) => t.id !== id);
      emit();
    }, 4200);
  },
};

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function Toaster() {
  const current = useSyncExternalStore(
    subscribe,
    () => items,
    () => [],
  );
  return (
    <div className="toast-stack" aria-live="polite">
      {current.map((t) => (
        <div
          key={t.id}
          className={t.tone === "success" ? "toast toast-success" : "toast toast-error"}
        >
          <Icon name={t.tone === "success" ? "cek" : "peringatan"} />
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
