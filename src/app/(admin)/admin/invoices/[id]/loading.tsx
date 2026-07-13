import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  DetailSkeleton,
} from "@/components/admin/skeletons";

export default function InvoiceDetailLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={2} />
      <DetailSkeleton />
    </AdminSkeletonSection>
  );
}
