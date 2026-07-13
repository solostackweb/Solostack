import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  KpiGridSkeleton,
  TableSkeleton,
} from "@/components/admin/skeletons";

export default function RazorpayLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={2} />
      <KpiGridSkeleton cols={5} count={10} />
      <TableSkeleton cols={6} rows={10} withToolbar />
    </AdminSkeletonSection>
  );
}
