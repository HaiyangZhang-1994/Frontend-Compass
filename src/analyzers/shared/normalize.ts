import type { AnalysisSnapshot, SupportedFramework } from "./types.js";

export function createEmptyAnalysis(
  framework: SupportedFramework,
): AnalysisSnapshot {
  return {
    framework,
    routes: [],
    pages: [],
    components: [],
    apiCalls: [],
    stateUnits: [],
    navigationEdges: [],
  };
}
