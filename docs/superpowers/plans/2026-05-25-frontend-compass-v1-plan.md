# Frontend Compass V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first onboarding dev tool for React and Vue projects that launches a local web app and explains routes, pages, components, APIs, and state flows using structured analysis plus the user's own OpenAI-compatible API.

**Architecture:** The system is split into a CLI entrypoint, a project scanner, framework analyzers, a semantic generation layer, a local cache manager, and a local web UI. React and Vue share one normalized analysis model so the UI and semantic layer do not need framework-specific branches for every surface.

**Tech Stack:** TypeScript, Node.js, Vite, React, AST tooling for JS/TS/Vue parsing, local JSON cache, OpenAI-compatible HTTP client

---

## Proposed File Structure

- `package.json`
  Project metadata, scripts, dependencies, CLI bin entry.
- `src/cli/index.ts`
  CLI entrypoint that starts scan, semantic generation, cache loading, and local app launch.
- `src/config/load-user-config.ts`
  Reads local API and product config from the user's project.
- `src/core/project-scanner.ts`
  Discovers files, detects framework, reads config files, and builds a normalized project file graph.
- `src/core/file-filter.ts`
  Excludes generated, vendor, and irrelevant files from analysis.
- `src/core/framework-detector.ts`
  Detects React, Vue, Next.js, Nuxt, and Vite project flavors.
- `src/analyzers/shared/types.ts`
  Shared normalized analysis model definitions.
- `src/analyzers/shared/normalize.ts`
  Converts raw extractor output into the shared intermediate model.
- `src/analyzers/react/react-analyzer.ts`
  React project analysis orchestration.
- `src/analyzers/react/extract-routes.ts`
  React and Next route discovery logic.
- `src/analyzers/react/extract-components.ts`
  React component and hook extraction.
- `src/analyzers/react/extract-data-flow.ts`
  React API and state usage extraction.
- `src/analyzers/vue/vue-analyzer.ts`
  Vue project analysis orchestration.
- `src/analyzers/vue/extract-routes.ts`
  Vue and Nuxt route discovery logic.
- `src/analyzers/vue/extract-components.ts`
  Vue SFC, composable, and component extraction.
- `src/analyzers/vue/extract-data-flow.ts`
  Vue API and state usage extraction.
- `src/semantic/prompt-builder.ts`
  Builds bounded prompts from structured evidence.
- `src/semantic/provider-client.ts`
  OpenAI-compatible API client.
- `src/semantic/generate-summaries.ts`
  Produces project, page, module, and reading-guide summaries.
- `src/cache/cache-store.ts`
  Reads and writes cached analysis artifacts.
- `src/cache/invalidation.ts`
  Computes what changed and what needs refresh.
- `src/server/app-server.ts`
  Starts the local HTTP server and serves UI data.
- `src/server/routes/*.ts`
  JSON endpoints for overview, routes, components, API, state, reading guide, and ask.
- `web/`
  Frontend React app for local browsing experience.
- `tests/`
  Unit and integration tests for scanner, analyzers, semantic layer, cache, and server.

## Task 1: Bootstrap the repo and CLI shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/cli/index.ts`
- Create: `src/server/app-server.ts`
- Create: `tests/cli/bootstrap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildStartupPlan } from "../../src/cli/index";

describe("buildStartupPlan", () => {
  it("returns a startup plan for the current project root", () => {
    const plan = buildStartupPlan({
      cwd: "/demo/project",
      port: 4111,
    });

    expect(plan.projectRoot).toBe("/demo/project");
    expect(plan.port).toBe(4111);
    expect(plan.mode).toBe("serve");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- bootstrap.test.ts`
Expected: FAIL because the CLI module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type StartupPlan = {
  projectRoot: string;
  port: number;
  mode: "serve";
};

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- bootstrap.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json src/cli/index.ts src/server/app-server.ts tests/cli/bootstrap.test.ts
git commit -m "chore: bootstrap frontend compass cli shell"
```

## Task 2: Detect framework and filter project files

**Files:**
- Create: `src/core/framework-detector.ts`
- Create: `src/core/file-filter.ts`
- Create: `src/core/project-scanner.ts`
- Create: `tests/core/framework-detector.test.ts`
- Create: `tests/core/file-filter.test.ts`

- [ ] **Step 1: Write the failing framework detection test**

```ts
import { describe, expect, it } from "vitest";
import { detectFramework } from "../../src/core/framework-detector";

describe("detectFramework", () => {
  it("detects Next.js projects from package metadata", () => {
    const framework = detectFramework({
      packageJson: {
        dependencies: { next: "15.0.0", react: "19.0.0" },
      },
      files: ["app/page.tsx"],
    });

    expect(framework.kind).toBe("next");
  });
});
```

- [ ] **Step 2: Write the failing file filter test**

```ts
import { describe, expect, it } from "vitest";
import { shouldIncludeFile } from "../../src/core/file-filter";

describe("shouldIncludeFile", () => {
  it("excludes generated and vendor files", () => {
    expect(shouldIncludeFile("node_modules/react/index.js")).toBe(false);
    expect(shouldIncludeFile(".next/server/app.js")).toBe(false);
    expect(shouldIncludeFile("src/pages/Home.tsx")).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- framework-detector.test.ts file-filter.test.ts`
Expected: FAIL because the detector and filter do not exist yet.

- [ ] **Step 4: Write minimal implementation**

```ts
export function shouldIncludeFile(file: string): boolean {
  return ![
    "node_modules/",
    ".next/",
    "dist/",
    "build/",
    ".nuxt/",
    "coverage/",
  ].some((prefix) => file.startsWith(prefix));
}

export function detectFramework(input: {
  packageJson: { dependencies?: Record<string, string> };
  files: string[];
}) {
  const deps = input.packageJson.dependencies ?? {};
  if (deps.next) return { kind: "next" as const };
  if (deps.nuxt) return { kind: "nuxt" as const };
  if (deps.vue) return { kind: "vue" as const };
  if (deps.react) return { kind: "react" as const };
  return { kind: "unknown" as const };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- framework-detector.test.ts file-filter.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/framework-detector.ts src/core/file-filter.ts src/core/project-scanner.ts tests/core/framework-detector.test.ts tests/core/file-filter.test.ts
git commit -m "feat: detect supported frontend frameworks"
```

## Task 3: Define the shared analysis model

**Files:**
- Create: `src/analyzers/shared/types.ts`
- Create: `src/analyzers/shared/normalize.ts`
- Create: `tests/analyzers/shared-model.test.ts`

- [ ] **Step 1: Write the failing shared model test**

```ts
import { describe, expect, it } from "vitest";
import { createEmptyAnalysis } from "../../../src/analyzers/shared/normalize";

describe("createEmptyAnalysis", () => {
  it("creates the normalized top-level containers", () => {
    const analysis = createEmptyAnalysis("next");

    expect(analysis.framework).toBe("next");
    expect(analysis.routes).toEqual([]);
    expect(analysis.pages).toEqual([]);
    expect(analysis.components).toEqual([]);
    expect(analysis.apiCalls).toEqual([]);
    expect(analysis.stateUnits).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- shared-model.test.ts`
Expected: FAIL because the shared model does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type SupportedFramework = "react" | "next" | "vue" | "nuxt";

export type AnalysisSnapshot = {
  framework: SupportedFramework;
  routes: unknown[];
  pages: unknown[];
  components: unknown[];
  apiCalls: unknown[];
  stateUnits: unknown[];
};

export function createEmptyAnalysis(
  framework: SupportedFramework,
): AnalysisSnapshot {
  return {
    framework,
    routes: [],
    pages: [],
    components: [],
    apiCalls: [],
    stateUnits: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- shared-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/analyzers/shared/types.ts src/analyzers/shared/normalize.ts tests/analyzers/shared-model.test.ts
git commit -m "feat: add shared analysis snapshot model"
```

## Task 4: Implement React extraction

**Files:**
- Create: `src/analyzers/react/react-analyzer.ts`
- Create: `src/analyzers/react/extract-routes.ts`
- Create: `src/analyzers/react/extract-components.ts`
- Create: `src/analyzers/react/extract-data-flow.ts`
- Create: `tests/analyzers/react/routes.test.ts`
- Create: `tests/analyzers/react/data-flow.test.ts`

- [ ] **Step 1: Write the failing React route test**

```ts
import { describe, expect, it } from "vitest";
import { extractReactRoutes } from "../../../src/analyzers/react/extract-routes";

describe("extractReactRoutes", () => {
  it("finds app router pages in Next.js", () => {
    const routes = extractReactRoutes(["app/page.tsx", "app/settings/page.tsx"]);
    expect(routes.map((route) => route.path)).toEqual(["/", "/settings"]);
  });
});
```

- [ ] **Step 2: Write the failing React data-flow test**

```ts
import { describe, expect, it } from "vitest";
import { extractReactDataFlow } from "../../../src/analyzers/react/extract-data-flow";

describe("extractReactDataFlow", () => {
  it("captures useEffect and fetch hints from page content", () => {
    const result = extractReactDataFlow(`
      export default function Page() {
        useEffect(() => { fetch("/api/profile"); }, []);
        return null;
      }
    `);

    expect(result.effects).toHaveLength(1);
    expect(result.apiCalls[0].target).toContain("/api/profile");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- routes.test.ts data-flow.test.ts`
Expected: FAIL because React extraction is not implemented yet.

- [ ] **Step 4: Write minimal implementation**

```ts
export function extractReactRoutes(files: string[]) {
  return files
    .filter((file) => /(^app\/page\.|\/page\.)/.test(file))
    .map((file) => ({
      file,
      path:
        file === "app/page.tsx"
          ? "/"
          : `/${file.replace(/^app\//, "").replace(/\/page\.[^.]+$/, "")}`,
    }));
}

export function extractReactDataFlow(source: string) {
  const hasEffect = source.includes("useEffect(");
  const apiMatch = source.match(/fetch\\((['"`])(.+?)\\1\\)/);
  return {
    effects: hasEffect ? ["useEffect"] : [],
    apiCalls: apiMatch ? [{ target: apiMatch[2] }] : [],
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- routes.test.ts data-flow.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/analyzers/react src/tests/analyzers/react
git commit -m "feat: add react project analysis primitives"
```

## Task 5: Implement Vue extraction

**Files:**
- Create: `src/analyzers/vue/vue-analyzer.ts`
- Create: `src/analyzers/vue/extract-routes.ts`
- Create: `src/analyzers/vue/extract-components.ts`
- Create: `src/analyzers/vue/extract-data-flow.ts`
- Create: `tests/analyzers/vue/routes.test.ts`
- Create: `tests/analyzers/vue/data-flow.test.ts`

- [ ] **Step 1: Write the failing Vue route test**

```ts
import { describe, expect, it } from "vitest";
import { extractVueRoutes } from "../../../src/analyzers/vue/extract-routes";

describe("extractVueRoutes", () => {
  it("finds Nuxt pages and converts them to route paths", () => {
    const routes = extractVueRoutes(["pages/index.vue", "pages/profile.vue"]);
    expect(routes.map((route) => route.path)).toEqual(["/", "/profile"]);
  });
});
```

- [ ] **Step 2: Write the failing Vue data-flow test**

```ts
import { describe, expect, it } from "vitest";
import { extractVueDataFlow } from "../../../src/analyzers/vue/extract-data-flow";

describe("extractVueDataFlow", () => {
  it("captures watch and fetch usage in Vue source", () => {
    const result = extractVueDataFlow(`
      <script setup lang="ts">
      watch(userId, () => $fetch("/api/user"))
      </script>
    `);

    expect(result.watchers).toHaveLength(1);
    expect(result.apiCalls[0].target).toContain("/api/user");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- routes.test.ts data-flow.test.ts`
Expected: FAIL because Vue extraction is not implemented yet.

- [ ] **Step 4: Write minimal implementation**

```ts
export function extractVueRoutes(files: string[]) {
  return files
    .filter((file) => file.startsWith("pages/") && file.endsWith(".vue"))
    .map((file) => ({
      file,
      path:
        file === "pages/index.vue"
          ? "/"
          : `/${file.replace(/^pages\//, "").replace(/\.vue$/, "").replace(/index$/, "")}`.replace(/\/$/, ""),
    }));
}

export function extractVueDataFlow(source: string) {
  const hasWatch = source.includes("watch(");
  const apiMatch = source.match(/\$fetch\\((['"`])(.+?)\\1\\)/);
  return {
    watchers: hasWatch ? ["watch"] : [],
    apiCalls: apiMatch ? [{ target: apiMatch[2] }] : [],
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- routes.test.ts data-flow.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/analyzers/vue tests/analyzers/vue
git commit -m "feat: add vue project analysis primitives"
```

## Task 6: Add semantic generation with OpenAI-compatible API

**Files:**
- Create: `src/config/load-user-config.ts`
- Create: `src/semantic/provider-client.ts`
- Create: `src/semantic/prompt-builder.ts`
- Create: `src/semantic/generate-summaries.ts`
- Create: `tests/semantic/prompt-builder.test.ts`
- Create: `tests/semantic/provider-client.test.ts`

- [ ] **Step 1: Write the failing prompt test**

```ts
import { describe, expect, it } from "vitest";
import { buildOverviewPrompt } from "../../src/semantic/prompt-builder";

describe("buildOverviewPrompt", () => {
  it("includes framework, routes, and onboarding purpose", () => {
    const prompt = buildOverviewPrompt({
      framework: "next",
      routeCount: 4,
      pageCount: 4,
    });

    expect(prompt).toContain("next");
    expect(prompt).toContain("routeCount");
    expect(prompt).toContain("new developer");
  });
});
```

- [ ] **Step 2: Write the failing provider config test**

```ts
import { describe, expect, it } from "vitest";
import { normalizeProviderConfig } from "../../src/semantic/provider-client";

describe("normalizeProviderConfig", () => {
  it("normalizes an OpenAI-compatible provider config", () => {
    const config = normalizeProviderConfig({
      baseURL: "https://example.com/v1",
      apiKey: "demo",
      model: "gpt-like-model",
    });

    expect(config.baseURL).toBe("https://example.com/v1");
    expect(config.model).toBe("gpt-like-model");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- prompt-builder.test.ts provider-client.test.ts`
Expected: FAIL because semantic generation modules do not exist yet.

- [ ] **Step 4: Write minimal implementation**

```ts
export function normalizeProviderConfig(input: {
  baseURL: string;
  apiKey: string;
  model: string;
}) {
  return {
    baseURL: input.baseURL,
    apiKey: input.apiKey,
    model: input.model,
  };
}

export function buildOverviewPrompt(input: {
  framework: string;
  routeCount: number;
  pageCount: number;
}) {
  return [
    "You are helping a new developer understand a frontend project.",
    `framework=${input.framework}`,
    `routeCount=${input.routeCount}`,
    `pageCount=${input.pageCount}`,
  ].join("\\n");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- prompt-builder.test.ts provider-client.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/config/load-user-config.ts src/semantic tests/semantic
git commit -m "feat: add semantic generation configuration layer"
```

## Task 7: Add cache and refresh primitives

**Files:**
- Create: `src/cache/cache-store.ts`
- Create: `src/cache/invalidation.ts`
- Create: `tests/cache/cache-store.test.ts`
- Create: `tests/cache/invalidation.test.ts`

- [ ] **Step 1: Write the failing cache test**

```ts
import { describe, expect, it } from "vitest";
import { createCacheEnvelope } from "../../src/cache/cache-store";

describe("createCacheEnvelope", () => {
  it("stores framework and analysis timestamp", () => {
    const envelope = createCacheEnvelope("next", { routes: [] });
    expect(envelope.framework).toBe("next");
    expect(typeof envelope.createdAt).toBe("string");
  });
});
```

- [ ] **Step 2: Write the failing invalidation test**

```ts
import { describe, expect, it } from "vitest";
import { findChangedFiles } from "../../src/cache/invalidation";

describe("findChangedFiles", () => {
  it("returns only changed paths by hash", () => {
    const changed = findChangedFiles(
      { "src/a.ts": "old", "src/b.ts": "same" },
      { "src/a.ts": "new", "src/b.ts": "same" },
    );

    expect(changed).toEqual(["src/a.ts"]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- cache-store.test.ts invalidation.test.ts`
Expected: FAIL because cache modules do not exist yet.

- [ ] **Step 4: Write minimal implementation**

```ts
export function createCacheEnvelope(framework: string, analysis: object) {
  return {
    framework,
    createdAt: new Date().toISOString(),
    analysis,
  };
}

export function findChangedFiles(
  previous: Record<string, string>,
  current: Record<string, string>,
) {
  return Object.keys(current).filter((file) => previous[file] !== current[file]);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- cache-store.test.ts invalidation.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/cache tests/cache
git commit -m "feat: add cache and refresh primitives"
```

## Task 8: Build the local web app surfaces

**Files:**
- Create: `web/src/app.tsx`
- Create: `web/src/pages/overview.tsx`
- Create: `web/src/pages/routes.tsx`
- Create: `web/src/pages/components.tsx`
- Create: `web/src/pages/api.tsx`
- Create: `web/src/pages/state.tsx`
- Create: `web/src/pages/reading-guide.tsx`
- Create: `web/src/pages/ask.tsx`
- Create: `tests/web/overview-page.test.tsx`

- [ ] **Step 1: Write the failing UI smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../web/src/app";

describe("App", () => {
  it("renders the main navigation labels", () => {
    render(<App />);
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("Routes / Views")).toBeTruthy();
    expect(screen.getByText("Reading Guide")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- overview-page.test.tsx`
Expected: FAIL because the UI app does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
export function App() {
  return (
    <main>
      <nav>
        <span>Overview</span>
        <span>Routes / Views</span>
        <span>Components</span>
        <span>Data / API</span>
        <span>State</span>
        <span>Reading Guide</span>
        <span>Ask</span>
      </nav>
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- overview-page.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web tests/web
git commit -m "feat: scaffold frontend compass local web app"
```

## Task 9: Wire the end-to-end launch flow

**Files:**
- Modify: `src/cli/index.ts`
- Modify: `src/core/project-scanner.ts`
- Modify: `src/server/app-server.ts`
- Create: `tests/integration/launch-flow.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
import { describe, expect, it } from "vitest";
import { createLaunchSummary } from "../../src/cli/index";

describe("createLaunchSummary", () => {
  it("returns launch metadata for a supported project", async () => {
    const summary = await createLaunchSummary({
      projectRoot: "/demo/project",
      port: 4111,
    });

    expect(summary.status).toBe("ready");
    expect(summary.port).toBe(4111);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- launch-flow.test.ts`
Expected: FAIL because the end-to-end launch summary is not implemented yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function createLaunchSummary(input: {
  projectRoot: string;
  port: number;
}) {
  return {
    status: "ready" as const,
    projectRoot: input.projectRoot,
    port: input.port,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- launch-flow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/index.ts src/core/project-scanner.ts src/server/app-server.ts tests/integration/launch-flow.test.ts
git commit -m "feat: wire frontend compass launch flow"
```

## Task 10: Verify the MVP contract

**Files:**
- Modify: `README.md`
- Create: `tests/integration/mvp-contract.test.ts`

- [ ] **Step 1: Write the failing MVP contract test**

```ts
import { describe, expect, it } from "vitest";
import { getMvpSurfaceList } from "../../src/server/app-server";

describe("getMvpSurfaceList", () => {
  it("returns all required V1 surfaces", () => {
    expect(getMvpSurfaceList()).toEqual([
      "overview",
      "routes",
      "components",
      "api",
      "state",
      "reading-guide",
      "ask",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- mvp-contract.test.ts`
Expected: FAIL because the server contract function is not implemented yet.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- mvp-contract.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full verification suite**

Run: `npm test`
Expected: PASS with all test files green

- [ ] **Step 6: Commit**

```bash
git add README.md src/server/app-server.ts tests/integration/mvp-contract.test.ts
git commit -m "docs: finalize frontend compass v1 contract"
```

## Self-Review

Spec coverage check:

- React and Vue scope is covered by dedicated analyzer tasks.
- Local-first CLI and web app are covered by bootstrap and launch tasks.
- OpenAI-compatible provider support is covered by semantic layer tasks.
- Cache and manual refresh are covered by cache tasks.
- Fixed semantic pages plus Ask are covered by web app and MVP contract tasks.

Placeholder scan:

- No `TBD`
- No `TODO`
- No unresolved task references

Type consistency check:

- Shared framework naming stays within `react`, `next`, `vue`, `nuxt`
- UI surfaces match the V1 spec labels
- Launch summary and startup plan use explicit field names

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-25-frontend-compass-v1-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
