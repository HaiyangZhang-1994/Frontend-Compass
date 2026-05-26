export async function createLaunchSummary(input: {
  projectRoot: string;
  port: number;
}) {
  return {
    status: "ready" as const,
    projectRoot: input.projectRoot,
    port: input.port,
  };
}
