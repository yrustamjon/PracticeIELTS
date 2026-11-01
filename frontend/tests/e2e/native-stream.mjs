// Invoked by the opt-in Django live-server test; uses only generated silence.
import { chromium } from '@playwright/test';
let input=''; for await (const part of process.stdin) input+=part;
const {base,token,audio,attempt}=JSON.parse(input);
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox']});
try {
 const context=await browser.newContext();
 const page=await context.newPage();
 await page.goto(base+'/api/v1/auth/csrf/');
 const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:64*1024,uploadThroughput:64*1024});
 const result=await page.evaluate(async ({token,audio,attempt})=>{
  const grant=await fetch(attempt ? `/api/v1/mock-attempts/${attempt}/start-audio/` : `/api/v1/audio/${audio}/playback/`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'});
  if(!grant.ok)throw Error('Grant failed '+grant.status);
  const data=await grant.json();
  const element=document.createElement('audio');element.preload='auto';element.src=data.url;document.body.append(element);
  const started=performance.now();
  await element.play();
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Playback did not advance')),20000);
   element.addEventListener('timeupdate',()=>{if(element.currentTime>.3){clearTimeout(timer);resolve();}});
  });
  const result={time:element.currentTime,duration:element.duration,buffered:element.buffered.length?element.buffered.end(element.buffered.length-1):0,elapsed:performance.now()-started};
  if (!attempt) {
  element.currentTime=90;
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Unbuffered seek did not resume')),20000);
   element.addEventListener('timeupdate',()=>{if(element.currentTime>90.3){clearTimeout(timer);resolve();}});
  });
  result.seekTime=element.currentTime;
  }
  element.pause();element.removeAttribute('src');element.load();
  return result;
 },{token,audio,attempt});
 if(!(result.time>.3&&result.buffered<result.duration-5&&(!attempt ? result.seekTime>90.3 : true)))throw Error('Full-download wait detected '+JSON.stringify(result));
 console.log(JSON.stringify(result));
} finally {await browser.close();}
