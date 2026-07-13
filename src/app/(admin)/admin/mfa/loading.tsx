import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  PanelSkeleton,
} from "@/components/admin/skeletons";

export default function MfaLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions={false} />
      <PanelSkeleton lines={5} />
    </AdminSkeletonSection>
  );
}
