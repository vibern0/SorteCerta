export function parseAmount(input: string, decimals: number): bigint {
  if (!Number.isSafeInteger(decimals) || decimals < 0) {
    throw new Error("Decimals must be a non-negative safe integer.");
  }

  const value = input.trim();
  const parts = value.split(".");
  if (parts.length > 2 || !validWholeAmount(parts[0])) {
    throw new Error("Enter a valid amount.");
  }

  const fraction = parts[1] ?? "";
  if (!digitsOnly(fraction)) throw new Error("Enter a valid amount.");
  if (fraction.length > decimals) {
    throw new Error(
      `Enter an amount with at most ${decimals} decimal places.`,
    );
  }

  const whole = parts[0].replaceAll(",", "");
  const scale = 10n ** BigInt(decimals);
  const fractional =
    fraction.length === 0 ? 0n : BigInt(fraction.padEnd(decimals, "0"));
  return BigInt(whole) * scale + fractional;
}

function validWholeAmount(value: string): boolean {
  const groups = value.split(",");
  if (groups.length === 1) return digitsOnly(groups[0]) && groups[0].length > 0;
  if (groups[0].length < 1 || groups[0].length > 3 || !digitsOnly(groups[0])) return false;
  return groups.slice(1).every((group) => group.length === 3 && digitsOnly(group));
}

function digitsOnly(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 48 || code > 57) return false;
  }
  return true;
}
