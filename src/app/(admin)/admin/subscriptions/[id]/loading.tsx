import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  DetailSkeleton,
} from "@/components/admin/skeletons";

export default function SubscriptionDetailLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={2} />
      <DetailSkeleton />
    </AdminSkeletonSection>
  );
}
