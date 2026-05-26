import { describe, expect, it } from "vitest";
import { buildApiPayload } from "../../src/server/api-payload.js";

describe("buildApiPayload", () => {
  it("returns api usage rows", () => {
    const payload = buildApiPayload({
      framework: "nuxt",
      routes: [{ file: "pages/index.vue", path: "/" }],
      pages: [],
      components: [],
      apiCalls: [{ target: "/api/home", file: "pages/index.vue", path: "/" }],
      stateUnits: [],
    });

    expect(payload.calls[0]?.target).toBe("/api/home");
    expect(payload.calls[0]?.file).toBe("pages/index.vue");
  });
});
