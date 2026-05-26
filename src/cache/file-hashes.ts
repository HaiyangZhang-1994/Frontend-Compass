import { createHash } from "node:crypto";

export function createSourceFileHashes(sourceByFile: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(sourceByFile).map(([file, source]) => [
      file,
      createHash("sha1").update(source).digest("hex"),
    ]),
  );
}
