import { describe, expect, it } from "vitest";
import {
  pickFrontendProjectRoot,
  scoreFrontendPackageJson,
} from "../../src/core/resolve-frontend-root.js";

describe("scoreFrontendPackageJson", () => {
  it("gives strong scores to supported frontend app packages", () => {
    const score = scoreFrontendPackageJson({
      dependencies: {
        next: "^15.0.0",
        react: "^19.0.0",
      },
    });

    expect(score).toBeGreaterThan(0);
  });
});

describe("pickFrontendProjectRoot", () => {
  it("prefers the nested web app root when the repo root is not a frontend package", () => {
    const picked = pickFrontendProjectRoot("C:\\repo", [
      {
        directory: "C:\\repo\\web",
        packageJson: {
          dependencies: {
            next: "^15.0.0",
            react: "^19.0.0",
          },
        },
      },
      {
        directory: "C:\\repo\\api",
        packageJson: {
          dependencies: {
            fastapi: "^0.1.0",
          },
        },
      },
    ]);

    expect(picked).toBe("C:\\repo\\web");
  });
});
