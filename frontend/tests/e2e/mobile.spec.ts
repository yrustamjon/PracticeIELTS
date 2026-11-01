import { expect, test, type Page } from "@playwright/test";

// Layout fixtures only; this suite never changes production users or answers.
async function setup(page: Page) {
  const session = {
    id: 15,
    material: 3,
    title: "Cambridge listening practice and sentence review",
    version: 1,
    difficulty: "easy",
    position: 0,
    drafts: {},
    checked_positions: [],
    groups: Array.from({ length: 12 }, (_, i) => ({
      start_ms: i * 1000,
      end_ms: i * 1000 + 900,
      speaker: "",
      word_count: 5,
    })),
    audio: {
      id: 1,
      duration_ms: 15000,
      mime_type: "audio/wav",
      size: 240044,
      stream_url: "/api/v1/audio/1/stream/",
    },
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown = { results: [], count: 0, next: null, previous: null };
    if (path.endsWith("/csrf/")) json = { csrfToken: "layout-fixture" };
    else if (path.endsWith("/refresh/"))
      json = {
        access: "layout-fixture",
        user: {
          id: 1,
          username: "Mobile learner",
          can_edit: true,
          role: "admin",
        },
      };
    else if (path.endsWith("/progress/"))
      json = {
        accuracy: null,
        sentences_completed: 0,
        exercises_completed: 0,
        attempts: 0,
        weekly_activity: [],
        resume: session,
        material_count: 0,
      };
    else if (path.endsWith("/sessions/15/")) json = session;
    else if (path.endsWith("/audio/1/playback/")) json = {url: "/api/v1/audio/1/stream/", expires_in: 600};
    else if (path.endsWith("/audio/1/stream/")) {
      const bytes = Buffer.alloc(240044);
      bytes.write("RIFF");
      bytes.writeUInt32LE(bytes.length - 8, 4);
      bytes.write("WAVEfmt ", 8);
      bytes.writeUInt32LE(16, 16);
      bytes.writeUInt16LE(1, 20);
      bytes.writeUInt16LE(1, 22);
      bytes.writeUInt32LE(8000, 24);
      bytes.writeUInt32LE(16000, 28);
      bytes.writeUInt16LE(2, 32);
      bytes.writeUInt16LE(16, 34);
      bytes.write("data", 36);
      bytes.writeUInt32LE(bytes.length - 44, 40);
      await route.fulfill({ body: bytes, contentType: "audio/wav" });
      return;
    }
    await route.fulfill({ json });
  });
}
async function fits(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}
for (const width of [320, 390, 760]) {
  test(`phone ${width}px navigation and practice controls`, async ({
    page,
  }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Quick navigation" }),
    ).toBeVisible();
    await fits(page);
    await page.screenshot({
      path: `test-results/mobile-dashboard-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("button", { name: "Close menu" }),
    ).toBeFocused();
    await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
    await page.keyboard.press("Shift+Tab");
    await expect(page.locator(".future-nav a").last()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Close menu" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toBeFocused();
    await page.goto("/practice/15");
    await expect(
      page.getByRole("heading", { name: "Listen and write" }),
    ).toBeVisible();
    await fits(page);
    const main = await page.locator(".practice-session-main").boundingBox();
    const exercises = await page.locator(".practice-exercises").boundingBox();
    expect(main!.y).toBeLessThan(exercises!.y);
    for (const name of [
      "Play audio",
      "Rewind 5 seconds",
      "Forward 5 seconds",
      "Replay segment",
    ]) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page
      .getByLabel("What did you hear?")
      .fill("A mobile practice answer");
    await expect(
      page.getByRole("button", { name: "Check Answer", exact: true }),
    ).toBeEnabled();
    await page.screenshot({
      path: `test-results/mobile-practice-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("navigation", { name: "Quick navigation" })
      .getByRole("link", { name: "Practice Library" })
      .click();
    await expect(page).toHaveURL(/\/library$/);
    await fits(page);
    await page.goto("/admin/content");
    await expect(page.locator(".studio-layout")).toBeVisible();
    await fits(page);
    await page.screenshot({
      path: `test-results/mobile-admin-${width}.png`,
      fullPage: true,
    });
  });
}
test("desktop retains sidebar and original column order", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/practice/15");
  await expect(
    page.getByRole("navigation", { name: "Quick navigation" }),
  ).toBeHidden();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Listen and write" }),
  ).toBeVisible();
  const main = await page.locator(".practice-session-main").boundingBox();
  const exercises = await page.locator(".practice-exercises").boundingBox();
  expect(exercises!.x).toBeLessThan(main!.x);
  await fits(page);
});

for (const width of [320, 390, 760]) {
  test(`admin ${width}px hierarchy and authoring steps`, async ({ page }) => {
    await setup(page);
    await page.route("**/api/v1/categories/**", (route) =>
      route.fulfill({
        json: {
          results: [
            { id: 1, name: "Original listening collection", parent: null },
            { id: 2, name: "Volume with a longer title", parent: 1 },
          ],
          count: 2,
          next: null,
          previous: null,
        },
      }),
    );
    await page.route("**/api/v1/materials/3/", (route) =>
      route.fulfill({
        json: {
          id: 3,
          title: "Original listening material for mobile authoring",
          category: 2,
          category_name: "Volume with a longer title",
          description: "",
          source: "Original",
          license: "Owned",
          rights_confirmed: true,
          status: "draft",
          version_id: 1,
          audio: null,
          segments: [
            {
              id: 1,
              text: "Original sentence for review.",
              speaker: "",
              start_ms: 0,
              end_ms: 900,
            },
          ],
        },
      }),
    );
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/admin/content");
    const trigger = page.getByRole("button", {
      name: "Browse books and tests",
    });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByLabel("Find a book or test")).toBeHidden();
    await trigger.click();
    await page.getByLabel("Find a book or test").fill("Volume");
    await page
      .getByRole("button", { name: "Volume with a longer title", exact: true })
      .click();
    await expect(page).toHaveURL(/category=2/);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await fits(page);
    await page.goto("/admin/3");
    const steps = page.getByRole("navigation", {
      name: "Material setup steps",
    });
    await expect(steps).toBeVisible();
    for (const label of [
      "Details",
      "Audio",
      "Questions",
      "Review",
      "Publish",
    ]) {
      const button = steps.getByRole("button", { name: new RegExp(label) });
      await button.click();
      await expect(button).toHaveAttribute("aria-current", "step");
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await fits(page);
    }
    await steps.getByRole("button", { name: /Review/ }).click();
    await page.getByText("Adjust timing (advanced)", { exact: true }).click();
    await expect(page.getByLabel("Segment 1 start", { exact: true })).toHaveCSS(
      "font-size",
      "16px",
    );
    await fits(page);
    await page.screenshot({
      path: `test-results/admin-review-${width}.png`,
      fullPage: true,
    });
  });
}

for (const width of [320, 390, 760]) {
  test(`super admin settings ${width}px`, async ({ page }) => {
    await setup(page);
    const user = { id: 1, username: "Owner", email: "owner@example.test", role: "admin", can_edit: true, can_delete: true, is_superuser: true };
    await page.route("**/api/v1/auth/refresh/", (route) => route.fulfill({ json: { access: "fixture", user } }));
    let created = false;
    await page.route("**/api/v1/admin/accounts/**", async (route) => {
      if (route.request().method() === "POST") {
        expect(route.request().postDataJSON()).toEqual({ username: "assistant-admin", email: "assistant@example.test", password: "New-admin-159!" });
        created = true;
        await route.fulfill({status: 201, json: { id: 2, username: "assistant-admin" }});
        return;
      }
      await route.fulfill({ json: { count: created ? 2 : 1, next: null, previous: null, results: [
        { ...user, is_active: true }, ...(created ? [{ id: 2, username: "assistant-admin", email: "assistant@example.test", is_active: true, is_superuser: false }] : []),
      ] }});
    });
    await page.route("**/api/v1/admin/activity/**", (route) => route.fulfill({ json: {
      count: 1, next: null, previous: null, results: [{ id: 1, username: "assistant-admin", action: "material.update", material_title: "Original material", details: {path: "/api/v1/materials/3/"}, created_at: "2026-10-27T08:00:00Z" }],
    }}));
    await page.route("**/api/v1/auth/password/", async (route) => {
      expect(route.request().postDataJSON()).toEqual({ current_password: "Old-password-135!", new_password: "New-password-246!" });
      await route.fulfill({ json: { access: "new-fixture", user } });
    });
    await page.setViewportSize({width, height: 844});
    await page.goto("/admin/management");
    await expect(page.getByRole("heading", {name: "Administrators", exact: true})).toBeVisible();
    await page.getByLabel("Admin username", {exact: true}).fill("assistant-admin");
    await page.getByLabel("Admin email", {exact: true}).fill("assistant@example.test");
    await page.getByLabel("Initial password", {exact: true}).fill("New-admin-159!");
    await page.getByRole("button", {name: "Add administrator", exact: true}).click();
    await expect(page.getByRole("status")).toContainText("Administrator created");
    await expect(page.getByRole("list", {name: "Administrator accounts"})).toContainText("assistant-admin");
    await page.getByRole("button", {name: "View activity for assistant-admin", exact: true}).click();
    await expect(page.getByLabel("Admin user ID")).toHaveValue("2");
    await expect(page.getByRole("list", {name: "Admin activity log"})).toContainText("material.update");
    await fits(page);
    await page.goto("/profile?workspace=admin");
    await page.getByLabel("Current password", {exact: true}).fill("Old-password-135!");
    await page.getByLabel("New password", {exact: true}).fill("New-password-246!");
    await page.getByLabel("Confirm new password", {exact: true}).fill("Mismatch-password!");
    const passwordSection = page.getByRole("region", {name: "Change password"});
    await passwordSection.getByRole("button", {name: "Change password", exact: true}).click();
    await expect(passwordSection).toContainText("The new passwords do not match");
    await page.getByLabel("Confirm new password", {exact: true}).fill("New-password-246!");
    await passwordSection.getByRole("button", {name: "Change password", exact: true}).click();
    await expect(passwordSection.getByRole("status")).toContainText("Password changed");
    await expect(page.getByLabel("Current password", {exact: true})).toHaveValue("");
    await fits(page);
    await page.screenshot({path: `test-results/super-admin-settings-${width}.png`, fullPage: true});
  });
}

test("regular admin profile has no admin management or deletion controls", async ({page}) => {
  await setup(page);
  let adminRequests = 0;
  await page.route("**/api/v1/admin/**", async (route) => { adminRequests++; await route.fulfill({ status: 403, json: {detail: "Forbidden"} }); });
  await page.setViewportSize({width: 390, height: 844});
  await page.goto("/profile");
  await expect(page.getByRole("heading", {name: "Change password", exact: true})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Administrators", exact: true})).toHaveCount(0);
  expect(adminRequests).toBe(0);
  await fits(page);
});

test.describe("content touch scrolling", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  test("book and transcript lists hand scrolling back to the page", async ({page}) => {
    await setup(page);
    await page.route("**/api/v1/categories/**", route => route.fulfill({json: {
      results: Array.from({length: 30}, (_,i) => ({id:i+1,name:`Original book ${i+1}`,parent:null})),
      count:30,next:null,previous:null,
    }}));
    await page.route("**/api/v1/materials/3/", route => route.fulfill({json: {
      id:3,title:"Original transcript scroll fixture",category:1,category_name:"Original book 1",description:"",source:"Original",license:"Owned",rights_confirmed:true,status:"draft",version_id:1,audio:null,
      segments:Array.from({length:20},(_,i)=>({id:i+1,text:`Original sentence ${i+1}.`,speaker:"",start_ms:i*1000,end_ms:i*1000+900})),
    }}));
    const cdp = await page.context().newCDPSession(page);
    for(const [route,selector] of [["/admin/content",".studio-tree-scroll"],["/admin/3?step=material-review",".segment-editor-list"]]) {
      await page.goto(route);
      if(route === "/admin/content") await page.getByRole("button",{name:"Browse books and tests"}).click();
      const list = page.locator(selector);
      await expect(list).toBeVisible();
      await list.evaluate(el => {el.scrollTop=0;el.scrollIntoView({block:"center"});});
      await expect(list).toHaveCSS("overscroll-behavior-y","auto");
      const before = await page.evaluate(()=>scrollY);
      expect(before).toBeGreaterThan(30);
      const rect = await list.boundingBox();
      const x=rect!.x+rect!.width/2, y=Math.max(110,rect!.y+30);
      await cdp.send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x,y}]});
      for(let i=1;i<=10;i++) {
        await cdp.send("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x,y:y+i*15}]});
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
      await expect.poll(()=>page.evaluate(()=>scrollY)).toBeLessThan(before-20);
    }
  });
  test("PDF scrolls by default and field placement is temporary", async ({page}) => {
    await setup(page);
    await page.route("**/api/v1/materials/3/", route => route.fulfill({json: {
      id: 3, title: "Original scroll fixture", category: 2, category_name: "Original volume",
      source: "Original", license: "Owned", description: "", rights_confirmed: true,
      status: "draft", version_id: 1, segments: [], audio: null,
    }}));
    await page.route("**/api/v1/materials/3/questions/", route => route.fulfill({json: {
      id: 1, material: 3, audio: 1, document: 1, presentation: "pdf", document_pages: [1], duration_seconds: 1800,
      questions: [{number: 1, part: 1, type: "short_answer", prompt: "Original blank", answers: ["original"], options: [], instructions: "", max_words: 1, context: {pdf_field: {page: 1, x: .2, y: .2, width: .3, height: .04}}}],
    }}));
    await page.route("**/api/v1/materials/3/question-document/", route => route.fulfill({json: {id: 1, page_count: 1, extraction_state: "extracted", extracted_text: ""}}));
    await page.route("**/api/v1/question-documents/1/pdf-pages/1/", route => route.fulfill({path: "tests/fixtures/scroll-paper.pdf", contentType: "application/pdf"}));
    await page.goto("/admin/3?step=material-questions");
    const paper = page.locator(".pdf-original-page");
    await expect(paper.locator("canvas")).toBeVisible({timeout: 15000});
    await expect(page.getByText("Opening original PDF…", {exact: true})).toBeHidden({timeout: 15000});
    await expect(paper).not.toHaveClass(/pdf-placing/);
    const cdp = await page.context().newCDPSession(page);
    async function swipe(x: number, y: number) {
      await cdp.send("Input.dispatchTouchEvent", {type: "touchStart", touchPoints: [{x, y}]});
      for(let i=1;i<=10;i++) {
        await cdp.send("Input.dispatchTouchEvent", {type: "touchMove", touchPoints: [{x, y:y-i*20}]});
        await page.waitForTimeout(16);
      }
      await cdp.send("Input.dispatchTouchEvent", {type: "touchEnd", touchPoints: []});
    }
    await paper.evaluate(el => el.scrollIntoView({block: "start"}));
    const before = await page.evaluate(() => scrollY);
    await swipe(195, 500);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 50);
    const place = page.getByRole("button", {name: "Place answer field 1", exact: true});
    await place.click();
    await expect(paper).toHaveClass(/pdf-placing/);
    await page.getByRole("button", {name: "Cancel field placement", exact: true}).click();
    await expect(paper).not.toHaveClass(/pdf-placing/);
    await place.click();
    await paper.evaluate(el => el.scrollIntoView({block: "start"}));
    await swipe(195, 500);
    await expect(paper).not.toHaveClass(/pdf-placing/);
    await page.screenshot({path: "test-results/pdf-touch-scroll.png", fullPage: true});
  });
});

for (const width of [320, 1280]) {
  test(`profile switches separate workspaces ${width}px`, async ({page}) => {
    await setup(page);
    await page.route('**/api/v1/auth/refresh/',route=>route.fulfill({json:{access:'fixture',user:{id:1,username:'Owner',email:'owner@example.test',role:'admin',can_edit:true,is_superuser:true}}}));
    await page.setViewportSize({width,height:844});
    await page.goto('/');
    await expect(page.locator('.app-shell')).toHaveClass(/learner-workspace/);
    await expect(page.getByRole('link',{name:'Manage materials',exact:true})).toBeHidden();
    if(width===320) {
      const quick=page.getByRole('navigation',{name:'Quick navigation'});
      await expect(quick.getByRole('link')).toHaveCount(5);
      await expect(quick.getByRole('link').last()).toHaveAttribute('href','/profile');
    }
    await page.getByRole('button',{name:'Account menu',exact:true}).click();
    await page.getByRole('link',{name:'Switch to admin mode',exact:true}).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.locator('.app-shell')).toHaveClass(/admin-workspace/);
    await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Practice Library'})).toBeHidden();
    await expect(page.locator('.future-nav')).toBeHidden();
    await page.getByRole('button',{name:'Account menu',exact:true}).click();
    await page.locator('.profile-menu').getByRole('link',{name:'Profile & settings',exact:true}).click();
    await expect(page).toHaveURL(/\/profile\?workspace=admin$/);
    await page.reload();
    await expect(page.getByRole('heading',{name:'Administrator profile',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Account menu',exact:true}).click();
    await page.getByRole('link',{name:'Switch to learner mode',exact:true}).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.app-shell')).toHaveClass(/learner-workspace/);
    if(width===320) await page.getByRole('navigation',{name:'Quick navigation'}).getByRole('link',{name:'Profile',exact:true}).click();
    else {
      await page.getByRole('button',{name:'Account menu',exact:true}).click();
      await page.locator('.profile-menu').getByRole('link',{name:'Profile & settings',exact:true}).click();
    }
    await expect(page.getByRole('heading',{name:'Your learning profile',exact:true})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Administrators',exact:true})).toBeHidden();
    await fits(page);
    await page.screenshot({path:`test-results/workspace-profile-${width}.png`,fullPage:true});
  });
}

test('student cannot enable administrator UI through workspace query', async ({page}) => {
  await setup(page);
  await page.route('**/api/v1/auth/refresh/',route=>route.fulfill({json:{access:'fixture',user:{id:2,username:'Student',role:'student',can_edit:false,is_superuser:false}}}));
  let adminRequests=0;
  await page.route('**/api/v1/admin/**',route=>{adminRequests++;return route.fulfill({status:403,json:{detail:'Forbidden'}});});
  await page.goto('/profile?workspace=admin');
  await expect(page.getByRole('heading',{name:'Your learning profile',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Account menu',exact:true}).click();
  await expect(page.getByRole('link',{name:/Switch to .* mode/})).toHaveCount(0);
  expect(adminRequests).toBe(0);
});

test('learner practice hides editing and profile switch opens timing in place', async ({page})=>{
  await setup(page);
  await page.route('**/api/v1/sessions/15/',route=>route.fulfill({json:{
    id:15,material:3,title:'Original timing fixture',version:1,difficulty:'easy',position:0,
    drafts:{'0':'My saved answer'},checked_positions:[],can_edit_timing:true,
    groups:[{start_ms:0,end_ms:900,speaker:'',word_count:3}],
    audio:{id:1,duration_ms:15000,mime_type:'audio/wav',size:240044,stream_url:'/api/v1/audio/1/stream/'},
  }}));
  await page.goto('/practice/15');
  await expect(page.getByLabel('What did you hear?')).toHaveValue('My saved answer');
  await expect(page.getByRole('button',{name:'Adjust timing',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Account menu',exact:true}).click();
  await page.getByRole('link',{name:'Switch to admin mode',exact:true}).click();
  await expect(page).toHaveURL(/practice\/15\?workspace=admin$/);
  await expect(page.getByRole('button',{name:'Adjust timing',exact:true})).toBeVisible();
  await expect(page.getByLabel('What did you hear?')).toHaveValue('My saved answer');
  await page.getByRole('button',{name:'Account menu',exact:true}).click();
  await page.getByRole('link',{name:'Switch to learner mode',exact:true}).click();
  await expect(page).toHaveURL(/practice\/15$/);
  await expect(page.getByRole('button',{name:'Adjust timing',exact:true})).toHaveCount(0);
});
