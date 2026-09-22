export function tupleValues(
  value: unknown,
  names: readonly string[],
): unknown[] {
  if (Array.isArray(value)) {
    if (value.length !== names.length) {
      throw new Error(`Expected a contract tuple with ${names.length} fields.`);
    }
    return [...value];
  }

  if (value === null || typeof value !== "object") {
    throw new Error("Expected a contract tuple.");
  }

  return names.map((name) => {
    if (!Object.prototype.hasOwnProperty.call(value, name)) {
      throw new Error(`Expected tuple field ${name}.`);
    }
    return Reflect.get(value, name);
  });
}

export function asBigInt(value: unknown, label: string): bigint {
  if (typeof value === "bigint") {
    if (value < 0n) throw new Error(`${label} must be a non-negative integer.`);
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${label} must be a non-negative safe integer.`);
    }
    return BigInt(value);
  }

  if (typeof value === "string" && /^(0|[1-9]\d*)$/.test(value)) {
    return BigInt(value);
  }

  throw new Error(`${label} must be a non-negative integer.`);
}
