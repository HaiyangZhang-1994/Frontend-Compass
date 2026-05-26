import type { AnalysisSnapshot } from "../analyzers/shared/types.js";
import type { ProviderConfigInput } from "../semantic/provider-client.js";
import {
  enhanceOverviewSummaryWithProvider,
  generateOverviewSummary,
  type OverviewSummary,
} from "../semantic/generate-summaries.js";

export type OverviewPayload = {
  framework: AnalysisSnapshot["framework"];
  routeCount: number;
  pageCount: number;
  componentCount: number;
  summary: OverviewSummary;
  summarySource?: "provider" | "fallback" | "local";
};

export function buildOverviewPayload(
  snapshot: AnalysisSnapshot,
): OverviewPayload {
  return {
    framework: snapshot.framework,
    routeCount: snapshot.routes.length,
    pageCount: snapshot.pages.length,
    componentCount: snapshot.components.length,
    summary: generateOverviewSummary(snapshot),
    summarySource: "local",
  };
}

export async function buildEnhancedOverviewPayload(
  snapshot: AnalysisSnapshot,
  providerConfig: ProviderConfigInput,
  invokeProvider?: (prompt: string) => Promise<string>,
): Promise<OverviewPayload> {
  const result = await enhanceOverviewSummaryWithProvider(
    snapshot,
    providerConfig,
    invokeProvider,
  );

  return {
    framework: snapshot.framework,
    routeCount: snapshot.routes.length,
    pageCount: snapshot.pages.length,
    componentCount: snapshot.components.length,
    summary: result.summary,
    summarySource: result.source,
  };
}
