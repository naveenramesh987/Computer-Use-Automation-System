import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { CapabilityArtifactSchema, StepSchema } from "../src/artifact/schema.js";

const minimalArtifact = {
  id: "test-v1",
  name: "test",
  version: "1.0.0",
  target: { app: "mock-bank-backoffice", baseUrl: "http://localhost:4000" },
  inputs: [],
  outputs: [],
  steps: [{ action: "navigate", url: "http://localhost:4000" }],
  outcomeRules: [],
  successCheckpoint: { kind: "urlContains", value: "/members" },
};

describe("CapabilityArtifactSchema", () => {
  it("accepts a minimal valid artifact", () => {
    expect(() => CapabilityArtifactSchema.parse(minimalArtifact)).not.toThrow();
  });

  it("rejects an artifact missing a required field", () => {
    const { successCheckpoint, ...broken } = minimalArtifact;
    expect(() => CapabilityArtifactSchema.parse(broken)).toThrow();
  });

  it("rejects a step with an unknown action", () => {
    const broken = { ...minimalArtifact, steps: [{ action: "teleport", url: "x" }] };
    expect(() => CapabilityArtifactSchema.parse(broken)).toThrow();
  });

  it("rejects a role outside the known set", () => {
    const broken = {
      ...minimalArtifact,
      steps: [
        {
          action: "click",
          target: { role: "checkbox", name: "Whatever", reason: "test" },
          risk: "safe",
        },
      ],
    };
    expect(() => CapabilityArtifactSchema.parse(broken)).toThrow();
  });
});

describe("StepSchema fill value", () => {
  const target = { role: "textbox", name: "Username", reason: "test" };

  it("accepts a literal string value", () => {
    expect(() =>
      StepSchema.parse({ action: "fill", target, value: "jsmith" }),
    ).not.toThrow();
  });

  it("accepts a {paramRef} value", () => {
    expect(() =>
      StepSchema.parse({ action: "fill", target, value: { paramRef: "memberId" } }),
    ).not.toThrow();
  });

  it("accepts a {secretRef} value", () => {
    expect(() =>
      StepSchema.parse({
        action: "fill",
        target,
        value: { secretRef: "MOCK_APP_PASSWORD" },
      }),
    ).not.toThrow();
  });

  it("rejects a value that's neither a string nor a known ref shape", () => {
    expect(() =>
      StepSchema.parse({ action: "fill", target, value: { somethingElse: "x" } }),
    ).toThrow();
  });
});

describe("real saved artifacts", () => {
  const artifactsDir = path.join(process.cwd(), "artifacts");
  const files = fs
    .readdirSync(artifactsDir)
    .filter((f) => f.endsWith(".json") && !f.includes("outcome-rules"));

  it.each(files)("%s validates against CapabilityArtifactSchema", (file) => {
    const raw = fs.readFileSync(path.join(artifactsDir, file), "utf8");
    expect(() => CapabilityArtifactSchema.parse(JSON.parse(raw))).not.toThrow();
  });
});
