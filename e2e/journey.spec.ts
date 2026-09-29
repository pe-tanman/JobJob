import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.nodes.length}): ${v.help}\n    ${v.nodes[0]?.target.join(" ")}`);
  expect(summary, `${label} axe violations`).toEqual([]);
}

for (const scheme of ["light", "dark"] as const) {
  test(`landing and onboarding pass axe when the device prefers ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page, `/ ${scheme}`);
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page, `/onboarding ${scheme}`);
    await page.goto("/signin");
    await expectNoA11yViolations(page, `/signin ${scheme}`);
  });
}

test("keyboard-only onboarding, confirm email, give feedback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/onboarding");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByText("Step 1 of 7")).toBeVisible();

  // Roles: tab to the first chip and toggle it with Space.
  const swe = page.getByRole("checkbox", { name: "Software engineering" });
  await swe.focus();
  await page.keyboard.press("Space");
  await expect(swe).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space"); // Machine learning and AI
  await expect(page.getByRole("checkbox", { name: "Machine learning and AI" })).toHaveAttribute("aria-checked", "true");

  const next = async () => {
    await page.getByRole("button", { name: /Continue|Skip for now/ }).focus();
    await page.keyboard.press("Enter");
  };

  await next();
  await expect(page.getByText("Step 2 of 7")).toBeVisible();
  // Focus moves to the new step's heading.
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.getByRole("checkbox", { name: "Summer" }).focus();
  await page.keyboard.press("Space");

  await next(); // where
  await next(); // filters
  await next(); // about
  await page.getByLabel("What kind of work excites you?").fill(
    "I want to build backend systems and machine learning infrastructure. I like Python and distributed systems.",
  );
  await next(); // preview

  await expect(page.getByText("Step 6 of 7")).toBeVisible();
  const firstVote = page.getByRole("button", { name: "Interested" }).first();
  await expect(firstVote).toBeVisible({ timeout: 20_000 });
  await firstVote.focus();
  await page.keyboard.press("Enter");
  await expect(firstVote).toHaveAttribute("aria-pressed", "true");

  await next(); // email
  await expect(page.getByText("Step 7 of 7")).toBeVisible();
  const email = `e2e-${Date.now()}@example.edu`;
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send my link" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible({ timeout: 20_000 });

  // Dev mode exposes the magic link instead of sending mail.
  const href = await page.getByRole("link", { name: "open the confirmation link" }).getAttribute("href");
  await page.goto(href!);
  await expect(page).toHaveURL(/\/matches\?welcome=1/);
  await expect(page.getByRole("heading", { name: "You are all set" })).toBeVisible();

  const cards = page.getByRole("region", { name: /New for you/ }).getByRole("listitem");
  const before = await cards.count();
  expect(before).toBeGreaterThan(0);
  await expectNoA11yViolations(page, "/matches");

  const firstTitle = await cards.first().locator("h3").innerText();
  await cards.first().getByRole("button", { name: "Not for me" }).click();
  await page.getByRole("radio", { name: "Timing" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: firstTitle, exact: true })).toHaveCount(0);
  await expect(cards).toHaveCount(before - 1);

  // Survives a reload: the dismissal was stored.
  await page.reload();
  await expect(page.getByRole("heading", { name: firstTitle, exact: true })).toHaveCount(0);

  // Save a posting from Browse: it persists and shows up with the user's matches.
  await page.goto("/opportunities?sort=company");
  const firstRow = page.getByRole("region", { name: /internships?/ }).getByRole("listitem").filter({ has: page.getByRole("button", { name: /^Save/ }) }).first();
  const savedTitle = (await firstRow.locator("h3").innerText()).split("\n")[0]!.replace("(opens in a new tab)", "").trim();
  await firstRow.getByRole("button", { name: /^Save/ }).click();
  await expect(firstRow.getByRole("button", { name: /^Saved/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: `Saved ${savedTitle.trim()}` })).toBeVisible();
  await page.goto("/matches");
  await expect(page.getByRole("region", { name: /You are interested in/ })).toContainText(savedTitle.trim());

  await page.goto("/settings");
  await expectNoA11yViolations(page, "/settings");
});

test("daily digest email, then a one-click feedback link from it", async ({ page, request }) => {
  const { readdir, readFile, stat } = await import("node:fs/promises");
  const res = await request.get("/api/cron/digest");
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { sent: number };
  expect(body.sent).toBeGreaterThan(0);

  // Dev mode writes emails to ./.outbox instead of sending them.
  const files = await readdir(".outbox");
  const withTimes = await Promise.all(files.map(async (f) => ({ f, t: (await stat(`.outbox/${f}`)).mtimeMs })));
  const latest = withTimes.sort((a, b) => b.t - a.t)[0]!.f;
  const html = await readFile(`.outbox/${latest}`, "utf8");
  expect(html).toContain("Subject:");
  expect(html).not.toMatch(/[–—]/);

  const link = html.match(/href="(http:\/\/localhost:3000\/f\/[^"]+)"/)?.[1];
  expect(link, "digest contains a feedback link").toBeTruthy();
  await page.goto(link!.replace(/&amp;/g, "&"));
  await expect(page.getByRole("heading", { name: /Saved|Got it/ })).toBeVisible({ timeout: 15_000 });
});
