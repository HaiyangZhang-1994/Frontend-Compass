import { createSourceFileHashes } from "../cache/file-hashes.js";
import type { CacheEnvelope } from "../cache/cache-store.js";
import { ANALYZER_VERSION } from "../cache/cache-store.js";
import { analyzeProject } from "./analyze-project.js";
import type { LoadedProjectInput } from "./load-project-input.js";

export function resolveAnalysisSnapshot(input: {
  loadedProject: LoadedProjectInput;
  cachedEnvelope: CacheEnvelope<ReturnType<typeof analyzeProject>> | null;
}) {
  const currentHashes = createSourceFileHashes(input.loadedProject.sourceByFile);
  const currentHashEntries = Object.entries(currentHashes).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const cachedHashEntries = Object.entries(
    input.cachedEnvelope?.fileHashes ?? {},
  ).sort(([a], [b]) => a.localeCompare(b));

  if (
    input.cachedEnvelope?.analyzerVersion === ANALYZER_VERSION &&
    input.cachedEnvelope?.fileHashes &&
    JSON.stringify(cachedHashEntries) === JSON.stringify(currentHashEntries)
  ) {
    return {
      cacheStatus: "hit" as const,
      snapshot: input.cachedEnvelope.analysis,
      fileHashes: currentHashes,
    };
  }

  return {
    cacheStatus: "miss" as const,
    snapshot: analyzeProject(input.loadedProject),
    fileHashes: currentHashes,
  };
}
