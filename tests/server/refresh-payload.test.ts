import { describe, expect, it } from "vitest";
import { buildRefreshPayload } from "../../src/server/refresh-payload.js";

describe("buildRefreshPayload", () => {
  it("returns a simple refresh result payload", () => {
    const payload = buildRefreshPayload({
      cacheStatus: "miss",
      routeCount: 3,
      pageCount: 3,
    });

    expect(payload.ok).toBe(true);
    expect(payload.cacheStatus).toBe("miss");
    expect(payload.message).toContain("3 route");
  });
});
