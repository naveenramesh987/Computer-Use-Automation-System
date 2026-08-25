import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { discover, redactTrajectory } from "../agent/loop.js";
import { createRunLogger } from "../logging/logger.js";
import { readArg } from "./args.js";

const goal = readArg("goal");
const target = readArg("target") ?? process.env.MOCK_APP_BASE_URL ?? "http://localhost:4000";

if (!goal) {
  console.error('Usage: npm run discover -- --goal "..." --target <url>');
  process.exit(1);
}

const runId = `discover-${nanoid(8)}`;
const logger = createRunLogger(runId);

console.log(`Starting discovery run ${runId}`);
console.log(`Goal: ${goal}`);
console.log(`Target: ${target}`);

const result = await discover(goal, target, logger);
const safeResult = { ...result, trajectory: redactTrajectory(result.trajectory) };

fs.writeFileSync(
  path.join("evidence", runId, "result.json"),
  JSON.stringify(safeResult, null, 2),
);

console.log(JSON.stringify(safeResult, null, 2));
console.log(`\nEvidence saved to evidence/${runId}/`);

if (result.status !== "finished") {
  process.exit(1);
}
