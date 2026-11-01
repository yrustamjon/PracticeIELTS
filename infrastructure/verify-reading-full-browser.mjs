// Requires an explicitly supplied private fixture; never embeds source content or keys.
// READING_BROWSER_FIXTURE: {username,password,book,test,paper,answers}; isolated learner only.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const { chromium } = require("playwright-core");
const fixture = JSON.parse(
  readFileSync(process.env.READING_BROWSER_FIXTURE, "utf8"),
);
const base = process.env.READING_BASE;
assert.ok(base && fixture.paper && Object.keys(fixture.answers).length === 40);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  args: ["--no-sandbox"],
});
const receipt = { checks: [], base, book: fixture.book, test: fixture.test };
try {
  const widths = (process.env.READING_WIDTHS || "1440,390,320")
    .split(",")
    .map(Number);
  assert.ok(
    widths.length && widths.every((width) => width >= 320 && width <= 2000),
  );
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("dialog", (dialog) => void dialog.accept());
      let auth;
      if (fixture.access && fixture.user) {
        // Only authenticate the disposable probe; all Reading requests stay real.
        await context.route("**/api/v1/auth/refresh/", route => route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ access: fixture.access, user: fixture.user }),
        }));
        auth = fixture;
        await page.goto(base + "/");
      } else {
      await page.goto(base + "/login");
      await page.getByLabel("Username", { exact: true }).fill(fixture.username);
      await page.getByLabel("Password", { exact: true }).fill(fixture.password);
      const login = page.waitForResponse(
        (r) =>
          r.url().endsWith("/auth/login/") && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      auth = await (await login).json();
      assert.ok(auth.access, "Real login must succeed");
      await page.waitForURL(base + "/");
      }
      const headers = { Authorization: "Bearer " + auth.access };
      const request = async (path, method = "GET", data) => {
        const r = await context.request.fetch(base + "/api/v1/" + path, {
          method,
          data,
          headers,
        });
        return { status: r.status(), data: await r.json() };
      };
      const library = `${base}/reading?collection=Cambridge&book=${encodeURIComponent(fixture.book)}&test=${fixture.test}`;
      await page.goto(library);
      assert.equal(await page.locator(".skill-navigation").count(), 0);
      if (process.env.READING_FLOW === "1") {
        const picker = page.getByRole("navigation", { name: "Choose test section" });
        await picker.getByRole("button", { name: /^Passage 2/ }).click();
        await page.getByRole("button", { name: /^(Start|Resume) Practice$/ }).waitFor();
        assert.equal(await page.getByRole("radio").count(), 0);
        await picker.getByRole("button", { name: /^Full test/ }).click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({path: `/tmp/reading-flow-selection-${width}.png`, fullPage:true});
      }
      await page.getByRole("radio", { name: /Mock · No time limit/ }).check();
      await page
        .getByRole("button", { name: /^(Start|Resume) Mock$/ })
        .click();
      await page.waitForURL(/reading\/full\/attempts\/\d+/, { timeout: 60000 });
      const attemptUrl = page.url();
      const id = attemptUrl.split("/").at(-1);
      await page.locator(".reading-prose").waitFor();
      await page.locator(".exam-shell").waitFor();
      assert.equal(await page.getByRole("navigation",{name:"Question navigation"}).locator(".question-jump").count(), 40);
      const initial = (await request(`reading-full-attempts/${id}/`)).data;
      assert.equal(initial.total, 40);
      for (const passage of [1, 2, 3]) {
        await page
          .getByRole("button", { name: `Passage ${passage}`, exact: true })
          .click();
        const passageContent = initial.passages[passage - 1].version.content;
        await page.locator(".reading-prose h2").filter({ hasText: passageContent.title }).waitFor({ state: "attached" });
        const expectedFigures = passageContent.figures || [];
        if (expectedFigures.length) {
          await page.waitForFunction((count) => {
            const images = [...document.querySelectorAll(".reading-prose figure img, .reading-question-groups figure img")];
            return images.length === count && images.every((img) => img.complete && img.naturalWidth > 0);
          }, expectedFigures.length);
          assert.deepEqual((await page.locator(".reading-prose figure img, .reading-question-groups figure img").evaluateAll((images) => images.map((image) => image.alt))).sort(), expectedFigures.map((figure) => figure.alt).sort());
        }
        assert.equal(await page.locator(".reading-prose figure img, .reading-question-groups figure img").count(), expectedFigures.length);
        if (width < 768)
          await page
            .getByRole("tab", { name: "Questions", exact: true })
            .click();
        const fields = page.locator(
          ".reading-question-groups input, .reading-question-groups select",
        );
        if (process.env.READING_SHORT_OPTIONS === "1") {
          for (const group of passageContent.groups) {
            for (const code of group.options || []) {
              const label = group.option_labels?.[code];
              if (label)
                assert.ok(await page.locator(".reading-source-options li").filter({ hasText: `${code}. ${label}` }).count(), "Full source option must be outside the answer menu");
            }
          }
          for (const select of await page.locator(".reading-question-groups select").all()) {
            assert.ok(await select.locator("option").evaluateAll(options => options.every(option => !option.value || option.textContent.trim() === option.value)), "Answer menus must show short source codes only");
          }
        }
        for (const field of await fields.all()) {
          const number = (await field.getAttribute("aria-label")).replace(
            "Question ",
            "",
          );
          if (await field.evaluate((e) => e.tagName === "SELECT"))
            await field.selectOption(fixture.answers[number]);
          else await field.fill(fixture.answers[number]);
        }
        if (process.env.READING_SHORT_OPTIONS === "1" && fixture.book === "Cambridge 12" && fixture.test === 4 && passage === 2 && width === 390) {
          await page.locator(".reading-source-options").first().scrollIntoViewIfNeeded();
          await page.screenshot({ path: "/tmp/reading-short-options-live-phone.png", fullPage: true });
        }
      }
      await page
        .getByRole("status")
        .filter({ hasText: /^Saved$/ })
        .waitFor({ timeout: 60_000 });
      let saved = await request(`reading-full-attempts/${id}/`);
      assert.ok(Object.entries(fixture.answers).every(([number,answer]) => saved.data.answers[number] === answer), "All saved answers must match the private fixture");
      assert.ok(!("results" in saved.data));
      for (const p of saved.data.passages) {
        for (const field of ["keys", "source", "source_pages", "key_pages"])
          assert.ok(!(field in p.version));
      }
      await page.reload();
      await page.locator(".reading-prose").waitFor();
      await page
        .getByRole("button", { name: "Passage 3", exact: true })
        .click();
      if (width < 768)
        await page.getByRole("tab", { name: "Questions", exact: true }).click();
      assert.ok((await page.getByLabel("Question 40", { exact: true }).inputValue()) === fixture.answers["40"], "Restored question40 must match the private fixture");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page
        .getByRole("link", { name: "Save & exit", exact: true })
        .click();
      await page.getByRole("radio", { name: /Mock · No time limit/ }).check();
      await page
        .getByRole("button", { name: /^(Start|Resume) Mock$/ })
        .click();
      await page.waitForURL(attemptUrl);
      await page
        .getByRole("button", { name: "Submit Mock", exact: true })
        .click();
      await page.getByLabel("Result: 40 / 40", { exact: true }).waitFor();
      await page.reload();
      await page.getByLabel("Result: 40 / 40", { exact: true }).waitFor();
      if (process.env.READING_FLOW === "1") {
        await page.getByRole("link", { name: "My Reading results", exact:true }).click();
        await page.waitForURL(/reading\/history/);
        const result = page.locator(`a[href="/reading/full/attempts/${id}/results"]`);
        await result.waitFor();
        assert.ok((await result.textContent()).includes("40 / 40"));
        await page.screenshot({path:`/tmp/reading-flow-history-${width}.png`,fullPage:true});
        await result.click();
        await page.getByLabel("Result: 40 / 40", {exact:true}).waitFor();
      }
      assert.equal(
        (
          await request(`reading-full-attempts/${id}/`, "PATCH", {
            answers: { 1: "changed" },
          })
        ).status,
        400,
      );
      assert.equal(
        (await request(`reading-papers/${fixture.paper}/source-pages/17/`))
          .status,
        403,
      );
      await page.goto(library);
      await page.getByRole("radio", { name: /Real Exam · Timed/ }).check();
      await page
        .getByRole("button", { name: "Start Mock", exact: true })
        .click();
      await page.waitForURL(/reading\/full\/attempts\/\d+/);
      const timedId = page.url().split("/").at(-1);
      await page.getByRole("timer", { name: "Time remaining" }).waitFor();
      assert.equal((await request(`reading-full-attempts/${id}/`)).status, 403);
      assert.equal(
        (await request("reading-attempts/", "POST", { paper: fixture.paper }))
          .status,
        403,
      );
      await page
        .getByRole("button", { name: "Submit Mock", exact: true })
        .click();
      await page.getByLabel("Result: 0 / 40", { exact: true }).waitFor();
      assert.equal(
        (await request(`reading-full-attempts/${timedId}/`)).data.score,
        0,
      );
      assert.equal(errors.length, 0, errors.join("\n"));
      receipt.checks.push({
        width,
        answers: 40,
        score: 40,
        savedReloadResume: true,
        timedTimer: true,
        studyRestriction: true,
        privateSources: true,
        immutableResult: true,
        pageErrors: 0,
      });
      console.log(`Full Reading browser verified at ${width}px.`);
    } finally {
      await context.close();
    }
  }
  if (process.env.READING_BROWSER_RECEIPT)
    writeFileSync(
      process.env.READING_BROWSER_RECEIPT,
      JSON.stringify(receipt, null, 2),
    );
} finally {
  await browser.close();
}
