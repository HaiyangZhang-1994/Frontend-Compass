export type VueApiCall = {
  target: string;
};

export type VueDataFlowResult = {
  watchers: string[];
  stateSignals: string[];
  handlers: string[];
  apiCalls: VueApiCall[];
  navigationCalls: Array<{
    to: string;
    type: "link" | "anchor" | "router-push" | "navigate-to";
    evidence: string;
  }>;
};

export function extractVueDataFlow(source: string): VueDataFlowResult {
  const watchers = source.includes("watch(") ? ["watch"] : [];
  const handlers = [...source.matchAll(/(?:const|function)\s+([A-Za-z0-9_]+)\s*=?\s*(?:\(|async\s*\()/g)]
    .map((match) => match[1])
    .filter(Boolean);

  const stateSignals: string[] = [];
  if (source.includes("ref(")) {
    stateSignals.push("ref");
  }
  if (source.includes("reactive(")) {
    stateSignals.push("reactive");
  }
  if (source.includes("computed(")) {
    stateSignals.push("computed");
  }

  const apiCalls: VueApiCall[] = [];
  const patterns = [
    /\$fetch\((['"`])(.+?)\1\)/g,
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

  const navigationCalls: VueDataFlowResult["navigationCalls"] = [];
  const normalizePath = (value: string) =>
    value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
  const navPatterns: Array<{
    pattern: RegExp;
    type: VueDataFlowResult["navigationCalls"][number]["type"];
    formatter: (match: RegExpMatchArray) => string;
  }> = [
    { pattern: /<NuxtLink[^>]*\s+to=(['"`])([^"'`]+)\1/gi, type: "link", formatter: (m) => m[0] },
    { pattern: /<NuxtLink[^>]*\s+to=\{(['"`])([^"'`]+)\1\}/gi, type: "link", formatter: (m) => m[0] },
    { pattern: /<RouterLink[^>]*\s+to=(['"`])([^"'`]+)\1/gi, type: "link", formatter: (m) => m[0] },
    { pattern: /<RouterLink[^>]*\s+to=\{(['"`])([^"'`]+)\1\}/gi, type: "link", formatter: (m) => m[0] },
    { pattern: /<a[^>]*\s+href=(['"`])([^"'`]+)\1/gi, type: "anchor", formatter: (m) => m[0] },
    { pattern: /<a[^>]*\s+href=\{(['"`])([^"'`]+)\1\}/gi, type: "anchor", formatter: (m) => m[0] },
    { pattern: /router\.push\((['"])([^'"]+)\1\)/g, type: "router-push", formatter: (m) => `router.push("${m[2]}")` },
    { pattern: /router\.push\(`([^`]+)`\)/g, type: "router-push", formatter: (m) => `router.push(\`${m[1]}\`)` },
    { pattern: /navigateTo\((['"])([^'"]+)\1\)/g, type: "navigate-to", formatter: (m) => `navigateTo("${m[2]}")` },
    { pattern: /navigateTo\(`([^`]+)`\)/g, type: "navigate-to", formatter: (m) => `navigateTo(\`${m[1]}\`)` },
  ];
  for (const navPattern of navPatterns) {
    for (const match of source.matchAll(navPattern.pattern)) {
      const to = normalizePath(match[2]);
      if (to?.startsWith("/")) {
        navigationCalls.push({
          to,
          type: navPattern.type,
          evidence: navPattern.formatter(match),
        });
      }
    }
  }

  return {
    watchers,
    stateSignals,
    handlers,
    apiCalls,
    navigationCalls,
  };
}
