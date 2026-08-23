import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { newId } from "../components/assistant-helpers";

/**
 * Panel-generated ids flow into audited tool actions as `requestId` /
 * `idempotencyKey`, whose schemas require UUID shape. A non-UUID id fails
 * server validation before any work runs - the unbilled-time, refinement,
 * and support-forward flows were unreachable from the panel because of this
 * (IVO-005). This pins the contract at the source.
 */
describe("panel id generation", () => {
  it("produces UUID-shaped ids that pass server tool schemas", () => {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (let i = 0; i < 20; i++) {
      assert.match(newId(), uuidPattern);
    }
  });

  it("produces unique ids across calls", () => {
    const seen = new Set(Array.from({ length: 50 }, () => newId()));
    assert.equal(seen.size, 50);
  });
});
