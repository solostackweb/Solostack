import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  KpiGridSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";

export default function SentryLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={2} />
      <KpiGridSkeleton cols={4} />
      <TableSkeleton cols={5} rows={12} withToolbar />
    </AdminSkeletonSection>
  );
}
