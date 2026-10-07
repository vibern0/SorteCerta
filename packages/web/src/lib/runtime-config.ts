type RuntimeConfig = Partial<Record<`NEXT_PUBLIC_${string}`, string>>;

declare global {
  interface Window {
    __KETTIGO_CONFIG__?: RuntimeConfig;
  }
}

export function publicConfig(name: keyof RuntimeConfig, fallback?: string): string {
  if (typeof window !== "undefined") {
    return window.__KETTIGO_CONFIG__?.[name] ?? fallback ?? "";
  }

  return fallback ?? "";
}
