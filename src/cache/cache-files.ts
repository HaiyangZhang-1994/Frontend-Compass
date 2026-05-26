import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export function getCacheDirectory(projectRoot: string) {
  return path.join(projectRoot, ".frontend-compass", "cache");
}

export function getCacheFilePath(projectRoot: string) {
  return path.join(getCacheDirectory(projectRoot), "analysis.json");
}

export function getFallbackCacheDirectory(
  toolRoot: string,
  targetProjectRoot: string,
) {
  const targetKey = createHash("sha1")
    .update(targetProjectRoot)
    .digest("hex")
    .slice(0, 12);
  return path.join(
    toolRoot,
    ".frontend-compass",
    "targets",
    targetKey,
  );
}

export function getFallbackCacheFilePath(
  toolRoot: string,
  targetProjectRoot: string,
) {
  return path.join(
    getFallbackCacheDirectory(toolRoot, targetProjectRoot),
    "analysis.json",
  );
}

export async function writeCacheFile(
  projectRoot: string,
  contents: object,
  toolRoot = process.cwd(),
) {
  const cacheDirectory = getCacheDirectory(projectRoot);
  const cachePath = getCacheFilePath(projectRoot);

  try {
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(cachePath, JSON.stringify(contents, null, 2), "utf8");
    return cachePath;
  } catch {
    const fallbackDirectory = getFallbackCacheDirectory(toolRoot, projectRoot);
    const fallbackPath = getFallbackCacheFilePath(toolRoot, projectRoot);
    await mkdir(fallbackDirectory, { recursive: true });
    await writeFile(fallbackPath, JSON.stringify(contents, null, 2), "utf8");
    return fallbackPath;
  }
}

export async function readCacheFile<T>(
  projectRoot: string,
  toolRoot = process.cwd(),
): Promise<T | null> {
  const cachePath = getCacheFilePath(projectRoot);

  try {
    const raw = await readFile(cachePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    const fallbackPath = getFallbackCacheFilePath(toolRoot, projectRoot);
    try {
      const raw = await readFile(fallbackPath, "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
