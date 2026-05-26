import type { AnalysisSnapshot } from "../analyzers/shared/types.js";

export function buildStatusPayload(snapshot: AnalysisSnapshot) {
  const unsupported = Boolean(snapshot.unsupportedReason);

  return {
    supported: !unsupported,
    status: unsupported ? ("unsupported" as const) : ("ready" as const),
    framework: snapshot.framework,
    message: unsupported
      ? snapshot.unsupportedReason
      : "Frontend Compass is ready to explore this project.",
  };
}
