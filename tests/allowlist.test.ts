import { describe, it, expect } from "vitest";
import { checkPolicy } from "../src/safety/allowlist.js";

describe("checkPolicy", () => {
  it("allows navigating to the allowed domain", () => {
    const result = checkPolicy({ kind: "navigate", url: "http://localhost:4000/members" });
    expect(result.allowed).toBe(true);
  });

  it("blocks navigating to a domain that isn't allowlisted", () => {
    const result = checkPolicy({ kind: "navigate", url: "http://example.com/" });
    expect(result.allowed).toBe(false);
  });

  it("allows a safe click that isn't on the irreversible list", () => {
    const result = checkPolicy({ kind: "click", role: "button", name: "Search" });
    expect(result.allowed).toBe(true);
  });

  it("blocks the irreversible button by default", () => {
    const result = checkPolicy({ kind: "click", role: "button", name: "Open Sub-Account" });
    expect(result.allowed).toBe(false);
  });

  it("allows the irreversible button when allowIrreversible is true", () => {
    const result = checkPolicy(
      { kind: "click", role: "button", name: "Open Sub-Account" },
      true,
    );
    expect(result.allowed).toBe(true);
  });

  it("does not block a link with the same text as the irreversible button", () => {
    // The mock app has both a *link* (navigates to the form) and a
    // *button* (submits it) named "Open Sub-Account" — only the button
    // is irreversible, since role+name together identify the target,
    // not name alone.
    const result = checkPolicy({ kind: "click", role: "link", name: "Open Sub-Account" });
    expect(result.allowed).toBe(true);
  });
});
