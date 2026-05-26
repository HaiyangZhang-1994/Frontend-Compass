import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../../src/cli/index.js";

describe("parseCliArgs", () => {
  it("uses the current cwd when no project argument is provided", () => {
    const parsed = parseCliArgs(["node", "cli.js"], "C:\\work\\current");
    expect(parsed.projectRoot).toBe("C:\\work\\current");
  });

  it("uses the explicit --project path when provided", () => {
    const parsed = parseCliArgs(
      ["node", "cli.js", "--project", "C:\\Users\\Haiyang\\Desktop\\birding-copilot"],
      "C:\\work\\current",
    );

    expect(parsed.projectRoot).toBe("C:\\Users\\Haiyang\\Desktop\\birding-copilot");
  });
});
