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
  const toggle = page.locator("[data-theme-toggle], #theme-toggle, .theme-toggle").first();
  if (await toggle.count() === 0) {
    test.skip(true, "Theme toggle selector not found — update selector to match markup");
  }
  await toggle.click();
  const themeBefore = await page.evaluate(() => localStorage.getItem("theme"));
  await page.reload();
  const themeAfter = await page.evaluate(() => localStorage.getItem("theme"));
  expect(themeAfter).toBe(themeBefore);
});

test("contact form shows a response after submission attempt", async ({ page }) => {
  await page.goto("/contact.html");
  const form = page.locator("form").first();
  if (await form.count() === 0) {
    test.skip(true, "No <form> element found on contact page — update selector");
  }
  // Fill required fields defensively; adjust selectors to match actual field names/ids.
  const nameInput = page.locator('input[name="name"], input#name').first();
  const emailInput = page.locator('input[name="email"], input#email').first();
  if ((await nameInput.count()) && (await emailInput.count())) {
    await nameInput.fill("Test User");
    await emailInput.fill("test@example.com");
  }
  await form.locator('button[type="submit"], input[type="submit"]').first().click();
  // Expect some success/error message element to appear — adjust selector to match markup.
  await expect(page.locator("text=/success|error|thank you/i").first()).toBeVisible({ timeout: 5000 });
});
