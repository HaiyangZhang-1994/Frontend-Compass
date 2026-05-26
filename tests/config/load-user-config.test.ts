import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  getUserConfigPath,
  loadUserConfig,
  mergeUserConfigWithDefaults,
} from "../../src/config/load-user-config.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("mergeUserConfigWithDefaults", () => {
  it("fills default values while preserving provider configuration", () => {
    const merged = mergeUserConfigWithDefaults({
      provider: {
        baseURL: "https://example.com/v1",
        apiKey: "demo-key",
        model: "demo-model",
      },
    });

    expect(merged.provider!.baseURL).toBe("https://example.com/v1");
    expect(merged.provider!.model).toBe("demo-model");
    expect(merged.cacheDir).toBe(".frontend-compass/cache");
  });
});

describe("getUserConfigPath", () => {
  it("always resolves the config file inside the Frontend Compass tool directory", () => {
    const configPath = getUserConfigPath("C:\\Users\\Haiyang\\Desktop\\frontend-compass");
    expect(configPath).toBe(
      "C:\\Users\\Haiyang\\Desktop\\frontend-compass\\frontend-compass.config.json",
    );
  });
});

describe("loadUserConfig", () => {
  it("reads provider configuration even when the json file starts with a utf-8 bom", async () => {
    const toolRoot = await mkdtemp(path.join(os.tmpdir(), "frontend-compass-"));
    tempDirs.push(toolRoot);
    await writeFile(
      path.join(toolRoot, "frontend-compass.config.json"),
      "\uFEFF" + JSON.stringify({
        provider: {
          baseURL: "https://api.deepseek.com",
          apiKey: "demo-key",
          model: "deepseek-v4-pro",
        },
      }),
      "utf8",
    );

    const config = await loadUserConfig(toolRoot);

    expect(config.provider).toEqual({
      baseURL: "https://api.deepseek.com",
      apiKey: "demo-key",
      model: "deepseek-v4-pro",
    });
  });
});
