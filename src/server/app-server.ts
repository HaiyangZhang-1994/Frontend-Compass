import express from "express";
import { execFile } from "node:child_process";
import path from "node:path";
import type { AnalysisSnapshot } from "../analyzers/shared/types.js";
import { analyzeProject } from "../core/analyze-project.js";
import { createCacheEnvelope } from "../cache/cache-store.js";
import { readCacheFile, writeCacheFile } from "../cache/cache-files.js";
import type { LoadedProjectInput } from "../core/load-project-input.js";
import { buildLoadedProjectInput, readProjectPackageJson, readSourceFiles } from "../core/load-project-input.js";
import { discoverProjectFiles } from "../core/discover-project-files.js";
import { resolveAnalysisSnapshot } from "../core/resolve-analysis-snapshot.js";
import type { FrontendCompassResolvedConfig } from "../config/load-user-config.js";
import { buildApiPayload } from "./api-payload.js";
import { buildComponentsPayload } from "./components-payload.js";
import {
  buildEnhancedOverviewPayload,
  buildOverviewPayload,
} from "./overview-payload.js";
import { buildRoutesPayload } from "./routes-payload.js";
import { buildStatePayload } from "./state-payload.js";
import { buildStatusPayload } from "./status-payload.js";
import { buildRefreshPayload } from "./refresh-payload.js";
import { buildPageGraphPayload } from "./page-graph-payload.js";
import { buildPageDetailsPayload } from "./page-details-payload.js";

function toLineFromSnippet(source: string, snippet?: string) {
  if (!snippet) {
    return 1;
  }
  const normalizedSnippet = snippet.replace(/\r\n/g, "\n").trim();
  if (!normalizedSnippet) {
    return 1;
  }
  const normalizedSource = source.replace(/\r\n/g, "\n");
  const index = normalizedSource.indexOf(normalizedSnippet);
  if (index < 0) {
    return 1;
  }
  return normalizedSource.slice(0, index).split("\n").length;
}

function findBestFileBySnippet(
  sourceByFile: Record<string, string>,
  snippet?: string,
): { file: string; line: number } | null {
  if (!snippet) {
    return null;
  }
  const normalizedSnippet = snippet.replace(/\r\n/g, "\n").trim();
  if (!normalizedSnippet) {
    return null;
  }

  const candidates: Array<{ file: string; line: number; index: number }> = [];
  for (const [file, source] of Object.entries(sourceByFile)) {
    const normalizedSource = source.replace(/\r\n/g, "\n");
    const index = normalizedSource.indexOf(normalizedSnippet);
    if (index < 0) {
      continue;
    }
    const line = normalizedSource.slice(0, index).split("\n").length;
    candidates.push({ file, line, index });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => a.index - b.index || a.file.length - b.file.length);
  return { file: candidates[0].file, line: candidates[0].line };
}

function findBestFileByLooseSnippet(
  sourceByFile: Record<string, string>,
  snippet?: string,
): { file: string; line: number; score: number } | null {
  if (!snippet) {
    return null;
  }
  const normalized = snippet.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return null;
  }

  const tokens = (normalized.match(/[A-Za-z0-9_/$.]+/g) ?? [])
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 3);
  if (tokens.length === 0) {
    return null;
  }

  let best: { file: string; line: number; score: number } | null = null;
  for (const [file, source] of Object.entries(sourceByFile)) {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const lineLower = line.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (lineLower.includes(token)) {
          score += token.length >= 8 ? 2 : 1;
        }
      }
      if (score > 0 && (lineLower.includes("router.push") || lineLower.includes("router.replace") || lineLower.includes("navigate(") || lineLower.includes("redirect("))) {
        score += 2;
      }
      if (score >= 3 && (!best || score > best.score)) {
        best = { file, line: index + 1, score };
      }
    }
  }
  return best;
}

function parseImportedBindings(clause: string): string[] {
  const value = clause.trim();
  const names: string[] = [];
  if (!value) {
    return names;
  }

  const pushName = (raw: string) => {
    const cleaned = raw.trim();
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(cleaned)) {
      names.push(cleaned);
    }
  };

  const namedBlockMatch = value.match(/\{([^}]+)\}/);
  if (namedBlockMatch) {
    for (const part of namedBlockMatch[1].split(",")) {
      const token = part.trim();
      if (!token) {
        continue;
      }
      const aliasMatch = token.match(/\bas\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
      if (aliasMatch?.[1]) {
        pushName(aliasMatch[1]);
        continue;
      }
      const direct = token.split(/\s+/)[0] ?? "";
      pushName(direct);
    }
  }

  const withoutNamed = value.replace(/\{[^}]+\}/g, "").trim();
  const defaultPart = withoutNamed.split(",")[0]?.trim() ?? "";
  if (defaultPart && !defaultPart.startsWith("*")) {
    pushName(defaultPart);
  }

  const namespaceMatch = value.match(/\*\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)/);
  if (namespaceMatch?.[1]) {
    pushName(namespaceMatch[1]);
  }

  return [...new Set(names)];
}

function resolveImportSpecifierToFile(
  importerFile: string,
  specifier: string,
  sourceByFile: Record<string, string>,
): string | null {
  const normalizedSpecifier = specifier.replace(/\\/g, "/");
  let basePath: string | null = null;
  if (normalizedSpecifier.startsWith("./") || normalizedSpecifier.startsWith("../")) {
    const importerDir = path.posix.dirname(importerFile.replace(/\\/g, "/"));
    basePath = path.posix.normalize(path.posix.join(importerDir, normalizedSpecifier));
  } else if (normalizedSpecifier.startsWith("@/")) {
    basePath = normalizedSpecifier.slice(2);
  } else {
    return null;
  }

  const candidates = [
    basePath,
    `${basePath}.tsx`,
    `${basePath}.ts`,
    `${basePath}.jsx`,
    `${basePath}.js`,
    `${basePath}/index.tsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.jsx`,
    `${basePath}/index.js`,
  ];

  for (const candidate of candidates) {
    if (sourceByFile[candidate]) {
      return candidate;
    }
  }
  return null;
}

function buildImportedSymbolFileMap(
  importerFile: string,
  sourceByFile: Record<string, string>,
): Record<string, string> {
  const source = sourceByFile[importerFile];
  if (!source) {
    return {};
  }

  const map: Record<string, string> = {};
  const importRegex = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importRegex)) {
    const clause = String(match[1] ?? "").trim();
    const specifier = String(match[2] ?? "").trim();
    if (!clause || !specifier) {
      continue;
    }
    const resolvedFile = resolveImportSpecifierToFile(importerFile, specifier, sourceByFile);
    if (!resolvedFile) {
      continue;
    }
    const names = parseImportedBindings(clause);
    for (const name of names) {
      if (!map[name]) {
        map[name] = resolvedFile;
      }
    }
  }
  return map;
}

type ImportedBinding = {
  name: string;
  sourceFile: string;
};

type ComponentTreeItem = {
  id: string;
  label: string;
  code: string;
  sourceFile: string;
  line?: number;
  kind: "component" | "handler";
  children?: ComponentTreeItem[];
};

function resolveImportedBindings(
  importerFile: string,
  sourceByFile: Record<string, string>,
): ImportedBinding[] {
  const source = sourceByFile[importerFile];
  if (!source) {
    return [];
  }
  const result: ImportedBinding[] = [];
  const importRegex = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importRegex)) {
    const clause = String(match[1] ?? "").trim();
    const specifier = String(match[2] ?? "").trim();
    if (!clause || !specifier) {
      continue;
    }
    const resolvedFile = resolveImportSpecifierToFile(importerFile, specifier, sourceByFile);
    if (!resolvedFile) {
      continue;
    }
    const names = parseImportedBindings(clause);
    for (const name of names) {
      result.push({ name, sourceFile: resolvedFile });
    }
  }
  return result;
}

function extractUsedJsxComponentNames(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)) {
    const name = match[1];
    if (name) {
      names.add(name);
    }
  }
  return names;
}

function findFirstLineOfSymbol(source: string, symbol: string): number {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`\\bfunction\\s+${escaped}\\b`),
    new RegExp(`\\bconst\\s+${escaped}\\b`),
    new RegExp(`\\blet\\s+${escaped}\\b`),
    new RegExp(`\\bvar\\s+${escaped}\\b`),
    new RegExp(`\\bclass\\s+${escaped}\\b`),
  ];
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (patterns.some((pattern) => pattern.test(line))) {
      return index + 1;
    }
  }
  return 1;
}

function extractHandlersWithLine(source: string): Array<{ name: string; line: number }> {
  const matches = source.matchAll(/(?:const|function)\s+([A-Za-z0-9_]+)\s*=?\s*(?:\(|async\s*\()/g);
  const handlers: Array<{ name: string; line: number }> = [];
  for (const match of matches) {
    const name = match[1];
    if (!name) {
      continue;
    }
    const index = match.index ?? 0;
    const line = source.slice(0, Math.max(index, 0)).split("\n").length;
    handlers.push({ name, line });
  }
  return handlers;
}

function extractFunctionCandidates(source: string): Array<{ name: string; line: number; snippet: string }> {
  const normalized = source.replace(/\r\n/g, "\n");
  const candidates: Array<{ name: string; line: number; snippet: string }> = [];
  const push = (name: string, index: number) => {
    const line = normalized.slice(0, Math.max(index, 0)).split("\n").length;
    const snippet = extractSnippetAroundLine(normalized, line, 10);
    candidates.push({ name, line, snippet });
  };

  for (const match of normalized.matchAll(/(?:const|let|var|function)\s+([A-Za-z0-9_]+)\s*=?\s*(?:\(|async\s*\(|<)/g)) {
    const name = match[1];
    if (!name) {
      continue;
    }
    push(name, match.index ?? 0);
  }

  for (const match of normalized.matchAll(/\b(useEffect|useMemo|useCallback)\s*\(\s*(?:async\s*)?\(/g)) {
    const hook = match[1];
    if (!hook) {
      continue;
    }
    const line = normalized.slice(0, Math.max(match.index ?? 0, 0)).split("\n").length;
    push(`${hook}@${line}`, match.index ?? 0);
  }

  for (const match of normalized.matchAll(/\bon([A-Z][A-Za-z0-9_]*)\s*=\s*\{\s*(?:async\s*)?\([^)]*\)\s*=>/g)) {
    const eventName = match[1];
    if (!eventName) {
      continue;
    }
    const line = normalized.slice(0, Math.max(match.index ?? 0, 0)).split("\n").length;
    push(`inline${eventName}@${line}`, match.index ?? 0);
  }

  const dedup = new Set<string>();
  return candidates.filter((item) => {
    const key = `${item.name}:${item.line}`;
    if (dedup.has(key)) {
      return false;
    }
    dedup.add(key);
    return true;
  });
}

function extractSnippetAroundLine(source: string, line: number, radius = 6) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const start = Math.max(0, line - 1);
  const end = Math.min(lines.length, start + radius);
  return lines.slice(start, end).join("\n").trim();
}

function buildComponentTreeForPage(
  pageFile: string,
  sourceByFile: Record<string, string>,
): ComponentTreeItem[] {
  const visitedOnPath = new Set<string>();
  const cache = new Map<string, ComponentTreeItem>();

  const buildNodeFromBinding = (binding: ImportedBinding, depth: number): ComponentTreeItem | null => {
    if (depth > 6) {
      return null;
    }
    const targetFile = binding.sourceFile;
    const source = sourceByFile[targetFile];
    if (!source) {
      return null;
    }
    const cacheKey = `${binding.name}@@${targetFile}`;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const line = findFirstLineOfSymbol(source, binding.name);
    const node: ComponentTreeItem = {
      id: `component:${cacheKey}`,
      label: `${binding.name} (${path.posix.basename(targetFile)})`,
      code: binding.name,
      sourceFile: targetFile,
      line,
      kind: "component",
      children: [],
    };
    cache.set(cacheKey, node);

    if (visitedOnPath.has(cacheKey)) {
      return node;
    }
    visitedOnPath.add(cacheKey);

    const usedNames = extractUsedJsxComponentNames(source);
    const importedBindings = resolveImportedBindings(targetFile, sourceByFile);
    const childComponents = importedBindings
      .filter((item) => usedNames.has(item.name))
      .map((item) => buildNodeFromBinding(item, depth + 1))
      .filter((item): item is ComponentTreeItem => Boolean(item));

    const handlerNodes = extractHandlersWithLine(source).map((handler) => ({
      id: `handler:${targetFile}:${handler.name}:${handler.line}`,
      label: `# ${handler.name}()`,
      code: handler.name,
      sourceFile: targetFile,
      line: handler.line,
      kind: "handler" as const,
      children: [],
    }));

    node.children = [...handlerNodes, ...childComponents];
    visitedOnPath.delete(cacheKey);
    return node;
  };

  const pageSource = sourceByFile[pageFile] ?? "";
  const pageUsedNames = extractUsedJsxComponentNames(pageSource);
  const pageImportedBindings = resolveImportedBindings(pageFile, sourceByFile);
  const rootComponents = pageImportedBindings
    .filter((binding) => pageUsedNames.has(binding.name))
    .map((binding) => buildNodeFromBinding(binding, 1))
    .filter((item): item is ComponentTreeItem => Boolean(item));

  const pageHandlers = extractHandlersWithLine(pageSource).map((handler) => ({
    id: `handler:${pageFile}:${handler.name}:${handler.line}`,
    label: `# ${handler.name}()`,
    code: handler.name,
    sourceFile: pageFile,
    line: handler.line,
    kind: "handler" as const,
    children: [],
  }));

  return [...pageHandlers, ...rootComponents];
}

function buildEditorUri(editor: string, filePath: string, line: number) {
  const normalized = filePath.replace(/\\/g, "/");
  if (editor === "cursor") {
    return `cursor://file/${encodeURI(normalized)}:${line}:1`;
  }
  return `vscode://file/${encodeURI(normalized)}:${line}:1`;
}

async function openInEditor(filePath: string, line: number, editor: string) {
  const gotoTarget = `${filePath}:${line}:1`;
  const normalizedEditor = (editor || "vscode").toLowerCase();
  const cliCommand =
    normalizedEditor === "cursor" ? "cursor" : "code";

  const run = (command: string, args: string[]) =>
    new Promise<boolean>((resolve) => {
      execFile(command, args, { windowsHide: true }, (error) => {
        resolve(!error);
      });
    });

  if (process.platform === "win32") {
    const ok = await run("cmd", ["/c", cliCommand, "-g", gotoTarget]);
    if (ok) {
      return;
    }
    const uri = buildEditorUri(normalizedEditor, filePath, line);
    await run("cmd", ["/c", "start", "", uri]);
    return;
  }

  const ok = await run(cliCommand, ["-g", gotoTarget]);
  if (ok) {
    return;
  }
  const uri = buildEditorUri(normalizedEditor, filePath, line);
  if (process.platform === "darwin") {
    await run("open", [uri]);
    return;
  }
  await run("xdg-open", [uri]);
}

export function buildMetaPayload(input: {
  projectRoot: string;
  cacheStatus: "hit" | "miss";
  providerConfigured: boolean;
  configPath?: string;
  configExists?: boolean;
  analysisStarted?: boolean;
  analysisInProgress?: boolean;
  analysisGranularity?: "local" | "file";
}) {
  return {
    product: "Frontend Compass",
    projectRoot: input.projectRoot,
    surfaces: getMvpSurfaceList(),
    cacheStatus: input.cacheStatus,
    providerConfigured: input.providerConfigured,
    configPath: input.configPath,
    configExists: input.configExists ?? false,
    analysisStarted: input.analysisStarted ?? false,
    analysisInProgress: input.analysisInProgress ?? false,
    analysisGranularity: input.analysisGranularity ?? "local",
  };
}

export function getMvpSurfaceList() {
  return [
    "overview",
    "routes",
    "components",
    "api",
    "state",
    "reading-guide",
    "ask",
  ];
}

const SURFACE_LABELS: Record<string, string> = {
  overview: "Overview",
  routes: "Routes / Views",
  components: "Components",
  api: "Data / API",
  state: "State",
  "reading-guide": "Reading Guide",
  ask: "Ask",
};

export function buildAppShellHtml(input: { projectRoot: string }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Frontend Compass</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.20.1/cdn/themes/light.css" />
    <script type="module" src="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.20.1/cdn/shoelace-autoloader.js"></script>
    <style>
      :root {
        color-scheme: light;
        font-family: "Manrope", "Segoe UI", Arial, sans-serif;
        --bg: #eef3ef;
        --panel: #fdfefc;
        --ink: #183126;
        --muted: #4e655a;
        --accent: #1f8a5b;
        --line: #cad9d0;
        --accent-soft: #e7f5ee;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background:
          radial-gradient(circle at 10% -10%, #dff2e7 0%, transparent 38%),
          radial-gradient(circle at 90% 0%, #e4efe8 0%, transparent 35%),
          linear-gradient(180deg, #f3f8f4 0%, #edf2ef 100%);
        color: var(--ink);
      }
      button {
        font: inherit;
      }
      .shell {
        min-height: 100vh;
        display: block;
      }
      .content {
        padding: 28px 28px 24px;
      }
      .hero {
        background: linear-gradient(135deg, rgba(31, 138, 91, 0.11), rgba(27, 102, 75, 0.06));
        border: 1px solid rgba(31, 138, 91, 0.22);
        border-radius: 16px;
        padding: 18px 20px;
        margin-bottom: 14px;
      }
      .hero h1 {
        margin: 0 0 6px;
        font-size: 30px;
        letter-spacing: -0.02em;
      }
      .hero p {
        margin: 0;
        max-width: 760px;
      }
      h2, h3 {
        margin-top: 0;
      }
      p {
        color: var(--muted);
        line-height: 1.6;
      }
      ul {
        padding-left: 18px;
        color: var(--muted);
      }
      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        border-radius: 999px;
        background: #e9f6ef;
        border: 1px solid #bcdac9;
        color: #1f5b3e;
        margin-top: 2px;
        font-size: 14px;
      }
      .meta-bar {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: stretch;
      }
      .meta-row {
        margin-top: 12px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      .meta-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 12px;
        border-radius: 10px;
        border: 1px solid #c7d7ce;
        background: #f7fbf8;
        color: #2a5944;
        font-size: 13px;
        font-weight: 600;
        min-height: 38px;
      }
      .meta-select {
        border: 1px solid #c7d7ce;
        border-radius: 8px;
        background: #f7fbf8;
        color: #2a5944;
        font-size: 13px;
        padding: 7px 12px;
        min-width: 130px;
      }
      .editor-control {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid #c7d7ce;
        background: #f7fbf8;
      }
      .editor-control-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #496658;
        font-weight: 700;
      }
      .status-pill.unsupported {
        background: #fff4e8;
        border-color: #edd1a9;
        color: #8a5a20;
      }
      .actions {
        display: flex;
        gap: 12px;
        margin-top: 12px;
        align-items: end;
        flex-wrap: wrap;
      }
      .analysis-control {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .analysis-control-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #496658;
        font-weight: 700;
      }
      .ai-summary {
        margin-top: 12px;
        border: 1px solid #c7d7ce;
        background: #f7fbf8;
        border-radius: 12px;
        padding: 12px 14px;
      }
      .ai-summary[hidden] {
        display: none;
      }
      .ai-summary-title {
        margin: 0 0 6px;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #2a5b44;
        font-weight: 700;
      }
      .ai-summary-headline {
        margin: 0 0 4px;
        font-size: 15px;
        color: #173c2c;
        font-weight: 700;
      }
      .ai-summary-description {
        margin: 0;
        font-size: 13px;
        color: #3d5d4f;
      }
      .ai-summary-list {
        margin: 8px 0 0;
        padding-left: 18px;
        color: #335645;
        font-size: 13px;
      }
      .action-button {
        border: 1px solid #1d7f55;
        background: linear-gradient(180deg, #2aa36f 0%, #208d60 100%);
        color: #f8fffb;
        border-radius: 11px;
        padding: 10px 16px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 8px 18px rgba(32, 141, 96, 0.24);
        transition: transform 140ms ease, box-shadow 180ms ease, filter 180ms ease;
      }
      .action-button:hover {
        transform: translateY(-1px);
        filter: brightness(1.03);
        box-shadow: 0 12px 20px rgba(32, 141, 96, 0.28);
      }
      .action-button:disabled {
        opacity: 0.75;
        cursor: wait;
        transform: none;
      }
      .page-graph-layout {
        margin-top: 24px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 14px;
        align-items: start;
        height: calc(100vh - 220px);
        min-height: 620px;
      }
      .graph-panel {
        background: var(--panel);
        border: 1px solid #cbdad1;
        border-radius: 18px;
        padding: 18px;
        box-shadow: 0 8px 26px rgba(44, 83, 64, 0.08);
        height: 100%;
      }
      .graph-panel-main {
        display: flex;
        flex-direction: column;
      }
      #graph-canvas {
        width: 100%;
        flex: 1;
        height: auto;
        min-height: 420px;
        border: 1px solid #cfd8d1;
        border-radius: 14px;
        background:
          radial-gradient(circle at 1px 1px, #e4ece7 1px, transparent 0) 0 0/20px 20px,
          linear-gradient(180deg, #fdfcf8 0%, #f7fbf8 100%);
      }
      .graph-list {
        margin: 10px 0 0;
      }
      .side-panel {
        position: sticky;
        top: 18px;
        height: 100%;
      }
      .side-panel .graph-panel {
        display: flex;
        flex-direction: column;
      }
      #page-detail-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1;
        min-height: 0;
      }
      .detail-headline {
        margin: 0 0 8px;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #527060;
      }
      .detail-main {
        margin: 0 0 10px;
        font-size: 22px;
        line-height: 1.2;
        color: #1f3c2e;
      }
      .detail-sub {
        margin: 0;
        font-size: 13px;
        color: #5f7167;
        word-break: break-all;
      }
      .detail-section {
        border: 1px solid #d7dfda;
        border-radius: 12px;
        background: #fbfdfb;
        padding: 10px;
        max-height: 180px;
        overflow: auto;
      }
      .detail-section.component-tree-section {
        flex: 1;
        max-height: none;
        min-height: 300px;
      }
      .detail-section-title {
        margin: 0 0 8px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #355647;
      }
      .detail-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .detail-chip {
        border: 1px solid #d1ddd6;
        border-radius: 999px;
        background: #f0f8f3;
        color: #294d3d;
        padding: 4px 8px;
        font-size: 12px;
      }
      .detail-code-list {
        margin: 0;
        padding-left: 18px;
      }
      .detail-code-item {
        margin-bottom: 6px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 12px;
        color: #1e4636;
      }
      .detail-open-btn {
        border: 1px solid #cfe0d7;
        background: #f4fbf7;
        border-radius: 8px;
        color: #1e4636;
        cursor: pointer;
        font: inherit;
        padding: 6px 8px;
        text-align: left;
        width: 100%;
      }
      .detail-open-btn:hover {
        background: #eaf7f0;
      }
      .component-tree {
        --indent-guide-width: 1px;
        --indent-guide-color: #c8d9cf;
        border: 1px solid #d7e5dd;
        background: #fbfefc;
        border-radius: 10px;
        padding: 8px 10px;
      }
      .component-tree-item-btn {
        border: 0;
        background: transparent;
        color: #1e4636;
        font: inherit;
        font-size: 13px;
        line-height: 1.4;
        text-align: left;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 6px;
      }
      .component-tree-item-btn:hover {
        background: #eaf7f0;
      }
      .component-kind-handler {
        color: #4f6c5f;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
        font-size: 12px;
      }
      .function-summary-list {
        display: grid;
        gap: 8px;
      }
      .function-summary-item {
        border: 1px solid #cfe0d7;
        border-radius: 10px;
        background: #f6fbf8;
        padding: 8px;
      }
      .function-summary-title {
        margin: 0 0 4px;
        font-size: 12px;
        font-weight: 700;
        color: #1e4636;
      }
      .function-summary-text {
        margin: 0;
        font-size: 12px;
        color: #355647;
        line-height: 1.5;
      }
      .graph-toolbar {
        display: flex;
        gap: 8px;
        margin: 10px 0 12px;
      }
      .graph-button {
        border: 1px solid #c7d7cd;
        background: #f6fbf7;
        border-radius: 10px;
        color: #2a5e42;
        cursor: pointer;
        padding: 6px 10px;
      }
      .graph-button:hover {
        background: #edf6ef;
      }
      .edge-summary {
        margin-top: 8px;
        font-size: 13px;
        color: #4f6558;
      }
      .edge-tooltip {
        position: absolute;
        display: none;
        max-width: 360px;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid #c8d8ce;
        background: #ffffff;
        color: #2a5b41;
        font-size: 12px;
        box-shadow: 0 8px 24px rgba(42, 91, 65, 0.18);
        z-index: 20;
        pointer-events: none;
      }
      .loading-overlay {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(237, 245, 240, 0.72);
        backdrop-filter: blur(4px);
        z-index: 200;
      }
      .loading-overlay.is-visible {
        display: flex;
      }
      .loading-card {
        min-width: 260px;
        background: #ffffff;
        border: 1px solid #c7d7ce;
        border-radius: 14px;
        padding: 16px 18px;
        box-shadow: 0 18px 36px rgba(35, 79, 57, 0.16);
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .loading-spinner {
        width: 20px;
        height: 20px;
        border-radius: 999px;
        border: 2px solid #c8e4d4;
        border-top-color: #208d60;
        animation: spin 900ms linear infinite;
        flex-shrink: 0;
      }
      .loading-text {
        font-size: 14px;
        color: #2c5c45;
        font-weight: 600;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .node-button {
        border: 1px solid var(--line);
        background: #f7f4ec;
        border-radius: 10px;
        color: var(--ink);
        cursor: pointer;
        padding: 4px 8px;
      }
      .node-button.is-active {
        background: var(--accent-soft);
        border-color: #c7ddcd;
      }
      @media (max-width: 1080px) {
        .page-graph-layout {
          grid-template-columns: 1fr;
          height: auto;
          min-height: 0;
        }
        .side-panel { position: static; }
        #graph-canvas {
          height: 460px;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <main class="content">
        <section class="hero">
          <h1>Frontend Compass</h1>
          <p>Visualize page routes, inspect component-level behavior, and jump directly to code in your IDE for faster project onboarding.</p>
        </section>
        <div class="meta-bar">
          <span id="meta-framework" class="meta-chip">Framework: -</span>
          <span id="meta-cache" class="meta-chip">Cache: -</span>
          <div class="editor-control">
            <label class="editor-control-label" for="editor-select">Editor</label>
            <select id="editor-select" class="meta-select">
              <option value="vscode">VS Code</option>
              <option value="cursor">Cursor</option>
            </select>
          </div>
        </div>
        <div class="actions">
          <div class="analysis-control">
            <label class="analysis-control-label" for="analysis-granularity">Analysis Granularity</label>
            <select id="analysis-granularity" class="meta-select">
              <option value="local">Local Only (No AI)</option>
              <option value="file">File Level (Layered AI)</option>
            </select>
          </div>
          <button id="start-analysis-button" class="action-button" type="button">Start Analysis</button>
          <button id="refresh-button" class="action-button" type="button">Refresh Analysis</button>
        </div>
        <section id="ai-summary" class="ai-summary" hidden>
          <h3 class="ai-summary-title">AI Summary</h3>
          <p id="ai-summary-headline" class="ai-summary-headline"></p>
          <p id="ai-summary-description" class="ai-summary-description"></p>
          <ul id="ai-summary-list" class="ai-summary-list"></ul>
        </section>
        <section class="page-graph-layout">
          <div class="graph-panel graph-panel-main">
            <h2>Global Page Graph</h2>
            <p id="graph-hint">Loading page graph...</p>
            <div class="graph-toolbar">
              <button id="graph-fit" class="graph-button" type="button">Fit</button>
              <button id="graph-relayout" class="graph-button" type="button">Relayout</button>
            </div>
            <div id="graph-canvas"></div>
            <div id="edge-tooltip" class="edge-tooltip"></div>
            <div id="edge-summary" class="edge-summary"></div>
          </div>
          <aside class="side-panel">
          <div class="graph-panel">
            <h3>Page Detail</h3>
            <p id="page-detail-title" class="detail-main">Select a page node</p>
            <p id="page-detail-subtitle" class="detail-sub">Click a node to inspect it.</p>
            <div id="page-detail-list"></div>
          </div>
          </aside>
        </section>
      </main>
    </div>
    <div id="loading-overlay" class="loading-overlay is-visible" aria-live="polite" aria-busy="true">
      <div class="loading-card">
        <div class="loading-spinner"></div>
        <div id="loading-text" class="loading-text">Loading analysis...</div>
      </div>
    </div>
    <script src="https://unpkg.com/@antv/g6@5/dist/g6.min.js"></script>
    <script>
      const surfaceState = {
        pageGraph: null,
        activeNodeId: null,
        g6Graph: null,
        preferredEditor: 'vscode',
        resizeHandler: null,
        analysisStarted: false,
      };
      function escapeHtml(value) {
        return String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }
      function loadPreferredEditor() {
        const select = document.getElementById('editor-select');
        if (!select) {
          return;
        }
        const stored = localStorage.getItem('frontendCompass.editor');
        const selected = stored === 'cursor' ? 'cursor' : 'vscode';
        surfaceState.preferredEditor = selected;
        select.value = selected;
        select.addEventListener('change', () => {
          surfaceState.preferredEditor = select.value === 'cursor' ? 'cursor' : 'vscode';
          localStorage.setItem('frontendCompass.editor', surfaceState.preferredEditor);
        });
      }

      function setGlobalLoading(visible, text) {
        const overlay = document.getElementById('loading-overlay');
        const label = document.getElementById('loading-text');
        if (!overlay) {
          return;
        }
        if (label && text) {
          label.textContent = text;
        }
        overlay.classList.toggle('is-visible', Boolean(visible));
      }

      function renderFlowCanvas() {
        const canvas = document.getElementById('graph-canvas');
        const edgeTooltip = document.getElementById('edge-tooltip');
        if (!canvas || !surfaceState.pageGraph || typeof G6 === 'undefined') {
          return;
        }
        const graph = surfaceState.pageGraph;
        const entryPath = graph.nodes.find((node) => node.path === '/')?.path ?? graph.nodes[0]?.path ?? null;
        const depthByNodeId = new Map();
        graph.nodes.forEach((node) => depthByNodeId.set(node.id, Number.MAX_SAFE_INTEGER));
        if (entryPath) {
          const entryNode = graph.nodes.find((node) => node.path === entryPath);
          if (entryNode) {
            depthByNodeId.set(entryNode.id, 0);
            const queue = [entryNode.id];
            while (queue.length > 0) {
              const current = queue.shift();
              const currentDepth = depthByNodeId.get(current) ?? 0;
              graph.edges.forEach((edge) => {
                if (edge.from === current) {
                  const nextDepth = currentDepth + 1;
                  const existing = depthByNodeId.get(edge.to) ?? Number.MAX_SAFE_INTEGER;
                  if (nextDepth < existing) {
                    depthByNodeId.set(edge.to, nextDepth);
                    queue.push(edge.to);
                  }
                }
              });
            }
          }
        }
        const palette = ['#2f7d57', '#357f88', '#3b6f9a', '#5b62a3', '#7a5b9f'];
        const data = {
          nodes: graph.nodes.map((node) => {
            const depth = depthByNodeId.get(node.id) ?? Number.MAX_SAFE_INTEGER;
            return {
              id: node.id,
              style: {
                labelText: node.label || node.path,
                fill: !Number.isFinite(depth) || depth > 1000
                  ? '#d6e4dc'
                  : ['#dff0e7', '#d7ebef', '#dbe4f3', '#e3dff3', '#e9dff0'][Math.min(depth, 4)],
                stroke: node.path === entryPath ? '#ffe38a' : '#e8f2ec',
                lineWidth: node.path === entryPath ? 4 : 2,
                labelFill: '#163a2a',
                labelFontSize: 13,
                labelFontWeight: 700,
                labelStroke: '#ffffff',
                labelLineWidth: 2,
                radius: 10,
                size: [Math.max(150, (node.label || node.path).length * 8), 42],
                shadowColor: node.path === entryPath ? '#f6c645' : '#9db7aa',
                shadowBlur: 12,
              },
            };
          }),
          edges: graph.edges.map((edge, index) => ({
            id: 'edge-' + index,
            source: edge.from,
            target: edge.to,
            data: {
              evidences: edge.evidences,
              typeLabels: edge.types,
            },
            style: {
              stroke: '#3f8f67',
              lineWidth: 3,
              lineAppendWidth: 18,
              endArrow: true,
              endArrowType: 'triangle',
              endArrowSize: 12,
              endArrowOffset: 10,
              endArrowFill: '#3f8f67',
              endArrowStroke: '#3f8f67',
              startArrow: false,
              labelText: '',
            },
          })),
        };
        if (surfaceState.g6Graph) {
          surfaceState.g6Graph.destroy();
          surfaceState.g6Graph = null;
        }

        surfaceState.g6Graph = new G6.Graph({
          container: canvas,
          width: canvas.clientWidth || 900,
          height: canvas.clientHeight || 420,
          autoFit: 'view',
          data,
          layout: {
            type: 'dagre',
            rankdir: 'TB',
            nodesep: 28,
            ranksep: 56,
          },
          node: { type: 'rect' },
          edge: { type: 'line' },
          behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
        });
        surfaceState.g6Graph.render();
        if (surfaceState.resizeHandler) {
          window.removeEventListener('resize', surfaceState.resizeHandler);
          surfaceState.resizeHandler = null;
        }
        surfaceState.resizeHandler = () => {
          if (!surfaceState.g6Graph || !canvas) {
            return;
          }
          const width = canvas.clientWidth || 900;
          const height = canvas.clientHeight || 420;
          surfaceState.g6Graph.setSize(width, height);
          surfaceState.g6Graph.fitView();
        };
        window.addEventListener('resize', surfaceState.resizeHandler);

        surfaceState.g6Graph.on('node:click', async (event) => {
          const nodeId = event.target.id;
          surfaceState.activeNodeId = nodeId;
          const connectedEdgeIds = new Set(
            graph.edges
              .filter((edge) => edge.from === nodeId || edge.to === nodeId)
              .map((edge, index) => 'edge-' + index),
          );
          surfaceState.g6Graph.getNodeData().forEach((node) => {
            surfaceState.g6Graph.updateNodeData([
              {
                id: node.id,
                style: {
                  opacity: node.id === nodeId || graph.edges.some((edge) => (edge.from === nodeId && edge.to === node.id) || (edge.to === nodeId && edge.from === node.id))
                    ? 1
                    : 0.45,
                },
              },
            ]);
          });
          surfaceState.g6Graph.getEdgeData().forEach((edge) => {
            surfaceState.g6Graph.updateEdgeData([
              {
                id: edge.id,
                style: {
                  opacity: connectedEdgeIds.has(edge.id) ? 1 : 0.22,
                },
              },
            ]);
          });
          surfaceState.g6Graph.draw();
          renderPageGraph();
          await loadPageDetails(nodeId);
        });
        function showEdgeTooltip(event) {
          if (!edgeTooltip) {
            return;
          }
          const model = event.target?.context?.model ?? event.target?.model ?? {};
          const edgeId = model?.id ?? event.target?.id ?? '';
          const indexText = String(edgeId).replace('edge-', '');
          const edgeIndex = Number(indexText);
          const edgeData = Number.isFinite(edgeIndex) ? graph.edges[edgeIndex] : null;
          const evidences = edgeData?.evidences ?? model?.data?.evidences ?? [];
          const codes = evidences.length > 0
            ? evidences.map((entry, index) => (index + 1) + '. ' + entry)
            : ['No direct code evidence found.'];
          edgeTooltip.textContent = codes.join('\\n');
          edgeTooltip.style.whiteSpace = 'pre-line';
          edgeTooltip.style.display = 'block';
        }

        function hideEdgeTooltip() {
          if (edgeTooltip) {
            edgeTooltip.style.display = 'none';
          }
        }

        function moveEdgeTooltip(event) {
          if (!edgeTooltip) {
            return;
          }
          const nativeEvent = event.originalEvent ?? event.nativeEvent;
          let clientX = nativeEvent?.clientX;
          let clientY = nativeEvent?.clientY;
          if (typeof clientX !== 'number' || typeof clientY !== 'number') {
            const rect = canvas.getBoundingClientRect();
            clientX = rect.left + (event.canvas?.x ?? 0);
            clientY = rect.top + (event.canvas?.y ?? 0);
          }
          edgeTooltip.style.left = clientX + 14 + 'px';
          edgeTooltip.style.top = clientY + 14 + 'px';
        }

        surfaceState.g6Graph.on('edge:pointerenter', showEdgeTooltip);
        surfaceState.g6Graph.on('edge:mouseenter', showEdgeTooltip);
        surfaceState.g6Graph.on('edge:click', showEdgeTooltip);
        surfaceState.g6Graph.on('edge:pointerleave', hideEdgeTooltip);
        surfaceState.g6Graph.on('edge:mouseleave', hideEdgeTooltip);
        surfaceState.g6Graph.on('edge:pointermove', moveEdgeTooltip);
        surfaceState.g6Graph.on('edge:mousemove', moveEdgeTooltip);
        surfaceState.g6Graph.on('edge:click', moveEdgeTooltip);

        const fitButton = document.getElementById('graph-fit');
        if (fitButton) {
          fitButton.onclick = () => {
            surfaceState.g6Graph.fitView();
          };
        }
        const relayoutButton = document.getElementById('graph-relayout');
        if (relayoutButton) {
          relayoutButton.onclick = () => {
            surfaceState.g6Graph.setLayout({
              type: 'dagre',
              rankdir: 'TB',
              nodesep: 28,
              ranksep: 56,
            });
            surfaceState.g6Graph.layout();
            surfaceState.g6Graph.fitView();
          };
        }

        surfaceState.g6Graph.fitView();
      }

      async function loadPageDetails(nodeId) {
        const response = await fetch('/api/page-details?nodeId=' + encodeURIComponent(nodeId));
        if (!response.ok) {
          return;
        }
        const detail = await response.json();
        const title = document.getElementById('page-detail-title');
        const subtitle = document.getElementById('page-detail-subtitle');
        const list = document.getElementById('page-detail-list');
        if (!title || !subtitle || !list) {
          return;
        }
        title.textContent = detail.path;
        subtitle.textContent = detail.file;
        const chips = (items) =>
          (items && items.length > 0)
            ? '<div class="detail-chips">' + items.map((entry) => '<span class="detail-chip">' + escapeHtml(entry) + '</span>').join('') + '</div>'
            : '<span class="detail-sub">No data</span>';
        const clickableList = (items, emptyText) =>
          (items && items.length > 0)
            ? '<ol class="detail-code-list">' + items.map((entry) => '<li class="detail-code-item"><button class="detail-open-btn" data-open-snippet="' + encodeURIComponent(entry.code || entry.label || '') + '" data-open-file="' + encodeURIComponent(entry.sourceFile || detail.file) + '" data-open-line="' + String(entry.line ?? 0) + '">' + escapeHtml(entry.label || entry.code || '') + '</button></li>').join('') + '</ol>'
            : '<span class="detail-sub">' + escapeHtml(emptyText || 'No data') + '</span>';
        const codeList = (items) =>
          (items && items.length > 0)
            ? '<ol class="detail-code-list">' + items.map((entry) => '<li class="detail-code-item"><button class="detail-open-btn" data-open-snippet="' + encodeURIComponent(entry.code) + '" data-open-file="' + encodeURIComponent(entry.sourceFile || detail.file) + '" data-open-line="' + String(entry.line ?? 0) + '">' + escapeHtml(entry.code) + '</button></li>').join('') + '</ol>'
            : '<span class="detail-sub">No evidence</span>';
        const renderTreeNodes = (nodes) => {
          if (!nodes || nodes.length === 0) {
            return '';
          }
          return nodes.map((node) => {
            const hasChildren = Array.isArray(node.children) && node.children.length > 0;
            const kindClass = node.kind === 'handler' ? 'component-kind-handler' : '';
            return '<sl-tree-item ' + (hasChildren ? 'expanded' : '') + '>' +
              '<button class="component-tree-item-btn ' + kindClass + '" data-open-snippet="' + encodeURIComponent(node.code || node.label || '') + '" data-open-file="' + encodeURIComponent(node.sourceFile || detail.file) + '" data-open-line="' + String(node.line ?? 0) + '">' + escapeHtml(node.label || node.code || '') + '</button>' +
              renderTreeNodes(node.children || []) +
              '</sl-tree-item>';
          }).join('');
        };
        const componentTree = (nodes) =>
          (nodes && nodes.length > 0)
            ? '<sl-tree class="component-tree">' + renderTreeNodes(nodes) + '</sl-tree>'
            : '<span class="detail-sub">No components</span>';
        const functionSummaryList = (items) =>
          (items && items.length > 0)
            ? '<div class="function-summary-list">' + items.map((entry) =>
              '<div class="function-summary-item">' +
              '<button class="detail-open-btn" data-open-snippet="' + encodeURIComponent(entry.code || entry.label || '') + '" data-open-file="' + encodeURIComponent(entry.sourceFile || detail.file) + '" data-open-line="' + String(entry.line ?? 0) + '">' + escapeHtml(entry.label || '') + '</button>' +
              '<p class="function-summary-text">' + escapeHtml(entry.summary || '') + '</p>' +
              '</div>'
            ).join('') + '</div>'
            : '<span class="detail-sub">No function summaries yet</span>';
        list.innerHTML = [
          '<section class="detail-section component-tree-section"><h4 class="detail-section-title">Components & Handlers</h4>',
          componentTree(detail.componentTreeItems),
          '</section>',
          '<section class="detail-section"><h4 class="detail-section-title">Outgoing Routes</h4>',
          clickableList(detail.outgoingRouteItems ?? (detail.outgoingEdges ?? []).map((edge) => ({ label: detail.path + ' -> ' + edge.to + ' [' + edge.type + ']', code: edge.evidence || '', sourceFile: edge.sourceFile || detail.file, line: edge.line })), 'No outgoing routes'),
          '</section>',
          '<section class="detail-section"><h4 class="detail-section-title">Incoming Routes</h4>',
          clickableList(detail.incomingRouteItems ?? (detail.incomingEdges ?? []).map((edge) => ({ label: edge.from + ' -> ' + detail.path + ' [' + edge.type + ']', code: edge.evidence || '', sourceFile: edge.sourceFile || detail.file, line: edge.line })), 'No incoming routes'),
          '</section>',
          '<section class="detail-section"><h4 class="detail-section-title">Navigation Evidence</h4>',
          codeList(detail.evidenceItems ?? detail.evidence.map((code) => ({ code, sourceFile: detail.file }))),
          '</section>',
        ].join('');

        list.querySelectorAll('[data-open-snippet]').forEach((element) => {
          element.addEventListener('click', async () => {
            const snippet = decodeURIComponent(element.getAttribute('data-open-snippet') ?? '');
            const sourceFile = decodeURIComponent(element.getAttribute('data-open-file') ?? detail.file);
            const sourceLine = Number(element.getAttribute('data-open-line') ?? 0);
            const payload = {
              file: sourceFile,
              snippet,
              line: Number.isFinite(sourceLine) && sourceLine > 0 ? sourceLine : undefined,
              editor: surfaceState.preferredEditor,
            };
            console.log('[Frontend Compass][open-code][request]', payload);
            try {
              const response = await fetch('/api/open-code', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
              });
              if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error ?? 'Failed to open code');
              }
              const result = await response.json().catch(() => ({}));
              console.log('[Frontend Compass][open-code][response]', result);
            } catch (error) {
              console.error('[Frontend Compass][open-code][error]', error);
            }
          });
        });
      }

      function renderPageGraph() {
        const graphHint = document.getElementById('graph-hint');
        if (!graphHint || !surfaceState.pageGraph) {
          return;
        }
        const graph = surfaceState.pageGraph;
        graphHint.textContent = graph.edges.length > 0
          ? 'Click a page to inspect details. Edges are deterministic and evidence-backed.'
          : 'No deterministic navigation edges were found yet.';
      }

      async function loadDashboard() {
        const [metaResponse, statusResponse, overviewResponse, pageGraphResponse] = await Promise.all([
          fetch('/api/meta'),
          fetch('/api/status'),
          fetch('/api/overview'),
          fetch('/api/page-graph'),
        ]);

        const meta = await metaResponse.json();
        const status = await statusResponse.json();
        const overview = await overviewResponse.json();
        const pageGraph = await pageGraphResponse.json();
        surfaceState.analysisStarted = true;
        surfaceState.pageGraph = pageGraph;
        const defaultNode = pageGraph.nodes.find((node) => node.path === '/') ?? pageGraph.nodes[0] ?? null;
        surfaceState.activeNodeId = defaultNode ? defaultNode.id : null;
        renderPageGraph();
        renderFlowCanvas();
        if (surfaceState.activeNodeId) {
          await loadPageDetails(surfaceState.activeNodeId);
        }

        const metaFramework = document.getElementById('meta-framework');
        const metaCache = document.getElementById('meta-cache');
        const granularitySelect = document.getElementById('analysis-granularity');
        const refreshButton = document.getElementById('refresh-button');
        const aiSummary = document.getElementById('ai-summary');
        const aiHeadline = document.getElementById('ai-summary-headline');
        const aiDescription = document.getElementById('ai-summary-description');
        const aiList = document.getElementById('ai-summary-list');

        if (metaFramework) {
          metaFramework.textContent = 'Framework: ' + overview.framework;
        }
        if (metaCache) {
          const granularity = meta.analysisGranularity || 'local';
          metaCache.textContent = 'Cache: ' + meta.cacheStatus + ' | Mode: ' + granularity;
        }
        if (granularitySelect) {
          granularitySelect.value = meta.analysisGranularity || 'local';
        }
        if (refreshButton) {
          refreshButton.removeAttribute('disabled');
        }
        const mode = meta.analysisGranularity || 'local';
        if (aiSummary) {
          aiSummary.hidden = mode !== 'file';
        }
        if (mode === 'file' && overview && aiHeadline && aiDescription && aiList) {
          aiHeadline.textContent = overview.summary?.title || 'File-level summary';
          aiDescription.textContent = overview.summary?.description || '';
          const points = Array.isArray(overview.summary?.highlights) ? overview.summary.highlights : [];
          aiList.innerHTML = points.map((item) => '<li>' + escapeHtml(item) + '</li>').join('');
        } else if (aiHeadline && aiDescription && aiList) {
          aiHeadline.textContent = '';
          aiDescription.textContent = '';
          aiList.innerHTML = '';
        }

      }

      async function loadIdleState() {
        const [metaResponse, statusResponse] = await Promise.all([
          fetch('/api/meta'),
          fetch('/api/status'),
        ]);
        const meta = await metaResponse.json();
        const status = await statusResponse.json();
        const metaFramework = document.getElementById('meta-framework');
        const metaCache = document.getElementById('meta-cache');
        const graphHint = document.getElementById('graph-hint');
        const detailTitle = document.getElementById('page-detail-title');
        const detailSubtitle = document.getElementById('page-detail-subtitle');
        const detailList = document.getElementById('page-detail-list');
        const granularitySelect = document.getElementById('analysis-granularity');
        const refreshButton = document.getElementById('refresh-button');
        const aiSummary = document.getElementById('ai-summary');
        if (metaFramework) {
          metaFramework.textContent = 'Framework: -';
        }
        if (metaCache) {
          metaCache.textContent = 'Cache: -';
        }
        if (graphHint) {
          graphHint.textContent = status.message || 'Pick granularity and start analysis.';
        }
        if (detailTitle) {
          detailTitle.textContent = 'Analysis not started';
        }
        if (detailSubtitle) {
          detailSubtitle.textContent = 'Select a granularity and click Start Analysis.';
        }
        if (detailList) {
          detailList.innerHTML = '';
        }
        if (granularitySelect) {
          granularitySelect.value = meta.analysisGranularity || 'local';
        }
        if (refreshButton) {
          refreshButton.setAttribute('disabled', 'true');
        }
        if (aiSummary) {
          aiSummary.hidden = true;
        }
        surfaceState.analysisStarted = false;
      }

      const startAnalysisButton = document.getElementById('start-analysis-button');
      if (startAnalysisButton) {
        startAnalysisButton.addEventListener('click', async () => {
          const granularitySelect = document.getElementById('analysis-granularity');
          const granularity = granularitySelect ? granularitySelect.value : 'local';
          setGlobalLoading(true, 'Running analysis...');
          startAnalysisButton.setAttribute('disabled', 'true');
          try {
            const response = await fetch('/api/analysis/start', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ granularity }),
            });
            if (!response.ok) {
              const payload = await response.json().catch(() => ({}));
              throw new Error(payload.error || 'Failed to start analysis.');
            }
            await loadDashboard();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            alert(message);
            await loadIdleState().catch(() => {});
          } finally {
            setGlobalLoading(false);
            startAnalysisButton.removeAttribute('disabled');
          }
        });
      }

      const refreshButton = document.getElementById('refresh-button');
      if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
          if (!surfaceState.analysisStarted) {
            return;
          }
          setGlobalLoading(true, 'Refreshing analysis...');
          refreshButton.setAttribute('disabled', 'true');
          try {
            const response = await fetch('/api/refresh', { method: 'POST' });
            if (!response.ok) {
              const payload = await response.json().catch(() => ({}));
              throw new Error(payload.error || 'Failed to refresh analysis.');
            }
            await loadDashboard();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            alert(message);
          } finally {
            setGlobalLoading(false);
            refreshButton.removeAttribute('disabled');
          }
        });
      }

      loadPreferredEditor();
      loadIdleState()
        .catch((error) => {
          console.error(error);
          setGlobalLoading(true, 'Failed to load project overview.');
        })
        .finally(() => {
          setGlobalLoading(false);
        });
    </script>
  </body>
</html>`;
}

export async function startAppServer(input: {
  projectRoot: string;
  port: number;
}, runtime?: {
  loadedProject?: LoadedProjectInput;
  snapshot?: AnalysisSnapshot;
  cacheStatus?: "hit" | "miss";
  userConfig?: FrontendCompassResolvedConfig;
  toolRoot?: string;
  configPath?: string;
  configExists?: boolean;
}) {
  type AnalysisGranularity = "local" | "file";
  const app = express();
  app.use(express.json());

  let currentLoadedProject = runtime?.loadedProject;
  let currentSnapshot = runtime?.snapshot ?? null;
  let currentCacheStatus: "hit" | "miss" = runtime?.cacheStatus ?? "miss";
  let currentGranularity: AnalysisGranularity = "local";
  let analysisInProgress = false;

  async function refreshRuntimeState() {
    analysisInProgress = true;
    try {
      const files = await discoverProjectFiles(input.projectRoot);
      const packageJson = await readProjectPackageJson(input.projectRoot);
      const sourceByFile = await readSourceFiles(input.projectRoot, files);
      currentLoadedProject = buildLoadedProjectInput({
        projectRoot: input.projectRoot,
        packageJson,
        files,
        sourceByFile,
      });
      const cachedEnvelope = await readCacheFile<
        ReturnType<typeof createCacheEnvelope<AnalysisSnapshot>>
      >(input.projectRoot, runtime?.toolRoot);
      const resolved = resolveAnalysisSnapshot({
        loadedProject: currentLoadedProject,
        cachedEnvelope,
      });
      currentSnapshot = resolved.snapshot;
      currentCacheStatus = resolved.cacheStatus;
      await writeCacheFile(
        input.projectRoot,
        createCacheEnvelope(
          currentSnapshot.framework,
          currentSnapshot,
          resolved.fileHashes,
        ),
        runtime?.toolRoot,
      );
    } finally {
      analysisInProgress = false;
    }
  }

  function hasSnapshot() {
    return Boolean(currentSnapshot);
  }

  function formatAnalysisError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
    if (
      message.includes("ENOENT") &&
      message.includes("package.json")
    ) {
      return "No package.json was found at the selected project root. Please point to the frontend app folder and try again.";
    }
    return message;
  }

  function ensureSnapshot(response: express.Response) {
    if (!currentSnapshot) {
      response.status(409).json({
        error: "Analysis has not started yet. Choose a granularity and click Start Analysis.",
      });
      return false;
    }
    return true;
  }

  app.get("/api/meta", (_request, response) => {
    response.json(
      buildMetaPayload({
        projectRoot: input.projectRoot,
        cacheStatus: currentCacheStatus,
        providerConfigured: Boolean(runtime?.userConfig?.provider),
        configPath: runtime?.configPath,
        configExists: runtime?.configExists,
        analysisStarted: hasSnapshot(),
        analysisInProgress,
        analysisGranularity: currentGranularity,
      }),
    );
  });

  app.get("/api/status", (_request, response) => {
    if (!currentSnapshot) {
      response.json({
        supported: false,
        status: analysisInProgress ? "running" : "idle",
        framework: "unknown",
        message: analysisInProgress
          ? "Analysis is running..."
          : "Pick an analysis granularity and click Start Analysis.",
      });
      return;
    }
    response.json(buildStatusPayload(currentSnapshot));
  });

  app.get("/api/analysis-state", (_request, response) => {
    response.json({
      started: hasSnapshot(),
      inProgress: analysisInProgress,
      granularity: currentGranularity,
      providerConfigured: Boolean(runtime?.userConfig?.provider),
    });
  });

  app.post("/api/analysis/start", async (request, response) => {
    const requested = String(request.body?.granularity ?? "local");
    const granularity: AnalysisGranularity =
      requested === "file" ? "file" : "local";
    currentGranularity = granularity;
    try {
      await refreshRuntimeState();
      response.json({
        ok: true,
        granularity: currentGranularity,
        cacheStatus: currentCacheStatus,
        routeCount: currentSnapshot?.routes.length ?? 0,
        pageCount: currentSnapshot?.pages.length ?? 0,
      });
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: formatAnalysisError(error),
      });
    }
  });

  app.get("/api/overview", async (_request, response) => {
    if (!ensureSnapshot(response)) {
      return;
    }
    const snapshot = currentSnapshot;
    if (!snapshot) {
      return;
    }
    if (runtime?.userConfig?.provider && currentGranularity !== "local") {
      response.json(
        await buildEnhancedOverviewPayload(snapshot, runtime.userConfig.provider),
      );
      return;
    }

    response.json(buildOverviewPayload(snapshot));
  });

  app.get("/api/routes", (_request, response) => {
    if (!ensureSnapshot(response)) {
      return;
    }
    const snapshot = currentSnapshot;
    if (!snapshot) {
      return;
    }
    response.json(buildRoutesPayload(snapshot));
  });

  app.get("/api/components", (_request, response) => {
    if (!ensureSnapshot(response)) {
      return;
    }
    const snapshot = currentSnapshot;
    if (!snapshot) {
      return;
    }
    response.json(buildComponentsPayload(snapshot));
  });

  app.get("/api/api-calls", (_request, response) => {
    if (!ensureSnapshot(response)) {
      return;
    }
    const snapshot = currentSnapshot;
    if (!snapshot) {
      return;
    }
    response.json(buildApiPayload(snapshot));
  });

  app.get("/api/state", (_request, response) => {
    if (!ensureSnapshot(response)) {
      return;
    }
    const snapshot = currentSnapshot;
    if (!snapshot) {
      return;
    }
    response.json(buildStatePayload(snapshot));
  });

  app.get("/api/page-graph", (_request, response) => {
    if (!ensureSnapshot(response)) {
      return;
    }
    const snapshot = currentSnapshot;
    if (!snapshot) {
      return;
    }
    response.json(buildPageGraphPayload(snapshot));
  });

  app.get("/api/page-details", async (request, response) => {
    if (!ensureSnapshot(response)) {
      return;
    }
    const snapshot = currentSnapshot;
    if (!snapshot) {
      return;
    }
    const nodeId = String(request.query.nodeId ?? "");
    const payload = buildPageDetailsPayload(snapshot, nodeId);
    if (!payload) {
      response.status(404).json({
        error: "Page node not found",
      });
      return;
    }

    if (currentLoadedProject) {
      const loadedProject = currentLoadedProject;
      const importMap = buildImportedSymbolFileMap(
        payload.file,
        loadedProject.sourceByFile,
      );
      payload.componentItems = (payload.componentItems ?? []).map((item: { label: string; code: string; sourceFile: string }) => ({
        ...item,
        code: item.code ?? item.label,
        sourceFile: importMap[item.label] ?? item.sourceFile ?? payload.file,
      }));
      payload.componentTreeItems = buildComponentTreeForPage(
        payload.file,
        loadedProject.sourceByFile,
      );

      payload.functionSummaryItems = [];
    }

    response.json(payload);
  });

  app.post("/api/open-code", (request, response) => {
    const requestedFile = String(request.body?.file ?? "").replace(/\\/g, "/");
    const snippet = String(request.body?.snippet ?? "");
    const requestedLine = Number(request.body?.line ?? 0);
    const editor = String(request.body?.editor ?? "vscode");
    if (!currentLoadedProject) {
      response.status(409).json({ error: "Project source is not loaded yet." });
      return;
    }

    const sourceByFile = currentLoadedProject.sourceByFile;
    let matchedFile = requestedFile && sourceByFile[requestedFile] ? requestedFile : "";
    if (!matchedFile && requestedFile) {
      matchedFile = Object.keys(sourceByFile).find((file) => file.endsWith(requestedFile)) ?? "";
    }

    const snippetMatch = findBestFileBySnippet(sourceByFile, snippet);
    const looseSnippetMatch = snippetMatch ? null : findBestFileByLooseSnippet(sourceByFile, snippet);
    if (!matchedFile && snippetMatch) {
      matchedFile = snippetMatch.file;
    }
    if (!matchedFile && looseSnippetMatch) {
      matchedFile = looseSnippetMatch.file;
    }
    if (!matchedFile) {
      response.status(404).json({ error: "Unable to locate file in analyzed project." });
      return;
    }

    const source = sourceByFile[matchedFile] ?? "";
    const requestedLineValid = Number.isFinite(requestedLine) && requestedLine > 0;
    const directLine = toLineFromSnippet(source, snippet);
    const shouldOverrideMatchedFile =
      !requestedLineValid &&
      directLine <= 1 &&
      ((snippetMatch && snippetMatch.file !== matchedFile) ||
        (looseSnippetMatch && looseSnippetMatch.file !== matchedFile && looseSnippetMatch.score >= 5));
    if (shouldOverrideMatchedFile) {
      matchedFile = snippetMatch?.file ?? looseSnippetMatch?.file ?? matchedFile;
    }
    const finalSource = sourceByFile[matchedFile] ?? "";
    const line = requestedLineValid
      ? requestedLine
      : (() => {
        const finalDirectLine = toLineFromSnippet(finalSource, snippet);
        if (finalDirectLine > 1) {
          return finalDirectLine;
        }
        if (snippetMatch?.file === matchedFile && snippetMatch.line > 0) {
          return snippetMatch.line;
        }
        if (looseSnippetMatch?.file === matchedFile && looseSnippetMatch.line > 0) {
          return looseSnippetMatch.line;
        }
        return finalDirectLine;
      })();
    const absolutePath = path.resolve(currentLoadedProject.projectRoot, matchedFile);
    const normalizedProjectRoot = path.resolve(currentLoadedProject.projectRoot);
    if (!absolutePath.startsWith(normalizedProjectRoot)) {
      response.status(400).json({ error: "Refusing to open file outside project root." });
      return;
    }

    try {
      void openInEditor(absolutePath, line, editor);
      response.json({
        ok: true,
        file: matchedFile,
        absolutePath,
        line,
        editor,
        matchedBySnippet: Boolean(
          (snippetMatch && snippetMatch.file === matchedFile) ||
          (looseSnippetMatch && looseSnippetMatch.file === matchedFile),
        ),
      });
    } catch (error) {
      response.status(500).json({
        error: error instanceof Error ? error.message : "Failed to open editor.",
      });
    }
  });

  app.post("/api/refresh", async (_request, response) => {
    if (!hasSnapshot()) {
      response.status(409).json({
        error: "Analysis has not started yet. Click Start Analysis first.",
      });
      return;
    }
    try {
      await refreshRuntimeState();
      const snapshot = currentSnapshot;
      if (!snapshot) {
        response.status(500).json({
          error: "Analysis did not produce a snapshot.",
        });
        return;
      }
      response.json(
        buildRefreshPayload({
          cacheStatus: currentCacheStatus,
          routeCount: snapshot.routes.length,
          pageCount: snapshot.pages.length,
        }),
      );
    } catch (error) {
      response.status(400).json({
        ok: false,
        error: formatAnalysisError(error),
      });
    }
  });

  app.get("/", (_request, response) => {
    response.type("html").send(buildAppShellHtml({
      projectRoot: input.projectRoot,
    }));
  });

  return new Promise<void>((resolve, reject) => {
    const server = app.listen(input.port, () => resolve());
    server.on("error", reject);
  });
}
