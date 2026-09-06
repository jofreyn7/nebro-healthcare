import { test, expect } from "@playwright/test";

const pages = [
  { path: "/index.html", title: /Nebro/i },
  { path: "/about.html", title: /About/i },
  { path: "/products.html", title: /Product/i },
  { path: "/industries.html", title: /Industries/i },
  { path: "/case-studies.html", title: /Case Studies/i },
  { path: "/resources.html", title: /Resources/i },
  { path: "/contact.html", title: /Contact/i },
];

for (const { path, title } of pages) {
  test(`${path} loads with no console errors`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const response = await page.goto(path);
    expect(response.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(title);
    expect(errors, `Console errors on ${path}:\n${errors.join("\n")}`).toEqual([]);
  });
}

test("dark mode toggle persists across reload", async ({ page }) => {
  await page.goto("/index.html");
  const toggle = page.locator("#theme-toggle");
  await expect(toggle).toBeVisible();
  await toggle.click();
  const themeBefore = await page.evaluate(() => localStorage.getItem("theme"));
  await page.reload();
  const themeAfter = await page.evaluate(() => localStorage.getItem("theme"));
  expect(themeAfter).toBe(themeBefore);
});

test("contact form shows feedback after submission attempt", async ({ page }) => {
  await page.goto("/contact.html");

  await page.locator("#quote-name").fill("Test User");
  await page.locator("#quote-email").fill("test@example.com");
  await page.locator("#quote-facility").fill("Test Hospital");
  await page.locator("#quote-message").fill("This is a smoke test submission.");

  await page.locator("#form-submit-btn").click();

  // #form-feedback starts with class="hidden" and is revealed by script.js
  // after the Supabase insert attempt (success or graceful failure).
  const feedback = page.locator("#form-feedback");
  await expect(feedback).toBeVisible({ timeout: 8000 });
  await expect(feedback).not.toHaveText("");
});