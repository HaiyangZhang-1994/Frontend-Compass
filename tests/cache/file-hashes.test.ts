import { describe, expect, it } from "vitest";
import { createSourceFileHashes } from "../../src/cache/file-hashes.js";

describe("createSourceFileHashes", () => {
  it("creates deterministic hashes for source files", () => {
    const hashes = createSourceFileHashes({
      "src/App.tsx": "export default function App() { return null; }",
    });

    expect(typeof hashes["src/App.tsx"]).toBe("string");
    expect(hashes["src/App.tsx"]?.length).toBeGreaterThan(10);
  });

  it("returns the same hash map regardless of object key insertion order", () => {
    const a = createSourceFileHashes({
      "src/App.tsx": "one",
      "src/Page.tsx": "two",
    });
    const b = createSourceFileHashes({
      "src/Page.tsx": "two",
      "src/App.tsx": "one",
    });

    expect(a).toEqual(b);
  });
});
