import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  KpiGridSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";

export default function JobsLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={1} />
      <KpiGridSkeleton cols={4} />
      <TableSkeleton cols={5} rows={8} withToolbar />
    </AdminSkeletonSection>
  );
}
