import { describe, expect, it } from "vitest";
import { createEmptyAnalysis } from "../../src/analyzers/shared/normalize.js";

describe("createEmptyAnalysis", () => {
  it("creates the normalized top-level containers", () => {
    const analysis = createEmptyAnalysis("next");

    expect(analysis.framework).toBe("next");
    expect(analysis.routes).toEqual([]);
    expect(analysis.pages).toEqual([]);
    expect(analysis.components).toEqual([]);
    expect(analysis.apiCalls).toEqual([]);
    expect(analysis.stateUnits).toEqual([]);
  });
});
