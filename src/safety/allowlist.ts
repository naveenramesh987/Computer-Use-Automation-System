import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const policyFile = path.join(here, "policy.json");

export type AllowlistConfig = {
  allowedDomains: string[];
  irreversibleActions: { role: string; name: string }[];
};

const policy: AllowlistConfig = JSON.parse(fs.readFileSync(policyFile, "utf8"));

export type PolicyAction =
  | { kind: "navigate"; url: string }
  | { kind: "click"; role: string; name: string }
  | { kind: "fill"; role: string; name: string };

export type PolicyResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Checks one action against the allowlist before it's allowed to run.
 * Pass allowIrreversible: true to allow an action on the irreversible
 * list — without it, any matching action gets blocked.
 */
export function checkPolicy(
  action: PolicyAction,
  allowIrreversible = false,
): PolicyResult {
  if (action.kind === "navigate") {
    const host = new URL(action.url).hostname;

    if (!policy.allowedDomains.includes(host)) {
      return { allowed: false, reason: `Domain not allowed: ${host}` };
    }

    return { allowed: true };
  }

  const isIrreversible = policy.irreversibleActions.some(
    (a) => a.role === action.role && a.name === action.name,
  );

  if (isIrreversible && !allowIrreversible) {
    return {
      allowed: false,
      reason: `"${action.name}" (${action.role}) is an irreversible action and requires explicit approval.`,
    };
  }

  return { allowed: true };
}
