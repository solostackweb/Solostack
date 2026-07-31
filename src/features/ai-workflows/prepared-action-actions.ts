"use server";

/** Public read/prepare surface. Delivery and dismissal are mutations and must
 * go through the audited tools in `tool-actions.ts`. */
import { refreshIvoPreparedActionsAction as refreshPreparedActions } from "./prepared-actions";

export async function refreshIvoPreparedActionsAction() {
  return refreshPreparedActions();
}
