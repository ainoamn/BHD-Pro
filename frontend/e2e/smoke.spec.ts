import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("login page renders email form", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const email = page.locator('input[type="email"], input[name="email"]').first();
    await expect(email).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /sign in|تسجيل|login|دخول/i }).first()).toBeVisible();
  });
});
