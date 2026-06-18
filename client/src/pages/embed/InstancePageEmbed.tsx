/**
 * InstancePageEmbed.tsx
 * Public embeddable pages for workshop instances and cohort groups.
 * Routes: /embed/instance/workshop/:instanceId, /embed/instance/cohort/:groupId
 */
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { BlockPreview } from "@/components/BlockPreview";
import { RemainingSeatsBlock } from "@/components/RemainingSeatsBlock";
import { Skeleton } from "@/components/ui/skeleton";

function EmbedLandingBlock({
  block,
  workshopInstanceId,
  cohortGroupId,
}: {
  block: any;
  workshopInstanceId?: number;
  cohortGroupId?: number;
}) {
  if (block.type === "remaining_seats") {
    const rsData = { ...block.data };
    if (workshopInstanceId && (!rsData.sourceId || Number(rsData.sourceId) === 0)) {
      rsData.sourceId = workshopInstanceId;
      rsData.sourceType = "workshop_instance";
    }
    if (cohortGroupId && (!rsData.sourceId || Number(rsData.sourceId) === 0)) {
      rsData.sourceId = cohortGroupId;
      rsData.sourceType = "cohort_group";
    }
    return <RemainingSeatsBlock data={rsData} />;
  }
  return <BlockPreview block={block} />;
}

export default function InstancePageEmbed() {
  const params = useParams<{ instanceId?: string; groupId?: string }>();
  const workshopInstanceId = params.instanceId ? Number(params.instanceId) : null;
  const cohortGroupId = params.groupId ? Number(params.groupId) : null;
  const isWorkshop = workshopInstanceId != null && !Number.isNaN(workshopInstanceId);

  const workshopQuery = trpc.workshop.getInstancePage.useQuery(
    { instanceId: workshopInstanceId! },
    { enabled: isWorkshop && !!workshopInstanceId },
  );
  const cohortQuery = trpc.lms.getCohortGroupPage.useQuery(
    { cohortGroupId: cohortGroupId! },
    { enabled: !isWorkshop && !!cohortGroupId },
  );

  const data = isWorkshop ? workshopQuery.data : cohortQuery.data;
  const isLoading = isWorkshop ? workshopQuery.isLoading : cohortQuery.isLoading;
  const error = isWorkshop ? workshopQuery.error : cohortQuery.error;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-6 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-sm text-gray-500">
        This page is not available for embedding.
      </div>
    );
  }

  const blocks = (data.landingBlocks ?? []) as any[];
  const heading = isWorkshop ? data.title : ("name" in data ? data.name : "");

  return (
    <div className="min-h-screen bg-white">
      {blocks.length > 0 ? (
        <div>
          {blocks.map((block: any) => (
            <EmbedLandingBlock
              key={block.id}
              block={block}
              workshopInstanceId={workshopInstanceId ?? undefined}
              cohortGroupId={cohortGroupId ?? undefined}
            />
          ))}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto p-6 space-y-4">
          <h1 className="text-xl font-bold text-gray-900">{heading}</h1>
          {"description" in data && data.description && (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.description}</p>
          )}
          {"instanceContent" in data && data.instanceContent && (
            <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: data.instanceContent }} />
          )}
        </div>
      )}
    </div>
  );
}
