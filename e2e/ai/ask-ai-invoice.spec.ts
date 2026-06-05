/**
 * Ask AI invoice workflow E2E test.
 *
 * Exercises: single-prompt field extraction → draft preview → approval →
 * delivery, the explicit client-picker when no client is named, and a
 * mid-flow context switch to another workflow.
 *
 * Required env:
 *   E2E_USER_EMAIL       -- non-admin user email
 *   E2E_USER_PASSWORD    -- its password
 *   E2E_AI_CLIENT_NAME   -- client display name available in workspace
 */

import { test, expect, type Page } from "@playwright/test";
import { loginUser, openAiPanel, aiInput, setAiClient } from "./helpers";

const USER_EMAIL = process.env.E2E_USER_EMAIL;
const USER_PASSWORD = process.env.E2E_USER_PASSWORD;
const CLIENT_NAME = process.env.E2E_AI_CLIENT_NAME;
const HAS_CREDS = Boolean(USER_EMAIL && USER_PASSWORD && CLIENT_NAME);

/** Drive the invoice workflow to a visible draft preview. */
async function draftInvoice(page: Page, prompt: string): Promise<void> {
  await page.getByRole("button", { name: "Create invoice" }).click();
  // Pin the client through the workspace context selector for determinism.
  await setAiClient(page, CLIENT_NAME!).catch(() => {});

  const promptInput = aiInput(page);
  await expect(promptInput).toBeVisible();
  await promptInput.fill(prompt);
  await promptInput.press("Enter");

  const draftHeading = page.getByText("Draft invoice ready for approval");
  const clientPickerTitle = page.getByText("Which client is this invoice for?");
  const discountQ = page.getByText(/Any discount/i);
  const dueQ = page.getByText(/When is it due/i);

  // The assistant may ask for a client and the optional discount / due date
  // before the draft is ready. Resolve each as it appears.
  for (let i = 0; i < 6; i++) {
    if (await draftHeading.isVisible().catch(() => false)) break;
    await Promise.race([
      draftHeading.waitFor({ state: "visible", timeout: 60_000 }),
      clientPickerTitle.waitFor({ state: "visible", timeout: 60_000 }),
      discountQ.waitFor({ state: "visible", timeout: 60_000 }),
      dueQ.waitFor({ state: "visible", timeout: 60_000 }),
    ]).catch(() => {});

    if (await draftHeading.isVisible().catch(() => false)) break;

    if (await clientPickerTitle.isVisible().catch(() => false)) {
      const pickerSelect = page.locator("select").filter({ hasText: "Choose a client" }).first();
      await pickerSelect.selectOption({ label: CLIENT_NAME! });
      await page.getByRole("button", { name: "Use selected client" }).click();
      continue;
    }
    // Skip the optional discount / due-date questions.
    if (
      (await discountQ.isVisible().catch(() => false)) ||
      (await dueQ.isVisible().catch(() => false))
    ) {
      const input = aiInput(page);
      await input.fill("skip");
      await input.press("Enter");
      continue;
    }
  }

  await expect(draftHeading).toBeVisible({ timeout: 30_000 });
}

test.describe("Ask AI invoice flow", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !HAS_CREDS,
    "Set E2E_USER_EMAIL, E2E_USER_PASSWORD, and E2E_AI_CLIENT_NAME to run Ask AI tests.",
  );

  test("creates and approves an invoice draft via Ask AI", async ({ page }) => {
    test.setTimeout(120_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);

    await draftInvoice(
      page,
      `Invoice ${CLIENT_NAME} 50000 for landing page design, due in 15 days`,
    );

    await expect(page.getByRole("button", { name: "Approve invoice" })).toBeVisible();
    await page.getByRole("button", { name: "Approve invoice" }).click();

    const approveSuccess = page.getByText("Invoice approved");
    const approveError = page.getByText(/could not approve|approval failed/i);
    await Promise.race([
      approveSuccess.waitFor({ state: "visible", timeout: 25_000 }),
      approveError.waitFor({ state: "visible", timeout: 25_000 }),
    ]);
    if ((await approveError.isVisible()) && !(await approveSuccess.isVisible())) {
      throw new Error(`Invoice approval failed: ${await approveError.textContent()}`);
    }
    await expect(approveSuccess).toBeVisible({ timeout: 5_000 });

    await expect(page.getByRole("button", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "WhatsApp" })).toBeVisible();
  });

  test("asks which client when none is named or selected", async ({ page }) => {
    test.setTimeout(120_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);

    await page.getByRole("button", { name: "Create invoice" }).click();
    // Deliberately do NOT pin a client and do NOT name one in the prompt.
    const promptInput = aiInput(page);
    await promptInput.fill("Bill 30000 for consulting work, due in 10 days");
    await promptInput.press("Enter");

    // The assistant must surface the explicit client picker.
    await expect(page.getByText("Which client is this invoice for?")).toBeVisible({ timeout: 60_000 });
    const pickerSelect = page.locator("select").filter({ hasText: "Choose a client" }).first();
    await pickerSelect.selectOption({ label: CLIENT_NAME! });
    await page.getByRole("button", { name: "Use selected client" }).click();

    // Skip the optional discount prompt if it appears.
    const discountQ = page.getByText(/Any discount/i);
    const draftHeading = page.getByText("Draft invoice ready for approval");
    await Promise.race([
      discountQ.waitFor({ state: "visible", timeout: 60_000 }),
      draftHeading.waitFor({ state: "visible", timeout: 60_000 }),
    ]).catch(() => {});
    if (await discountQ.isVisible().catch(() => false)) {
      const input = aiInput(page);
      await input.fill("skip");
      await input.press("Enter");
    }

    await expect(draftHeading).toBeVisible({ timeout: 60_000 });
  });

  test("switches workflow mid-invoice when the user changes intent", async ({ page }) => {
    test.setTimeout(120_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);

    await page.getByRole("button", { name: "Create invoice" }).click();
    await expect(page.getByText(/Let's create an invoice/i).first()).toBeVisible({ timeout: 8_000 });

    // Pivot to a different workflow without finishing the invoice.
    const switchName = `Switch Client ${Date.now().toString().slice(-5)}`;
    const promptInput = aiInput(page);
    await promptInput.fill(`Actually, never mind — create a new client called ${switchName} instead`);
    await promptInput.press("Enter");

    // The assistant should follow the client workflow, not the invoice one —
    // it asks for contact details, the client's name, or shows the confirm card.
    await expect(
      page
        .getByText(
          new RegExp(
            `Create this client|email, phone|What's the client's name|Client created|Added ${switchName}`,
            "i",
          ),
        )
        .first(),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Draft invoice ready for approval")).toHaveCount(0);
  });

  test("invoice WhatsApp button opens WhatsApp in a new tab", async ({ page, context }) => {
    test.setTimeout(120_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);

    await draftInvoice(
      page,
      `Invoice ${CLIENT_NAME} 25000 for branding design, due in 7 days`,
    );

    await page.getByRole("button", { name: "Approve invoice" }).click();
    await expect(page.getByText("Invoice approved")).toBeVisible({ timeout: 25_000 });

    const [newPage] = await Promise.all([
      context.waitForEvent("page", { timeout: 15_000 }),
      page.getByRole("button", { name: "WhatsApp" }).click(),
    ]);
    expect(newPage.url()).toMatch(/whatsapp\.com|wa\.me/);
  });

  test("invoice email send completes after approval", async ({ page }) => {
    test.setTimeout(120_000);

    await loginUser(page, USER_EMAIL!, USER_PASSWORD!);
    await openAiPanel(page);

    await draftInvoice(
      page,
      `Invoice ${CLIENT_NAME} 15000 for content writing, due in 10 days`,
    );

    await page.getByRole("button", { name: "Approve invoice" }).click();
    await expect(page.getByText("Invoice approved")).toBeVisible({ timeout: 25_000 });

    await page.getByRole("button", { name: "Email" }).click();
    await expect(page.getByText(/Done\.|emailed|invoice sent/i)).toBeVisible({ timeout: 20_000 });
  });
});
