// Release-update regression, with a synthetic 2-version server and isolated browser.
// Does not use any real employee or personal work data.
const puppeteer=require(process.env.PUPPETEER_MODULE||"puppeteer");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const root=path.join(__dirname,"publish");
const MIME={".html":"text/html",".css":"text/css",".js":"text/javascript",".mjs":"text/javascript",".json":"application/json",".webmanifest":"application/manifest+json",".png":"image/png",".svg":"image/svg+xml"};
let release="alpha";
const server=http.createServer((req,res)=>{
 const request=new URL(req.url,"http://localhost");
 const name=decodeURIComponent(request.pathname.replace(/^\/+/,""))||"index.html";
 if(!/^[a-zA-Z0-9._-]+$/.test(name)){res.writeHead(404).end();return;}
 const file=path.join(root,name);
 if(!fs.existsSync(file)){res.writeHead(404).end();return;}
 let content=fs.readFileSync(file);
 if(name==="service-worker.js"){
  let source=content.toString("utf8");
  source=source.replace(/const CACHE_NAME = "planning-offline-[^"]+";/,
    'const CACHE_NAME = "planning-offline-test-'+release+'";');
  content=Buffer.from(source);
 }
 res.writeHead(200,{
  "Content-Type":MIME[path.extname(name)]||"application/octet-stream",
  "Cache-Control":name==="service-worker.js"?"no-store":"no-cache"
 }).end(content);
});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const url="http://127.0.0.1:"+server.address().port+"/";
 const browser=await puppeteer.launch({
  executablePath:process.env.CHROME_PATH||"/usr/bin/google-chrome",
  headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]
 });
 try{
  const page=await browser.newPage(),errors=[];
  page.on("pageerror",err=>errors.push(err.stack||err.message));
  await page.setViewport({width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.evaluateOnNewDocument(()=>{
   const now=Date.parse("2026-10-15T11:00:00Z"),Actual=Date;
   class TestDate extends Actual{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
   window.Date=TestDate;
   if(!sessionStorage.getItem("pwa-update-seed")){
    sessionStorage.setItem("pwa-update-seed","yes");
    const defaults={morning:{start:"10:00",end:"14:00"},evening:{start:"18:00",end:"22:00"}};
    const policy={payMode:"shift",paymentMode:"split",shiftRate:40,hourlyRate:10,payslipCap:711,useDefaultTimes:true,defaultTimes:defaults};
    localStorage.setItem("shift-planner-archive-v2",JSON.stringify({
     schemaVersion:5,savedAt:now-2000,
     records:{"2026-10-05":{morning:"work",evening:"work"}},settings:{language:"fr",theme:"light",weekStart:1,...policy},
     monthlyPolicies:{"2026-10":policy},audit:[]
    }));
   }
  });
  await page.goto(url,{waitUntil:"networkidle0"});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==="true");
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload({waitUntil:"networkidle0"});
  await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  assert.equal(await page.$eval("#pwa-update-banner",node=>node.hidden),true);
  const snapshotBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem("shift-planner-archive-v2")));
  assert.equal(await page.$eval("#salary-total",n=>n.textContent.includes("80")),true);
  const initialWorker=await page.evaluate(()=>caches.keys().then(keys=>keys.filter(k=>k.includes("test-alpha"))));
  assert.equal(initialWorker.length,1);
  // Background discovery: old UI does not reload or alter records.
  release="beta";
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
  await page.waitForFunction(()=>document.querySelector("#pwa-update-banner").hidden===false,{timeout:9000});
  assert.equal(await page.$eval("#pwa-update-now",n=>n.textContent),"Mettre à jour");
  assert.equal(await page.$eval(".settings-fineprint",n=>n.textContent.includes("v2.5")),true);
  const pending=await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
  assert.equal(pending,true);
  assert.deepEqual((await page.evaluate(()=>JSON.parse(localStorage.getItem("shift-planner-archive-v2")))).records,snapshotBefore.records);
  // A currently-open shift editor blocks activation.
  await page.$eval('#calendar-grid [data-date="2026-10-05"]',e=>e.click());
  await page.waitForSelector(".quick-sheet");
  await page.$eval("#pwa-update-now",n=>n.click());
  await delay(350);
  assert.equal(await page.$(".quick-sheet")!==null,true);
  assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),true);
  await page.click(".quick-close");
  await page.click("#pwa-update-later");
  assert.equal(await page.$eval("#pwa-update-banner",n=>n.hidden),true);
  // Closing/opening the PWA again offers the waiting update.
  await page.reload({waitUntil:"networkidle0"});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==="true");
  await page.waitForFunction(()=>!document.querySelector("#pwa-update-banner").hidden);
  await page.click("#nav-settings");
  await page.$eval("#payslip-cap-input",el=>{
   el.focus();el.value="710";el.dispatchEvent(new Event("input",{bubbles:true}));
  });
  // Invalid/incomplete input must block installing; it cannot erase old rates.
  await page.$eval("#payslip-cap-input",el=>{
   el.value="";el.dispatchEvent(new Event("input",{bubbles:true}));
  });
  await delay(520);
  await page.$eval("#pwa-update-now",n=>n.click());
  await delay(220);
  assert.equal(await page.$eval("#pwa-update-banner",n=>n.hidden),false);
  assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),true);
  await page.$eval("#payslip-cap-input",el=>{
   el.value="710";el.dispatchEvent(new Event("input",{bubbles:true}));
  });
  // A valid yet unsaved draft must be flushed before activation.
  // The confirmed update navigates immediately: arm the navigation waiter first.
  const navigated=page.waitForNavigation({waitUntil:"networkidle0",timeout:12000});
  await page.evaluate(()=>{setTimeout(()=>document.querySelector("#pwa-update-now").click(),0);});
  await navigated;
  await page.waitForFunction(async()=>{
    const r=await navigator.serviceWorker.getRegistration();
    const keys=await caches.keys();
    return !r.waiting&&r.active&&keys.some(k=>k.includes("test-beta"));
  },{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==="true",{timeout:10000});
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem("shift-planner-archive-v2")));
  assert.equal(after.settings.payslipCap,710);
  assert.deepEqual(after.records,snapshotBefore.records);
  assert.equal(await page.$eval("#salary-total",e=>e.textContent.includes("80")),true);
  const db=await page.evaluate(async()=>{
   const {loadArchiveFromDb}=await import("./archive-db.mjs");
   return loadArchiveFromDb();
  });
  assert.deepEqual(db.records,after.records);
  assert.equal(db.settings.payslipCap,710);
  // The new version and its app-shell assets work without internet.
  await page.setOfflineMode(true);
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==="true");
  assert.equal(await page.$eval("#salary-total",e=>e.textContent.includes("80")),true);
  assert.equal(await page.$eval("#pwa-update-banner",n=>n.hidden),true);
  assert.equal(await page.$$eval("#history-months .history-month",e=>e.length),1);
  await page.setOfflineMode(false);
  assert.deepEqual(errors,[]);
  console.log("PASS: two-version Service Worker; notification; Later; next launch; unsaved/invalid form and open editor block; controlled activation; records survive; IndexedDB; offline.");
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;})
.finally(()=>new Promise(resolve=>server.close(resolve)));
