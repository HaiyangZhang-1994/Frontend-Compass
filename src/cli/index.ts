import { readCacheFile, writeCacheFile } from "../cache/cache-files.js";
import {
  createCacheEnvelope,
  type CacheEnvelope,
} from "../cache/cache-store.js";
import type { AnalysisSnapshot } from "../analyzers/shared/types.js";
import { createLaunchSummary } from "../core/launch-summary.js";
import {
  buildLoadedProjectInput,
  readProjectPackageJson,
  readSourceFiles,
} from "../core/load-project-input.js";
import { discoverProjectFiles } from "../core/discover-project-files.js";
import { resolveAnalysisSnapshot } from "../core/resolve-analysis-snapshot.js";
import { resolveFrontendProjectRoot } from "../core/resolve-frontend-root.js";
import {
  getUserConfigPath,
  loadUserConfig,
  userConfigExists,
} from "../config/load-user-config.js";
import { startAppServer } from "../server/app-server.js";

export type StartupPlan = {
  projectRoot: string;
  port: number;
  mode: "serve";
};

export function parseCliArgs(argv: string[], cwd: string) {
  const projectFlagIndex = argv.findIndex((value) => value === "--project");
  const projectRoot =
    projectFlagIndex >= 0 && argv[projectFlagIndex + 1]
      ? argv[projectFlagIndex + 1]
      : cwd;

  return {
    projectRoot,
  };
}

export function buildStartupPlan(input: {
  cwd: string;
  port: number;
}): StartupPlan {
  return {
    projectRoot: input.cwd,
    port: input.port,
    mode: "serve",
  };
}

export async function runCli() {
  const toolRoot = process.cwd();
  const cliArgs = parseCliArgs(process.argv, toolRoot);
  const plan = buildStartupPlan({
    cwd: cliArgs.projectRoot,
    port: 4411,
  });
  const summary = await createLaunchSummary({
    projectRoot: plan.projectRoot,
    port: plan.port,
  });

  const userConfig = await loadUserConfig(toolRoot);
  const configPath = getUserConfigPath(toolRoot);
  const configExists = await userConfigExists(toolRoot);
  const frontendProjectRoot = await resolveFrontendProjectRoot(summary.projectRoot);
  const files = await discoverProjectFiles(frontendProjectRoot);
  const packageJson = await readProjectPackageJson(frontendProjectRoot);
  const sourceByFile = await readSourceFiles(frontendProjectRoot, files);
  const loadedProject = buildLoadedProjectInput({
    projectRoot: frontendProjectRoot,
    packageJson,
    files,
    sourceByFile,
  });
  const cachedEnvelope = await readCacheFile<CacheEnvelope<AnalysisSnapshot>>(
    summary.projectRoot,
  );
  const resolved = resolveAnalysisSnapshot({
    loadedProject,
    cachedEnvelope,
  });
  await writeCacheFile(
    summary.projectRoot,
    createCacheEnvelope(
      resolved.snapshot.framework,
      resolved.snapshot,
      resolved.fileHashes,
    ),
    toolRoot,
  );

  await startAppServer(
    {
      projectRoot: summary.projectRoot,
      port: summary.port,
    },
    {
      loadedProject,
      snapshot: resolved.snapshot,
      cacheStatus: resolved.cacheStatus,
      userConfig,
      toolRoot,
      configPath,
      configExists,
    },
  );

  console.log(
    `Frontend Compass running at http://localhost:${summary.port} for ${summary.projectRoot} (${resolved.cacheStatus} cache)`,
  );
}

const entryFile = process.argv[1] ?? "";
if (import.meta.url.endsWith(entryFile.replace(/\\/g, "/"))) {
  runCli().catch((error: unknown) => {
    console.error("Failed to start Frontend Compass.");
    console.error(error);
    process.exitCode = 1;
  });
}
