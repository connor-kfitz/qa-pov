import { useMemo, useSyncExternalStore } from "react";

const storageKey = "qa-pov:nav-open";
const listeners = new Set<() => void>();
let memory = "{}";

export function useOpenNodes() {
  const raw = useSyncExternalStore(subscribe, read, () => "{}");
  return useMemo(() => parse(raw), [raw]);
}

export function setNodeOpen(key: string, open: boolean) {
  memory = JSON.stringify({ ...parse(read()), [key]: open });
  persist(memory);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  }
}

function read() {
  try {
    return localStorage.getItem(storageKey) ?? memory;
  } catch {
    return memory;
  }
}

function persist(value: string) {
  try {
    localStorage.setItem(storageKey, value);
    return true;
  } catch {
    return false;
  }
}

function parse(raw: string): Record<string, boolean> {
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}
