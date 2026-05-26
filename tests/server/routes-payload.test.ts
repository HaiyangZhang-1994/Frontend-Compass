import { describe, expect, it } from "vitest";
import { buildRoutesPayload } from "../../src/server/routes-payload.js";

describe("buildRoutesPayload", () => {
  it("returns route rows with related file paths", () => {
    const payload = buildRoutesPayload({
      framework: "next",
      routes: [{ file: "app/settings/page.tsx", path: "/settings" }],
      pages: [
        {
          file: "app/settings/page.tsx",
          path: "/settings",
          components: { componentNames: ["SettingsPage"], childComponents: ["SettingsPanel"] },
          dataFlow: { effects: ["useEffect"], stateHooks: ["useState"], apiCalls: [{ target: "/api/settings" }] },
        },
      ],
      components: ["SettingsPage", "SettingsPanel"],
      apiCalls: [{ target: "/api/settings", file: "app/settings/page.tsx", path: "/settings" }],
      stateUnits: ["useState"],
    });

    expect(payload.routes[0]?.path).toBe("/settings");
    expect(payload.routes[0]?.file).toBe("app/settings/page.tsx");
  });
});
