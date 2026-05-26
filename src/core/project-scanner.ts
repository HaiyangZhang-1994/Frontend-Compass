import { shouldIncludeFile } from "./file-filter.js";
import {
  type FrameworkDetectionResult,
  type PackageJsonLike,
  detectFramework,
} from "./framework-detector.js";

export type ProjectScanInput = {
  projectRoot: string;
  packageJson: PackageJsonLike;
  files: string[];
};

export type ProjectScanResult = {
  projectRoot: string;
  framework: FrameworkDetectionResult;
  includedFiles: string[];
  entryHints: string[];
};

function detectEntryHints(files: string[], frameworkKind: FrameworkDetectionResult["kind"]) {
  if (frameworkKind === "next") {
    return files.filter((file) => file === "app/page.tsx" || file === "pages/index.tsx");
  }

  if (frameworkKind === "nuxt") {
    return files.filter((file) => file === "pages/index.vue");
  }

  if (frameworkKind === "react") {
    return files.filter((file) => file === "src/main.tsx" || file === "src/App.tsx");
  }

  if (frameworkKind === "vue") {
    return files.filter((file) => file === "src/main.ts" || file === "src/App.vue");
  }

  return [];
}

export function buildProjectScanResult(
  input: ProjectScanInput,
): ProjectScanResult {
  const includedFiles = input.files.filter(shouldIncludeFile);
  const framework = detectFramework({
    packageJson: input.packageJson,
    files: includedFiles,
  });

  return {
    projectRoot: input.projectRoot,
    framework,
    includedFiles,
    entryHints: detectEntryHints(includedFiles, framework.kind),
  };
}
