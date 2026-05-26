import { describe, expect, it } from "vitest";
import { extractReactRoutes } from "../../../src/analyzers/react/extract-routes.js";

describe("extractReactRoutes", () => {
  it("finds app router pages in Next.js", () => {
    const routes = extractReactRoutes([
      "app/page.tsx",
      "app/settings/page.tsx",
      "app/blog/[slug]/page.tsx",
    ]);

    expect(routes.map((route) => route.path)).toEqual([
      "/",
      "/settings",
      "/blog/[slug]",
    ]);
  });

  it("finds pages router pages in Next.js", () => {
    const routes = extractReactRoutes([
      "pages/index.tsx",
      "pages/profile.tsx",
      "pages/account/security.tsx",
    ]);

    expect(routes.map((route) => route.path)).toEqual([
      "/",
      "/profile",
      "/account/security",
    ]);
  });

  it("finds vite react entry views when no route system is present", () => {
    const routes = extractReactRoutes(["src/App.tsx"]);
    expect(routes.map((route) => route.path)).toEqual(["/"]);
  });
});
