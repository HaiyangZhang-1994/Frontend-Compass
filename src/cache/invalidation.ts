export function findChangedFiles(
  previous: Record<string, string>,
  current: Record<string, string>,
) {
  return Object.keys(current).filter((file) => previous[file] !== current[file]);
}
