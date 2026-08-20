import * as React from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import type { ClientFeedItem } from "@/features/dashboard/server";
import { formatINR } from "@/lib/format";

export function RecentClients({ items }: { items: ClientFeedItem[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-bold tracking-tight">Recent clients</CardTitle>
          <CardDescription className="text-xs">
            Latest additions to your roster
          </CardDescription>
        </div>
        <Link
          href="/dashboard/clients"
          className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
        >
          View all →
        </Link>
      </CardHeader>
      <CardContent className="flex-1 px-2 pb-2">
        {items.length === 0 ? (
          <div className="px-2">
            <EmptyState
              icon={Users}
              title="No clients yet"
              description="Add your first client to start invoicing and tracking work."
              action={{ label: "Add client", href: "/dashboard/clients" }}
              className="min-h-[220px]"
            />
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/clients/${c.id}`}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all hover:bg-accent"
                >
                  <Avatar className="h-9 w-9 ring-1 ring-border">
                    <AvatarFallback className="bg-gradient-to-br from-primary/10 to-indigo-500/10 text-micro font-bold text-primary">
                      {c.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.email ?? "No email"}
                    </p>
                  </div>
                  {c.lifetimeValue > 0 && (
                    <div className="text-right">
                      <p className="text-micro font-semibold uppercase tracking-widest text-muted-foreground">
                        LTV
                      </p>
                      <p className="text-xs font-bold tabular-nums">
                        {formatINR(c.lifetimeValue, { compact: true })}
                      </p>
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
