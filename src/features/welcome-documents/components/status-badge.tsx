import { Badge } from "@/components/ui/badge";

const TONE: Record<
  "draft" | "published" | "archived",
  { label: string; cls: string }
> = {
  draft: { label: "Draft", cls: "bg-muted text-foreground/80" },
  published: {
    label: "Published",
    cls: "bg-success-subtle text-success-strong",
  },
  archived: {
    label: "Archived",
    cls: "bg-muted text-muted-foreground",
  },
};

export function WelcomeStatusBadge({
  status,
}: {
  status: "draft" | "published" | "archived";
}) {
  const t = TONE[status];
  return (
    <Badge variant="secondary" className={`${t.cls} text-micro font-medium`}>
      {t.label}
    </Badge>
  );
}
