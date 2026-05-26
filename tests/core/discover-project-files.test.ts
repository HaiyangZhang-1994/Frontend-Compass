import { describe, expect, it } from "vitest";
import {
  shouldSkipDirectoryName,
  toRelativeProjectPath,
} from "../../src/core/discover-project-files.js";

describe("toRelativeProjectPath", () => {
  it("converts an absolute file path into a project-relative path", () => {
    const relative = toRelativeProjectPath(
      "C:\\demo\\project",
      "C:\\demo\\project\\src\\App.tsx",
    );

    expect(relative).toBe("src/App.tsx");
  });

  it("skips heavyweight generated directories during discovery", () => {
    expect(shouldSkipDirectoryName("node_modules")).toBe(true);
    expect(shouldSkipDirectoryName(".next")).toBe(true);
    expect(shouldSkipDirectoryName("src")).toBe(false);
  });
});
