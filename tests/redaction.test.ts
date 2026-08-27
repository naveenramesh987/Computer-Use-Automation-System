import { describe, it, expect } from "vitest";
import { redact } from "../src/safety/redaction.js";

describe("redact", () => {
  it("hides a top-level field whose key looks sensitive", () => {
    const result = redact({ username: "jsmith", password: "demo1234" });
    expect(result).toEqual({ username: "jsmith", password: "[REDACTED]" });
  });

  it("leaves fields with non-sensitive names untouched", () => {
    const result = redact({ memberId: "12345", balance: "$4231.55" });
    expect(result).toEqual({ memberId: "12345", balance: "$4231.55" });
  });

  it("redacts sensitive fields inside nested objects", () => {
    const result = redact({
      step: 2,
      input: { name: "Password", token: "abc123" },
    });
    expect(result).toEqual({
      step: 2,
      input: { name: "Password", token: "[REDACTED]" },
    });
  });

  it("redacts sensitive fields inside arrays of objects", () => {
    const result = redact([{ apiKey: "sk-test" }, { memberId: "12345" }]);
    expect(result).toEqual([{ apiKey: "[REDACTED]" }, { memberId: "12345" }]);
  });

  it("matches sensitive key names case-insensitively", () => {
    const result = redact({ PASSWORD: "demo1234", SSN: "000-00-0000" });
    expect(result).toEqual({ PASSWORD: "[REDACTED]", SSN: "[REDACTED]" });
  });

  it("does not touch a plain string or number with no field name attached", () => {
    expect(redact("password")).toBe("password");
    expect(redact(42)).toBe(42);
  });
});
