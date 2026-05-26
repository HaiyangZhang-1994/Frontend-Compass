import type { AnalysisSnapshot } from "../analyzers/shared/types.js";
import type { ProviderConfigInput } from "./provider-client.js";
import { buildOverviewPrompt } from "./prompt-builder.js";
import { requestProviderText } from "./provider-client.js";

export type OverviewSummary = {
  title: string;
  description: string;
  highlights: string[];
};

export type OverviewSummaryResult = {
  source: "provider" | "fallback";
  summary: OverviewSummary;
  error?: string;
};

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function generateOverviewSummary(
  snapshot: AnalysisSnapshot,
): OverviewSummary {
  const routeCount = snapshot.routes.length;
  const pageCount = snapshot.pages.length;
  const componentCount = snapshot.components.length;
  const apiTargets = [...new Set(snapshot.apiCalls.map((call) => call.target))];

  return {
    title: `${snapshot.framework} onboarding overview`,
    description: `This project currently exposes ${pluralize(routeCount, "route", "routes")} across ${pluralize(pageCount, "page", "pages")} with ${pluralize(componentCount, "component", "components")} identified for a new developer to explore.`,
    highlights: [
      apiTargets.length > 0
        ? `Key API usage includes ${apiTargets.join(", ")}.`
        : "No API usage has been identified yet.",
      snapshot.stateUnits.length > 0
        ? `State signals detected: ${snapshot.stateUnits.join(", ")}.`
        : "No state signals have been identified yet.",
      snapshot.pages.length > 0
        ? `Start with ${snapshot.pages[0].file} to understand the first important view.`
        : "No page-level entries have been identified yet.",
    ],
  };
}

function parseOverviewSummaryJson(raw: string): OverviewSummary | null {
  try {
    const parsed = JSON.parse(raw) as OverviewSummary;
    if (
      typeof parsed.title === "string" &&
      typeof parsed.description === "string" &&
      Array.isArray(parsed.highlights)
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

export async function enhanceOverviewSummaryWithProvider(
  snapshot: AnalysisSnapshot,
  providerConfig: ProviderConfigInput,
  invokeProvider: (prompt: string) => Promise<string> = (prompt) =>
    requestProviderText(providerConfig, prompt),
): Promise<OverviewSummaryResult> {
  const fallback = generateOverviewSummary(snapshot);
  const prompt = [
    buildOverviewPrompt({
      framework: snapshot.framework,
      routeCount: snapshot.routes.length,
      pageCount: snapshot.pages.length,
    }),
    "",
    "Return strict JSON with this shape:",
    '{"title":"...","description":"...","highlights":["..."]}',
    "Keep the summary concise and onboarding-focused.",
  ].join("\n");

  try {
    const raw = await invokeProvider(prompt);
    const parsed = parseOverviewSummaryJson(raw);

    if (!parsed) {
      return {
        source: "fallback",
        summary: fallback,
        error: "Provider returned invalid JSON summary.",
      };
    }

    return {
      source: "provider",
      summary: parsed,
    };
  } catch (error) {
    return {
      source: "fallback",
      summary: fallback,
      error: error instanceof Error ? error.message : "Provider request failed.",
    };
  }
}
