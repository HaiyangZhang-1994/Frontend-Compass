import { describe, expect, it } from "vitest";
import {
  buildAppShellHtml,
  buildMetaPayload,
  getMvpSurfaceList,
} from "../../src/server/app-server.js";

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

describe("buildAppShellHtml", () => {
  it("renders the graph-first layout containers", () => {
    const html = buildAppShellHtml({
      projectRoot: "C:\\demo",
    });

    expect(html).toContain('id="graph-canvas"');
    expect(html).toContain('id="page-detail-list"');
    expect(html).toContain('id="edge-tooltip"');
  });

  it("does not render legacy surface cards and lower summary panels", () => {
    const html = buildAppShellHtml({
      projectRoot: "C:\\demo",
    });

    expect(html).not.toContain('id="surface-title"');
    expect(html).not.toContain('id="summary-highlights"');
    expect(html).not.toContain('class="card-grid"');
  });

  it("renders top meta chips for framework and cache context", () => {
    const html = buildAppShellHtml({
      projectRoot: "C:\\demo",
    });

    expect(html).toContain('id="meta-framework"');
    expect(html).toContain('id="meta-cache"');
    expect(html).toContain('id="meta-summary-source"');
  });

  it("renders graph controls", () => {
    const html = buildAppShellHtml({
      projectRoot: "C:\\demo",
    });

    expect(html).toContain('id="graph-fit"');
    expect(html).toContain('id="graph-relayout"');
  });
});

describe("buildMetaPayload", () => {
  it("includes config path diagnostics for provider debugging", () => {
    expect(
      buildMetaPayload({
        projectRoot: "C:\\project",
        cacheStatus: "hit",
        providerConfigured: true,
        configPath: "C:\\tool\\frontend-compass.config.json",
        configExists: true,
      }),
    ).toEqual({
      product: "Frontend Compass",
      projectRoot: "C:\\project",
      surfaces: [
        "overview",
        "routes",
        "components",
        "api",
        "state",
        "reading-guide",
        "ask",
      ],
      cacheStatus: "hit",
      providerConfigured: true,
      configPath: "C:\\tool\\frontend-compass.config.json",
      configExists: true,
    });
  });
});
