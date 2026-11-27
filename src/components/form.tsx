import type { ComponentProps, ReactNode } from "react";
import type { ChoiceProps } from "@/types/dashboard.types";

export const inputClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-subtle focus:border-muted focus:ring-2 focus:ring-hover";

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {hint && <span className="ml-2 font-normal text-muted">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select {...props} className={`${inputClass} appearance-none pr-10 ${className ?? ""}`}>
        {children}
      </select>
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden>
        <path d="m4 6 4 4 4-4" />
      </svg>
    </div>
  );
}

export function Choice({ name, value, title, detail, checked, defaultChecked, onChange }: ChoiceProps) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border p-3 hover:bg-hover has-checked:border-muted has-checked:bg-panel">
      <input type="radio" name={name} value={value} checked={checked} defaultChecked={defaultChecked} onChange={onChange} className="mt-0.5 accent-foreground" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted">{detail}</span>
      </span>
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{message}</p>;
}
