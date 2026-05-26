import { extractVueComponents } from "./extract-components.js";
import { extractVueDataFlow } from "./extract-data-flow.js";
import { extractVueRoutes } from "./extract-routes.js";

export function analyzeVueProject(input: {
  files: string[];
  sourceByFile: Record<string, string>;
}) {
  const routes = extractVueRoutes(input.files);

  return {
    routes,
    pages: routes.map((route) => {
      const source = input.sourceByFile[route.file] ?? "";
      return {
        file: route.file,
        path: route.path,
        components: extractVueComponents(source),
        dataFlow: extractVueDataFlow(source),
      };
    }),
  };
}
