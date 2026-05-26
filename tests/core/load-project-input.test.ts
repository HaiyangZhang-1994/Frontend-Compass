import { describe, expect, it } from "vitest";
import { buildLoadedProjectInput } from "../../src/core/load-project-input.js";

describe("buildLoadedProjectInput", () => {
  it("builds an analysis-ready input object from discovered files", () => {
    const loaded = buildLoadedProjectInput({
      projectRoot: "/demo/project",
      packageJson: {
        dependencies: { react: "19.0.0" },
      },
      files: ["src/App.tsx", "node_modules/react/index.js"],
      sourceByFile: {
        "src/App.tsx": "export default function App() { return null; }",
      },
    });

    expect(loaded.projectRoot).toBe("/demo/project");
    expect(loaded.packageJson.dependencies?.react).toBe("19.0.0");
    expect(loaded.files).toEqual(["src/App.tsx", "node_modules/react/index.js"]);
    expect(loaded.sourceByFile["src/App.tsx"]).toContain("function App");
  });
});
