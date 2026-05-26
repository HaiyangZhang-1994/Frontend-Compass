import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PackageJsonLike } from "./framework-detector.js";
import { shouldIncludeFile } from "./file-filter.js";

export type LoadedProjectInput = {
  projectRoot: string;
  packageJson: PackageJsonLike;
  files: string[];
  sourceByFile: Record<string, string>;
};

export function buildLoadedProjectInput(input: LoadedProjectInput): LoadedProjectInput {
  return {
    projectRoot: input.projectRoot,
    packageJson: input.packageJson,
    files: input.files,
    sourceByFile: input.sourceByFile,
  };
}

export async function readProjectPackageJson(projectRoot: string): Promise<PackageJsonLike> {
  const raw = await readFile(path.join(projectRoot, "package.json"), "utf8");
  return JSON.parse(raw) as PackageJsonLike;
}

export async function readSourceFiles(
  projectRoot: string,
  files: string[],
): Promise<Record<string, string>> {
  const sourceByFile: Record<string, string> = {};

  const sourceFiles = files.filter((file) =>
    shouldIncludeFile(file) && /\.(tsx|jsx|ts|js|vue)$/.test(file),
  );

  await Promise.all(
    sourceFiles.map(async (file) => {
      const absolutePath = path.join(projectRoot, file);
      try {
        sourceByFile[file] = await readFile(absolutePath, "utf8");
      } catch {
        sourceByFile[file] = "";
      }
    }),
  );

  return sourceByFile;
}
