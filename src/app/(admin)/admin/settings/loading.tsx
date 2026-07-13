import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  PanelSkeleton,
} from "@/components/admin/skeletons";

export default function SettingsLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions={false} />
      <PanelSkeleton lines={5} />
      <PanelSkeleton lines={4} />
      <PanelSkeleton lines={3} />
    </AdminSkeletonSection>
  );
}
