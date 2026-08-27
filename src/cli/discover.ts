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
import { OutcomeRuleSchema } from "../artifact/schema.js";
import { z } from "zod";
import { readArg } from "./args.js";

const goal = readArg("goal");
const target =
  readArg("target") ?? process.env.MOCK_APP_BASE_URL ?? "http://localhost:4000";
const capabilityName = readArg("name");
const inputs = JSON.parse(readArg("inputs") ?? "{}");
// Maps an env var name to the value used during this run, e.g.
// {"MOCK_APP_PASSWORD":"demo1234"} — lets the recorder recognize that
// value and save a {secretRef} instead of the literal.
const secrets = JSON.parse(readArg("secrets") ?? "{}");
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
  // Accepts either a plain array of outcome rules, or a full artifact
  // whose outcomeRules get reused — whichever already exists to point at.
  const outcomeRules = outcomeRulesFrom
    ? (() => {
        const parsed = JSON.parse(fs.readFileSync(outcomeRulesFrom, "utf8"));
        return Array.isArray(parsed)
          ? z.array(OutcomeRuleSchema).parse(parsed)
          : OutcomeRuleSchema.array().parse(parsed.outcomeRules);
      })()
    : [];

  const artifact = recordArtifact({
    name: capabilityName,
    targetApp: "mock-bank-backoffice",
    baseUrl: target,
    trajectory: result.trajectory,
    inputs,
    outputs: result.outputs,
    outcomeRules,
    secrets,
  });

  const artifactPath = path.join(
    "artifacts",
    `${capabilityName}.discovered.json`,
  );
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact saved to ${artifactPath}`);
}
