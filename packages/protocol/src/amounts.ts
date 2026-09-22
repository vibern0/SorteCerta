export function parseAmount(input: string, decimals: number): bigint {
  if (!Number.isSafeInteger(decimals) || decimals < 0) {
    throw new Error("Decimals must be a non-negative safe integer.");
  }

  const value = input.trim();
  const match = /^(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d*))?$/.exec(value);
  if (!match) throw new Error("Enter a valid amount.");

  const fraction = match[2] ?? "";
  if (fraction.length > decimals) {
    throw new Error(
      `Enter an amount with at most ${decimals} decimal places.`,
    );
  }

  const whole = match[1].replaceAll(",", "");
  const scale = 10n ** BigInt(decimals);
  const fractional =
    fraction.length === 0 ? 0n : BigInt(fraction.padEnd(decimals, "0"));
  return BigInt(whole) * scale + fractional;
}
