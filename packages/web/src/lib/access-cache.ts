import { getAddress, type Address } from "viem";

const ACCESS_CACHE_KEY = "kettigo.access.v1";

type AccessStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type ApprovedAccessInput = {
  email: string;
  walletAddress: string;
};

type AccessCache = {
  approvedEmail?: string;
  approvedAccess?: {
    email: string;
    walletAddress: Address;
  };
};

export function readCachedApprovedEmail(storage = getAccessStorage()): string | null {
  return readCache(storage).approvedEmail ?? null;
}

export function rememberApprovedEmail(email: string, storage = getAccessStorage()) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;
  writeCache({ ...readCache(storage), approvedEmail: normalizedEmail }, storage);
}

export function hasCachedApprovedAccess(input: ApprovedAccessInput, storage = getAccessStorage()): boolean {
  const normalizedEmail = normalizeEmail(input.email);
  const walletAddress = normalizeAddress(input.walletAddress);
  const approvedAccess = readCache(storage).approvedAccess;
  if (!normalizedEmail || !walletAddress || !approvedAccess) return false;

  return approvedAccess.email === normalizedEmail && approvedAccess.walletAddress === walletAddress;
}

export function rememberApprovedAccess(input: ApprovedAccessInput, storage = getAccessStorage()) {
  const normalizedEmail = normalizeEmail(input.email);
  const walletAddress = normalizeAddress(input.walletAddress);
  if (!normalizedEmail || !walletAddress) return;
  writeCache(
    {
      ...readCache(storage),
      approvedEmail: normalizedEmail,
      approvedAccess: {
        email: normalizedEmail,
        walletAddress,
      },
    },
    storage,
  );
}

function readCache(storage: AccessStorage | null): AccessCache {
  if (!storage) return {};
  try {
    const raw = storage.getItem(ACCESS_CACHE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return {};

    const approvedEmail = typeof parsed.approvedEmail === "string" ? normalizeEmail(parsed.approvedEmail) : null;
    const approvedAccess = isRecord(parsed.approvedAccess)
      ? parseApprovedAccess(parsed.approvedAccess)
      : null;

    return {
      ...(approvedEmail ? { approvedEmail } : {}),
      ...(approvedAccess ? { approvedAccess } : {}),
    };
  } catch {
    return {};
  }
}

function writeCache(cache: AccessCache, storage: AccessStorage | null) {
  if (!storage) return;
  try {
    storage.setItem(ACCESS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // best-effort cache only
  }
}

function parseApprovedAccess(value: Record<string, unknown>): AccessCache["approvedAccess"] | null {
  if (typeof value.email !== "string" || typeof value.walletAddress !== "string") return null;
  const email = normalizeEmail(value.email);
  const walletAddress = normalizeAddress(value.walletAddress);
  if (!email || !walletAddress) return null;
  return { email, walletAddress };
}

function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  return normalized === "" ? null : normalized;
}

function normalizeAddress(address: string): Address | null {
  try {
    return getAddress(address);
  } catch {
    return null;
  }
}

function getAccessStorage(): AccessStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
