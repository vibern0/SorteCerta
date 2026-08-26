"use client";

export function LoadingAmount() {
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-end"
      aria-label="Loading balance"
      role="status"
    >
      <span className="h-3.5 w-3.5 rounded-full border-2 border-text/20 border-t-brand animate-spin" />
      <span className="sr-only">Loading balance</span>
    </span>
  );
}
