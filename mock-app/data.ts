import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const membersFile = path.join(here, "data", "members.json");

export type SubAccount = {
  accountNumber: string;
  accountType: string;
  initialDeposit: number;
};

export type Member = {
  id: string;
  name: string;
  status: "active" | "locked";
  savingsBalance: number;
  subAccounts: SubAccount[];
};

// Load the seed data when the server starts, and index it by id in a Map
// so looking up a member by id is instant.
const seed: Omit<Member, "subAccounts">[] = JSON.parse(
  fs.readFileSync(membersFile, "utf8"),
);
const members = new Map<string, Member>();
for (const m of seed) {
  members.set(m.id, { ...m, subAccounts: [] });
}

// Look up one member by exact id. Returns undefined if no such member exists —
// that's the "not found" case, handled by whoever calls this.
export function findMember(id: string): Member | undefined {
  return members.get(id);
}

// Search by id or (partial, case-insensitive) name match, for the search page.
// Empty query returns no results."
export function searchMembers(query: string): Member[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }

  const matches: Member[] = [];
  for (const m of members.values()) {
    if (m.id === q || m.name.toLowerCase().includes(q)) {
      matches.push(m);
    }
  }

  return matches;
}

// Member ids in this mock app are always exactly 5 digits.
// Used to catch "invalid format" (e.g. "abc" or "123") before even checking if it exists.
export function isValidMemberId(id: string): boolean {
  return /^\d{5}$/.test(id);
}

// Creates a new sub-account for a member and appends it to their record.
// Throws an error if the member doesn't exist — callers are expected to have 
// already confirmed the member exists before calling this.
export function openSubAccount(
  memberId: string,
  accountType: string,
  initialDeposit: number,
): SubAccount {
  const member = members.get(memberId);
  if (!member) {
    throw new Error("member not found");
  }

  const number = member.subAccounts.length + 1;
  const account: SubAccount = {
    accountNumber: `${memberId}-${number}`,
    accountType,
    initialDeposit,
  };
  member.subAccounts.push(account);
  return account;
}
