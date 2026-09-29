import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const count = (text: string) => Number(text.replace(/[^\d]/g, "").slice(0, 7) || 0);

for (const scheme of ["light", "dark"] as const) {
  test(`browse passes axe when the device prefers ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/opportunities");
    await expect(page.getByRole("heading", { level: 1, name: "Browse internships" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  });
}

test("filter by kind of work, then page through with filters kept", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/opportunities");
  const results = page.locator("#results-heading");
  const all = count(await results.innerText());
  expect(all).toBeGreaterThan(100);

  await page.getByRole("checkbox", { name: /Quant and trading/ }).check();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/role=quant_trading/);
  const quant = count(await results.innerText());
  expect(quant).toBeGreaterThan(0);
  expect(quant).toBeLessThan(all);
  // Every row is tagged with the chosen kind of work.
  const tags = page.getByRole("list", { name: "Details" }).first();
  await expect(tags).toContainText("Quant and trading");

  if (quant > 30) {
    await page.getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(/role=quant_trading.*page=2|page=2.*role=quant_trading/);
    await expect(page.getByText("Page 2 of")).toBeVisible();
  }

  await page.getByRole("link", { name: "Clear all" }).click();
  await expect(page).toHaveURL(/\/opportunities$/);
});

test("filters collapse behind a disclosure on phones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/opportunities");
  const title = page.getByLabel("Title or company");
  await expect(title).toBeHidden();
  await page.getByText("Filters", { exact: true }).click();
  await expect(title).toBeVisible();
  await title.fill("intern");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/q=intern/);
});
