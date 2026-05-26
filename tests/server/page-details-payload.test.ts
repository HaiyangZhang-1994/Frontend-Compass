import { describe, expect, it } from "vitest";
import { buildPageDetailsPayload } from "../../src/server/page-details-payload.js";
import { buildPageNodeId } from "../../src/server/page-graph-payload.js";

describe("buildPageDetailsPayload", () => {
  it("builds detail payload for the selected node", () => {
    const snapshot = {
      framework: "next" as const,
      routes: [
        { file: "app/page.tsx", path: "/" },
        { file: "app/settings/page.tsx", path: "/settings" },
      ],
      pages: [
        {
          file: "app/page.tsx",
          path: "/",
          components: {
            componentNames: ["HomePage"],
            childComponents: ["HeroPanel"],
          },
          dataFlow: {
            stateHooks: ["useState"],
            handlers: ["handleGo"],
            apiCalls: [{ target: "/api/home" }],
          },
        },
        {
          file: "app/settings/page.tsx",
          path: "/settings",
          components: {
            componentNames: ["SettingsPage"],
            childComponents: [],
          },
          dataFlow: {
            stateHooks: [],
            handlers: [],
            apiCalls: [],
          },
        },
      ],
      components: ["HomePage", "HeroPanel", "SettingsPage"],
      apiCalls: [{ target: "/api/home", file: "app/page.tsx", path: "/" }],
      stateUnits: ["useState"],
      navigationEdges: [
        {
          from: "/",
          to: "/settings",
          type: "link" as const,
          evidence: `<Link href="/settings">`,
        },
      ],
    };

    const payload = buildPageDetailsPayload(snapshot, buildPageNodeId(snapshot.routes[0]));

    expect(payload?.path).toBe("/");
    expect(payload?.outgoingEdges).toHaveLength(1);
    expect(payload?.apiCalls).toContain("/api/home");
  });
});
