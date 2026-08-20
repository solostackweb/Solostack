"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format";

import type { NotificationRecord } from "@/features/notifications/server";
import {
  fetchNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions";
import {
  notificationToneClass,
  presentNotification,
} from "@/features/notifications/presentation";

/**
 * Bell-icon dropdown that lives in the top nav.
 *
 * The list is loaded lazily on mount via the `fetchNotificationsAction`
 * server action, then refreshed whenever the dropdown opens. Mutations
 * (mark-one / mark-all read) update local state optimistically and trigger
 * a router refresh so server-rendered counters elsewhere stay in sync.
 */
export function NotificationsMenu() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [, startTransition] = React.useTransition();

  const reload = React.useCallback(async () => {
    try {
      const { items, unreadCount } = await fetchNotificationsAction();
      setItems(items);
      setUnreadCount(unreadCount);
    } catch {
      // Silent: failed background fetch shouldn't break the rest of the
      // top-nav. The user can re-open the menu to retry.
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  // Re-fetch when the dropdown is opened so the list never feels stale.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void reload();
  };

  const hasUnread = unreadCount > 0;

  const onMarkAll = () => {
    if (!hasUnread) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    startTransition(async () => {
      const res = await markAllNotificationsReadAction();
      if (!res.ok) {
        toast.error(res.error);
        await reload();
        return;
      }
      router.refresh();
    });
  };

  const onClickItem = (id: string, alreadyRead: boolean) => {
    if (alreadyRead) return;
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const res = await markNotificationReadAction(undefined, fd);
      if (!res.ok) {
        toast.error(res.error);
        await reload();
        return;
      }
      router.refresh();
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={`Notifications${hasUnread ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {hasUnread && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight">Notifications</span>
            {hasUnread ? (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-micro font-bold text-primary-foreground">
                {unreadCount}
              </span>
            ) : null}
          </div>
          {hasUnread ? (
            <button
              type="button"
              onClick={onMarkAll}
              className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
            >
              Mark all read
            </button>
          ) : (
            <span className="flex items-center gap-1 text-micro font-medium text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" /> All caught up
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-[360px] overflow-y-auto py-1">
          {loading ? (
            <SkeletonList />
          ) : items.length === 0 ? (
            <EmptyDropdown />
          ) : (
            items.map((n) => (
              <NotificationDropdownRow
                key={n.id}
                notification={n}
                onClick={() => onClickItem(n.id, n.read)}
              />
            ))
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <div className="p-1">
          <Link
            href="/dashboard/notifications"
            className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-accent"
          >
            View all notifications →
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationDropdownRow({
  notification,
  onClick,
}: {
  notification: NotificationRecord;
  onClick: () => void;
}) {
  const { icon: Icon, tone, href } = presentNotification(notification);
  const unread = !notification.read;
  const inner = (
    <>
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset shadow-sm",
          notificationToneClass(tone),
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold">{notification.title}</p>
          {unread && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_6px_currentColor]" />
          )}
        </div>
        {notification.message && (
          <p className="truncate text-xs text-muted-foreground">
            {notification.message}
          </p>
        )}
        <p className="mt-0.5 text-micro font-medium text-muted-foreground/80">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
    </>
  );

  const className = cn(
    "group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none",
    unread && "bg-primary/[0.03]",
  );

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      {inner}
    </button>
  );
}

function EmptyDropdown() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-indigo-500/10 text-primary ring-1 ring-primary/15">
        <Bell className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold">No notifications</p>
        <p className="text-xs text-muted-foreground">You&apos;re all caught up.</p>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2 p-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-full animate-pulse rounded bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );
}
