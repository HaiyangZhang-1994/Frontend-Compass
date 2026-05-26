import type { AnalysisSnapshot } from "../analyzers/shared/types.js";

export function buildStatePayload(snapshot: AnalysisSnapshot) {
  return {
    framework: snapshot.framework,
    stateUnits: [...new Set(snapshot.stateUnits)],
  };
}
