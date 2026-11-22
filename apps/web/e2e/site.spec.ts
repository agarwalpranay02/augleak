import { expect, test } from "@playwright/test";

const PAGES = ["/", "/audit", "/inspect", "/registry", "/research", "/developers", "/about", "/legal/privacy", "/legal/terms", "/account"];

test.describe("pages", () => {
  for (const path of PAGES) {
    test(`${path} renders without errors or horizontal overflow`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      const res = await page.goto(path, { waitUntil: "networkidle" });
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      expect(errors).toEqual([]);
    });
  }

  test("unknown pages return 404", async ({ page }) => {
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
  });
});

test("demo audit flags the same 29 of 75 test images as the Python reference", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/audit?demo=1");
  await expect(page.getByText(/test images \(38\.7%\) have a copy in the training set/)).toBeVisible({ timeout: 200_000 });
  await expect(page.locator("main")).toContainText(/29\s*of\s*75/);
});

test("inspector compares the sample pair", async ({ page }) => {
  await page.goto("/inspect");
  await expect(page.getByText(/structure/i).first()).toBeVisible();
});

test.describe("API", () => {
  test("health", async ({ request }) => {
    const r = await request.get("/api/v1/health");
    expect(r.ok()).toBeTruthy();
    expect((await r.json()).status).toBe("ok");
  });
  test("exposure needs no key", async ({ request }) => {
    const r = await request.get("/api/v1/exposure?photos=1000&copies=16&test_share=0.2");
    expect(r.ok()).toBeTruthy();
    expect((await r.json()).exposure).toBeGreaterThan(0.99);
  });
  test("compare rejects a missing key", async ({ request }) => {
    const r = await request.post("/api/v1/compare", { multipart: { a: "x", b: "y" } });
    expect(r.status()).toBe(401);
  });
});
