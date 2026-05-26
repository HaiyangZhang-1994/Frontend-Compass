import type { AnalysisSnapshot } from "../analyzers/shared/types.js";

export function buildRoutesPayload(snapshot: AnalysisSnapshot) {
  return {
    framework: snapshot.framework,
    routes: snapshot.routes.map((route) => ({
      path: route.path,
      file: route.file,
    })),
  };
}
