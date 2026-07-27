import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("login page renders email form", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const email = page.locator('input[type="email"], input[name="email"]').first();
    await expect(email).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: /sign in|تسجيل|login|دخول/i }).first(),
    ).toBeVisible();
  });

  test("register page renders company signup fields", async ({ page }) => {
    await page.goto("/register", { waitUntil: "domcontentloaded" });
    const email = page.locator('input[type="email"], input[name="email"]').first();
    await expect(email).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: /create|register|تسجيل|إنشاء|sign up/i }).first(),
    ).toBeVisible();
  });

  test("complete-profile without invite shows recovery hint", async ({ page }) => {
    await page.goto("/complete-profile", { waitUntil: "domcontentloaded" });
    await expect(
      page
        .getByText(
          /invitation unavailable|الدعوة غير متاحة|ask your company|اطلب من مدير|invalid|expired|دعوة/i,
        )
        .first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
