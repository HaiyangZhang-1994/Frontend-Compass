import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PackageJsonLike } from "./framework-detector.js";

export function scoreFrontendPackageJson(packageJson: PackageJsonLike) {
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };

  let score = 0;
  if (dependencies.react) score += 2;
  if (dependencies.next) score += 3;
  if (dependencies.vue) score += 2;
  if (dependencies.nuxt) score += 3;
  if (dependencies.typescript) score += 1;
  return score;
}

export function pickFrontendProjectRoot(
  repoRoot: string,
  candidates: Array<{ directory: string; packageJson: PackageJsonLike }>,
) {
  const scored = candidates
    .map((candidate) => ({
      directory: candidate.directory,
      score: scoreFrontendPackageJson(candidate.packageJson),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.directory.localeCompare(b.directory));

  return scored[0]?.directory ?? repoRoot;
}

export async function resolveFrontendProjectRoot(repoRoot: string) {
  const candidateDirectories = [repoRoot];
  const entries = await readdir(repoRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      candidateDirectories.push(path.join(repoRoot, entry.name));
    }
  }

  const candidates: Array<{ directory: string; packageJson: PackageJsonLike }> = [];

  for (const directory of candidateDirectories) {
    try {
      const raw = await readFile(path.join(directory, "package.json"), "utf8");
      candidates.push({
        directory,
        packageJson: JSON.parse(raw) as PackageJsonLike,
      });
    } catch {
      continue;
    }
  }

  return pickFrontendProjectRoot(repoRoot, candidates);
}
