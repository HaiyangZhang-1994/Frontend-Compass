const EXCLUDED_PREFIXES = [
  "node_modules/",
  ".next/",
  ".nuxt/",
  "dist/",
  "build/",
  "coverage/",
];

export function shouldIncludeFile(file: string): boolean {
  return !EXCLUDED_PREFIXES.some((prefix) => file.startsWith(prefix));
}
