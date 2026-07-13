import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  KpiGridSkeleton,
  PanelSkeleton,
} from "@/components/admin/skeletons";

export default function EmailsLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={1} />
      <KpiGridSkeleton cols={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelSkeleton lines={5} />
        <PanelSkeleton lines={5} />
      </div>
      <PanelSkeleton lines={4} />
    </AdminSkeletonSection>
  );
}
