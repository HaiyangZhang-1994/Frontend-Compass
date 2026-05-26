import type { AnalysisRoute, AnalysisSnapshot } from "../analyzers/shared/types.js";

export function buildPageNodeId(route: AnalysisRoute) {
  return `${route.path}::${route.file}`;
}

function buildNodeLabel(route: AnalysisRoute) {
  return route.file.replace(/\\/g, "/");
}

export function buildPageGraphPayload(snapshot: AnalysisSnapshot) {
  const routeByPath = new Map(snapshot.routes.map((route) => [route.path, route]));
  const edgeMap = new Map<string, {
    from: string;
    to: string;
    types: string[];
    evidences: string[];
    evidenceDetails: Array<{ code: string; sourceFile?: string; line?: number }>;
  }>();

  for (const edge of snapshot.navigationEdges ?? []) {
    const fromRoute = routeByPath.get(edge.from);
    const toRoute = routeByPath.get(edge.to);
    if (!fromRoute || !toRoute) {
      continue;
    }
    const from = buildPageNodeId(fromRoute);
    const to = buildPageNodeId(toRoute);
    const key = `${from}=>${to}`;
    const existing = edgeMap.get(key);
    if (!existing) {
      edgeMap.set(key, {
        from,
        to,
        types: [edge.type],
        evidences: [edge.evidence],
        evidenceDetails: [{ code: edge.evidence, sourceFile: edge.sourceFile, line: edge.line }],
      });
      continue;
    }
    if (!existing.types.includes(edge.type)) {
      existing.types.push(edge.type);
    }
    if (!existing.evidences.includes(edge.evidence)) {
      existing.evidences.push(edge.evidence);
      existing.evidenceDetails.push({ code: edge.evidence, sourceFile: edge.sourceFile, line: edge.line });
    }
  }

  return {
    framework: snapshot.framework,
    nodes: snapshot.routes.map((route) => ({
      id: buildPageNodeId(route),
      path: route.path,
      file: route.file,
      label: buildNodeLabel(route),
    })),
    edges: [...edgeMap.values()],
  };
}
