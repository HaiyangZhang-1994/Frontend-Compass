import { describe, expect, it } from "vitest";
import { ANALYZER_VERSION } from "../../src/cache/cache-store.js";
import { createSourceFileHashes } from "../../src/cache/file-hashes.js";
import { resolveAnalysisSnapshot } from "../../src/core/resolve-analysis-snapshot.js";

describe("resolveAnalysisSnapshot", () => {
  it("returns a cache hit when file hashes are unchanged", () => {
    const sourceByFile = {
      "src/App.tsx": "export default function App() { return null; }",
    };
    const fileHashes = createSourceFileHashes(sourceByFile);

    const result = resolveAnalysisSnapshot({
      loadedProject: {
        projectRoot: "/demo/project",
        packageJson: { dependencies: { react: "19.0.0" } },
        files: ["src/App.tsx"],
        sourceByFile,
      },
      cachedEnvelope: {
        framework: "react",
        createdAt: "2026-05-25T00:00:00.000Z",
        analysis: {
          framework: "react",
          routes: [],
          pages: [],
          components: [],
          apiCalls: [],
          stateUnits: [],
        },
        fileHashes,
        analyzerVersion: ANALYZER_VERSION,
      },
    });

    expect(result.cacheStatus).toBe("hit");
    expect(result.snapshot.framework).toBe("react");
  });
});
