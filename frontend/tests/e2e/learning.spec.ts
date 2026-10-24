import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
const root = path.resolve("..");
const stamp = Date.now().toString(36);
const teacher = `teacher_${stamp}`,
  student = `student_${stamp}`,
  password = randomBytes(18).toString("hex");
const title = `Original listening ${stamp}`;
const recording = path.join(root, "frontend/test-results/original-speech.wav");
const pdf = path.join(root, "frontend/test-results/original-questions.pdf");
const fixtureEnv = {
  ...process.env,
  TEST_TEACHER: teacher,
  TEST_STUDENT: student,
  TEST_PASSWORD: password,
  TEST_QUESTION_PDF: pdf,
};
function fixture(mode: string, extra: Record<string, string> = {}) {
  return execFileSync(
    "python",
    [
      "infrastructure/run.py",
      "backend/.venv/bin/python",
      "backend/tests/browser_fixture.py",
      mode,
    ],
    { cwd: root, env: { ...fixtureEnv, ...extra }, stdio: "pipe" },
  );
}
async function login(page: import("@playwright/test").Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(username) }),
  ).toBeVisible();
}
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
  fixture("create");
  fixture("create_pdf");
});
test.afterAll(() => fixture("cleanup"));

test("real upload outcome, explicit manual transcript fixture, PDF questions, dictation and untimed/timed mocks", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  await login(page, teacher);
  await page.getByRole("link", { name: "Admin Panel", exact: true }).click();
  await page
    .getByRole("button", { name: "Add collection", exact: true })
    .click();
  await page
    .getByLabel("Collection name", { exact: true })
    .fill(`Everyday English ${stamp}`);
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
  const material = page.url().split("/").at(-1)!;
  await page
    .getByLabel("Content source", { exact: true })
    .fill("Original speech fixture");
  await page
    .getByLabel("License / permission", { exact: true })
    .fill("CC0 original test");
  await page
    .getByRole("checkbox", {
      name: "I own this material or have permission to share it.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(page.getByText("Details saved.", { exact: true })).toBeVisible();
  await page
    .getByLabel("Upload audio", { exact: true })
    .setInputFiles(recording);
  await page
    .getByRole("button", {
      name: "Upload & create Practice automatically",
      exact: true,
    })
    .click();
  await expect(page.locator(".processing-status")).toBeVisible();
  await expect
    .poll(() => page.locator(".processing-status").getAttribute("class"), {
      timeout: 150000,
    })
    .toMatch(/succeeded|failed/);
  const outcome = await page
    .locator(".processing-status")
    .getAttribute("class");
  console.log("Real local speech job outcome:", outcome);
  if (outcome?.includes("failed"))
    await expect(page.locator(".processing-status")).toContainText(
      "speech model is unavailable",
    );
  // A deterministic manual fixture verifies downstream UI without claiming blocked ASR succeeded.
  fixture("seed_manual", { TEST_MATERIAL_ID: material });
  await page.reload();
  await expect(page.getByLabel("Segment 1 text", { exact: true })).toHaveValue(
    "Welcome to our library.",
  );
  await page
    .getByLabel("Question paper PDF", { exact: true })
    .setInputFiles(pdf);
  await expect(
    page.getByRole("heading", {
      name: "Question paper · 2 pages",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await expect(
    page.getByRole("img", {
      name: "Editor preview of question paper, page 1",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByText("Quick setup: use PDF questions + an answer key", {
      exact: true,
    })
    .click();
  await page.getByLabel("PDF question count", { exact: true }).fill("2");
  await page
    .getByLabel("PDF answer key", { exact: true })
    .fill("1. upstairs\n2. A");
  await page
    .getByRole("button", { name: "Create answer fields from PDF", exact: true })
    .click();
  await page
    .getByLabel("Question 2 type", { exact: true })
    .selectOption("multiple_choice");
  await page
    .getByLabel("Question 2 options", { exact: true })
    .fill("A. Upstairs\nB. Downstairs");
  await page
    .getByLabel("Timed exam limit in minutes", { exact: true })
    .fill("1");
  await page
    .getByRole("button", { name: "Save exam questions", exact: true })
    .click();
  await expect(
    page.getByText(
      "Questions saved as a new version. Publishing will release Mock and Practice together.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "I listened to the generated segments and reviewed the transcript.",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", {
      name: "Approve & publish Mock + Practice",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Material published. Its Practice levels are available in the student library.",
      { exact: true },
    ),
  ).toBeVisible();
  const context = await browser.newContext();
  const studentPage = await context.newPage();
  await login(studentPage, student);
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
    .getByRole("button", { name: "Dictation", exact: true })
    .click();
  await studentPage
    .getByRole("button", { name: "Start Dictation", exact: true })
    .click();
  await expect(
    studentPage.getByText("4 words to listen for", { exact: true }),
  ).toBeVisible();
  await studentPage
    .getByRole("button", { name: "Play audio", exact: true })
    .click();
  await expect
    .poll(() =>
      studentPage
        .locator("audio")
        .evaluate((a: HTMLAudioElement) => a.currentTime),
    )
    .toBeGreaterThan(0.1);
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
  await studentPage
    .getByRole("link", { name: "Dashboard", exact: true })
    .click();
  await studentPage
    .getByRole("link", { name: "Continue Practice", exact: true })
    .click();
  await expect(
    studentPage.getByLabel("What did you hear?", { exact: true }),
  ).toHaveValue("The books are upstairs.");
  await studentPage.reload();
  await expect(
    studentPage.getByLabel("What did you hear?", { exact: true }),
  ).toHaveValue("The books are upstairs.");
  await studentPage.getByRole("link", { name: title, exact: true }).click();
  await studentPage
    .getByRole("button", { name: "Dictation", exact: true })
    .click();
  await studentPage.locator('input[value="medium"]').check();
  await studentPage
    .getByRole("button", { name: "Start Dictation", exact: true })
    .click();
  await expect(studentPage.locator(".expected-word-count")).toHaveCount(0);
  await expect(
    studentPage.getByRole("heading", { name: "Segment 1 / 2", exact: true }),
  ).toBeVisible();
  await studentPage.getByRole("link", { name: title, exact: true }).click();
  await studentPage
    .getByRole("radio", { name: /Mock · No time limit/ })
    .check();
  await studentPage
    .getByRole("button", { name: "Start Mock", exact: true })
    .click();
  await expect(
    studentPage.getByText("No time limit", { exact: true }),
  ).toBeVisible();
  await expect(studentPage.getByRole("timer")).toHaveCount(0);
  await expect(
    studentPage.getByRole("img", {
      name: "Question paper page 1",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    studentPage.getByRole("button", { name: "Reveal Transcript", exact: true }),
  ).toHaveCount(0);
  await studentPage.getByLabel("Answer 1", { exact: true }).fill("upstairs");
  await studentPage
    .getByRole("radio", { name: "A. Upstairs", exact: true })
    .check();
  await expect(studentPage.getByText("Saved", { exact: true })).toBeVisible();
  await studentPage
    .getByRole("link", { name: "Mock Tests", exact: true })
    .click();
  await studentPage
    .getByRole("link")
    .filter({ has: studentPage.getByText(title, { exact: true }) })
    .first()
    .click();
  await expect(studentPage.getByLabel("Answer 1", { exact: true })).toHaveValue(
    "upstairs",
  );
  await studentPage.reload();
  await expect(studentPage.getByLabel("Answer 1", { exact: true })).toHaveValue(
    "upstairs",
  );
  await expect(
    studentPage.getByText("No time limit", { exact: true }),
  ).toBeVisible();
  await studentPage
    .getByRole("button", { name: "Start audio once", exact: true })
    .click();
  await expect(
    studentPage.getByRole("button", { name: "Start audio once", exact: true }),
  ).toBeDisabled();
  await expect
    .poll(() =>
      studentPage
        .locator(".exam-audio audio")
        .evaluate((a: HTMLAudioElement) => a.currentTime),
    )
    .toBeGreaterThan(0.1);
  await studentPage.screenshot({
    path: "test-results/untimed-mock-desktop.png",
    fullPage: true,
  });
  await studentPage.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      studentPage
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await studentPage.screenshot({
    path: "test-results/untimed-mock-mobile.png",
    fullPage: true,
  });
  expect(
    await studentPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  studentPage.on("dialog", (d) => d.accept());
  await studentPage
    .getByRole("button", { name: "Submit Mock", exact: true })
    .first()
    .click();
  await expect(
    studentPage.getByRole("heading", { name: "100% correct", exact: true }),
  ).toBeVisible();
  await studentPage.setViewportSize({ width: 1280, height: 900 });
  await studentPage
    .getByRole("link", { name: "Work through it in Practice", exact: true })
    .click();
  await studentPage
    .getByRole("button", { name: "Listening Mock", exact: true })
    .click();
  await studentPage
    .getByRole("button", { name: "Start Mock", exact: true })
    .click();
  await expect(studentPage.getByRole("timer")).toBeVisible();
  const timedId = studentPage.url().split("/").at(-1)!;
  await studentPage.getByLabel("Answer 1", { exact: true }).fill("upstairs");
  await expect(studentPage.getByText("Saved", { exact: true })).toBeVisible();
  fixture("expire_exam", { TEST_ATTEMPT_ID: timedId });
  await studentPage.reload();
  await expect(
    studentPage.getByRole("heading", { name: "50% correct", exact: true }),
  ).toBeVisible();
  await studentPage
    .getByRole("link", { name: "All mocks", exact: true })
    .click();
  await studentPage
    .getByRole("link", { name: "Reading Future", exact: true })
    .click();
  await expect(
    studentPage.getByRole("heading", {
      name: "Reading is planned",
      exact: true,
    }),
  ).toBeVisible();
  await context.close();
});

test("audio only automatically becomes published Practice without manual transcript or timestamps", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  await login(page, teacher);
  await page.getByRole("link", { name: "Admin Panel", exact: true }).click();
  await page
    .getByRole("button", { name: "Add collection", exact: true })
    .click();
  await page
    .getByLabel("Collection name", { exact: true })
    .fill(`Auto Speech ${stamp}`);
  await page
    .getByRole("button", { name: "Create collection", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: `Edit Auto Speech ${stamp}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New material", exact: true }).click();
  const autoTitle = `Automatic speech ${stamp}`;
  await page.getByLabel("Title", { exact: true }).fill(autoTitle);
  await page
    .getByRole("combobox", { name: "Collection", exact: true })
    .selectOption({ label: `Auto Speech ${stamp}` });
  await page.getByRole("button", { name: "Create draft", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: autoTitle, exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Content source", { exact: true })
    .fill("Original audio-only speech test");
  await page
    .getByLabel("License / permission", { exact: true })
    .fill("CC0 original fixture");
  await page
    .getByRole("checkbox", {
      name: "I own this material or have permission to share it.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(page.getByText("Details saved.", { exact: true })).toBeVisible();
  await page
    .getByLabel("Upload audio", { exact: true })
    .setInputFiles(recording);
  await page
    .getByRole("button", {
      name: "Upload & create Practice automatically",
      exact: true,
    })
    .click();
  await expect(page.locator(".processing-status.succeeded")).toBeVisible({
    timeout: 150000,
  });
  await expect(
    page.getByLabel("Segment 1 text", { exact: true }),
  ).toBeVisible();
  const texts = await page
    .locator('textarea[aria-label^="Segment "][aria-label$=" text"]')
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLTextAreaElement).value));
  expect(texts.join(" ").toLowerCase()).toContain("library");
  const sentences = texts.length;
  expect(sentences).toBeGreaterThan(0);
  await page.screenshot({
    path: "test-results/real-auto-transcript-admin.png",
    fullPage: true,
  });
  await page
    .getByRole("checkbox", {
      name: "I listened to the generated segments and reviewed the transcript.",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", {
      name: "Approve & publish Mock + Practice",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Material published. Its Practice levels are available in the student library.",
      { exact: true },
    ),
  ).toBeVisible();
  const context = await browser.newContext();
  const learner = await context.newPage();
  await login(learner, student);
  await learner
    .getByRole("link", { name: "Practice Library", exact: true })
    .click();
  await learner
    .getByRole("link")
    .filter({
      has: learner.getByRole("heading", { name: autoTitle, exact: true }),
    })
    .click();
  await learner
    .getByRole("button", { name: "Start Dictation", exact: true })
    .click();
  await expect(learner.locator(".expected-word-count")).toBeVisible();
  await learner
    .getByRole("button", { name: "Play audio", exact: true })
    .click();
  await expect
    .poll(() =>
      learner.locator("audio").evaluate((a: HTMLAudioElement) => a.currentTime),
    )
    .toBeGreaterThan(0.05);
  await learner
    .getByRole("button", { name: "Reveal Transcript", exact: true })
    .click();
  await expect(learner.locator(".hint-box")).toBeVisible();
  const actualReference = await learner.locator(".hint-box").textContent();
  await learner
    .getByLabel("What did you hear?", { exact: true })
    .fill(actualReference || "");
  await learner
    .getByRole("button", { name: "Check Answer", exact: true })
    .click();
  await expect(
    learner.getByText("100% accuracy", { exact: true }),
  ).toBeVisible();
  await learner.getByRole("link", { name: autoTitle, exact: true }).click();
  await learner.locator('input[value="medium"]').check();
  await learner
    .getByRole("button", { name: "Start Dictation", exact: true })
    .click();
  await expect(learner.locator(".expected-word-count")).toHaveCount(0);
  await expect(learner.locator(".segment-grid button")).toHaveCount(sentences);
  await learner.getByRole("link", { name: autoTitle, exact: true }).click();
  await learner.locator('input[value="hard"]').check();
  await learner
    .getByRole("button", { name: "Start Dictation", exact: true })
    .click();
  await expect(learner.locator(".expected-word-count")).toHaveCount(0);
  await expect(learner.locator(".segment-grid button")).toHaveCount(
    Math.ceil(sentences / 3),
  );
  await context.close();
});
