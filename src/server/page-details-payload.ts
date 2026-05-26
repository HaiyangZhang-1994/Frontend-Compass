import type { AnalysisSnapshot } from "../analyzers/shared/types.js";
import { buildPageNodeId } from "./page-graph-payload.js";

export function buildPageDetailsPayload(snapshot: AnalysisSnapshot, nodeId: string) {
  const selectedRoute = snapshot.routes.find((route) => buildPageNodeId(route) === nodeId);
  if (!selectedRoute) {
    return null;
  }

  const selectedPage = snapshot.pages.find((page) => page.file === selectedRoute.file && page.path === selectedRoute.path);
  if (!selectedPage) {
    return null;
  }

  const routeByPath = new Map(snapshot.routes.map((route) => [route.path, route]));
  const navigationEdges = snapshot.navigationEdges ?? [];
  const incomingEdges = navigationEdges
    .filter((edge) => edge.to === selectedRoute.path)
    .map((edge) => {
      const fromRoute = routeByPath.get(edge.from);
      return {
        from: fromRoute?.path ?? edge.from,
        to: selectedRoute.path,
        type: edge.type,
        evidence: edge.evidence,
        sourceFile: edge.sourceFile,
        line: edge.line,
      };
    });
  const outgoingEdges = navigationEdges
    .filter((edge) => edge.from === selectedRoute.path)
    .map((edge) => {
      const toRoute = routeByPath.get(edge.to);
      return {
        from: selectedRoute.path,
        to: toRoute?.path ?? edge.to,
        type: edge.type,
        evidence: edge.evidence,
        sourceFile: edge.sourceFile,
        line: edge.line,
      };
    });

  return {
    id: nodeId,
    path: selectedPage.path,
    file: selectedPage.file,
    components: [
      ...(selectedPage.components.componentNames ?? []),
      ...selectedPage.components.childComponents,
    ],
    handlers: selectedPage.dataFlow.handlers ?? [],
    apiCalls: selectedPage.dataFlow.apiCalls.map((call) => call.target),
    stateSignals: [
      ...(selectedPage.dataFlow.stateHooks ?? []),
      ...(selectedPage.dataFlow.stateSignals ?? []),
    ],
    incomingEdges,
    outgoingEdges,
    componentItems: [
      ...(selectedPage.components.componentNames ?? []),
      ...selectedPage.components.childComponents,
    ].map((name) => ({
      label: name,
      code: name,
      sourceFile: selectedPage.file,
    })),
    handlerItems: (selectedPage.dataFlow.handlers ?? []).map((name) => ({
      label: name,
      code: name,
      sourceFile: selectedPage.file,
    })),
    outgoingRouteItems: outgoingEdges.map((edge) => ({
      label: `${selectedPage.path} -> ${edge.to} [${edge.type}]`,
      code: edge.evidence,
      sourceFile: edge.sourceFile ?? selectedPage.file,
      line: edge.line,
    })),
    incomingRouteItems: incomingEdges.map((edge) => ({
      label: `${edge.from} -> ${selectedPage.path} [${edge.type}]`,
      code: edge.evidence,
      sourceFile: edge.sourceFile ?? selectedPage.file,
      line: edge.line,
    })),
    componentTreeItems: [] as Array<{
      id: string;
      label: string;
      code: string;
      sourceFile: string;
      line?: number;
      kind: "component" | "handler";
      children?: unknown[];
    }>,
    functionSummaryItems: [] as Array<{
      label: string;
      summary: string;
      code: string;
      sourceFile: string;
      line?: number;
    }>,
    evidence: [...incomingEdges, ...outgoingEdges].map((edge) => edge.evidence),
    evidenceItems: [...incomingEdges, ...outgoingEdges].map((edge) => ({
      code: edge.evidence,
      sourceFile: edge.sourceFile ?? selectedPage.file,
      line: edge.line,
    })),
  };
}
