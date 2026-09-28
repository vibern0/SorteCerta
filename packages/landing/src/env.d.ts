/// <reference types="vite/client" />
/// <reference types="@cloudflare/workers-types" />
/// <reference types="@cloudflare/vitest-plugin/types/cloudflare-test" />

declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ASSETS: { fetch(request: Request): Promise<Response> };
    TURNSTILE_SECRET_KEY: string;
  }
}
