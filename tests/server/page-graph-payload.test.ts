import { describe, expect, it } from "vitest";
import { buildPageGraphPayload } from "../../src/server/page-graph-payload.js";

describe("buildPageGraphPayload", () => {
  it("builds nodes and evidence-backed edges", () => {
    const payload = buildPageGraphPayload({
      framework: "next",
      routes: [
        { file: "app/page.tsx", path: "/" },
        { file: "app/settings/page.tsx", path: "/settings" },
      ],
      pages: [],
      components: [],
      apiCalls: [],
      stateUnits: [],
      navigationEdges: [
        {
          from: "/",
          to: "/settings",
          type: "link",
          evidence: `<Link href="/settings">`,
        },
      ],
    });

    expect(payload.nodes).toHaveLength(2);
    expect(payload.edges[0]).toMatchObject({
      types: ["link"],
      evidences: [`<Link href="/settings">`],
    });
  });

  it("merges multiple navigation paths between the same pages", () => {
    const payload = buildPageGraphPayload({
      framework: "next",
      routes: [
        { file: "app/page.tsx", path: "/" },
        { file: "app/chat/[id]/page.tsx", path: "/chat/[id]" },
      ],
      pages: [],
      components: [],
      apiCalls: [],
      stateUnits: [],
      navigationEdges: [
        {
          from: "/",
          to: "/chat/[id]",
          type: "router-push",
          evidence: `router.push("/chat/\${id}")`,
        },
        {
          from: "/",
          to: "/chat/[id]",
          type: "link",
          evidence: `<Link href="/chat/[id]">`,
        },
      ],
    });

    expect(payload.edges).toHaveLength(1);
    expect(payload.edges[0]?.types.sort()).toEqual(["link", "router-push"]);
    expect(payload.edges[0]?.evidences).toHaveLength(2);
  });
});
