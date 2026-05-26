import { describe, expect, it } from "vitest";
import { extractVueRoutes } from "../../../src/analyzers/vue/extract-routes.js";

describe("extractVueRoutes", () => {
  it("finds Nuxt pages and converts them to route paths", () => {
    const routes = extractVueRoutes([
      "pages/index.vue",
      "pages/profile.vue",
      "pages/account/security.vue",
    ]);

    expect(routes.map((route) => route.path)).toEqual([
      "/",
      "/profile",
      "/account/security",
    ]);
  });

  it("finds dynamic Nuxt routes", () => {
    const routes = extractVueRoutes(["pages/blog/[slug].vue"]);
    expect(routes.map((route) => route.path)).toEqual(["/blog/[slug]"]);
  });

  it("falls back to Vite Vue app shell when no page routes exist", () => {
    const routes = extractVueRoutes(["src/App.vue"]);
    expect(routes.map((route) => route.path)).toEqual(["/"]);
  });
});
