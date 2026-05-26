import { describe, expect, it } from "vitest";
import {
  getCacheFilePath,
  getFallbackCacheFilePath,
} from "../../src/cache/cache-files.js";

describe("getCacheFilePath", () => {
  it("returns a cache file inside the hidden project cache directory", () => {
    const cachePath = getCacheFilePath("C:\\demo\\project");
    expect(cachePath.replace(/\\/g, "/")).toContain(".frontend-compass/cache/analysis.json");
  });

  it("returns a fallback cache file inside the tool workspace", () => {
    const cachePath = getFallbackCacheFilePath(
      "C:\\tool\\frontend-compass",
      "C:\\demo\\project",
    );
    expect(cachePath.replace(/\\/g, "/")).toContain(
      ".frontend-compass/targets/",
    );
  });
});
