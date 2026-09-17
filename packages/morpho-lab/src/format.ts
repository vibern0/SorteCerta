import type { Address, Hex } from "viem";

const WAD_DECIMALS = 18;

export function formatToken(
  value: bigint | undefined,
  decimals = 6,
  fractionDigits = 2
): string {
  if (value === undefined) return "Unavailable";

  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = absolute / base;
  const fraction = absolute % base;

  if (fractionDigits === 0 || decimals === 0) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  const visibleDigits = Math.min(decimals, fractionDigits);
  const divisor = 10n ** BigInt(decimals - visibleDigits);
  const visibleFraction = (fraction / divisor)
    .toString()
    .padStart(visibleDigits, "0");

  return `${negative ? "-" : ""}${whole.toString()}.${visibleFraction}`;
}

export function formatPercent(value: bigint | undefined, fractionDigits = 2): string {
  if (value === undefined) return "Unavailable";

  const scale = 10n ** BigInt(fractionDigits);
  const rounded = (value * 100n * scale + 10n ** BigInt(WAD_DECIMALS) / 2n) /
    10n ** BigInt(WAD_DECIMALS);
  const whole = rounded / scale;
  const fraction = (rounded % scale).toString().padStart(fractionDigits, "0");

  return fractionDigits === 0 ? `${whole.toString()}%` : `${whole.toString()}.${fraction}%`;
}

export function formatTimestamp(value: bigint | number | undefined): string {
  if (value === undefined || value === 0n || value === 0) return "Unavailable";
  const date = new Date(Number(value) * 1_000);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

export function formatAddress(value: Address | Hex | undefined): string {
  if (value === undefined) return "Unavailable";
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export function blockscoutAddressUrl(address: Address): string {
  return `https://sepolia.blockscout.com/address/${address}`;
}

export function blockscoutBlockUrl(blockNumber: bigint): string {
  return `https://sepolia.blockscout.com/block/${blockNumber.toString()}`;
}
