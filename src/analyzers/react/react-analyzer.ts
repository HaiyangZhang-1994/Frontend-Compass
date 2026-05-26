import path from "node:path";
import { extractReactComponents } from "./extract-components.js";
import { extractReactDataFlow } from "./extract-data-flow.js";
import { extractReactRoutes } from "./extract-routes.js";

function mergeUniqueStrings(...groups: Array<string[] | undefined>) {
  return [...new Set(groups.flatMap((group) => group ?? []))];
}

function resolveLocalImportPath(
  importerFile: string,
  importTarget: string,
  sourceByFile: Record<string, string>,
) {
  if (!importTarget.startsWith(".")) {
    return null;
  }

  const importerDir = path.posix.dirname(importerFile.replace(/\\/g, "/"));
  const base = path.posix.normalize(path.posix.join(importerDir, importTarget));
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`,
  ];

  return candidates.find((candidate) => Object.prototype.hasOwnProperty.call(sourceByFile, candidate)) ?? null;
}

function collectLinkedSources(input: {
  entryFile: string;
  sourceByFile: Record<string, string>;
  maxDepth?: number;
}) {
  const maxDepth = input.maxDepth ?? 2;
  const visited = new Set<string>();
  const queue: Array<{ file: string; depth: number }> = [{ file: input.entryFile, depth: 0 }];
  const linkedSources: Array<{ file: string; source: string }> = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.file)) {
      continue;
    }
    visited.add(current.file);
    const source = input.sourceByFile[current.file] ?? "";
    linkedSources.push({ file: current.file, source });

    if (current.depth >= maxDepth) {
      continue;
    }

    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const importTarget = match[1];
      const resolved = resolveLocalImportPath(current.file, importTarget, input.sourceByFile);
      if (resolved && !visited.has(resolved)) {
        queue.push({ file: resolved, depth: current.depth + 1 });
      }
    }
  }

  return linkedSources;
}

export function analyzeReactProject(input: {
  files: string[];
  sourceByFile: Record<string, string>;
}) {
  const routes = extractReactRoutes(input.files);

  return {
    routes,
    pages: routes.map((route) => {
      const source = input.sourceByFile[route.file] ?? "";
      const linkedSources = collectLinkedSources({
        entryFile: route.file,
        sourceByFile: input.sourceByFile,
        maxDepth: 2,
      });
      const dataFlows = linkedSources.map((entry) => {
        const extracted = extractReactDataFlow(entry.source);
        return {
          ...extracted,
          navigationCalls: extracted.navigationCalls.map((call) => ({
            ...call,
            sourceFile: entry.file,
          })),
        };
      });
      return {
        file: route.file,
        path: route.path,
        components: extractReactComponents(source),
        dataFlow: {
          effects: mergeUniqueStrings(...dataFlows.map((dataFlow) => dataFlow.effects)),
          stateHooks: mergeUniqueStrings(...dataFlows.map((dataFlow) => dataFlow.stateHooks)),
          handlers: mergeUniqueStrings(...dataFlows.map((dataFlow) => dataFlow.handlers)),
          apiCalls: dataFlows.flatMap((dataFlow) => dataFlow.apiCalls),
          navigationCalls: dataFlows.flatMap((dataFlow) => dataFlow.navigationCalls),
        },
      };
    }),
  };
}
