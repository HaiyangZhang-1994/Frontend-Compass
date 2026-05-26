import { describe, expect, it } from "vitest";
import { createLaunchSummary } from "../../src/core/launch-summary.js";

describe("createLaunchSummary", () => {
  it("returns launch metadata for a supported project", async () => {
    const summary = await createLaunchSummary({
      projectRoot: "/demo/project",
      port: 4111,
    });

    expect(summary.status).toBe("ready");
    expect(summary.projectRoot).toBe("/demo/project");
    expect(summary.port).toBe(4111);
  });
});
