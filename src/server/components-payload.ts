import type { AnalysisSnapshot } from "../analyzers/shared/types.js";

export function buildComponentsPayload(snapshot: AnalysisSnapshot) {
  return {
    framework: snapshot.framework,
    components: snapshot.components.map((name) => ({
      name,
      usedBy: snapshot.pages
        .filter((page) =>
          (page.components.componentNames ?? []).includes(name) ||
          page.components.childComponents.includes(name),
        )
        .map((page) => page.file),
    })),
  };
}
