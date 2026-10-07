"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastInput = Omit<Toast, "id">;

const ToastContext = createContext<((toast: ToastInput) => void) | undefined>(undefined);

const toneClass: Record<ToastTone, { accent: string; icon: string; shadow: string }> = {
  success: {
    accent: "bg-success",
    icon: "bg-success text-surface",
    shadow: "shadow-[6px_6px_0_#E4F66A]",
  },
  error: {
    accent: "bg-danger",
    icon: "bg-danger text-surface",
    shadow: "shadow-[6px_6px_0_#FFB69D]",
  },
  info: {
    accent: "bg-brand",
    icon: "bg-brand text-surface",
    shadow: "shadow-[6px_6px_0_#D5C5FF]",
  },
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  const iconClass = "h-4 w-4";

  if (tone === "success") {
    return (
      <svg aria-hidden="true" className={iconClass} fill="none" viewBox="0 0 20 20">
        <path d="m5 10.5 3.1 3.1L15 6.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
      </svg>
    );
  }

  if (tone === "error") {
    return (
      <svg aria-hidden="true" className={iconClass} fill="none" viewBox="0 0 20 20">
        <path d="M6.5 6.5 13.5 13.5M13.5 6.5 6.5 13.5" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className={iconClass} fill="none" viewBox="0 0 20 20">
      <path d="M10 9.2v5.1M10 5.7h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
    </svg>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((toast: ToastInput) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...toast, id }].slice(-3));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 5_000);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const searchParams = new URLSearchParams(window.location.search);
    const previewTone = searchParams.get("toast");
    if (previewTone === "success" || previewTone === "error" || previewTone === "info") {
      notify({
        tone: previewTone,
        title: searchParams.get("toastTitle") ?? "Toast preview",
        description: searchParams.get("toastDescription") ?? "This is how local notifications will appear.",
      });
    }

    function onDevToast(event: Event) {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      if (!detail || typeof detail.title !== "string") return;
      if (detail.tone !== "success" && detail.tone !== "error" && detail.tone !== "info") return;

      notify({
        tone: detail.tone,
        title: detail.title,
        description: typeof detail.description === "string" ? detail.description : undefined,
      });
    }

    window.addEventListener("sortecerta:toast", onDevToast);
    return () => window.removeEventListener("sortecerta:toast", onDevToast);
  }, [notify]);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-8 z-50 mx-auto flex w-full max-w-[480px] flex-col gap-3 px-5">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto relative flex transform-gpu items-start gap-3 overflow-hidden rounded-[18px] border-2 border-text bg-text px-4 py-3 text-surface motion-safe:animate-toast-in",
              toneClass[toast.tone].shadow,
            )}
          >
            <span className={cn("absolute inset-y-0 left-0 w-1.5", toneClass[toast.tone].accent)} />
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-surface/20",
                toneClass[toast.tone].icon,
              )}
            >
              <ToneIcon tone={toast.tone} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold leading-snug text-surface">{toast.title}</p>
              {toast.description && (
                <p className="mt-1 text-xs leading-relaxed text-surface/75">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-surface/70 transition-colors hover:bg-surface/10 hover:text-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-citron"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
              aria-label="Dismiss notification"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20">
                <path d="M6 6 14 14M14 6 6 14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast must be used inside ToastProvider.");
  return notify;
}
