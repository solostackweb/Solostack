/**
 * Compact loading state for the admin route group.
 *
 * Single line, no spinner - the founder will hit this dozens of times
 * a day. A flashing skeleton is noisier than necessary; a tiny
 * "Loading..." string at the same vertical position keeps the layout
 * stable while data fans out.
 */
export default function AdminLoading() {
  return (
    <div className="text-xs text-muted-foreground" role="status">
      Loading...
    </div>
  );
}
