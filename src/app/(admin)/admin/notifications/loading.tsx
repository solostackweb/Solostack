import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  KpiGridSkeleton,
  PanelSkeleton,
} from "@/components/admin/skeletons";

export default function NotificationsLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions={false} />
      <KpiGridSkeleton cols={3} />
      <PanelSkeleton lines={6} />
    </AdminSkeletonSection>
  );
}
