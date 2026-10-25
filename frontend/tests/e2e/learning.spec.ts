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
  TEST_RECORDING: recording,
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
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Admin Panel", exact: true }).click();
  await page
    .getByRole("link", {
      name: "Independent materials & collections",
      exact: true,
    })
    .click();
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
    .locator(".studio-steps button")
    .filter({ hasText: "Audio" })
    .click();
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
  await page
    .locator(".studio-steps button")
    .filter({ hasText: "Review" })
    .click();
  await expect(page.getByLabel("Segment 1 text", { exact: true })).toHaveValue(
    "Welcome to our library.",
  );
  await page
    .locator(".studio-steps button")
    .filter({ hasText: "Questions" })
    .click();
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
  await page
    .getByRole("checkbox", {
      name: "Keep original PDF layout with interactive answer blanks",
      exact: true,
    })
    .uncheck();
  await expect(
    page.getByRole("img", {
      name: "Editor preview of question paper, page 1",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("PDF answer key", { exact: true })
    .fill("1. upstairs\n2. A");
  await page
    .getByRole("button", {
      name: "Create editable questions from PDF",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Question 1 prompt", { exact: true }),
  ).toHaveValue("The books are ____.");
  await page.getByLabel("Question 2 part", { exact: true }).selectOption("2");
  await page
    .getByRole("checkbox", {
      name: "Keep original PDF layout with interactive answer blanks",
      exact: true,
    })
    .uncheck();
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
    .locator(".studio-steps button")
    .filter({ hasText: "Publish" })
    .click();
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
    .getByRole("link", { name: "Mock Tests", exact: true })
    .click();
  await expect(studentPage).toHaveURL(/mock-tests/);
  await studentPage.screenshot({
    path: "test-results/library-desktop.png",
    fullPage: true,
  });
  await studentPage.setViewportSize({ width: 390, height: 844 });
  await studentPage
    .getByRole("button", { name: "Open navigation", exact: true })
    .click();
  await expect(
    studentPage.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await studentPage.keyboard.press("Escape");
  await expect(
    studentPage.getByRole("button", { name: "Open navigation", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect
    .poll(() =>
      studentPage
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await studentPage.screenshot({
    path: "test-results/library-mobile.png",
    fullPage: true,
  });
  expect(
    await studentPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await studentPage.setViewportSize({ width: 1280, height: 900 });
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
    studentPage.getByRole("button", { name: "Go to segment 1", exact: true }),
  ).toBeVisible();
  await studentPage.getByRole("link", { name: title, exact: true }).click();
  await studentPage
    .getByRole("button", { name: "Listening Mock", exact: true })
    .click();
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
  await expect(studentPage.locator("img, canvas, iframe, object")).toHaveCount(
    0,
  );
  await expect(studentPage.locator(".sidebar, .global-search")).toHaveCount(0);
  await expect(studentPage.locator(".exam-prompt")).toContainText(
    "The books are",
  );
  await expect(
    studentPage.getByLabel("Answer 1", { exact: true }),
  ).toBeVisible();
  await expect(
    studentPage.getByRole("button", { name: "Reveal Transcript", exact: true }),
  ).toHaveCount(0);
  await studentPage.getByLabel("Answer 1", { exact: true }).fill("upstairs");
  await studentPage
    .getByRole("navigation", { name: "Question navigation", exact: true })
    .getByRole("button", { name: "Part 2", exact: true })
    .click();
  await studentPage
    .getByRole("button", { name: "Go to question 2, unanswered", exact: true })
    .click();
  await expect(
    studentPage.getByRole("radio", { name: "A. Upstairs", exact: true }),
  ).toBeFocused();
  await expect(
    studentPage.locator(".review-toggle, .exam-review-tools"),
  ).toHaveCount(0);
  await studentPage
    .getByRole("radio", { name: "A. Upstairs", exact: true })
    .check();
  await expect(studentPage.getByText("Saved", { exact: true })).toBeVisible();
  await studentPage
    .getByRole("link", { name: "Save & exit", exact: true })
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
  await studentPage
    .getByRole("navigation", { name: "Question navigation", exact: true })
    .getByRole("button", { name: "Part 2", exact: true })
    .click();
  await expect(
    studentPage.getByRole("button", {
      name: "Go to question 2, answered",
      exact: true,
    }),
  ).toBeVisible();
  await studentPage
    .getByRole("navigation", { name: "Question navigation", exact: true })
    .getByRole("button", { name: "Part 1", exact: true })
    .click();
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
  await expect(studentPage.locator(".sidebar")).toHaveCount(0);
  await studentPage
    .getByLabel("Answer 1", { exact: true })
    .scrollIntoViewIfNeeded();
  await studentPage.getByLabel("Answer 1", { exact: true }).click();
  const answerBox = await studentPage
    .getByLabel("Answer 1", { exact: true })
    .boundingBox();
  const navBox = await studentPage
    .getByRole("navigation", { name: "Question navigation", exact: true })
    .boundingBox();
  expect(answerBox!.y + answerBox!.height).toBeLessThanOrEqual(navBox!.y);
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
    .getByRole("link", {
      name: "Independent materials & collections",
      exact: true,
    })
    .click();
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
    .locator(".studio-steps button")
    .filter({ hasText: "Audio" })
    .click();
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
  await page
    .locator(".studio-steps button")
    .filter({ hasText: "Review" })
    .click();
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
    .locator(".studio-steps button")
    .filter({ hasText: "Publish" })
    .click();
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
  await learner
    .getByRole("link", { name: "Back to material", exact: true })
    .click();
  await learner.locator('input[value="medium"]').check();
  await learner
    .getByRole("button", { name: "Start Dictation", exact: true })
    .click();
  await expect(learner.locator(".expected-word-count")).toHaveCount(0);
  await expect(learner.locator(".practice-exercise-list button")).toHaveCount(
    sentences,
  );
  await learner
    .getByRole("link", { name: "Back to material", exact: true })
    .click();
  await learner.locator('input[value="hard"]').check();
  await learner
    .getByRole("button", { name: "Start Dictation", exact: true })
    .click();
  await expect(learner.locator(".expected-word-count")).toHaveCount(0);
  await expect(learner.locator(".practice-exercise-list button")).toHaveCount(
    Math.ceil(sentences / 3),
  );
  await context.close();
});

test("forty text questions across four parts remain usable on desktop and mobile", async ({
  page,
}) => {
  const material = fixture("create_text_mock").toString().trim();
  await login(page, student);
  await page.goto(`/library/${material}?mode=mock`);
  await page.getByRole("radio", { name: /Mock · No time limit/ }).check();
  await page.getByRole("button", { name: "Start Mock", exact: true }).click();
  const nav = page.getByRole("navigation", {
    name: "Question navigation",
    exact: true,
  });
  await expect(nav.locator(".question-jump")).toHaveCount(40);
  await expect(page.locator("img, canvas, iframe, object")).toHaveCount(0);
  await page.getByLabel("Answer 1", { exact: true }).fill("upstairs");
  const cell = page.getByLabel("Answer 6", { exact: true });
  await expect(cell.locator("xpath=..")).toHaveJSProperty("tagName", "TD");
  await cell.fill("upstairs");
  await nav.getByRole("button", { name: "Part 4", exact: true }).click();
  await nav
    .getByRole("button", { name: "Go to question 40, unanswered", exact: true })
    .click();
  await expect(page.getByLabel("Answer 40", { exact: true })).toBeFocused();
  await page.getByLabel("Answer 40", { exact: true }).fill("upstairs");
  await expect(page.locator(".review-toggle, .exam-review-tools")).toHaveCount(
    0,
  );
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/full-mock-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await nav.getByRole("button", { name: "Part 1", exact: true }).click();
  await nav
    .getByRole("button", { name: "Go to question 6, answered", exact: true })
    .click();
  await expect(page.getByLabel("Answer 6", { exact: true })).toBeFocused();
  await page.getByLabel("Answer 6", { exact: true }).click();
  const inputBox = await page
    .getByLabel("Answer 6", { exact: true })
    .boundingBox();
  const navBox = await nav.boundingBox();
  expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(navBox!.y);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/full-mock-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel("Answer 1", { exact: true })).toHaveValue(
    "upstairs",
  );
  await nav.getByRole("button", { name: "Part 4", exact: true }).click();
  await expect(
    nav.getByRole("button", {
      name: "Go to question 40, answered",
      exact: true,
    }),
  ).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Submit Mock", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "8% correct", exact: true }),
  ).toBeVisible();
});

test("original two-page PDF keeps headings, notes and table with ten positioned answer fields", async ({
  page,
  browser,
}) => {
  fixture("create_layout_pdf");
  const material = fixture("create_text_mock").toString().trim();
  await login(page, teacher);
  await page.goto(`/admin/${material}?step=material-questions`);
  await page
    .locator(".studio-steps button")
    .filter({ hasText: "Questions" })
    .click();
  await page
    .getByLabel("Question paper PDF", { exact: true })
    .setInputFiles(pdf);
  await expect(
    page.getByRole("heading", {
      name: "Question paper · 3 pages",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Page 1", exact: true }).check();
  await page.getByRole("checkbox", { name: "Page 2", exact: true }).check();
  await page
    .getByLabel("PDF answer key", { exact: true })
    .fill(
      "1. Alex\n2. Monday\n3. York\n4. mail\n5. 123\n6. blue\n7. nine\n8. basic\n9. ten\n10. Sam",
    );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", {
      name: "Create editable questions from PDF",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Question 10 answers", { exact: true }),
  ).toHaveValue("Sam");
  await expect(page.locator(".pdf-answer")).toHaveCount(5);
  await expect(page.locator(".textLayer")).toContainText("Community Workshop");
  await expect(page.locator(".textLayer")).toContainText(
    "Please arrive ten minutes early.",
  );
  // Teacher can correct a suggested rectangle on the original page.
  const field = page.locator(".pdf-answer").first();
  await field.scrollIntoViewIfNeeded();
  const rect = await field.boundingBox();
  await page.mouse.move(rect!.x, rect!.y);
  await page.mouse.down();
  await page.mouse.move(rect!.x + rect!.width, rect!.y + rect!.height, {
    steps: 3,
  });
  await page.mouse.up();
  await expect(
    page.getByRole("combobox", { name: "Place PDF answer field", exact: true }),
  ).toHaveValue("1");
  await page.screenshot({
    path: "test-results/original-pdf-editor.png",
    fullPage: true,
  });
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
    .locator(".studio-steps button")
    .filter({ hasText: "Publish" })
    .click();
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
  await learner.goto(`/library/${material}?mode=mock`);
  await learner.getByRole("radio", { name: /Mock · No time limit/ }).check();
  await learner
    .getByRole("button", { name: "Start Mock", exact: true })
    .click();
  await expect(
    learner.locator('.pdf-interactive[data-page="1"] .textLayer'),
  ).toContainText("Registration details");
  await expect(
    learner.locator('.pdf-interactive[data-page="1"] .textLayer'),
  ).toContainText("Please arrive ten minutes early.");
  await expect(learner.locator(".pdf-answer")).toHaveCount(10);
  await expect(learner.locator("img")).toHaveCount(0);
  const keys = [
    "Alex",
    "Monday",
    "York",
    "mail",
    "123",
    "blue",
    "nine",
    "basic",
    "ten",
    "Sam",
  ];
  for (let n = 1; n <= 5; n++)
    await learner.getByLabel(`Answer ${n}`, { exact: true }).fill(keys[n - 1]);
  await expect(learner.getByText("Saved", { exact: true })).toBeVisible();
  await learner.screenshot({
    path: "test-results/original-pdf-student-page1.png",
    fullPage: true,
  });
  await learner
    .getByLabel("Answer 6", { exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    learner.locator('.pdf-interactive[data-page="2"] .textLayer'),
  ).toContainText("Workshop schedule");
  await expect(
    learner.locator('.pdf-interactive[data-page="2"] .textLayer'),
  ).toContainText("Bring your notebook and a pencil.");
  for (let n = 6; n <= 10; n++)
    await learner.getByLabel(`Answer ${n}`, { exact: true }).fill(keys[n - 1]);
  await expect(learner.getByText("Saved", { exact: true })).toBeVisible();
  const attempt = learner.url().split("/").at(-1)!;
  const blocked = await learner.evaluate(async (id) => {
    const r = await fetch(`/api/v1/mock-attempts/${id}/pdf-pages/3/`);
    return r.status;
  }, attempt);
  expect([401, 403]).toContain(blocked);
  await learner.screenshot({
    path: "test-results/original-pdf-student-page2.png",
    fullPage: true,
  });
  await expect(learner.locator(".pdf-interactive")).toHaveCount(2);
  await learner
    .getByRole("button", { name: "Side by side", exact: true })
    .click();
  const layout = await learner
    .locator(".pdf-page-stack")
    .evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
  expect(layout).toBe(2);
  await learner.screenshot({ path: "test-results/mock-pdf-two-columns.png" });
  await learner.getByRole("button", { name: "Stacked", exact: true }).click();
  await learner.setViewportSize({ width: 390, height: 844 });
  expect(
    await learner.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await learner
    .locator('.pdf-interactive[data-page="2"]')
    .getByRole("button", { name: "Zoom in question paper", exact: true })
    .click();
  await expect(
    learner.locator('.pdf-interactive[data-page="2"] .pdf-zoom'),
  ).toContainText("120%");
  await learner.screenshot({
    path: "test-results/original-pdf-mobile.png",
    fullPage: true,
  });
  // Regression: loading the PDF then exiting must not restyle the app sidebar.
  await learner.getByRole("link", { name: "Save & exit", exact: true }).click();
  await learner.setViewportSize({ width: 1280, height: 720 });
  await expect(
    learner.getByRole("heading", {
      name: "Mock Tests",
      exact: true,
    }),
  ).toBeInViewport();
  expect(
    await learner
      .locator(".sidebar")
      .evaluate((el) => getComputedStyle(el).position),
  ).toBe("fixed");
  expect(
    await learner
      .locator(".sidebar")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(252, 253, 255)");
  const headingBox = await learner
    .getByRole("heading", {
      name: "Mock Tests",
      exact: true,
    })
    .boundingBox();
  expect(headingBox!.y).toBeLessThan(200);
  await learner.screenshot({ path: "test-results/after-pdf-exit.png" });
  await learner
    .getByRole("link")
    .filter({ hasText: "Original four-part mock" })
    .first()
    .click();
  await learner.reload();
  await expect(learner.getByLabel("Answer 1", { exact: true })).toHaveValue(
    "Alex",
  );
  await learner
    .getByRole("button", { name: "Go to question 10, answered", exact: true })
    .click();
  await expect(learner.getByLabel("Answer 10", { exact: true })).toHaveValue(
    "Sam",
  );
  learner.on("dialog", (d) => d.accept());
  await learner
    .getByRole("button", { name: "Submit Mock", exact: true })
    .first()
    .click();
  await expect(
    learner.getByRole("heading", { name: "100% correct", exact: true }),
  ).toBeVisible();
  await context.close();
});

test("reference-style native HTML keeps notes, choices and tables interactive", async ({
  page,
  browser,
}) => {
  const material = fixture("create_text_mock").toString().trim();
  await login(page, teacher);
  await page.goto(`/admin/${material}?step=material-questions`);
  const html = `<html><body><header>Promotion never imported</header><div id="part1"><p><strong>Questions 1–2</strong></p><p>Complete the notes. Write ONE WORD for each answer.</p><div class="gx-notes"><p class="gx-notes-title">Library visit</p><p class="gx-sec-title">Booking details</p><ul><li>Meeting point: <input type="text" data-question="1"> before nine.</li><li>Collect your books <input type="text" data-question="2"> at the counter.</li></ul></div><script>window.stolenAnswers = 'do not import';</script></div><div id="part2"><p><strong>Questions 3–4</strong></p><p>Choose the correct room, then complete the table.</p><label><input type="radio" data-question="3" value="A"> A Upstairs</label><label><input type="radio" data-question="3" value="B"> B Downstairs</label><table><tr><th>Item</th><th>Place</th></tr><tr><td>Books</td><td><input type="text" data-question="4"></td></tr></table></div></body></html>`;
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("HTML question paper", { exact: true }).setInputFiles({
    name: "native-paper.html",
    mimeType: "text/html",
    buffer: Buffer.from(html),
  });
  await expect(
    page
      .locator(".native-paper-editor")
      .getByRole("heading", { name: "Library visit", exact: true }),
  ).toBeVisible();
  for (const [n, value] of [
    [1, "upstairs"],
    [2, "upstairs"],
    [3, "A"],
    [4, "upstairs"],
  ] as const)
    await page.getByLabel(`Question ${n} answers`, { exact: true }).fill(value);
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
    .locator(".studio-steps button")
    .filter({ hasText: "Publish" })
    .click();
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
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const learner = await context.newPage();
  await login(learner, student);
  await learner.goto(`/library/${material}?mode=mock`);
  await learner.getByRole("radio", { name: /Mock · No time limit/ }).check();
  await learner
    .getByRole("button", { name: "Start Mock", exact: true })
    .click();
  await expect(
    learner.getByRole("heading", { name: "Library visit", exact: true }),
  ).toBeVisible();
  await expect(
    learner.getByLabel("Answer 1", { exact: true }).locator("xpath=../.."),
  ).toContainText("before nine.");
  await learner.getByLabel("Answer 1", { exact: true }).fill("upstairs");
  await learner.getByLabel("Answer 2", { exact: true }).fill("upstairs");
  await expect(learner.getByText("Saved", { exact: true })).toBeVisible();
  await expect(learner.locator(".exam-topbar .exam-audio")).toBeVisible();
  await expect(learner.locator("canvas, iframe, img")).toHaveCount(0);
  expect(
    await learner.evaluate(
      () => (window as unknown as { stolenAnswers?: string }).stolenAnswers,
    ),
  ).toBeUndefined();
  await learner.screenshot({
    path: "test-results/native-reference-desktop.png",
    fullPage: true,
  });
  const nav = learner.getByRole("navigation", {
    name: "Question navigation",
    exact: true,
  });
  await nav.getByRole("button", { name: "Part 2", exact: true }).click();
  await learner
    .getByRole("radio", { name: "3: A. Upstairs", exact: true })
    .check();
  const answer = learner.getByLabel("Answer 4", { exact: true });
  await expect(answer.locator("xpath=../..")).toHaveJSProperty("tagName", "TD");
  await answer.fill("upstairs");
  await expect(learner.getByText("Saved", { exact: true })).toBeVisible();
  await learner.setViewportSize({ width: 390, height: 844 });
  expect(
    await learner.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await learner.screenshot({
    path: "test-results/native-reference-mobile.png",
    fullPage: true,
  });
  await learner.reload();
  await expect(learner.getByLabel("Answer 1", { exact: true })).toHaveValue(
    "upstairs",
  );
  await nav.getByRole("button", { name: "Part 2", exact: true }).click();
  await expect(
    learner.getByRole("radio", { name: "3: A. Upstairs", exact: true }),
  ).toBeChecked();
  learner.on("dialog", (dialog) => dialog.accept());
  await learner
    .getByRole("button", { name: "Submit Mock", exact: true })
    .first()
    .click();
  await expect(
    learner.getByRole("heading", { name: "100% correct", exact: true }),
  ).toBeVisible();
  await context.close();
});

test("existing ten-question text attempt automatically uses one compact paper", async ({
  page,
}) => {
  const material = fixture("create_compact_mock").toString().trim();
  await login(page, student);
  await page.goto(`/library/${material}?mode=mock`);
  await page.getByRole("radio", { name: /Mock · No time limit/ }).check();
  await page.getByRole("button", { name: "Start Mock", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(
    page.getByRole("heading", { name: "Questions 1–10", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Write ONE WORD ONLY for each answer.", { exact: true }),
  ).toHaveCount(1);
  await expect(
    page.locator(
      ".question-kind, .question-tools, .exam-instructions, .review-toggle, .exam-review-tools",
    ),
  ).toHaveCount(0);
  await expect(
    page.locator(".reference-question-paper input[type=text]"),
  ).toHaveCount(10);
  await expect(
    page.getByLabel("Answer 1", { exact: true }),
  ).toHaveAccessibleDescription("Write ONE WORD ONLY for each answer.");
  const first = await page
    .getByLabel("Answer 1", { exact: true })
    .boundingBox();
  const last = await page
    .getByLabel("Answer 10", { exact: true })
    .boundingBox();
  expect(last!.y - first!.y).toBeLessThan(550);
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
  ]) {
    await page.setViewportSize(viewport);
    await page.locator(".exam-main").evaluate((el) => {
      el.scrollTop = 0;
    });
    const input = await page
      .getByLabel("Answer 10", { exact: true })
      .boundingBox();
    const footer = await page
      .getByRole("navigation", { name: "Question navigation", exact: true })
      .boundingBox();
    const header = await page.locator(".exam-topbar").boundingBox();
    expect(input!.y + input!.height).toBeLessThanOrEqual(footer!.y);
    expect(footer!.height).toBeLessThanOrEqual(50);
    expect(header!.height).toBeLessThanOrEqual(60);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/mock-fit-${viewport.width}.png`,
    });
  }
  await page.getByLabel("Answer 1", { exact: true }).fill("station");
  await page.getByLabel("Answer 10", { exact: true }).fill("station");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/existing-text-compact-desktop.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel("Answer 10", { exact: true })).toHaveValue(
    "station",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/existing-text-compact-mobile.png",
    fullPage: true,
  });
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Submit Mock", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "20% correct", exact: true }),
  ).toBeVisible();
});

test("approved book/test flow publishes separate Parts and assembles a real Full test", async ({
  page,
  browser,
}) => {
  test.setTimeout(240000);
  const signedIn = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/auth/login/") &&
      r.request().method() === "POST",
  );
  await login(page, teacher);
  const token = (await (await signedIn).json()).access;
  await page.goto("/admin");
  await page
    .getByRole("button", { name: "Add source collection", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill(`Review collection ${stamp}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: `Review collection ${stamp} · Tests`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add book", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill(`Review book ${stamp}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: `Review book ${stamp} · Tests`,
      exact: true,
    }),
  ).toBeVisible();
  const category = new URL(page.url()).searchParams.get("category")!;
  await page.getByRole("button", { name: "New test", exact: true }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Test 1");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Test 1", exact: true }),
  ).toBeVisible();
  const testId = new URL(page.url()).searchParams.get("test")!;
  await page
    .getByRole("button", { name: "Add Part", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/admin\/\d+/);
  const firstMaterial = Number(new URL(page.url()).pathname.split("/").at(-1));
  await page
    .getByLabel("Content source", { exact: true })
    .fill("Original speech for hierarchy review");
  await page
    .getByLabel("License / permission", { exact: true })
    .fill("Original fixture permission");
  await page
    .getByRole("checkbox", {
      name: "I own this material or have permission to share it.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(page.getByText("Details saved.", { exact: true })).toBeVisible();
  await page
    .locator(".studio-steps button")
    .filter({ hasText: "Audio" })
    .click();
  await expect(page.locator("#material-details")).toBeHidden();
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
  await page
    .locator(".studio-steps button")
    .filter({ hasText: "Questions" })
    .click();
  await page.getByRole("button", { name: "Add question", exact: true }).click();
  await page
    .getByLabel("Question 1 prompt", { exact: true })
    .fill("We are at the ____.");
  await page.getByLabel("Question 1 answers", { exact: true }).fill("library");
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
    .locator(".studio-steps button")
    .filter({ hasText: "Review" })
    .click();
  await expect(
    page.getByLabel("Segment 1 text", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".studio-steps button")
    .filter({ hasText: "Publish" })
    .click();
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
  async function call(
    method: string,
    path: string,
    data?: unknown,
    multipart?: Record<string, unknown>,
  ) {
    const r = await page.request.fetch("/api/v1/" + path, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      ...(multipart ? { multipart } : { data }),
    });
    expect(r.ok(), path + " " + r.status()).toBeTruthy();
    return r.json();
  }
  const source = await call("GET", `materials/${firstMaterial}/`);
  const segments = source.segments.map(
    (s: {
      text: string;
      speaker: string;
      start_ms: number;
      end_ms: number;
    }) => ({
      text: s.text,
      speaker: s.speaker,
      start_ms: s.start_ms,
      end_ms: s.end_ms,
    }),
  );
  const fs = await import("node:fs");
  for (let n = 2; n <= 4; n++) {
    const t = await call("POST", `listening-tests/${testId}/parts/`, {
      number: n,
    });
    const m = t.parts.find((p: { number: number }) => p.number === n).id;
    await call("PATCH", `materials/${m}/`, {
      source: "Original hierarchy fixture",
      license: "Author permission",
      rights_confirmed: true,
    });
    await call("POST", `materials/${m}/audio/`, undefined, {
      file: {
        name: "original-part.wav",
        mimeType: "audio/wav",
        buffer: fs.readFileSync(recording),
      },
    });
    await call("PUT", `materials/${m}/transcript/`, { segments });
    await call("PUT", `materials/${m}/questions/`, {
      presentation: "text",
      questions: [
        {
          number: 1,
          part: n,
          type: "short_answer",
          prompt: "We are at the ____.",
          instructions: "Write ONE WORD ONLY.",
          max_words: 1,
          answers: ["library"],
          options: [],
          context: {},
        },
      ],
      duration_seconds: 60,
    });
    await call("POST", `materials/${m}/publish/`, { confirm_review: true });
  }
  await page.goto(`/admin?category=${category}&test=${testId}`);
  await expect(
    page.getByRole("heading", { name: "Full test is available", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.locator(".full-test-banner")).toContainText("4 / 4 ready");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({
    path: "test-results/approved-admin-studio.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Upload Full recording", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Test 1 · Full test", exact: true }),
  ).toBeVisible();
  await page
    .locator(".studio-steps button")
    .filter({ hasText: "Audio" })
    .click();
  await expect(page.getByLabel("Upload audio", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Back to Content Studio", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Upload Full recording", exact: true }),
  ).toBeVisible();

  const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    }),
    learner = await context.newPage();
  await login(learner, student);
  await learner.goto("/library");
  await learner
    .getByLabel("Search library", { exact: true })
    .fill(`Review collection ${stamp}`);
  await learner.getByRole("button", { name: "Search", exact: true }).click();
  await learner
    .locator(".catalog-card")
    .filter({
      has: learner.getByRole("heading", {
        name: `Review collection ${stamp}`,
        exact: true,
      }),
    })
    .click();
  await learner
    .locator(".catalog-card")
    .filter({
      has: learner.getByRole("heading", {
        name: `Review book ${stamp}`,
        exact: true,
      }),
    })
    .click();
  await learner
    .locator(".catalog-card")
    .filter({
      has: learner.getByRole("heading", { name: "Test 1", exact: true }),
    })
    .click();
  await learner.screenshot({
    path: "test-results/approved-test-modes.png",
    fullPage: true,
  });
  await learner.getByRole("button", { name: /^Part 2/ }).click();
  await learner
    .locator(".test-mode-cards button")
    .filter({ hasText: "Practice" })
    .click();
  await learner
    .getByRole("button", { name: "Start Dictation", exact: true })
    .click();
  await expect(learner.locator("#answer")).toBeVisible();
  await expect(learner.locator(".expected-word-count")).toBeVisible();
  const geometry = await learner
    .locator(".practice-check-actions")
    .boundingBox();
  expect(geometry!.y + geometry!.height).toBeLessThan(721);
  await learner.screenshot({
    path: "test-results/approved-practice-laptop.png",
    fullPage: true,
  });
  await learner.getByRole("button", { name: /^Medium/ }).click();
  await expect(learner.locator(".expected-word-count")).toHaveCount(0);
  await learner.goto(`/tests/${testId}?part=all&mode=mock`);
  await learner.getByRole("radio", { name: /No time limit/ }).check();
  await learner
    .getByRole("button", { name: "Start Mock", exact: true })
    .click();
  await expect(
    learner.locator(".reference-question-paper input[type=text]"),
  ).toHaveCount(1);
  const attempt = learner.url().match(/mock\/(\d+)/)![1];
  // Each Part has a distinct bound answer and the server persists all four.
  for (let n = 1; n <= 4; n++) {
    if (n > 1)
      await learner
        .getByRole("button", { name: `Part ${n}`, exact: true })
        .click();
    await learner
      .locator(".reference-question-paper input[type=text]")
      .fill("library");
  }
  learner.on("dialog", (d) => d.accept());
  await learner
    .getByRole("button", { name: "Submit Mock", exact: true })
    .first()
    .click();
  await expect(learner).toHaveURL(new RegExp(`/mock/${attempt}/results`));
  await expect(
    learner.getByRole("heading", { name: "100% correct", exact: true }),
  ).toBeVisible();
  await learner.setViewportSize({ width: 390, height: 844 });
  await learner.goto(`/tests/${testId}?mode=practice&part=1`);
  await learner
    .getByRole("button", { name: "Start Dictation", exact: true })
    .click();
  expect(
    await learner.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await learner.screenshot({
    path: "test-results/approved-practice-mobile.png",
    fullPage: true,
  });
  await context.close();
});

test("Practice keeps long exercise lists paginated and saves answers across pages", async ({
  page,
}) => {
  const material = fixture("create_long_practice").toString().trim();
  await login(page, student);
  await page.goto(`/library/${material}?mode=practice`);
  await page
    .getByRole("button", { name: "Start Dictation", exact: true })
    .click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator(".practice-exercise-list button")).toHaveCount(8);
  expect(
    await page
      .locator(".practice-exercise-list")
      .evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await page
    .locator(".practice-exercises")
    .getByRole("button", { name: "Next page", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Go to segment 9", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reveal Transcript", exact: true })
    .click();
  const reference = await page.locator(".hint-box").innerText();
  await page.getByLabel("What did you hear?", { exact: true }).fill(reference);
  await page.getByRole("button", { name: "Check Answer", exact: true }).click();
  await expect(page.getByText("100% accuracy", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Go to segment 9", exact: true }),
  ).toHaveAttribute("aria-current", "step");
  await expect(
    page.getByLabel("What did you hear?", { exact: true }),
  ).toHaveValue(reference);
  expect(
    (await page.locator(".practice-check-actions").boundingBox())!.y,
  ).toBeLessThan(720);
  expect(
    (await page.locator(".workspace-navigation").boundingBox())!.y,
  ).toBeLessThan(720);
  await page.screenshot({
    path: "test-results/approved-practice-pagination.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /^Medium/ }).click();
  await expect(page.locator(".expected-word-count")).toHaveCount(0);
  await expect(page.locator(".practice-exercise-list button")).toHaveCount(8);
});
