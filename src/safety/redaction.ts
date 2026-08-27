// The one shared list of words that mark a field as sensitive, used here,
// by the agent loop's logging, and by the recorder when deciding whether
// a typed value is allowed to end up as a literal in a saved artifact.
export const SENSITIVE_KEYS = [
  "password",
  "pin",
  "ssn",
  "token",
  "apikey",
  "secret",
  "creditcard",
];

// Goes through an object and hides the value of any field
// whose name looks sensitive, like "password" or "token".
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      const isSensitive = SENSITIVE_KEYS.some((k) =>
        key.toLowerCase().includes(k),
      );
      result[key] = isSensitive ? "[REDACTED]" : redact(val);
    }

    return result;
  }

  return value;
}
