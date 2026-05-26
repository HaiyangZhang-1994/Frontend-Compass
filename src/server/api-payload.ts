import type { AnalysisSnapshot } from "../analyzers/shared/types.js";

export function buildApiPayload(snapshot: AnalysisSnapshot) {
  return {
    framework: snapshot.framework,
    calls: snapshot.apiCalls,
  };
}
