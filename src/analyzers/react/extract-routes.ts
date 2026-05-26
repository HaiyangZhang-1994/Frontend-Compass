export type ReactRoute = {
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

function fromNextAppRouter(file: string): ReactRoute {
  const withoutPrefix = file.replace(/^app\//, "");
  const normalized = withoutPrefix === "page.tsx" || withoutPrefix === "page.jsx"
    ? ""
    : withoutPrefix.replace(/\/page\.[^.]+$/, "");
  const segments = normalized
    .split("/")
    .filter((segment) => segment !== "page");

  return {
    file,
    path: toPathFromSegments(segments),
  };
}

function fromNextPagesRouter(file: string): ReactRoute {
  const withoutPrefix = file.replace(/^pages\//, "");
  const base = withoutPrefix.replace(/\.[^.]+$/, "");
  const segments = base === "index" ? [] : base.split("/").filter((segment) => segment !== "index");

  return {
    file,
    path: toPathFromSegments(segments),
  };
}

export function extractReactRoutes(files: string[]): ReactRoute[] {
  const appRouterFiles = files.filter(
    (file) => file.startsWith("app/") && /\/page\.[^.]+$|^app\/page\.[^.]+$/.test(file),
  );

  if (appRouterFiles.length > 0) {
    return appRouterFiles.map(fromNextAppRouter);
  }

  const pagesRouterFiles = files.filter(
    (file) => file.startsWith("pages/") && /\.(tsx|jsx|ts|js)$/.test(file),
  );

  if (pagesRouterFiles.length > 0) {
    return pagesRouterFiles.map(fromNextPagesRouter);
  }

  if (files.includes("src/App.tsx") || files.includes("src/App.jsx")) {
    return [
      {
        file: files.includes("src/App.tsx") ? "src/App.tsx" : "src/App.jsx",
        path: "/",
      },
    ];
  }

  return [];
}
