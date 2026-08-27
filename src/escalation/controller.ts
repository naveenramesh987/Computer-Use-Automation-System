import fs from "node:fs";
import path from "node:path";

export type Intervention = {
  runId: string;
  reason: string;
  step: number;
  screenshotPath: string;
  createdAt: string;
  resolvedAt?: string | null;
};

const POLL_INTERVAL_MS = 1000;

function interventionPath(runId: string): string {
  return path.join("evidence", runId, "intervention.json");
}

// Writes a pending intervention to disk and blocks until the operator
// page marks it resolved. The automation process just waits here
// while a human uses the same live browser window.
export async function requestIntervention(
  runId: string,
  reason: string,
  step: number,
  screenshotPath: string,
): Promise<void> {
  const intervention: Intervention = {
    runId,
    reason,
    step,
    screenshotPath,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  fs.writeFileSync(interventionPath(runId), JSON.stringify(intervention));

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const current: Intervention = JSON.parse(
      fs.readFileSync(interventionPath(runId), "utf8"),
    );
    if (current.resolvedAt) {
      return;
    }
  }
}

// Lists every intervention that hasn't been resolved yet, across all runs.
export function listPendingInterventions(): Intervention[] {
  if (!fs.existsSync("evidence")) {
    return [];
  }

  const runIds = fs.readdirSync("evidence");
  const pending: Intervention[] = [];
  for (const runId of runIds) {
    const file = interventionPath(runId);
    if (!fs.existsSync(file)) {
      continue;
    }

    const intervention: Intervention = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!intervention.resolvedAt) {
      pending.push(intervention);
    }
  }

  return pending;
}

// Marks an intervention as resolved, letting the paused automation continue.
export function resolveIntervention(runId: string): void {
  const file = interventionPath(runId);
  const intervention: Intervention = JSON.parse(fs.readFileSync(file, "utf8"));
  intervention.resolvedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(intervention, null, 2));
}
