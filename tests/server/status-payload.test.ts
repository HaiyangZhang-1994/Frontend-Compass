import { describe, expect, it } from "vitest";
import { buildStatusPayload } from "../../src/server/status-payload.js";

describe("buildStatusPayload", () => {
  it("marks a supported analyzed project as ready", () => {
    const payload = buildStatusPayload({
      framework: "next",
      routes: [{ file: "app/page.tsx", path: "/" }],
      pages: [],
      components: [],
      apiCalls: [],
      stateUnits: [],
    });

    expect(payload.status).toBe("ready");
    expect(payload.supported).toBe(true);
  });

  it("marks an empty project snapshot as unsupported", () => {
    const payload = buildStatusPayload({
      framework: "react",
      routes: [],
      pages: [],
      components: [],
      apiCalls: [],
      stateUnits: [],
      unsupportedReason: "No supported frontend framework detected.",
    });

    expect(payload.status).toBe("unsupported");
    expect(payload.message).toContain("No supported frontend framework detected.");
  });
});
