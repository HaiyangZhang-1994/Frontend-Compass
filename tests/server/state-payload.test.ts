import { describe, expect, it } from "vitest";
import { buildStatePayload } from "../../src/server/state-payload.js";

describe("buildStatePayload", () => {
  it("returns deduplicated state units", () => {
    const payload = buildStatePayload({
      framework: "next",
      routes: [],
      pages: [],
      components: [],
      apiCalls: [],
      stateUnits: ["useState", "useState", "useEffect"],
    });

    expect(payload.stateUnits).toEqual(["useState", "useEffect"]);
  });
});
