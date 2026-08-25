// Command-line entry point for a real discovery run: launches Claude to
// figure out a goal by driving the live browser itself (no scripted
// steps), then saves everything it did as evidence.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { discover, redactTrajectory } from "../agent/loop.js";
import { createRunLogger } from "../logging/logger.js";
import { recordArtifact } from "../artifact/recorder.js";
import { CapabilityArtifactSchema } from "../artifact/schema.js";
import { readArg } from "./args.js";

const goal = readArg("goal");
const target =
  readArg("target") ?? process.env.MOCK_APP_BASE_URL ?? "http://localhost:4000";
const capabilityName = readArg("name");
const inputs = JSON.parse(readArg("inputs") ?? "{}");
const outcomeRulesFrom = readArg("outcomeRulesFrom");

if (!goal) {
  console.error(
    'Usage: npm run discover -- --goal "..." --target <url> --name <capability> --inputs \'{"memberId":"12345"}\' --outcomeRulesFrom <path>',
  );
  process.exit(1);
}

const runId = `discover-${nanoid(8)}`;
const logger = createRunLogger(runId);

console.log(`Starting discovery run ${runId}`);
console.log(`Goal: ${goal}`);
console.log(`Target: ${target}`);

const result = await discover(goal, target, logger);
const safeResult = {
  ...result,
  trajectory: redactTrajectory(result.trajectory),
};

fs.writeFileSync(
  path.join("evidence", runId, "result.json"),
  JSON.stringify(safeResult, null, 2),
);

console.log(JSON.stringify(safeResult, null, 2));
console.log(`\nEvidence saved to evidence/${runId}/`);

if (result.status !== "finished") {
  process.exit(1);
}

if (capabilityName) {
  const outcomeRules = outcomeRulesFrom
    ? CapabilityArtifactSchema.parse(
        JSON.parse(fs.readFileSync(outcomeRulesFrom, "utf8")),
      ).outcomeRules
    : [];

  const artifact = recordArtifact({
    name: capabilityName,
    targetApp: "mock-bank-backoffice",
    baseUrl: target,
    trajectory: result.trajectory,
    inputs,
    outputs: result.outputs,
    outcomeRules,
  });

  const artifactPath = path.join(
    "artifacts",
    `${capabilityName}.discovered.json`,
  );
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact saved to ${artifactPath}`);
}
