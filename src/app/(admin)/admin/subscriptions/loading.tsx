import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  KpiGridSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";

export default function SubscriptionsLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={1} />
      <KpiGridSkeleton cols={4} />
      <FiltersSkeleton selects={2} />
      <TableSkeleton cols={7} rows={10} />
    </AdminSkeletonSection>
  );
}
