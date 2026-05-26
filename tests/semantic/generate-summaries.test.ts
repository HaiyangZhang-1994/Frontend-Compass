import { describe, expect, it } from "vitest";
import {
  enhanceOverviewSummaryWithProvider,
  generateOverviewSummary,
} from "../../src/semantic/generate-summaries.js";

describe("generateOverviewSummary", () => {
  it("turns an analysis snapshot into an onboarding-friendly overview summary", () => {
    const summary = generateOverviewSummary({
      framework: "next",
      routes: [{ file: "app/page.tsx", path: "/" }],
      pages: [
        {
          file: "app/page.tsx",
          path: "/",
          components: {
            componentNames: ["HomePage"],
            childComponents: ["HeroPanel"],
            customHooks: ["useSession"],
          },
          dataFlow: {
            effects: ["useEffect"],
            stateHooks: ["useState"],
            apiCalls: [{ target: "/api/home" }],
          },
        },
      ],
      components: ["HomePage", "HeroPanel"],
      apiCalls: [{ target: "/api/home", file: "app/page.tsx", path: "/" }],
      stateUnits: ["useState"],
    });

    expect(summary.title).toContain("next");
    expect(summary.description).toContain("1 route");
    expect(summary.highlights[0]).toContain("/api/home");
  });

  it("uses provider output when a valid JSON summary is returned", async () => {
    const result = await enhanceOverviewSummaryWithProvider(
      {
        framework: "next",
        routes: [{ file: "app/page.tsx", path: "/" }],
        pages: [],
        components: [],
        apiCalls: [],
        stateUnits: [],
      },
      {
        baseURL: "https://example.com/v1",
        apiKey: "demo-key",
        model: "demo-model",
      },
      async () =>
        JSON.stringify({
          title: "Provider title",
          description: "Provider description",
          highlights: ["Provider highlight"],
        }),
    );

    expect(result.source).toBe("provider");
    expect(result.summary.title).toBe("Provider title");
  });

  it("falls back to local summary when provider output is invalid", async () => {
    const result = await enhanceOverviewSummaryWithProvider(
      {
        framework: "next",
        routes: [{ file: "app/page.tsx", path: "/" }],
        pages: [],
        components: [],
        apiCalls: [],
        stateUnits: [],
      },
      {
        baseURL: "https://example.com/v1",
        apiKey: "demo-key",
        model: "demo-model",
      },
      async () => "not-json",
    );

    expect(result.source).toBe("fallback");
    expect(result.summary.title).toContain("next");
  });
});
