import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  FiltersSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";

export default function AuditLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions={false} />
      <FiltersSkeleton selects={2} />
      <TableSkeleton cols={6} rows={14} />
    </AdminSkeletonSection>
  );
}
