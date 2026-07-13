import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  PanelSkeleton,
} from "@/components/admin/skeletons";

export default function FlagsLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions={false} />
      <PanelSkeleton withHeader={false} lines={0} className="min-h-[640px]" />
    </AdminSkeletonSection>
  );
}
