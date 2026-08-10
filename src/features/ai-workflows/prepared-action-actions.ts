"use server";

/** Client-safe server-action facade. It keeps provider, email, and database
 * implementations out of browser bundles; the Ivo panel additionally routes
 * delivery and dismissal through the audited tools in `tool-actions.ts`. */
import {
  approveAndSendPreparedActionAction as approveAndSendPreparedAction,
  refreshIvoPreparedActionsAction as refreshPreparedActions,
  resolveIvoPreparedActionAction as resolvePreparedAction,
} from "./prepared-actions";

export async function refreshIvoPreparedActionsAction() {
  return refreshPreparedActions();
}

/** Legacy dashboard-card mutations stay behind an explicit server boundary.
 * The Ivo panel uses the audited tool wrappers; this facade prevents any
 * server-only provider/database code from entering the browser bundle. */
export async function approveAndSendPreparedActionAction(
  input: Parameters<typeof approveAndSendPreparedAction>[0],
) {
  return approveAndSendPreparedAction(input);
}

export async function resolveIvoPreparedActionAction(
  input: Parameters<typeof resolvePreparedAction>[0],
) {
  return resolvePreparedAction(input);
}
