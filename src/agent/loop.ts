import Anthropic from "@anthropic-ai/sdk";
import type { Page } from "playwright";
import { launch, click, fill } from "../surface/browser.js";
import { checkPolicy } from "../safety/allowlist.js";
import { SENSITIVE_KEYS } from "../safety/redaction.js";
import { tools } from "./tools.js";
import { buildSystemPrompt } from "./prompt.js";
import type { RunLogger } from "../logging/logger.js";

export type TrajectoryStep =
  | { action: "navigate"; url: string }
  | { action: "click"; role: string; name: string; reason: string }
  | {
      action: "fill";
      role: string;
      name: string;
      reason: string;
      value: string;
    }
  | {
      action: "extract";
      rowContains: string;
      cellIndex: number;
      outputKey: string;
      reason: string;
    };

// Anthropic's API sometimes returns a temporary "Overloaded" error. Retry
// a couple of times before giving up, instead of crashing the whole run.
async function createMessageWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  maxAttempts = 3,
): Promise<Anthropic.Message> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (error) {
      const status = error instanceof Anthropic.APIError ? error.status : undefined;
      const isRetryable = status === 529 || status === 503 || status === 429;

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      const delayMs = 2000 * attempt;
      console.log(`Anthropic API returned ${status}, retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("unreachable");
}

export type DiscoveryResult =
  | {
      status: "finished";
      outputs: Record<string, unknown>;
      trajectory: TrajectoryStep[];
    }
  | { status: "escalated"; reason: string; trajectory: TrajectoryStep[] }
  | { status: "stopped"; reason: string; trajectory: TrajectoryStep[] };

// Runs a discovery session: opens a browser, shows Claude the goal and the
// current page, then lets it choose one action per turn (navigate, click,
// fill, extract) until it finishes, escalates, or runs out of steps.
export async function discover(
  goal: string,
  baseUrl: string,
  logger: RunLogger,
  maxSteps = 15,
): Promise<DiscoveryResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  const system = buildSystemPrompt(goal, baseUrl);

  const { browser, page } = await launch();
  const trajectory: TrajectoryStep[] = [];
  const outputs: Record<string, unknown> = {};

  // Goes to the starting page, then repeatedly shows Claude the current
  // page and runs whichever action it picks, until it finishes, escalates,
  // or the step limit is hit.
  try {
    await page.goto(baseUrl);
    trajectory.push({ action: "navigate", url: baseUrl });

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: await describeCurrentPage(page) },
    ];

    for (let step = 0; step < maxSteps; step++) {
      const response = await createMessageWithRetry(client, {
        model,
        system,
        tools,
        // This loop only ever handles one tool call per turn, so Claude
        // must be prevented from returning several at once — otherwise
        // the API rejects the next request for an unanswered tool call.
        tool_choice: { type: "auto", disable_parallel_tool_use: true },
        max_tokens: 1024,
        messages,
      });

      const toolUse = response.content.find(
        (block) => block.type === "tool_use",
      );

      if (!toolUse) {
        return {
          status: "stopped",
          reason: "Claude did not choose an action.",
          trajectory,
        };
      }

      logger.log({
        type: "agent_action",
        step,
        tool: toolUse.name,
        input: redactFillValue(toolUse.name, toolUse.input),
      });
      messages.push({ role: "assistant", content: response.content });

      let resultText: string;

      // Run whichever action Claude picked. Each branch checks the safety
      // policy first, then performs it and records it in the trajectory.
      // If anything throws (a click that times out, an element that isn't
      // there), the catch below turns it into text for Claude to react to,
      // instead of crashing the whole run.
      try {
        if (toolUse.name === "navigate") {
          const input = toolUse.input as { url: string };
          const policyResult = checkPolicy({
            kind: "navigate",
            url: input.url,
          });

          if (!policyResult.allowed) {
            resultText = `Blocked: ${policyResult.reason}`;
          } else {
            await page.goto(input.url);
            trajectory.push({ action: "navigate", url: input.url });
            resultText = `Navigated to ${input.url}.\n\n${await describeCurrentPage(page)}`;
          }
        } else if (toolUse.name === "click") {
          const input = toolUse.input as {
            role: "button" | "link";
            name: string;
            reason: string;
          };
          // Discovery is a supervised run with a human watching the real
          // browser window, unlike replay (the unattended, repeatable
          // production path) — so irreversible actions are allowed here.
          const policyResult = checkPolicy(
            { kind: "click", role: input.role, name: input.name },
            true,
          );

          if (!policyResult.allowed) {
            resultText = `Blocked: ${policyResult.reason}`;
          } else {
            await click(page, input.role, input.name);
            trajectory.push({
              action: "click",
              role: input.role,
              name: input.name,
              reason: input.reason,
            });
            resultText = `Clicked "${input.name}".\n\n${await describeCurrentPage(page)}`;
          }
        } else if (toolUse.name === "fill") {
          const input = toolUse.input as {
            role: "textbox" | "combobox";
            name: string;
            reason: string;
            value: string;
          };
          const policyResult = checkPolicy({
            kind: "fill",
            role: input.role,
            name: input.name,
          });

          if (!policyResult.allowed) {
            resultText = `Blocked: ${policyResult.reason}`;
          } else {
            await fill(page, input.role, input.name, input.value);
            trajectory.push({
              action: "fill",
              role: input.role,
              name: input.name,
              reason: input.reason,
              value: input.value,
            });
            resultText = `Filled "${input.name}".\n\n${await describeCurrentPage(page)}`;
          }
        } else if (toolUse.name === "extract") {
          const input = toolUse.input as {
            rowContains: string;
            cellIndex: number;
            outputKey: string;
            reason: string;
          };
          const labelCell = page.getByRole("cell", {
            name: input.rowContains,
            exact: true,
          });
          const row = labelCell.locator("..");
          const cell = row.getByRole("cell").nth(input.cellIndex);
          const value = (await cell.textContent())?.trim() ?? "";

          outputs[input.outputKey] = value;
          trajectory.push({
            action: "extract",
            rowContains: input.rowContains,
            cellIndex: input.cellIndex,
            outputKey: input.outputKey,
            reason: input.reason,
          });
          resultText = `Extracted ${input.outputKey} = "${value}".\n\n${await describeCurrentPage(page)}`;
        } else if (toolUse.name === "finish") {
          const input = toolUse.input as {
            outputs: Record<string, unknown>;
            reason: string;
          };
          logger.log({
            type: "agent_finish",
            outputs: input.outputs,
            reason: input.reason,
          });
          return {
            status: "finished",
            outputs: { ...outputs, ...input.outputs },
            trajectory,
          };
        } else if (toolUse.name === "escalate") {
          const input = toolUse.input as { reason: string };
          logger.log({ type: "agent_escalate", reason: input.reason });
          return { status: "escalated", reason: input.reason, trajectory };
        } else {
          resultText = `Unknown tool "${toolUse.name}" — ignoring.`;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Describing the page can itself fail (e.g. if the browser crashed),
        // so this can't assume the page is still usable after an error.
        try {
          resultText = `Error: ${message}\n\n${await describeCurrentPage(page)}`;
        } catch {
          resultText = `Error: ${message}`;
        }
      }

      messages.push({
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: toolUse.id, content: resultText },
        ],
      });
    }

    return {
      status: "stopped",
      reason: "Max steps reached without finishing.",
      trajectory,
    };
  } finally {
    await browser.close();
  }
}

// redact() from safety/redaction.ts only hides fields by their own key name
// (e.g. a key literally called "password"), but a fill action's typed value
// is stored generically under "value", next to a separate "name" field like
// "Password" that only reveals it's sensitive by its content. This checks
// that label specifically before a fill action gets logged.
function redactFillValue(tool: string, input: unknown): unknown {
  if (tool !== "fill" || typeof input !== "object" || input === null) {
    return input;
  }

  const fillInput = input as { name?: string; value?: string };
  const looksSensitive = SENSITIVE_KEYS.some((word) =>
    fillInput.name?.toLowerCase().includes(word),
  );

  return looksSensitive ? { ...fillInput, value: "[REDACTED]" } : input;
}

// Same redaction, applied to a full trajectory — used before a
// DiscoveryResult is printed or saved, so a typed password never ends up
// in result.json either, not just the step-by-step log.
export function redactTrajectory(trajectory: TrajectoryStep[]): TrajectoryStep[] {
  return trajectory.map((step) => {
    if (step.action !== "fill") {
      return step;
    }

    const looksSensitive = SENSITIVE_KEYS.some((word) =>
      step.name.toLowerCase().includes(word),
    );

    return looksSensitive ? { ...step, value: "[REDACTED]" } : step;
  });
}

// Describes the current page for Claude: its URL plus the accessibility
// snapshot, the same text-based view every other part of this project uses.
async function describeCurrentPage(page: Page): Promise<string> {
  const ariaSnapshot = await page.locator("body").ariaSnapshot();
  return `Current URL: ${page.url()}\n\nPage:\n${ariaSnapshot}`;
}
