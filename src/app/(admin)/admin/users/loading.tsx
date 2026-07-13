import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  FiltersSkeleton,
  TableSkeleton,
  CardListSkeleton,
} from "@/components/admin/skeletons";

export default function UsersLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={1} />
      <FiltersSkeleton selects={3} />
      <CardListSkeleton count={6} className="md:hidden" />
      <TableSkeleton cols={9} rows={12} className="hidden md:block" />
    </AdminSkeletonSection>
  );
}
