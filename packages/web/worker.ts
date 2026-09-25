type Env = {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  NEXT_PUBLIC_CHAIN_ID?: string;
  NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS?: string;
  NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS?: string;
  NEXT_PUBLIC_PIMLICO_API_KEY?: string;
  NEXT_PUBLIC_RPC_URL?: string;
  NEXT_PUBLIC_USDC_ADDRESS?: string;
  NEXT_PUBLIC_WEB3AUTH_CLIENT_ID?: string;
};

const PUBLIC_KEYS = [
  "NEXT_PUBLIC_CHAIN_ID",
  "NEXT_PUBLIC_CONFIDENTIAL_PRIZE_POOL_ADDRESS",
  "NEXT_PUBLIC_CONFIDENTIAL_USDC_ADDRESS",
  "NEXT_PUBLIC_PIMLICO_API_KEY",
  "NEXT_PUBLIC_RPC_URL",
  "NEXT_PUBLIC_USDC_ADDRESS",
  "NEXT_PUBLIC_WEB3AUTH_CLIENT_ID",
] as const;

function runtimeConfig(env: Env): Record<string, string> {
  return Object.fromEntries(
    PUBLIC_KEYS.map((key) => [key, env[key] ?? ""]),
  );
}

export default {
  fetch(request: Request, env: Env): Promise<Response> | Response {
    const url = new URL(request.url);

    if (url.pathname === "/config.js") {
      return new Response(
        `window.__SORTE_CERTA_CONFIG__ = ${JSON.stringify(runtimeConfig(env))};\n`,
        {
          headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-store",
          },
        },
      );
    }

    return env.ASSETS.fetch(request);
  },
};
