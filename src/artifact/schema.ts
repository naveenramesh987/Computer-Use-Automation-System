import { z } from "zod";

const RoleSchema = z.enum(["button", "link", "textbox", "combobox"]);

// Identifies one element on the page: its role, its name, and why we
// think that combination will stay reliable.
export const TargetRefSchema = z.object({
  role: RoleSchema,
  name: z.string(),
  reason: z.string(),
});
export type TargetRef = z.infer<typeof TargetRefSchema>;

// A condition we check to confirm we actually reached the state we
// expected, instead of just assuming a click worked.
export const CheckpointSchema = z.object({
  kind: z.enum(["textVisible", "urlContains"]),
  value: z.string(),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

// One action in an artifact: go to a URL, click something, or type into something.
export const StepSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("navigate"),
    url: z.string(),
    checkpoint: CheckpointSchema.optional(),
  }),
  z.object({
    action: z.literal("click"),
    target: TargetRefSchema,
    risk: z.enum(["safe", "irreversible"]),
    checkpoint: CheckpointSchema.optional(),
  }),
  z.object({
    action: z.literal("fill"),
    target: TargetRefSchema,
    // A literal, a per-invocation param, or a secret read from an
    // environment variable at replay time — never a literal secret value.
    value: z.union([
      z.string(),
      z.object({ paramRef: z.string() }),
      z.object({ secretRef: z.string() }),
    ]),
  }),
  z.object({
    action: z.literal("extract"),
    rowContains: z.string(),
    cellIndex: z.number(),
    outputKey: z.string(),
    reason: z.string(),
  }),
]);
export type Step = z.infer<typeof StepSchema>;

// Recognizes one outcome and says what it means: normal answer, retry, or real failure.
export const OutcomeRuleSchema = z.object({
  id: z.string(),
  detect: CheckpointSchema,
  classification: z.enum(["businessOutcome", "recoverable", "hardFailure"]),
  code: z.string(),
  message: z.string(),
});
export type OutcomeRule = z.infer<typeof OutcomeRuleSchema>;

// The whole artifact: everything needed to run this capability again later.
export const CapabilityArtifactSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  target: z.object({
    app: z.string(),
    baseUrl: z.string(),
  }),
  inputs: z.array(z.object({ name: z.string(), description: z.string() })),
  outputs: z.array(z.object({ name: z.string(), description: z.string() })),
  steps: z.array(StepSchema),
  outcomeRules: z.array(OutcomeRuleSchema),
  successCheckpoint: CheckpointSchema,
});
export type CapabilityArtifact = z.infer<typeof CapabilityArtifactSchema>;
