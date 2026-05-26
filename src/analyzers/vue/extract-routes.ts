export type VueRoute = {
  file: string;
  path: string;
};

function toPathFromSegments(segments: string[]) {
  const cleanSegments = segments.filter(Boolean);
  if (cleanSegments.length === 0) {
    return "/";
  }

  return `/${cleanSegments.join("/")}`;
}

function fromNuxtPages(file: string): VueRoute {
  const withoutPrefix = file.replace(/^pages\//, "");
  const base = withoutPrefix.replace(/\.vue$/, "");
  const segments = base === "index" ? [] : base.split("/").filter((segment) => segment !== "index");

  return {
    file,
    path: toPathFromSegments(segments),
  };
}

export function extractVueRoutes(files: string[]): VueRoute[] {
  const nuxtPages = files.filter(
    (file) => file.startsWith("pages/") && file.endsWith(".vue"),
  );

  if (nuxtPages.length > 0) {
    return nuxtPages.map(fromNuxtPages);
  }

  if (files.includes("src/App.vue")) {
    return [
      {
        file: "src/App.vue",
        path: "/",
      },
    ];
  }

  return [];
}
