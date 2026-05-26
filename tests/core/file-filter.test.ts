import { describe, expect, it } from "vitest";
import { shouldIncludeFile } from "../../src/core/file-filter.js";

describe("shouldIncludeFile", () => {
  it("excludes generated and vendor files", () => {
    expect(shouldIncludeFile("node_modules/react/index.js")).toBe(false);
    expect(shouldIncludeFile(".next/server/app.js")).toBe(false);
    expect(shouldIncludeFile(".nuxt/dist/server.mjs")).toBe(false);
    expect(shouldIncludeFile("dist/assets/index.js")).toBe(false);
    expect(shouldIncludeFile("coverage/lcov.info")).toBe(false);
    expect(shouldIncludeFile("src/pages/Home.tsx")).toBe(true);
  });
});
