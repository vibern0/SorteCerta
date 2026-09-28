import type { Attribution } from "../../worker/types";

const FIELD_LIMIT = 128;
const QUERY_KEYS = [
  ["utm_source", "source"],
  ["utm_medium", "medium"],
  ["utm_campaign", "campaign"],
  ["ref", "referralCode"],
] as const;

export function captureAttribution(url: URL, referrer: string): Attribution {
  const attribution: Attribution = {};

  for (const [queryKey, attributionKey] of QUERY_KEYS) {
    const value = readAttributionValue(url.searchParams.get(queryKey));
    if (value !== undefined) {
      attribution[attributionKey] = value;
    }
  }

  const referrerHost = readReferrerHost(referrer);
  if (referrerHost !== undefined) {
    attribution.referrerHost = referrerHost;
  }

  return attribution;
}

function readAttributionValue(value: string | null): string | undefined {
  if (value === null) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > FIELD_LIMIT) {
    return undefined;
  }
  return trimmed;
}

function readReferrerHost(referrer: string): string | undefined {
  try {
    return readAttributionValue(new URL(referrer).hostname);
  } catch {
    return undefined;
  }
}
