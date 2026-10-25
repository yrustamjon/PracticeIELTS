import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";

const root = path.resolve("..");
const stamp = Date.now().toString(36) + randomBytes(2).toString("hex");
const password = randomBytes(18).toString("hex");
let fixtureData: { material: number; admin: string; student: string };
function fixture(mode: "create" | "cleanup") {
  return execFileSync(
    process.env.TEST_PYTHON || path.join(root, "backend/venv/bin/python"),
    ["backend/tests/practice_timing_browser_fixture.py", mode],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        TIMING_QA_ID: stamp,
        TIMING_QA_PASSWORD: password,
      },
    },
  );
}
async function login(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/v1/auth/login/") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const token = (await (await response).json()).access as string;
  await expect(
    page.getByRole("heading", { name: new RegExp(username) }),
  ).toBeVisible();
  return token;
}
async function start(page: Page, token: string) {
  const response = await page.request.post("/api/v1/sessions/", {
    headers: { Authorization: `Bearer ${token}` },
    data: { material: fixtureData.material, difficulty: "easy" },
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}

test.beforeAll(() => {
  fixtureData = JSON.parse(fixture("create"));
});
test.afterAll(() => {
  fixture("cleanup");
});

test("admin adjusts an Easy chunk with preview, reload persistence and unchanged student history", async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 1280, height: 850 });
  const token = await login(page, fixtureData.admin);
  const admin = await start(page, token);
  const context = await browser.newContext();
  const studentPage = await context.newPage();
  const studentToken = await login(studentPage, fixtureData.student);
  const oldStudent = await start(studentPage, studentToken);
  await page.goto(`/practice/${admin.id}`);
  await page
    .getByRole("button", { name: "Go to segment 2", exact: true })
    .click();
  await page.getByLabel("What did you hear?").fill("My practice answer");
  await page
    .getByRole("button", { name: "Adjust timing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Preview timing", exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator("audio").evaluate((a) => (a as HTMLAudioElement).paused),
    )
    .toBe(false);
  await page
    .getByRole("button", { name: "Cancel timing edit", exact: true })
    .click();
  await expect
    .poll(() =>
      page.locator("audio").evaluate((a) => (a as HTMLAudioElement).paused),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Adjust timing", exact: true })
    .click();
  await page.getByLabel("Start time (seconds)").fill("1.350");
  await page.getByLabel("End time (seconds)").fill("2.400");
  await page
    .getByRole("button", { name: "Preview timing", exact: true })
    .click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((a) => (a as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThanOrEqual(2.39);
  expect(
    await page
      .locator("audio")
      .evaluate((a) => (a as HTMLAudioElement).currentTime),
  ).toBeLessThanOrEqual(2.41);
  await expect
    .poll(() =>
      page.locator("audio").evaluate((a) => (a as HTMLAudioElement).paused),
    )
    .toBe(true);
  await page.screenshot({
    path: "/private/tmp/practice-easy-timing-desktop.png",
  });
  await page.getByRole("button", { name: "Save timing", exact: true }).click();
  await expect(
    page.getByText("Timing saved for Easy Practice.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Adjust timing", exact: true })
    .click();
  await expect(page.getByLabel("Start time (seconds)")).toHaveValue("1.350");
  await expect(page.getByLabel("End time (seconds)")).toHaveValue("2.400");
  await expect(page.getByLabel("What did you hear?")).toHaveValue(
    "My practice answer",
  );
  const oldResponse = await studentPage.request.get(
    `/api/v1/sessions/${oldStudent.id}/`,
    { headers: { Authorization: `Bearer ${studentToken}` } },
  );
  expect((await oldResponse.json()).groups[1]).toEqual(oldStudent.groups[1]);
  const newStudent = await start(studentPage, studentToken);
  expect(newStudent.id).not.toBe(oldStudent.id);
  expect(newStudent.groups[1].start_ms).toBe(1350);
  expect(newStudent.groups[1].end_ms).toBe(2400);
  await studentPage.goto(`/practice/${newStudent.id}`);
  await expect(
    studentPage.getByRole("heading", { name: "Listen and write", exact: true }),
  ).toBeVisible();
  await expect(
    studentPage.getByRole("button", { name: "Adjust timing", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Medium", exact: false }).click();
  await expect(
    page.getByRole("button", { name: "Medium", exact: false }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Adjust timing", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/practice/${admin.id}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Adjust timing", exact: true })
    .click();
  await expect(page.getByLabel("Start time (seconds)")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/private/tmp/practice-easy-timing-mobile.png",
    fullPage: true,
  });
  await context.close();
});
