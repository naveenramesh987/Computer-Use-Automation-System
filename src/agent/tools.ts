import type Anthropic from "@anthropic-ai/sdk";

export const tools: Anthropic.Tool[] = [
  {
    name: "navigate",
    description: "Go to a URL.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "click",
    description:
      "Click a button or link on the page, identified by its role and visible text.",
    input_schema: {
      type: "object",
      properties: {
        role: { type: "string", enum: ["button", "link"] },
        name: { type: "string", description: "The element's visible text." },
        reason: {
          type: "string",
          description: "Why this element reliably identifies the right target.",
        },
      },
      required: ["role", "name", "reason"],
    },
  },
  {
    name: "fill",
    description:
      "Type a value into a text field or dropdown, identified by its role and visible label.",
    input_schema: {
      type: "object",
      properties: {
        role: { type: "string", enum: ["textbox", "combobox"] },
        name: { type: "string", description: "The field's visible label." },
        reason: {
          type: "string",
          description: "Why this element reliably identifies the right target.",
        },
        value: { type: "string" },
      },
      required: ["role", "name", "reason", "value"],
    },
  },
  {
    name: "extract",
    description:
      "Read a value off the page from a label/value table row: finds the cell with the exact label text, then reads a sibling cell in the same row.",
    input_schema: {
      type: "object",
      properties: {
        rowContains: {
          type: "string",
          description: 'The exact label text, e.g. "Current Savings Balance".',
        },
        cellIndex: {
          type: "number",
          description:
            "Which cell in that row holds the value (0 = first, 1 = second).",
        },
        outputKey: {
          type: "string",
          description: "What to call this value in the final result.",
        },
        reason: { type: "string" },
      },
      required: ["rowContains", "cellIndex", "outputKey", "reason"],
    },
  },
  {
    name: "finish",
    description: "Declare the goal complete and report the final outputs.",
    input_schema: {
      type: "object",
      properties: {
        outputs: {
          type: "object",
          description: "Key-value pairs of everything the goal asked for.",
        },
        reason: { type: "string" },
      },
      required: ["outputs", "reason"],
    },
  },
  {
    name: "escalate",
    description:
      "Give up and ask a human for help, because the goal can't be completed safely or the page shows something unexpected.",
    input_schema: {
      type: "object",
      properties: {
        reason: { type: "string" },
      },
      required: ["reason"],
    },
  },
];
