// Explicit private fixture only. Reading requests are real; anonymous contexts
// have no cookies or authentication bootstrap. Never print bearer result links.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const { chromium } = require("playwright-core");
const fixture = JSON.parse(readFileSync(process.env.READING_BROWSER_FIXTURE, "utf8"));
const base = process.env.READING_BASE;
assert.ok(base && fixture.paper && fixture.answers);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
const receipt = { base, checks: [] };
try {
  for (const width of (process.env.READING_WIDTHS || "1440,390").split(",").map(Number)) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    try {
      const page = await context.newPage();
      page.on("dialog", d => void d.accept());
      let auth;
      if (fixture.access && fixture.user) {
        await context.route("**/api/v1/auth/refresh/", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access: fixture.access, user: fixture.user }) }));
        auth = fixture;
        await page.goto(base + "/");
      } else {
        await page.goto(base + "/login");
        await page.getByLabel("Username", { exact: true }).fill(fixture.username);
        await page.getByLabel("Password", { exact: true }).fill(fixture.password);
        const login = page.waitForResponse(r => r.url().endsWith("/auth/login/") && r.request().method() === "POST");
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        auth = await (await login).json(); assert.ok(auth.access);
        await page.waitForURL(base + "/");
      }
      for (const full of [false, true]) {
        const endpoint = full ? "reading-full-attempts" : "reading-attempts";
        const library = `${base}/reading?collection=Cambridge&book=${encodeURIComponent(fixture.book)}&test=${fixture.test}&part=${full ? "all" : "1"}`;
        await page.goto(library);
        if (full) await page.getByRole("radio", { name: /Mock · No time limit/ }).check();
        await page.getByRole("button", { name: full ? /^(Start|Resume) Mock$/ : /^(Start|Resume) Practice$/ }).click();
        await page.waitForURL(/reading\/(full\/)?attempts\/\d+$/);
        const id = page.url().split("/").at(-1);
        const request = async (path, method = "GET", data) => {
          const response = await context.request.fetch(`${base}/api/v1/${path}`, { method, data, headers: { Authorization: `Bearer ${auth.access}` } });
          assert.ok(response.ok(), `Owned Reading ${method} must succeed`);
          return response.status() === 204 ? null : response.json();
        };
        const attempt = await request(`${endpoint}/${id}/`);
        const numbers = attempt.version.content.groups.flatMap(g => g.questions.map(q => String(q.number)));
        const answers = Object.fromEntries(numbers.map(n => [n, fixture.answers[n]]));
        await request(`${endpoint}/${id}/`, "PATCH", { answers });
        await page.reload();
        await page.locator(".reading-prose").waitFor();
        if (full) await page.getByRole("button", { name: "Submit Mock", exact: true }).click();
        else {
          await page.getByRole("button", { name: "Submit answers", exact: true }).click();
          await page.getByRole("button", { name: "Confirm submission", exact: true }).click();
        }
        await page.getByRole("heading", { name: "Share your Reading result", exact: true }).waitFor();
        await page.getByRole("button", { name: "Create public result link", exact: true }).click();
        const link = await page.getByLabel("Public result link").inputValue();
        assert.ok(link.startsWith(base + "/shared/reading/"));
        await page.reload();
        await page.getByRole("button", { name: "Stop sharing", exact: true }).waitFor();
        const anon = await browser.newContext({ viewport: { width, height: 900 } });
        try {
          const publicPage = await anon.newPage();
          await publicPage.goto(link);
          await publicPage.getByLabel(`Result: ${numbers.length} / ${numbers.length}`, { exact: true }).waitFor();
          assert.ok(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          const publicResponse = await anon.request.get(`${base}/api/v1/shared-reading-results/${link.split("/").at(-1)}/`);
          assert.equal(publicResponse.status(), 200);
          assert.equal(publicResponse.headers()["cache-control"], "no-store");
          const snapshot = await publicResponse.json();
          for (const privateKey of ["username", "email", "paragraphs", "source", "keys", "version"]) assert.ok(!(privateKey in snapshot));
          assert.equal(snapshot.passage, full ? 0 : 1);
          await publicPage.screenshot({ path: `/tmp/reading-share-${full ? "full" : "passage"}-${width}.png`, fullPage: true });
          await page.getByRole("button", { name: "Stop sharing", exact: true }).click();
          await page.getByRole("button", { name: "Create public result link", exact: true }).waitFor();
          await publicPage.reload();
          await publicPage.getByText("This result link is unavailable or has been removed.", { exact: true }).waitFor();
          receipt.checks.push({ width, full, score: numbers.length, persistedLink: true, anonymous: true, privateSources: true, revoked: true });
          console.log(`Reading ${full ? "Full Mock" : "passage"} sharing/reload/anonymous view/revocation passed at ${width}px.`);
        } finally { await anon.close(); }
      }
    } finally { await context.close(); }
  }
  writeFileSync(process.env.READING_BROWSER_RECEIPT, JSON.stringify(receipt, null, 2));
} finally { await browser.close(); }
