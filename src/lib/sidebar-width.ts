import { useSyncExternalStore } from "react";
import { clampSidebarWidth, sidebarWidthKey, sidebarWidths } from "@/lib/helpers";

const listeners = new Set<() => void>();
let current: number | null = null;

export function useSidebarWidth() {
  return useSyncExternalStore(subscribe, read, () => sidebarWidths.initial);
}

export function setSidebarWidth(width: number, save: boolean) {
  current = clampSidebarWidth(width);
  document.documentElement.style.setProperty("--sidebar-width", `${current}px`);
  if (save) persist(current);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  }
}

function read() {
  current ??= stored() ?? sidebarWidths.initial;
  return current;
}

function stored() {
  try {
    const width = Number(localStorage.getItem(sidebarWidthKey));
    return width >= sidebarWidths.min && width <= sidebarWidths.max ? width : null;
  } catch {
    return null;
  }
}

function persist(width: number) {
  try {
    localStorage.setItem(sidebarWidthKey, String(width));
    return true;
  } catch {
    return false;
  }
}
