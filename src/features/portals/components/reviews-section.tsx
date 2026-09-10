"use client";

import * as React from "react";
import { Star, MessageSquare, CheckCircle2, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  createPortalReviewAction,
  getPortalReviewsAction,
  updatePortalReviewAction,
  deletePortalReviewAction,
  canClientReviewProjectAction,
} from "../actions-reviews";
import type { PortalReviewRow } from "@/lib/supabase/types";

interface ReviewStarProps {
  rating: number;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  value?: number;
}

function ReviewStar({
  rating,
  size = 20,
  interactive = false,
  onChange,
  value,
}: ReviewStarProps) {
  const displayValue = interactive ? (value ?? 0) : rating;

  return (
    <div className="flex items-center gap-0.5" role={interactive ? "radiogroup" : "img"} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type={interactive ? "button" : undefined}
          onClick={() => interactive && onChange?.(star)}
          onMouseEnter={() => interactive && onChange?.(star)}
          className={`flex-shrink-0 transition-colors ${interactive ? "hover:cursor-pointer" : ""}`}
          aria-label={`${star} star${star !== 1 ? "s" : ""}`}
          aria-checked={interactive ? displayValue === star : undefined}
          disabled={!interactive}
        >
          <Star
            className={`h-${size} w-${size} ${star <= displayValue ? "text-warning fill-warning" : "text-muted-foreground/30"}`}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}

interface ReviewCardProps {
  review: PortalReviewRow & {
    author_name?: string | null;
    author_email?: string | null;
    project_title?: string | null;
  };
  isOwner: boolean;
  currentUserId: string;
  portalId: string;
  onUpdate: () => void;
}

function ReviewCard({ review, isOwner, currentUserId, portalId, onUpdate }: ReviewCardProps) {
  const mine = review.author_id === currentUserId;
  const [editing, setEditing] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(review.title);
  const [editBody, setEditBody] = React.useState(review.body);
  const [editRating, setEditRating] = React.useState(review.rating);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave() {
    setPending(true);
    setError(null);
    const res = await updatePortalReviewAction({
      portalId,
      reviewId: review.id,
      rating: editRating,
      title: editTitle.trim(),
      body: editBody.trim(),
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing(false);
    onUpdate();
    toast.success("Review updated.");
  }

  async function handleDelete() {
    const confirmed = window.confirm("Delete this review? This cannot be undone.");
    if (!confirmed) return;

    setPending(true);
    const res = await deletePortalReviewAction({ portalId, reviewId: review.id });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onUpdate();
    toast.success("Review deleted.");
  }

  return (
    <Card className={`${mine ? "border-primary/30 bg-primary/5" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
              {review.author_name?.charAt(0)?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="text-sm font-medium">
                {mine ? "Your review" : review.author_name ?? "Client"}
              </p>
              <p className="text-xs text-muted-foreground">
                {review.author_email ?? ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ReviewStar rating={review.rating} size={16} />
            {mine && !editing && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditing(true)}
                  aria-label="Edit review"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </Button>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                    onClick={handleDelete}
                    disabled={pending}
                    aria-label="Delete review"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
            {editing && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(false); setError(null); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" className="h-7 w-7" onClick={handleSave} disabled={pending}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Rating</label>
                <ReviewStar
                  rating={editRating}
                  interactive
                  size={28}
                  onChange={setEditRating}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Review</label>
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  required
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(false); setError(null); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <ReviewStar rating={review.rating} size={20} />
                <span className="text-sm font-medium">{review.title}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{review.body}</p>
              <div className="flex items-center justify-between">
                <time className="text-xs text-muted-foreground" dateTime={review.created_at}>
                  {new Date(review.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </time>
                {review.project_title && (
                  <span className="text-xs text-muted-foreground">
                    Project: {review.project_title}
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
</Card>
    );
  }

interface ReviewsSectionProps {
  portalId: string;
  currentUserId: string;
  isOwner: boolean;
  reviews: Array<PortalReviewRow & { author_name?: string | null; author_email?: string | null; project_title?: string | null }>;
  onRefresh: () => void;
  availableProjects?: Array<{ id: string; name: string }>;
}

export function PortalReviewsSection({
  portalId,
  currentUserId,
  isOwner,
  reviews,
  onRefresh,
  availableProjects = [],
}: ReviewsSectionProps) {
  const [creating, setCreating] = React.useState(false);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>("");
  const [rating, setRating] = React.useState(5);
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [canReview, setCanReview] = React.useState<Record<string, boolean>>({});
  const [checking, setChecking] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!isOwner && availableProjects.length > 0) {
      availableProjects.forEach((project) => {
        checkCanReview(project.id);
      });
    }
  }, [availableProjects, isOwner]);

  async function checkCanReview(projectId: string) {
    if (checking[projectId]) return;
    setChecking((prev) => ({ ...prev, [projectId]: true }));
    try {
      const res = await canClientReviewProjectAction({ portalId, projectId });
      if (res.ok) {
        setCanReview((prev) => ({ ...prev, [projectId]: res.data.canReview }));
      }
    } catch {
      setCanReview((prev) => ({ ...prev, [projectId]: false }));
    } finally {
      setChecking((prev) => ({ ...prev, [projectId]: false }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !title.trim()) {
      setError("Please fill in both title and review.");
      return;
    }
    if (!selectedProjectId) {
      setError("Please select a project to review.");
      return;
    }
    setPending(true);
    setError(null);

    const res = await createPortalReviewAction({
      portalId,
      projectId: selectedProjectId,
      rating,
      title: title.trim(),
      body: body.trim(),
    });
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCreating(false);
    setRating(5);
    setTitle("");
    setBody("");
    setSelectedProjectId("");
    onRefresh();
    toast.success("Review submitted!");
  }

  const reviewableProjects = availableProjects.filter((p) => canReview[p.id] !== false);

  return (
    <Card id="portal-reviews" className="scroll-mt-24">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Reviews
          {reviews.length > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-micro font-semibold text-primary">
              {reviews.length}
            </span>
          )}
        </CardTitle>
        {!isOwner && !creating && reviewableProjects.length > 0 && (
          <Button size="sm" variant="outline" className="h-8" onClick={() => setCreating(true)}>
            <Star className="h-3.5 w-3.5" />
            Leave a Review
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center">
            <MessageSquare className="h-7 w-7 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {isOwner
                ? "No reviews yet. Completed projects will appear here when clients leave reviews."
                : "No reviews yet. Leave a review for a completed project!"}
            </p>
            {!isOwner && reviewableProjects.length > 0 && !checking[reviewableProjects[0]?.id] && (
              <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
                <Star className="h-3.5 w-3.5" />
                Leave a Review
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                isOwner={isOwner}
                currentUserId={currentUserId}
                portalId={portalId}
                onUpdate={onRefresh}
              />
            ))}
          </ul>
        )}

        {creating && (
          <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Project <span className="text-destructive">*</span></label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select a project</option>
                  {reviewableProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Rating</label>
                <ReviewStar rating={rating} interactive size={28} onChange={setRating} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Title <span className="text-destructive">*</span></label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Great experience, highly recommended"
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Your review <span className="text-destructive">*</span></label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  required
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-3" onClick={() => { setCreating(false); setError(null); setSelectedProjectId(""); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Submit Review"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}