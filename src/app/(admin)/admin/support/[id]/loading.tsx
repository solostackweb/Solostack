import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  DetailSkeleton,
} from "@/components/admin/skeletons";

export default function SupportThreadLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={1} />
      <DetailSkeleton />
    </AdminSkeletonSection>
  );
}
