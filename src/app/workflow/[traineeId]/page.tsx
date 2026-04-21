import { WorkflowSessionClient } from "./workflow-session-client";

export default async function WorkflowTraineePage({
  params,
  searchParams,
}: {
  params: Promise<{ traineeId: string }>;
  searchParams: Promise<{ position?: string }>;
}) {
  const { traineeId } = await params;
  const sp = await searchParams;
  const positionId = typeof sp.position === "string" ? sp.position : "";

  return <WorkflowSessionClient traineeId={traineeId} positionId={positionId} />;
}
