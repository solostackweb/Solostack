/**
 * Ask AI — time entry workflow E2E test.
 *
 * Exercises single-prompt duration + billable extraction and the explicit
 * "how long?" follow-up when the duration is missing.
 *
 * Required env:
 *   E2E_USER_EMAIL      -- non-admin user email
 *   E2E_USER_PASSWORD   -- its password
 */

import { test, expect, type Page } from "@playwright/test";
import { loginUser, openAiPanel, raceVisible, aiSubmit } from "./helpers";

const USER_EMAIL = process.env.E2E_USER_EMAIL;
const USER_PASSWORD = process.env.E2E_USER_PASSWORD;
const HAS_CREDS = Boolean(USER_EMAIL && USER_PASSWORD);

/** Approve the pre-create confirmation card before the entry is logged. */
async function confirmCreate(page: Page): Promise<void> {
  await expect(page.getByText("Log this time entry?")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Confirm.*create/i }).click();
}

test.describe("Ask AI time entry flow", () => {
  test.skip(!HAS_CREDS, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run Ask AI time entry tests.");

  test("logs a time entry from a single prompt", async ({ page }) => {
    test.setTimeout(90_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);
    await page.getByRole("button", { name: "Log time" }).click();

    await expect(page.getByText(/Let's log some time/i).first()).toBeVisible({ timeout: 8_000 });
    await aiSubmit(page, "Logged 2 hours 30 minutes on client calls and wireframe revisions for the homepage, billable");

    const result = await raceVisible(
      page,
      ["Log this time entry?", "Could not", "What work did you do", "How long"],
      60_000,
    );
    if (result.includes("Could not")) {
      throw new Error(`Time entry failed: "${result}"`);
    }
    await confirmCreate(page);

    await expect(page.getByText("Time entry logged")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open time tracker" })).toBeVisible();
  });

  test("asks how long when the duration is missing", async ({ page }) => {
    test.setTimeout(90_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);
    await page.getByRole("button", { name: "Log time" }).click();

    await expect(page.getByText(/Let's log some time/i).first()).toBeVisible({ timeout: 8_000 });
    // Describe the work but omit any duration.
    await aiSubmit(page, "Log time for a design review and feedback session, billable");

    await expect(page.getByText(/How long/i).first()).toBeVisible({ timeout: 30_000 });
    await aiSubmit(page, "1 hour");

    const result = await raceVisible(page, ["Log this time entry?", "Could not"], 60_000);
    if (result.includes("Could not")) {
      throw new Error(`Time entry failed after duration prompt: "${result}"`);
    }
    await confirmCreate(page);
    await expect(page.getByText("Time entry logged")).toBeVisible();
  });

  test("logs time via free-form prompt and navigates to the tracker", async ({ page }) => {
    test.setTimeout(90_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);

    await aiSubmit(page, "Log 1 hour 15 minutes billable time for code review");

    await expect(page.getByText(/code review/i).first()).toBeVisible({ timeout: 10_000 });

    const result = await raceVisible(page, ["Log this time entry?", "Could not", "What work did you do", "How long"], 60_000);
    if (result.includes("Could not")) {
      throw new Error(`Free-form time log failed: "${result}"`);
    }
    await confirmCreate(page);

    await expect(page.getByText("Time entry logged")).toBeVisible({ timeout: 5_000 });
    await page.getByRole("button", { name: "Open time tracker" }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/dashboard/time"), { timeout: 25_000 });
  });
});
