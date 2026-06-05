/**
 * Ask AI — project creation workflow E2E test.
 *
 * Exercises single-prompt field extraction, the explicit "ask for the missing
 * name" loop, and the explicit client picker (a project must be assigned to a
 * client or explicitly marked internal — it never silently inherits a client
 * from a previous workflow).
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
const TEST_PROJECT_NAME = `E2E Project ${UNIQUE_SUFFIX}`;

/** When the project client picker appears, mark the project internal (skip). */
async function skipClientIfAsked(page: Page): Promise<void> {
  const skip = page.getByRole("button", { name: "No client (internal)" });
  try {
    await skip.waitFor({ state: "visible", timeout: 30_000 });
    await skip.click();
  } catch {
    /* Picker never surfaced (a client was resolved) — nothing to skip. */
  }
}

/** Click through the pre-create confirmation card. */
async function confirmCreate(page: Page): Promise<void> {
  const confirm = page.getByRole("button", { name: /Confirm.*create/i });
  await confirm.waitFor({ state: "visible", timeout: 30_000 });
  await confirm.click();
}

test.describe("Ask AI project flow", () => {
  test.skip(!HAS_CREDS, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run Ask AI project tests.");

  test("asks which client for a project, then creates it when skipped", async ({ page }) => {
    test.setTimeout(90_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);
    await page.getByRole("button", { name: "Add project" }).click();

    await expect(page.getByText(/Let's create a project/i).first()).toBeVisible({ timeout: 8_000 });

    // Name + scope but no client — the assistant must explicitly ask for one.
    await aiSubmit(
      page,
      `Create a project called ${TEST_PROJECT_NAME}, scope is a full-stack web app with auth, dashboard and REST API, status active, starts next Monday and due in 6 weeks`,
    );

    await expect(page.getByText("Which client is this project for?")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "No client (internal)" }).click();

    // Confirmation card before the record is created.
    await expect(page.getByText("Create this project?")).toBeVisible({ timeout: 30_000 });
    await confirmCreate(page);

    await expect(page.getByText("Project created")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(new RegExp(`${TEST_PROJECT_NAME} is ready`, "i"))).toBeVisible();
    await page.getByRole("button", { name: "Open projects" }).click();
    await page.waitForURL((url) => url.pathname.startsWith("/dashboard/projects"), { timeout: 25_000 });
  });

  test("asks for the project name when it is missing", async ({ page }) => {
    test.setTimeout(90_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);
    await page.getByRole("button", { name: "Add project" }).click();

    await expect(page.getByText(/Let's create a project/i).first()).toBeVisible({ timeout: 8_000 });

    await aiSubmit(page, "I need to set up a new project, scope is branding work");

    await expect(page.getByText(/What should I name this project/i).first()).toBeVisible({ timeout: 30_000 });
    await aiSubmit(page, TEST_PROJECT_NAME);

    // After the name, the client picker is the next explicit gate.
    await expect(page.getByText("Which client is this project for?")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "No client (internal)" }).click();

    await expect(page.getByText("Create this project?")).toBeVisible({ timeout: 30_000 });
    await confirmCreate(page);

    const result = await raceVisible(page, ["Project created", "Could not"], 60_000);
    if (result.includes("Could not")) {
      throw new Error(`Project creation failed after name prompt: "${result}"`);
    }
    await expect(page.getByText("Project created")).toBeVisible();
  });

  test("creates a project via free-form prompt in general mode", async ({ page }) => {
    test.setTimeout(90_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);

    await aiSubmit(page, `Create a new project called "Branding Refresh ${UNIQUE_SUFFIX}", active status, 4-week timeline`);

    await expect(page.getByText(/Branding Refresh/i).first()).toBeVisible({ timeout: 10_000 });
    await skipClientIfAsked(page);
    await confirmCreate(page);

    const result = await raceVisible(page, ["Project created", "Could not", "What should I name this project"], 60_000);
    if (result.includes("Could not")) {
      throw new Error(`Free-form project creation failed: "${result}"`);
    }
    await expect(page.getByText("Project created")).toBeVisible({ timeout: 5_000 });
  });
});
