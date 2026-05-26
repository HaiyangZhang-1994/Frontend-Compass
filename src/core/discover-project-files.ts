import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

const SKIPPED_DIRECTORY_NAMES = new Set([
  "node_modules",
  ".next",
  ".nuxt",
  "dist",
  "build",
  "coverage",
  ".git",
  ".frontend-compass",
]);

export function toRelativeProjectPath(projectRoot: string, absolutePath: string) {
  return path.relative(projectRoot, absolutePath).replace(/\\/g, "/");
}

export function shouldSkipDirectoryName(directoryName: string) {
  return SKIPPED_DIRECTORY_NAMES.has(directoryName);
}

export async function discoverProjectFiles(projectRoot: string): Promise<string[]> {
  const absoluteFiles: string[] = [];
  const isSkippableFsError = (error: unknown) =>
    Boolean(
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code &&
      ["EPERM", "EACCES", "ENOENT"].includes(String((error as { code?: string }).code)),
    );

  async function walk(currentDir: string): Promise<void> {
    let entries: Dirent[] = [];
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      if (isSkippableFsError(error)) {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDirectoryName(entry.name)) {
          continue;
        }
        try {
          await walk(absolutePath);
        } catch (error) {
          if (isSkippableFsError(error)) {
            continue;
          }
          throw error;
        }
        continue;
      }

      absoluteFiles.push(absolutePath);
    }
  }

  await walk(projectRoot);

  return absoluteFiles
    .map((absolutePath) => toRelativeProjectPath(projectRoot, absolutePath))
    .sort((a, b) => a.localeCompare(b));
}
