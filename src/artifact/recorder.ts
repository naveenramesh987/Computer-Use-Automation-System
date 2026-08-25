import { checkPolicy } from "../safety/allowlist.js";
import type { TrajectoryStep } from "../agent/loop.js";
import type {
  Step,
  TargetRef,
  CapabilityArtifact,
  Checkpoint,
  OutcomeRule,
} from "./schema.js";

// Turns one thing Claude did into a real artifact step. A typed value
// matching a declared input becomes a {paramRef} instead of a literal.
function convertStep(
  step: TrajectoryStep,
  inputs: Record<string, string>,
): Step {
  const role = (target: { role: string }) => target.role as TargetRef["role"];

  if (step.action === "navigate") {
    return { action: "navigate", url: step.url };
  }

  if (step.action === "click") {
    // Reuses checkPolicy so risk matches the same list used at replay time.
    const risk = checkPolicy({
      kind: "click",
      role: step.role,
      name: step.name,
    }).allowed
      ? "safe"
      : "irreversible";

    return {
      action: "click",
      target: { role: role(step), name: step.name, reason: step.reason },
      risk,
    };
  }

  if (step.action === "fill") {
    const paramName = Object.keys(inputs).find(
      (key) => inputs[key] === step.value,
    );
    const value = paramName ? { paramRef: paramName } : step.value;

    return {
      action: "fill",
      target: { role: role(step), name: step.name, reason: step.reason },
      value,
    };
  }

  return {
    action: "extract",
    rowContains: step.rowContains,
    cellIndex: step.cellIndex,
    outputKey: step.outputKey,
    reason: step.reason,
  };
}

// Builds a complete artifact from a discovery run. successCheckpoint is
// derived from the last extract step's label when there is one; otherwise
// the caller must supply one, since the trajectory alone isn't enough.
export function recordArtifact(options: {
  name: string;
  targetApp: string;
  baseUrl: string;
  trajectory: TrajectoryStep[];
  inputs: Record<string, string>;
  outputs: Record<string, unknown>;
  outcomeRules: OutcomeRule[];
  successCheckpoint?: Checkpoint;
}): CapabilityArtifact {
  const lastExtract = [...options.trajectory]
    .reverse()
    .find(
      (step): step is Extract<TrajectoryStep, { action: "extract" }> =>
        step.action === "extract",
    );

  const successCheckpoint: Checkpoint | undefined =
    options.successCheckpoint ??
    (lastExtract
      ? { kind: "textVisible", value: lastExtract.rowContains }
      : undefined);

  if (!successCheckpoint) {
    throw new Error(
      "Could not derive a success checkpoint; pass one explicitly.",
    );
  }

  // Assembles the finished artifact: every step converted, every input
  // and output named, plus the outcome rules and checkpoint from above.
  return {
    id: `${options.name}-v1`,
    name: options.name,
    version: "1.0.0",
    target: { app: options.targetApp, baseUrl: options.baseUrl },
    inputs: Object.keys(options.inputs).map((key) => ({
      name: key,
      description: key,
    })),
    outputs: Object.keys(options.outputs).map((key) => ({
      name: key,
      description: key,
    })),
    steps: options.trajectory.map((step) => convertStep(step, options.inputs)),
    outcomeRules: options.outcomeRules,
    successCheckpoint,
  };
}
