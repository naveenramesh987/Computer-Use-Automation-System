import { Page } from "playwright";
import { launch, click, fill } from "../surface/browser.js";
import { checkPolicy } from "../safety/allowlist.js";
import { CapabilityArtifact, Checkpoint } from "../artifact/schema.js";

export type ReplayResult =
  | { status: "success"; outputs: Record<string, string> }
  | { status: "businessOutcome"; code: string; message: string }
  | { status: "escalated"; reason: string }
  | { status: "failure"; step: number; expected: string; observed: string };

// Checks whether a checkpoint's condition is currently true on the page.
async function matchesCheckpoint(
  page: Page,
  checkpoint: Checkpoint,
): Promise<boolean> {
  if (checkpoint.kind === "urlContains") {
    return page.url().includes(checkpoint.value);
  }

  return page.getByText(checkpoint.value).first().isVisible();
}

// Turns a checkpoint into a plain-English description, for error messages.
function describeCheckpoint(checkpoint: Checkpoint): string {
  if (checkpoint.kind === "urlContains") {
    return `URL contains "${checkpoint.value}"`;
  }
  return `text "${checkpoint.value}" visible on the page`;
}

// Runs a saved artifact with no AI involved. Goes through its steps one
// by one, checks each action against the safety policy first, and stops
// as soon as it hits a business outcome, a blocked action, or a failure.
export async function replay(
  artifact: CapabilityArtifact,
  params: Record<string, string>,
  options: { allowIrreversible?: boolean } = {},
): Promise<ReplayResult> {
  const { browser, page } = await launch();
  const outputs: Record<string, string> = {};

  try {
    for (let i = 0; i < artifact.steps.length; i++) {
      const step = artifact.steps[i];
      if (!step) {
        continue;
      }

      // Run this step's action (navigate/fill/click/extract). If it fails
      // — e.g. a link that isn't on the page — check the outcome rules
      // below before treating it as a failure.
      try {
        if (step.action === "navigate") {
          const policyResult = checkPolicy({ kind: "navigate", url: step.url });
          if (!policyResult.allowed) {
            return { status: "escalated", reason: policyResult.reason };
          }

          await page.goto(step.url);
        } else if (step.action === "fill") {
          const value =
            typeof step.value === "string"
              ? step.value
              : (params[step.value.paramRef] ?? "");
          const policyResult = checkPolicy({
            kind: "fill",
            role: step.target.role,
            name: step.target.name,
          });

          if (!policyResult.allowed) {
            return { status: "escalated", reason: policyResult.reason };
          }

          await fill(page, step.target.role, step.target.name, value);
        } else if (step.action === "click") {
          const policyResult = checkPolicy(
            { kind: "click", role: step.target.role, name: step.target.name },
            options.allowIrreversible,
          );

          if (!policyResult.allowed) {
            return { status: "escalated", reason: policyResult.reason };
          }

          await click(page, step.target.role, step.target.name);
        } else if (step.action === "extract") {
          const labelCell = page.getByRole("cell", {
            name: step.rowContains,
            exact: true,
          });
          const row = labelCell.locator("..");
          const cell = row.getByRole("cell").nth(step.cellIndex);

          outputs[step.outputKey] = (await cell.textContent())?.trim() ?? "";
        }
      } catch (error) {
        for (const rule of artifact.outcomeRules) {
          if (await matchesCheckpoint(page, rule.detect)) {
            return {
              status: "businessOutcome",
              code: rule.code,
              message: rule.message,
            };
          }
        }

        return {
          step: i,
          status: "failure",
          expected: `step ${i} (${step.action}) to complete without error`,
          observed: error instanceof Error ? error.message : String(error),
        };
      }

      // Only navigate and click steps can declare a checkpoint. If one is
      // set and we didn't reach it, stop here and report a failure.
      if ("checkpoint" in step && step.checkpoint) {
        const reached = await matchesCheckpoint(page, step.checkpoint);
        if (!reached) {
          return {
            status: "failure",
            step: i,
            expected: describeCheckpoint(step.checkpoint),
            observed: `page did not reach the expected state after step ${i} (${step.action})`,
          };
        }
      }

      for (const rule of artifact.outcomeRules) {
        if (await matchesCheckpoint(page, rule.detect)) {
          return {
            status: "businessOutcome",
            code: rule.code,
            message: rule.message,
          };
        }
      }
    }

    const succeeded = await matchesCheckpoint(page, artifact.successCheckpoint);
    if (!succeeded) {
      return {
        status: "failure",
        step: artifact.steps.length,
        expected: describeCheckpoint(artifact.successCheckpoint),
        observed: "success checkpoint not found after all steps completed",
      };
    }

    return { status: "success", outputs };
  } finally {
    await browser.close();
  }
}
