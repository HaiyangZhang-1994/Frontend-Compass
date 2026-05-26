import { describe, expect, it } from "vitest";
import { findChangedFiles } from "../../src/cache/invalidation.js";

describe("findChangedFiles", () => {
  it("returns only changed paths by hash", () => {
    const changed = findChangedFiles(
      { "src/a.ts": "old", "src/b.ts": "same" },
      { "src/a.ts": "new", "src/b.ts": "same" },
    );

    expect(changed).toEqual(["src/a.ts"]);
  });
});
