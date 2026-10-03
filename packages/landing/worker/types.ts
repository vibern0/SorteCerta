export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  referralCode?: string;
  referrerHost?: string;
};

export type WaitlistRequest = {
  email: string;
  attribution?: Attribution;
};

export type WaitlistResponse =
  | { ok: true; status: "joined" | "already_joined" }
  | {
      ok: false;
      code:
        | "invalid_request"
        | "temporarily_unavailable";
      message: string;
    };

export type Env = {
  DB: D1Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
  TURNSTILE_SECRET_KEY?: string;
};
