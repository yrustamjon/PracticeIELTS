import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
const root = path.resolve("..");
const stamp = Date.now().toString(36);
const teacher = `teacher_${stamp}`,
  student = `student_${stamp}`,
  password = randomBytes(18).toString("hex");
const title = `Original library conversation ${stamp}`;
const transcript = ["Welcome to our library.", "The books are upstairs."];
const recording = path.join(root, "frontend/test-results/original-speech.wav");

test.beforeAll(() => {
  execFileSync("mkdir", ["-p", path.dirname(recording)]);
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `flite=text='Welcome to our library. The books are upstairs.':voice=slt`,
      "-ar",
      "22050",
      recording,
    ],
    { stdio: "ignore" },
  );
  execFileSync(
    "python",
    [
      "infrastructure/run.py",
      "backend/.venv/bin/python",
      "backend/tests/browser_fixture.py",
      "create",
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        TEST_TEACHER: teacher,
        TEST_STUDENT: student,
        TEST_PASSWORD: password,
      },
      stdio: "pipe",
    },
  );
});
test.afterAll(() => {
  execFileSync(
    "python",
    [
      "infrastructure/run.py",
      "backend/.venv/bin/python",
      "backend/tests/browser_fixture.py",
      "cleanup",
    ],
    {
      cwd: root,
      env: { ...process.env, TEST_TEACHER: teacher, TEST_STUDENT: student },
      stdio: "pipe",
    },
  );
});
async function login(page: import("@playwright/test").Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(username) }),
  ).toBeVisible();
}

test("teacher publishes real speech; student listens, checks and resumes", async ({
  page,
  browser,
}) => {
  await login(page, teacher);
  await page.getByRole("link", { name: "Admin Panel" }).click();
  await page
    .getByRole("button", { name: "Add collection", exact: true })
    .click();
  await page
    .getByLabel("Collection name", { exact: true })
    .fill(`Everyday English ${stamp}`);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Original short conversations for focused practice.");
  await page
    .getByRole("button", { name: "Create collection", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: `Edit Everyday English ${stamp}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New material", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page
    .getByRole("combobox", { name: "Collection", exact: true })
    .selectOption({ label: `Everyday English ${stamp}` });
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Content source", { exact: true })
    .fill("Original synthetic speech created for this integration test");
  await page
    .getByLabel("License / permission", { exact: true })
    .fill("CC0 original test text");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Details saved");
  await page
    .getByLabel("Upload audio", { exact: true })
    .setInputFiles(recording);
  await expect(page.getByRole("status")).toContainText("Audio uploaded");
  await page.getByLabel("Segment 1 text", { exact: true }).fill(transcript[0]);
  await page.getByLabel("Segment 1 end", { exact: true }).fill("1.7");
  await page.getByRole("button", { name: "Add segment", exact: true }).click();
  await page.getByLabel("Segment 2 text", { exact: true }).fill(transcript[1]);
  await page.getByLabel("Segment 2 start", { exact: true }).fill("1.7");
  await page.getByLabel("Segment 2 end", { exact: true }).fill("2.8");
  await page
    .getByRole("button", { name: "Save transcript version", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Publish material", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Publish material", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Material published");
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await login(studentPage, student);
  await expect(studentPage.getByText("0", { exact: true })).toBeVisible();
  await studentPage
    .getByRole("link", { name: "Practice Library", exact: true })
    .click();
  await studentPage
    .getByRole("link")
    .filter({
      has: studentPage.getByRole("heading", { name: title, exact: true }),
    })
    .click();
  await studentPage
    .getByRole("button", { name: "Start Dictation", exact: true })
    .click();
  await expect(
    studentPage.getByRole("heading", { name: "Segment 1 / 2" }),
  ).toBeVisible();
  await studentPage
    .getByRole("button", { name: "Play audio", exact: true })
    .click();
  await expect
    .poll(() =>
      studentPage
        .locator("audio")
        .evaluate((el: HTMLAudioElement) => el.currentTime),
    )
    .toBeGreaterThan(0.1);
  await expect
    .poll(() =>
      studentPage
        .locator("audio")
        .evaluate((el: HTMLAudioElement) => el.paused),
    )
    .toBe(true);
  expect(
    await studentPage
      .locator("audio")
      .evaluate((el: HTMLAudioElement) => el.currentTime),
  ).toBeLessThanOrEqual(1.75);
  await studentPage
    .getByLabel("What did you hear?", { exact: true })
    .fill("Welcome to the library.");
  await studentPage
    .getByRole("button", { name: "Check Answer", exact: true })
    .click();
  await expect(
    studentPage.getByText("75% accuracy", { exact: true }),
  ).toBeVisible();
  await studentPage
    .getByRole("button", { name: "Next Segment", exact: true })
    .click();
  await studentPage
    .getByLabel("What did you hear?", { exact: true })
    .fill("The books are upstairs.");
  await expect(studentPage.getByText("Saved", { exact: true })).toBeVisible();
  await studentPage.screenshot({
    path: "test-results/dictation-desktop.png",
    fullPage: true,
  });
  await studentPage
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await studentPage
    .getByRole("link", { name: "Continue Practice", exact: true })
    .click();
  await expect(
    studentPage.getByRole("heading", { name: "Segment 2 / 2" }),
  ).toBeVisible();
  await expect(
    studentPage.getByLabel("What did you hear?", { exact: true }),
  ).toHaveValue("The books are upstairs.");
  await studentPage.reload();
  await expect(
    studentPage.getByLabel("What did you hear?", { exact: true }),
  ).toHaveValue("The books are upstairs.");
  await studentPage
    .getByRole("button", { name: "Check Answer", exact: true })
    .click();
  await expect(
    studentPage.getByText("100% accuracy", { exact: true }),
  ).toBeVisible();
  await studentPage
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await expect(
    studentPage.getByRole("heading", { name: new RegExp(student) }),
  ).toBeVisible();
  await expect(studentPage.getByText("88%", { exact: true })).toBeVisible();
  await studentPage.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await expect(studentPage.getByText("88%", { exact: true })).toBeVisible();
  await studentPage.setViewportSize({ width: 390, height: 844 });
  await studentPage.waitForFunction(() => {
    const el = document.querySelector(".sidebar")!;
    return el.getBoundingClientRect().right <= 1;
  });

  await studentPage.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await studentPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await studentPage.getByRole("button", { name: "Open navigation" }).click();
  await studentPage
    .getByRole("link", { name: "Mistake Review", exact: true })
    .click();
  await expect(
    studentPage.getByRole("heading", {
      name: "Turn a little friction into progress",
    }),
  ).toBeVisible();
  expect(
    await studentPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await studentContext.close();
});
