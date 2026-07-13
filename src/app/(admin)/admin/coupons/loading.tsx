import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  PanelSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";

export default function CouponsLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={1} />
      <PanelSkeleton lines={4} />
      <TableSkeleton cols={6} rows={8} withToolbar />
    </AdminSkeletonSection>
  );
}
