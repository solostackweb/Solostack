"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Filter } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";

import type { NotificationRecord } from "../server";
import {
  notificationToneClass,
  presentNotification,
} from "../presentation";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "../actions";

type FilterKey = "all" | "unread" | "activity";

interface NotificationsViewProps {
  initial: NotificationRecord[];
}

/**
 * Full-page notification center.
 *
 * Receives the initial server-rendered list as a prop, and uses server
 * actions for mark-as-read mutations. We also do an immediate optimistic
 * update so the UI feels instant; the server roundtrip then revalidates
 * the route to keep the cache consistent.
 */
export function NotificationsView({ initial }: NotificationsViewProps) {
  const router = useRouter();
  const [items, setItems] = React.useState<NotificationRecord[]>(initial);
  const [filter, setFilter] = React.useState<FilterKey>("all");
  const [, startTransition] = React.useTransition();

  // Keep local state in sync if the server pushes a new list (e.g. after
  // router.refresh()).
  React.useEffect(() => {
    setItems(initial);
  }, [initial]);

  const filtered = React.useMemo(() => {
    if (filter === "unread") return items.filter((n) => !n.read);
    if (filter === "activity")
      return items.filter(
        (n) => n.type.startsWith("client") || n.type.startsWith("contract"),
      );
    return items;
  }, [items, filter]);

  const unreadCount = items.filter((n) => !n.read).length;

  const markAllRead = () => {
    if (unreadCount === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    startTransition(async () => {
      const res = await markAllNotificationsReadAction();
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
        return;
      }
      toast.success("All notifications marked as read");
      router.refresh();
    });
  };

  const markOneRead = (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const res = await markNotificationReadAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        router.refresh();
      }
    });
  };

  const grouped = React.useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `You have ${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`
            : "You're all caught up."
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck /> Mark all read
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/settings/notifications">
                <Filter /> Preferences
              </Link>
            </Button>
          </div>
        }
      />

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as FilterKey)}
        className="space-y-4"
      >
        <div className="overflow-x-auto">
          <TabsList className="shrink-0">
            <TabsTrigger value="all">
              All <Count value={items.length} />
            </TabsTrigger>
            <TabsTrigger value="unread">
              Unread <Count value={unreadCount} />
            </TabsTrigger>
            <TabsTrigger value="activity">Clients & contracts</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={
            filter === "unread"
              ? "No unread notifications"
              : items.length === 0
                ? "No notifications yet"
                : "No notifications match this filter"
          }
          description={
            filter === "unread"
              ? "You're all caught up — enjoy the quiet."
              : "We'll let you know when something important happens — invoice payments, client activity, contract signatures, and more."
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.label} className="space-y-2">
              <h2 className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h2>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y">
                    {group.items.map((n) => (
                      <NotificationRow
                        key={n.id}
                        notification={n}
                        onMarkRead={() => markOneRead(n.id)}
                      />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Count({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-micro font-medium tabular-nums text-muted-foreground">
      {value}
    </span>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: NotificationRecord;
  onMarkRead: () => void;
}) {
  const { icon: Icon, tone, href } = presentNotification(notification);
  const unread = !notification.read;
  const Wrapper: React.ElementType = href ? Link : "div";
  const wrapperProps = href ? { href } : ({} as Record<string, never>);

  return (
    <li>
      <Wrapper
        {...wrapperProps}
        onClick={unread ? onMarkRead : undefined}
        className={cn(
          "group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/30",
          href && "cursor-pointer",
          unread && "bg-primary/[0.02]",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            notificationToneClass(tone),
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{notification.title}</p>
            {unread && (
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            )}
          </div>
          {notification.message && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {notification.message}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground/80">
            {formatRelativeTime(notification.createdAt)}
          </p>
        </div>
      </Wrapper>
    </li>
  );
}

interface GroupedNotifications {
  label: string;
  items: NotificationRecord[];
}

function groupByDay(items: NotificationRecord[]): GroupedNotifications[] {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yIso = yesterday.toISOString().slice(0, 10);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const wIso = weekAgo.toISOString().slice(0, 10);

  const todays: NotificationRecord[] = [];
  const yesterdays: NotificationRecord[] = [];
  const week: NotificationRecord[] = [];
  const older: NotificationRecord[] = [];

  for (const n of items) {
    const day = presentNotification(n).dateKey;
    if (day === today) todays.push(n);
    else if (day === yIso) yesterdays.push(n);
    else if (day >= wIso) week.push(n);
    else older.push(n);
  }

  return [
    { label: "Today", items: todays },
    { label: "Yesterday", items: yesterdays },
    { label: "Earlier this week", items: week },
    { label: "Older", items: older },
  ].filter((g) => g.items.length > 0);
}
