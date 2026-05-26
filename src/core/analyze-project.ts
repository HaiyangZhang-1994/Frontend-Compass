import { analyzeReactProject } from "../analyzers/react/react-analyzer.js";
import { createEmptyAnalysis } from "../analyzers/shared/normalize.js";
import type {
  AnalysisNavigationEdge,
  AnalysisPage,
  AnalysisSnapshot,
  SupportedFramework,
} from "../analyzers/shared/types.js";
import { analyzeVueProject } from "../analyzers/vue/vue-analyzer.js";
import type { PackageJsonLike } from "./framework-detector.js";
import { buildProjectScanResult } from "./project-scanner.js";

export type AnalyzeProjectInput = {
  projectRoot: string;
  packageJson: PackageJsonLike;
  files: string[];
  sourceByFile: Record<string, string>;
};

function routePathToRegex(routePath: string) {
  const escaped = routePath
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\[\\.\\.\\.([^\]]+)\\\]/g, "(.+)")
    .replace(/\\\[\\\[\\.\\.\\.([^\]]+)\\\]\\\]/g, "(.*)")
    .replace(/\\\[([^\]]+)\\\]/g, "([^/]+)");
  return new RegExp(`^${escaped}$`);
}

function resolveNavigationTargetToRoute(
  rawTarget: string,
  routePaths: string[],
) {
  const withoutQuery = rawTarget.split("?")[0]?.split("#")[0] ?? rawTarget;
  const normalized =
    withoutQuery.length > 1 && withoutQuery.endsWith("/")
      ? withoutQuery.slice(0, -1)
      : withoutQuery;

  if (routePaths.includes(normalized)) {
    return normalized;
  }

  const templateReplaced = normalized.replace(/\$\{[^}]+\}/g, "x");
  for (const routePath of routePaths) {
    if (routePathToRegex(routePath).test(templateReplaced)) {
      return routePath;
    }
  }

  return null;
}

function normalizePages(
  framework: SupportedFramework,
  pages: AnalysisPage[],
): AnalysisSnapshot {
  const normalizePath = (value: string) =>
    value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
  const snapshot = createEmptyAnalysis(framework);
  snapshot.pages = pages;
  snapshot.routes = pages.map((page) => ({
    file: page.file,
    path: normalizePath(page.path),
  }));
  snapshot.components = [
    ...new Set(
      pages.flatMap((page) => [
        ...(page.components.componentNames ?? []),
        ...page.components.childComponents,
      ]),
    ),
  ];
  snapshot.apiCalls = pages.flatMap((page) =>
    page.dataFlow.apiCalls.map((apiCall) => ({
      target: apiCall.target,
      file: page.file,
      path: page.path,
    })),
  );
  snapshot.stateUnits = [
    ...new Set(
      pages.flatMap((page) => [
        ...(page.dataFlow.stateHooks ?? []),
        ...(page.dataFlow.stateSignals ?? []),
      ]),
    ),
  ];
  const routePathList = snapshot.routes.map((route) => normalizePath(route.path));
  const routePaths = new Set(routePathList);
  snapshot.navigationEdges = pages.flatMap((page) => {
    const calls = page.dataFlow.navigationCalls ?? [];
    const dedup = new Set<string>();
    const edges: AnalysisNavigationEdge[] = [];
    for (const call of calls) {
      const resolvedToPath = resolveNavigationTargetToRoute(call.to, routePathList);
      if (!resolvedToPath) {
        continue;
      }
      const toPath = normalizePath(resolvedToPath);
      const fromPath = normalizePath(page.path);
      if (!routePaths.has(toPath)) {
        continue;
      }
      const key = `${fromPath}|${toPath}|${call.type}|${call.evidence}`;
      if (dedup.has(key)) {
        continue;
      }
      dedup.add(key);
      edges.push({
        from: fromPath,
        to: toPath,
        type: call.type,
        evidence: call.evidence,
        sourceFile: call.sourceFile ?? page.file,
        line: call.line,
      });
    }
    return edges;
  });
  return snapshot;
}

export function analyzeProject(input: AnalyzeProjectInput): AnalysisSnapshot {
  const scan = buildProjectScanResult({
    projectRoot: input.projectRoot,
    packageJson: input.packageJson,
    files: input.files,
  });

  if (scan.framework.kind === "react" || scan.framework.kind === "next") {
    const reactResult = analyzeReactProject({
      files: scan.includedFiles,
      sourceByFile: input.sourceByFile,
    });

    return normalizePages(scan.framework.kind, reactResult.pages);
  }

  if (scan.framework.kind === "vue" || scan.framework.kind === "nuxt") {
    const vueResult = analyzeVueProject({
      files: scan.includedFiles,
      sourceByFile: input.sourceByFile,
    });

    return normalizePages(scan.framework.kind, vueResult.pages);
  }

  return {
    ...createEmptyAnalysis("react"),
    unsupportedReason: "No supported frontend framework detected. Frontend Compass V1 currently expects React/Next.js or Vue/Nuxt projects.",
  };
}
