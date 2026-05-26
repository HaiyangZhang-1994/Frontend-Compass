import { describe, expect, it } from "vitest";
import {
  buildEnhancedOverviewPayload,
  buildOverviewPayload,
} from "../../src/server/overview-payload.js";

describe("buildOverviewPayload", () => {
  it("builds the overview API payload from project analysis", () => {
    const payload = buildOverviewPayload({
      framework: "nuxt",
      routes: [{ file: "pages/index.vue", path: "/" }],
      pages: [
        {
          file: "pages/index.vue",
          path: "/",
          components: {
            childComponents: ["HeroPanel"],
            composables: ["useSession"],
          },
          dataFlow: {
            watchers: ["watch"],
            stateSignals: ["ref"],
            apiCalls: [{ target: "/api/home" }],
          },
        },
      ],
      components: ["HeroPanel"],
      apiCalls: [{ target: "/api/home", file: "pages/index.vue", path: "/" }],
      stateUnits: ["ref"],
    });

    expect(payload.framework).toBe("nuxt");
    expect(payload.routeCount).toBe(1);
    expect(payload.summary.title).toContain("nuxt");
    expect(payload.summary.highlights[0]).toContain("/api/home");
  });

  it("marks provider summaries when enhanced output is available", async () => {
    const payload = await buildEnhancedOverviewPayload(
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

    expect(payload.summarySource).toBe("provider");
    expect(payload.summary.title).toBe("Provider title");
  });
});
