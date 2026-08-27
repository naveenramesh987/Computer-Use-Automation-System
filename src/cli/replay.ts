import "dotenv/config";
import fs from "node:fs";
import { nanoid } from "nanoid";
import { CapabilityArtifactSchema } from "../artifact/schema.js";
import { replay } from "../replay/executor.js";
import { readArg } from "./args.js";

const artifactPath = readArg("artifact");
if (!artifactPath) {
  console.error(
    'Usage: npm run replay -- --artifact <path> --params \'{"key":"value"}\'',
  );
  process.exit(1);
}

const raw = fs.readFileSync(artifactPath, "utf8");
const artifact = CapabilityArtifactSchema.parse(JSON.parse(raw));
const paramsJson = readArg("params") ?? "{}";
const params = JSON.parse(paramsJson);
const runId = `replay-${nanoid(8)}`;
const allowIrreversible = readArg("allowIrreversible") === "true";

console.log(`Run ${runId}`);

const result = await replay(artifact, params, runId, { allowIrreversible });

console.log(JSON.stringify(result, null, 2));

if (result.status === "failure" || result.status === "escalated") {
    process.exit(1);
}