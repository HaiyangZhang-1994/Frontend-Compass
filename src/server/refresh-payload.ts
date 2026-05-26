export function buildRefreshPayload(input: {
  cacheStatus: "hit" | "miss";
  routeCount: number;
  pageCount: number;
}) {
  return {
    ok: true,
    cacheStatus: input.cacheStatus,
    message: `Refresh complete. ${input.routeCount} route(s) and ${input.pageCount} page(s) are ready.`,
  };
}
