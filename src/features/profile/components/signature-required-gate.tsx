import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SignatureRequiredGate({
  title,
  description,
  ctaLabel,
}: {
  title: string;
  description: string;
  ctaLabel: string;
}) {
  return (
    <Card className="border-warning-subtle bg-warning-subtle">
      <CardContent className="space-y-4 p-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-warning-strong">{title}</p>
          <p className="text-sm text-warning-strong">{description}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard/settings/profile#signature">{ctaLabel}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/settings/profile">Open profile settings</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
