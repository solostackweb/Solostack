import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  PanelSkeleton,
} from "@/components/admin/skeletons";

export default function QueryLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions={false} />
      <PanelSkeleton withHeader={false} lines={0} className="min-h-[420px]" />
    </AdminSkeletonSection>
  );
}
