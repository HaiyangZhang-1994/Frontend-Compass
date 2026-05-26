import type { SupportedFramework } from "../analyzers/shared/types.js";

export type CacheEnvelope<TAnalysis> = {
  framework: SupportedFramework;
  createdAt: string;
  analysis: TAnalysis;
  fileHashes?: Record<string, string>;
  analyzerVersion: string;
};

export const ANALYZER_VERSION = "2026-05-26.page-graph-v3";

export function createCacheEnvelope<TAnalysis>(
  framework: SupportedFramework,
  analysis: TAnalysis,
  fileHashes?: Record<string, string>,
): CacheEnvelope<TAnalysis> {
  return {
    framework,
    createdAt: new Date().toISOString(),
    analysis,
    fileHashes,
    analyzerVersion: ANALYZER_VERSION,
  };
}
