export type ReactApiCall = {
  target: string;
};

export type ReactDataFlowResult = {
  effects: string[];
  stateHooks: string[];
  handlers: string[];
  apiCalls: ReactApiCall[];
  navigationCalls: Array<{
    to: string;
    type: "link" | "anchor" | "router-push" | "router-replace" | "navigate";
    evidence: string;
    sourceFile?: string;
    line?: number;
  }>;
};

export function extractReactDataFlow(source: string): ReactDataFlowResult {
  const effects = source.includes("useEffect(") ? ["useEffect"] : [];
  const stateHooks = source.includes("useState(") ? ["useState"] : [];
  const handlers = [...source.matchAll(/(?:const|function)\s+([A-Za-z0-9_]+)\s*=?\s*(?:\(|async\s*\()/g)]
    .map((match) => match[1])
    .filter(Boolean);

  const apiCalls: ReactApiCall[] = [];
  const patterns = [
    /fetch\((['"`])(.+?)\1\)/g,
    /apiClient\.(get|post|put|patch|delete)\((['"`])(.+?)\2\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const target = match[3] ?? match[2];
      if (target) {
        apiCalls.push({ target });
      }
    }
  }

  const navigationCalls: ReactDataFlowResult["navigationCalls"] = [];
  const lineFromIndex = (index: number) => source.slice(0, Math.max(index, 0)).split("\n").length;
  const normalizePath = (value: string) =>
    value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
  const navPatterns: Array<{
    pattern: RegExp;
    type: ReactDataFlowResult["navigationCalls"][number]["type"];
    formatter: (match: RegExpMatchArray) => string;
  }> = [
    { pattern: /<Link[^>]*\s+href=(['"`])([^"'`]+)\1/gi, type: "link", formatter: (m) => m[0] },
    { pattern: /<Link[^>]*\s+href=\{(['"`])([^"'`]+)\1\}/gi, type: "link", formatter: (m) => m[0] },
    { pattern: /<a[^>]*\s+href=(['"`])([^"'`]+)\1/gi, type: "anchor", formatter: (m) => m[0] },
    { pattern: /<a[^>]*\s+href=\{(['"`])([^"'`]+)\1\}/gi, type: "anchor", formatter: (m) => m[0] },
    { pattern: /router\.push\((['"])([^'"]+)\1\)/g, type: "router-push", formatter: (m) => `router.push("${m[2]}")` },
    { pattern: /router\.push\(`([^`]+)`\)/g, type: "router-push", formatter: (m) => `router.push(\`${m[1]}\`)` },
    { pattern: /router\.replace\((['"])([^'"]+)\1\)/g, type: "router-replace", formatter: (m) => `router.replace("${m[2]}")` },
    { pattern: /router\.replace\(`([^`]+)`\)/g, type: "router-replace", formatter: (m) => `router.replace(\`${m[1]}\`)` },
    { pattern: /navigate\((['"])([^'"]+)\1\)/g, type: "navigate", formatter: (m) => `navigate("${m[2]}")` },
    { pattern: /navigate\(`([^`]+)`\)/g, type: "navigate", formatter: (m) => `navigate(\`${m[1]}\`)` },
    { pattern: /redirect\((['"])([^'"]+)\1\)/g, type: "navigate", formatter: (m) => `redirect("${m[2]}")` },
    { pattern: /redirect\(`([^`]+)`\)/g, type: "navigate", formatter: (m) => `redirect(\`${m[1]}\`)` },
  ];
  for (const navPattern of navPatterns) {
    for (const match of source.matchAll(navPattern.pattern)) {
      const rawTarget = match[2] ?? match[1];
      const to = normalizePath(rawTarget);
      if (to?.startsWith("/")) {
        navigationCalls.push({
          to,
          type: navPattern.type,
          evidence: navPattern.formatter(match),
          line: lineFromIndex(match.index ?? 0),
        });
      }
    }
  }

  return {
    effects,
    stateHooks,
    handlers,
    apiCalls,
    navigationCalls,
  };
}
