"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { sidebarWidths } from "@/lib/helpers";
import { setSidebarWidth, useSidebarWidth } from "@/lib/sidebar-width";

const keyStep = 16;

export function SidebarResizer() {
  const width = useSidebarWidth();

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const handle = event.currentTarget;
    const left = handle.parentElement?.getBoundingClientRect().left ?? 0;
    handle.setPointerCapture(event.pointerId);
    document.body.classList.add("cursor-col-resize", "select-none");

    const move = (moved: globalThis.PointerEvent) => setSidebarWidth(moved.clientX - left, false);
    const stop = (stopped: globalThis.PointerEvent) => {
      setSidebarWidth(stopped.clientX - left, true);
      document.body.classList.remove("cursor-col-resize", "select-none");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    }

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  const resizeWithKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = { ArrowLeft: width - keyStep, ArrowRight: width + keyStep, Home: sidebarWidths.min, End: sidebarWidths.max }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setSidebarWidth(next, true);
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={sidebarWidths.min}
      aria-valuemax={sidebarWidths.max}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize, double-click to reset"
      onPointerDown={startDrag}
      onKeyDown={resizeWithKeys}
      onDoubleClick={() => setSidebarWidth(sidebarWidths.initial, true)}
      className="group absolute inset-y-0 -right-1 z-10 hidden w-2 cursor-col-resize touch-none outline-none md:block"
    >
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors group-hover:bg-sky-500/60 group-focus-visible:bg-sky-500 group-active:bg-sky-500" />
    </div>
  );
}
