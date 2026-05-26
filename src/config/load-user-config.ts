import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { ProviderConfigInput } from "../semantic/provider-client.js";

export type FrontendCompassUserConfig = {
  provider?: ProviderConfigInput;
  cacheDir?: string;
};

export type FrontendCompassResolvedConfig = {
  provider?: ProviderConfigInput;
  cacheDir: string;
};

export function getUserConfigPath(toolRoot: string) {
  return path.join(toolRoot, "frontend-compass.config.json");
}

export async function userConfigExists(toolRoot: string) {
  try {
    await access(getUserConfigPath(toolRoot));
    return true;
  } catch {
    return false;
  }
}

export function mergeUserConfigWithDefaults(
  config: FrontendCompassUserConfig,
): FrontendCompassResolvedConfig {
  return {
    provider: config.provider,
    cacheDir: config.cacheDir ?? ".frontend-compass/cache",
  };
}

export async function loadUserConfig(toolRoot: string) {
  const configPath = getUserConfigPath(toolRoot);

  try {
    const raw = await readFile(configPath, "utf8");
    const normalized = raw.replace(/^\uFEFF/, "");
    return mergeUserConfigWithDefaults(
      JSON.parse(normalized) as FrontendCompassUserConfig,
    );
  } catch {
    return mergeUserConfigWithDefaults({});
  }
}
