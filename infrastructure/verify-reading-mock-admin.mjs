// Only authentication bootstrap is supplied; all content/save/score calls use real DRF.
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../frontend/package.json',import.meta.url));
const {chromium}=require('playwright-core');
const fixture=JSON.parse(readFileSync(process.env.READING_ADMIN_FIXTURE,'utf8'));
const base=process.env.READING_BASE;
assert.ok(base && fixture.access && fixture.user.can_edit);
const created=[];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
try {
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:900}});
  try {
   await context.route('**/api/v1/auth/refresh/',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access:fixture.access,user:fixture.user})}));
   const page=await context.newPage();const errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>void d.accept());
   await page.goto(`${base}/admin/reading?collection=Cambridge&book=${encodeURIComponent(fixture.book)}&test=${fixture.test}`);
   const preview=page.getByRole('link',{name:'Preview Mock',exact:true});await preview.waitFor();
   assert.equal(await page.locator('.skill-navigation').count(),0);
   await preview.click();
   await page.getByRole('radio',{name:/Mock · No time limit/}).check();
   const started=page.waitForResponse(r=>r.url().endsWith('/reading-full-attempts/')&&r.request().method()==='POST');
   await page.getByRole('button',{name:'Start Mock',exact:true}).click();
   const response=await started;
   assert.equal(response.status(),201,'Must never reuse or clean up an existing admin attempt');
   const attempt=await response.json();created.push(attempt.id);
   if(process.env.READING_ADMIN_JOURNAL)writeFileSync(process.env.READING_ADMIN_JOURNAL,JSON.stringify({created,owner:fixture.user.id}));
   await page.locator('.exam-shell').waitFor();
   await page.getByRole('navigation',{name:'Question navigation'}).waitFor();
   if(width<768)await page.getByRole('tab',{name:'Questions',exact:true}).click();
   const firstAnswer=page.getByLabel('Question 1',{exact:true});
   // The first question can be a matching/heading task, where NOT GIVEN is
   // not a valid option. Choose a real wrong answer so the persisted result
   // check remains deterministic across different source test layouts.
   const probeAnswer=await firstAnswer.evaluate(element=>element.tagName==='SELECT'
    ? [...element.options].map(option=>option.value).find(value=>value)
    : 'probe answer');
   if(await firstAnswer.evaluate(element=>element.tagName)==='SELECT'){
    const correct=fixture.firstAnswer;
    const wrong=await firstAnswer.locator('option').evaluateAll((options,correctValue)=>options.map(option=>option.value).find(value=>value && value!==correctValue),correct);
    assert.ok(wrong,'Question 1 must expose an answer other than its printed key');
    await firstAnswer.selectOption(wrong);
   } else await firstAnswer.fill(probeAnswer);
   await page.getByRole('status').filter({hasText:/^Saved$/}).waitFor();
   await page.reload();
   if(width<768)await page.getByRole('tab',{name:'Questions',exact:true}).click();
   assert.equal(await page.getByLabel('Question 1',{exact:true}).inputValue(),probeAnswer);
   await page.screenshot({path:`/tmp/reading-admin-mock-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:'Submit Mock',exact:true}).click();
   await page.getByLabel('Result: 0 / 40',{exact:true}).waitFor();
   assert.ok(page.url().endsWith(`/reading/full/attempts/${attempt.id}/results`));
   await page.reload();await page.getByLabel('Result: 0 / 40',{exact:true}).waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   assert.deepEqual(errors,[]);
   console.log(`Administrator preview → same Mock controls → persisted submission/result verified at ${width}px.`);
  } finally {await context.close();}
 }
} finally {await browser.close();}
