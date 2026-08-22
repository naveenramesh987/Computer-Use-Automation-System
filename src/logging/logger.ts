import fs from "node:fs";
import path from "node:path";
import { redact } from "../safety/redaction.js";

export type RunLogger = {
  log: (event: Record<string, unknown>) => void;
  screenshotPath: (name: string) => string;
};

// Sets up logging for one run. Everything is saved in its own folder
// under evidence/, and sensitive fields are hidden before anything
// gets written to disk.
export function createRunLogger(runId: string): RunLogger {
  const dir = path.join("evidence", runId);
  fs.mkdirSync(dir, { recursive: true });
  const logFile = path.join(dir, "log.jsonl");

  function log(event: Record<string, unknown>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      ...(redact(event) as object),
    };
    fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
  }

  function screenshotPath(name: string): string {
    return path.join(dir, `${name}.png`);
  }

  return { log, screenshotPath };
}
