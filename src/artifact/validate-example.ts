import fs from "node:fs";
import { CapabilityArtifactSchema } from "./schema.js";

const raw = fs.readFileSync("artifacts/lookup-member-balance.json", "utf8");
const data = JSON.parse(raw);

const result = CapabilityArtifactSchema.safeParse(data);
if (result.success) {
  console.log("Valid artifact:", result.data.name, result.data.version);
} else {
  console.log("Invalid artifact:");
  console.log(result.error.format());
}
