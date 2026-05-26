export type VueComponentExtractionResult = {
  composables: string[];
  childComponents: string[];
};

export function extractVueComponents(
  source: string,
): VueComponentExtractionResult {
  const composables = [
    ...source.matchAll(/\b(use[A-Z][A-Za-z0-9_]*)\s*\(/g),
  ].map((match) => match[1]);

  const childComponents = [...source.matchAll(/<([A-Z][A-Za-z0-9_]*)\b/g)].map(
    (match) => match[1],
  );

  return {
    composables: [...new Set(composables)],
    childComponents: [...new Set(childComponents)],
  };
}
