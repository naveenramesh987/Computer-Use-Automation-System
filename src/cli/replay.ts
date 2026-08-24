import fs from "node:fs";
import { CapabilityArtifactSchema } from "../artifact/schema.js";
import { replay } from "../replay/executor.js";

// Reads the value that comes right after a flag like --artifact or --params.
function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

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
const result = await replay(artifact, params);

console.log(JSON.stringify(result, null, 2));

if (result.status === "failure" || result.status === "escalated") {
    process.exit(1);
}