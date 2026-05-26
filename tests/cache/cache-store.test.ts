import { describe, expect, it } from "vitest";
import { ANALYZER_VERSION, createCacheEnvelope } from "../../src/cache/cache-store.js";

describe("createCacheEnvelope", () => {
  it("stores framework and analysis timestamp", () => {
    const envelope = createCacheEnvelope("next", { routes: [] });

    expect(envelope.framework).toBe("next");
    expect(typeof envelope.createdAt).toBe("string");
    expect(envelope.analysis).toEqual({ routes: [] });
    expect(envelope.analyzerVersion).toBe(ANALYZER_VERSION);
  });
});
