import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";

export default function SupportLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={1} />
      <FiltersSkeleton selects={2} />
      <TableSkeleton cols={6} rows={12} />
    </AdminSkeletonSection>
  );
}
