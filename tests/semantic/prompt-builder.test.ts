import { describe, expect, it } from "vitest";
import { buildOverviewPrompt } from "../../src/semantic/prompt-builder.js";

describe("buildOverviewPrompt", () => {
  it("includes framework, routes, and onboarding purpose", () => {
    const prompt = buildOverviewPrompt({
      framework: "next",
      routeCount: 4,
      pageCount: 4,
    });

    expect(prompt).toContain("next");
    expect(prompt).toContain("routeCount=4");
    expect(prompt).toContain("new developer");
  });
});
