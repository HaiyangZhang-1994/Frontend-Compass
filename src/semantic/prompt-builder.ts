import type { SupportedFramework } from "../analyzers/shared/types.js";

export function buildOverviewPrompt(input: {
  framework: SupportedFramework;
  routeCount: number;
  pageCount: number;
}) {
  return [
    "You are helping a new developer understand a frontend project.",
    "Generate a concise onboarding summary.",
    `framework=${input.framework}`,
    `routeCount=${input.routeCount}`,
    `pageCount=${input.pageCount}`,
  ].join("\n");
}
