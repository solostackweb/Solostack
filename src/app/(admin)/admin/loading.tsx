/**
 * Command Center (/admin) loading skeleton.
 *
 * Mirrors the Now dashboard: header + status hero + integration panel,
 * a reliability KPI row, then the work-queue / metrics / sidebar grid.
 * Keeps the layout stable while the data fans out server-side.
 */
import {
  AdminSkeletonSection,
  PageHeaderSkeleton,
  KpiGridSkeleton,
  PanelSkeleton,
} from "@/components/admin/skeletons";

export default function AdminNowLoading() {
  return (
    <AdminSkeletonSection>
      <PageHeaderSkeleton withActions actionCount={4} />

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <PanelSkeleton withHeader={false} className="min-h-[220px]" lines={6} />
        <PanelSkeleton lines={4} />
      </section>

      <KpiGridSkeleton cols={5} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <PanelSkeleton lines={4} />
          <PanelSkeleton lines={4} />
          <PanelSkeleton lines={3} />
        </div>
        <aside className="space-y-4">
          <PanelSkeleton lines={5} />
          <PanelSkeleton lines={4} />
        </aside>
      </section>
    </AdminSkeletonSection>
  );
}
