import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  KpiGridSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";

export default function SecurityLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={1} />
      <KpiGridSkeleton cols={3} />
      <FiltersSkeleton selects={2} />
      <TableSkeleton cols={6} rows={12} />
    </AdminSkeletonSection>
  );
}
