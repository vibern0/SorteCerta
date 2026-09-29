import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render(
        container: HTMLElement,
        options: {
          sitekey: string;
          size: "compact" | "flexible";
          callback(token: string): void;
          "expired-callback"(): void;
          "error-callback"(): void;
        },
      ): string;
      reset(widgetId: string): void;
      remove(widgetId: string): void;
    };
  }
}

type TurnstileWidgetProps = {
  siteKey: string;
  onToken(token: string | null): void;
};

export type TurnstileWidgetHandle = {
  reset(): void;
};

const SCRIPT_ID = "turnstile-api";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

export const TurnstileWidget = forwardRef<TurnstileWidgetHandle, TurnstileWidgetProps>(function TurnstileWidget(
  { siteKey, onToken },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [widgetSize, setWidgetSize] = useState<"compact" | "flexible">(() => getTurnstileSize());

  useImperativeHandle(ref, () => ({
    reset() {
      onToken(null);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));

  useEffect(() => {
    const handleResize = () => {
      const nextSize = getTurnstileSize();
      if (nextSize !== widgetSize) {
        onToken(null);
        setWidgetSize(nextSize);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [onToken, widgetSize]);

  useEffect(() => {
    let cancelled = false;

    if (!siteKey) {
      setFailed(true);
      return undefined;
    }

    setFailed(false);
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile || widgetIdRef.current) {
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          size: widgetSize,
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(null),
          "error-callback": () => onToken(null),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          onToken(null);
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onToken, siteKey, widgetSize]);

  return (
    <div className="turnstile-field" aria-live="polite">
      <div ref={containerRef} />
      {failed ? <p className="verification-error">Verification is unavailable right now.</p> : null}
    </div>
  );
});

function getTurnstileSize(): "compact" | "flexible" {
  return window.innerWidth < 365 ? "compact" : "flexible";
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) {
      document.getElementById(SCRIPT_ID)?.addEventListener("load", () => resolve(), { once: true });
      document
        .getElementById(SCRIPT_ID)
        ?.addEventListener("error", () => reject(new Error("turnstile unavailable")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("turnstile unavailable")), { once: true });
    document.head.appendChild(script);
  });

  return scriptPromise;
}
