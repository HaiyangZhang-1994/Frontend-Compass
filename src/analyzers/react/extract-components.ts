export type ReactComponentExtractionResult = {
  componentNames: string[];
  customHooks: string[];
  childComponents: string[];
};

export function extractReactComponents(
  source: string,
): ReactComponentExtractionResult {
  const componentNames = [
    ...source.matchAll(/function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g),
  ].map((match) => match[1]);

  const customHooks = [
    ...source.matchAll(/\b(use[A-Z][A-Za-z0-9_]*)\s*\(/g),
  ]
    .map((match) => match[1])
    .filter((hook) => hook !== "useEffect" && hook !== "useState");

  const childComponents = [...source.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)].map(
    (match) => match[1],
  );

  return {
    componentNames: [...new Set(componentNames)],
    customHooks: [...new Set(customHooks)],
    childComponents: [...new Set(childComponents)],
  };
}
