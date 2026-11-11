// Checks the arriving data. Each returns null instead of throwing,
// so one bad field costs that field, not the whole message.

export function asObject(value: unknown): Record<string, unknown> | null {
  // In JavaScript, arrays and null both technically count as typeof 'object'. This filters them out.
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  // Type is asserted so Typescript knows fields can be accessed.
  return value as Record<string, unknown>;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
