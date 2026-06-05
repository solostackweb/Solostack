/**
 * Ask AI — client creation workflow E2E test.
 *
 * Exercises the intelligence-layer flow: a single natural-language prompt is
 * interpreted into structured fields, the client name is mapped correctly,
 * and a missing name is asked for explicitly.
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

const UNIQUE_SUFFIX = Date.now().toString().slice(-5);
const TEST_CLIENT_NAME = `E2E Test Client ${UNIQUE_SUFFIX}`;

/** If the optional contact-details question appears, reply "skip". */
async function skipContactIfAsked(page: Page): Promise<void> {
  const contactQ = page.getByText(/email, phone, and state/i);
  if (await contactQ.isVisible().catch(() => false)) {
    await aiSubmit(page, "skip");
  }
}

/** Approve the pre-create confirmation card. */
async function confirmCreate(page: Page): Promise<void> {
  await expect(page.getByText("Create this client?")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Confirm.*create/i }).click();
}

test.describe("Ask AI client flow", () => {
  test.skip(!HAS_CREDS, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run Ask AI client tests.");

  test("maps the client name correctly from a single prompt", async ({ page }) => {
    test.setTimeout(90_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);
    await page.getByRole("button", { name: "Add client" }).click();

    // The workflow opens with a free-form intro — no scripted question steps.
    await expect(page.getByText(/Let's add a client/i).first()).toBeVisible({ timeout: 8_000 });

    await aiSubmit(
      page,
      `Add ${TEST_CLIENT_NAME}, business ${TEST_CLIENT_NAME} Corp, email e2etest${UNIQUE_SUFFIX}@example.com, phone +91 9876500000, based in Mumbai. Notes: automated E2E client, can be deleted.`,
    );

    const result = await raceVisible(
      page,
      ["Create this client?", "Could not", "Tell me about the client", "What's the client's name"],
      60_000,
    );
    if (result.includes("Could not") || result.includes("Tell me about")) {
      throw new Error(`Client creation failed: "${result}"`);
    }

    // Confirm summary shows the mapped name before the record is created.
    await confirmCreate(page);

    await expect(page.getByText("Client created")).toBeVisible();
    // The core fix: the client name is mapped from the prompt, not the question text.
    await expect(page.getByText(new RegExp(`Added ${TEST_CLIENT_NAME}`, "i"))).toBeVisible();

    await page.getByRole("button", { name: "Open clients" }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/dashboard/clients"), { timeout: 25_000 });
  });

  test("asks for the name explicitly when it is missing", async ({ page }) => {
    test.setTimeout(90_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);
    await page.getByRole("button", { name: "Add client" }).click();

    await expect(page.getByText(/Let's add a client/i).first()).toBeVisible({ timeout: 8_000 });

    // No name in the prompt — the assistant must ask for it.
    await aiSubmit(page, "I want to add a new client to my workspace");

    await expect(page.getByText(/What's the client's name/i).first()).toBeVisible({ timeout: 30_000 });

    // Answering with just the name should map it; then it offers contact details.
    await aiSubmit(page, TEST_CLIENT_NAME);

    await expect(page.getByText(/email, phone, and state/i)).toBeVisible({ timeout: 30_000 });
    await aiSubmit(page, "skip");

    await confirmCreate(page);

    const result = await raceVisible(page, ["Client created", "Could not"], 60_000);
    if (result.includes("Could not")) {
      throw new Error(`Client creation failed after name prompt: "${result}"`);
    }
    await expect(page.getByText("Client created")).toBeVisible();
    await expect(page.getByText(new RegExp(`Added ${TEST_CLIENT_NAME}`, "i"))).toBeVisible();
  });

  test("creates a client via free-form prompt in general mode", async ({ page }) => {
    test.setTimeout(90_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);

    const freeFormName = `FreeForm Client ${UNIQUE_SUFFIX}`;
    await aiSubmit(
      page,
      `Create a new client called ${freeFormName}, email ff${UNIQUE_SUFFIX}@example.com, based in Delhi`,
    );

    // User message echo confirms the submission was processed.
    await expect(page.getByText(/FreeForm Client/i).first()).toBeVisible({ timeout: 10_000 });

    const result = await raceVisible(
      page,
      ["Create this client?", "Could not", "What's the client's name", "email, phone, and state"],
      60_000,
    );
    if (result.includes("Could not")) {
      throw new Error(`Free-form client creation failed: "${result}"`);
    }
    await skipContactIfAsked(page);
    await confirmCreate(page);
    await expect(page.getByText("Client created")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(new RegExp(`Added ${freeFormName}`, "i"))).toBeVisible();
  });
});
