export type SupportedFrameworkKind =
  | "react"
  | "next"
  | "vue"
  | "nuxt"
  | "unknown";

export type PackageJsonLike = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type FrameworkDetectionInput = {
  packageJson: PackageJsonLike;
  files: string[];
};

export type FrameworkDetectionResult = {
  kind: SupportedFrameworkKind;
};

function getAllDependencies(packageJson: PackageJsonLike) {
  return {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };
}

export function detectFramework(
  input: FrameworkDetectionInput,
): FrameworkDetectionResult {
  const dependencies = getAllDependencies(input.packageJson);

  if (dependencies.next || input.files.some((file) => file.startsWith("app/"))) {
    return { kind: "next" };
  }

  if (
    dependencies.nuxt ||
    input.files.some((file) => file.startsWith("pages/") && file.endsWith(".vue"))
  ) {
    return { kind: "nuxt" };
  }

  if (dependencies.vue || input.files.some((file) => file.endsWith(".vue"))) {
    return { kind: "vue" };
  }

  if (
    dependencies.react ||
    input.files.some((file) => file.endsWith(".tsx") || file.endsWith(".jsx"))
  ) {
    return { kind: "react" };
  }

  return { kind: "unknown" };
}
