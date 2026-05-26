import { describe, expect, it } from "vitest";
import { detectFramework } from "../../src/core/framework-detector.js";

describe("detectFramework", () => {
  it("detects Next.js projects from package metadata", () => {
    const framework = detectFramework({
      packageJson: {
        dependencies: { next: "15.0.0", react: "19.0.0" },
      },
      files: ["app/page.tsx"],
    });

    expect(framework.kind).toBe("next");
  });

  it("detects Nuxt projects from package metadata", () => {
    const framework = detectFramework({
      packageJson: {
        dependencies: { nuxt: "4.0.0", vue: "3.0.0" },
      },
      files: ["pages/index.vue"],
    });

    expect(framework.kind).toBe("nuxt");
  });

  it("detects Vue projects when vue is present without nuxt", () => {
    const framework = detectFramework({
      packageJson: {
        dependencies: { vue: "3.5.0" },
      },
      files: ["src/App.vue"],
    });

    expect(framework.kind).toBe("vue");
  });

  it("detects React projects when react is present without next", () => {
    const framework = detectFramework({
      packageJson: {
        dependencies: { react: "19.0.0" },
      },
      files: ["src/App.tsx"],
    });

    expect(framework.kind).toBe("react");
  });
});
