/** Format USDC (6 decimals) to a human string. */
export function formatUSDC(amount: bigint | undefined, maxDecimals = 2): string {
  if (amount === undefined) return "—";
  const whole = amount / 1_000_000n;
  const frac = amount % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0").slice(0, maxDecimals);
  return `${whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fracStr}`;
}

/** Parse a USDC string ("10.5") into 6-decimal bigint. */
export function parseUSDC(input: string): bigint {
  const cleaned = input.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,6})?$/.test(cleaned)) {
    throw new Error("Invalid USDC amount");
  }
  const [whole, frac = ""] = cleaned.split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(fracPadded);
}

/** Seconds-remaining → "2d 4h 13m 02s". */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s.toString().padStart(2, "0")}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/** Truncate an address: 0x1234…abcd */
export function shortAddress(addr: string | undefined): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
