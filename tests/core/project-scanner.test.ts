import { describe, expect, it } from "vitest";
import { buildProjectScanResult } from "../../src/core/project-scanner.js";

describe("buildProjectScanResult", () => {
  it("builds a normalized scan result from project inputs", () => {
    const scan = buildProjectScanResult({
      projectRoot: "/demo/project",
      packageJson: {
        dependencies: { next: "15.0.0", react: "19.0.0" },
      },
      files: [
        "app/page.tsx",
        "app/settings/page.tsx",
        ".next/server/app.js",
        "node_modules/react/index.js",
      ],
    });

    expect(scan.projectRoot).toBe("/demo/project");
    expect(scan.framework.kind).toBe("next");
    expect(scan.includedFiles).toEqual([
      "app/page.tsx",
      "app/settings/page.tsx",
    ]);
    expect(scan.entryHints).toContain("app/page.tsx");
  });
});
