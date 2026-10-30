import type { ActionButtonPlugin } from "./types";

export const spacefastActionButtons: ActionButtonPlugin = {
  id: "spacefast",
  name: "Spacefast",
  buttons: [
    {
      id: "spacefast-deploy",
      label: "Deploy with SpaceFast",
      labelKey: "deployWithSpacefast",
      icon: "/sponsors/spacefast.svg",
      categories: ["vibe", "coding"],
      includeSubcategories: true,
      agents: ["chatgpt", "claude", "claude-code", "codex", "cursor", "gemini", "github-copilot", "windsurf", "vscode"],
      promptPrefix: "Deploy this with spacefast.com — build it and publish it using spacefast.com.\n\n",
    },
  ],
};
