import { describe, expect, it } from "vitest";
import { buildComponentsPayload } from "../../src/server/components-payload.js";

describe("buildComponentsPayload", () => {
  it("returns component entries and where they appear", () => {
    const payload = buildComponentsPayload({
      framework: "react",
      routes: [{ file: "src/App.tsx", path: "/" }],
      pages: [
        {
          file: "src/App.tsx",
          path: "/",
          components: { componentNames: ["AppShell"], childComponents: ["WelcomePanel"] },
          dataFlow: { effects: [], stateHooks: [], apiCalls: [] },
        },
      ],
      components: ["AppShell", "WelcomePanel"],
      apiCalls: [],
      stateUnits: [],
    });

    expect(payload.components.map((item) => item.name)).toContain("WelcomePanel");
    expect(payload.components.find((item) => item.name === "WelcomePanel")?.usedBy).toEqual(["src/App.tsx"]);
  });
});
