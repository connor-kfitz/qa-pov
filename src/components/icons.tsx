export function Chevron({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={`size-3.5 shrink-0 text-subtle transition-transform ${className}`} aria-hidden>
      <path d="M6 4l4 4-4 4"/>
    </svg>
  );
}

export function BranchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-4 shrink-0 text-muted" aria-hidden>
      <circle cx="4.5" cy="3.5" r="1.5"/>
      <circle cx="4.5" cy="12.5" r="1.5"/>
      <circle cx="11.5" cy="5.5" r="1.5"/>
      <path d="M4.5 5v6M11.5 7c0 2.5-2 3-7 4"/>
    </svg>
  );
}

export function StackIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" className="size-4 shrink-0 text-muted" aria-hidden>
      <path d="M8 2l6 3-6 3-6-3 6-3z"/>
      <path d="M2 8l6 3 6-3M2 11l6 3 6-3"/>
    </svg>
  );
}
