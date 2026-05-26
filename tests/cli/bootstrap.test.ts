import { describe, expect, it } from "vitest";
import { buildStartupPlan } from "../../src/cli/index.js";

describe("buildStartupPlan", () => {
  it("returns a startup plan for the current project root", () => {
    const plan = buildStartupPlan({
      cwd: "/demo/project",
      port: 4111,
    });

    expect(plan.projectRoot).toBe("/demo/project");
    expect(plan.port).toBe(4111);
    expect(plan.mode).toBe("serve");
  });
});
