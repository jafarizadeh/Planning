// Eight-language regression uses only a temporary browser profile and synthetic records.
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer');
const assert=require('node:assert/strict');
const URL=process.env.PLANNING_TEST_URL||'http://127.0.0.1:48628/';
const OUT=process.env.PLANNING_SCREENSHOTS||'/tmp';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage(),errors=[],dialogs=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept();});
  await page.setViewport({width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.evaluateOnNewDocument(()=>{
   const RealDate=Date,now=RealDate.parse('2026-10-15T11:00:00Z');
   class TestDate extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
   window.Date=TestDate;
   if(!location.protocol.startsWith('http')||sessionStorage.getItem('languages-test-seeded'))return;
   sessionStorage.setItem('languages-test-seeded','1');
   const policy={payMode:'hourly',paymentMode:'split',shiftRate:40,hourlyRate:10,payslipCap:711,useDefaultTimes:true,defaultTimes:{morning:{start:'10:00',end:'14:00'},evening:{start:'18:00',end:'22:00'}}};
   const records={'2026-09-05':{morning:'work',timings:{morning:{start:'10:00',end:'13:00',nextDay:false}}}};
   for(let n=1;n<=10;n++)records['2026-10-'+String(n).padStart(2,'0')]={morning:'work',evening:'work'};
   records['2026-10-05'].timings={morning:{start:'09:15',end:'12:45',nextDay:false}};
   localStorage.setItem('shift-planner-archive-v2',JSON.stringify({schemaVersion:5,savedAt:now-1000,
    records,settings:{language:'fr',theme:'light',weekStart:1,morningName:'Ancien matin',eveningName:'Ancien soir',...policy},
    monthlyPolicies:{'2026-09':{...policy,hourlyRate:11},'2026-10':policy},audit:[]}));
  });
  const tap=async selector=>{await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.click(selector);};
  const archive=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('shift-planner-archive-v2')));
  const ready=()=>page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  const visible=selector=>page.$eval(selector,e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
  const settings=()=>page.click('#nav-settings');
  const home=()=>page.click('#nav-home');
  const openDay=async()=>{await tap('#calendar-grid [data-date="2026-10-05"]');await wait(240);};
  const closeDay=()=>page.click('.quick-close');
  const setLanguage=async code=>{
   await settings();await tap('#language-picker-trigger');await wait(280);
   const choices=await page.$$eval('#picker-root .picker-choice',items=>items.map(e=>e.dataset.value));
   assert.deepEqual(choices,['de','en','fr','fa','es','zh','hi','ur']);
   await tap('#picker-root [data-value="'+code+'"]');
   assert.equal(await page.$('.picker-sheet'),null);
   assert.equal((await archive()).settings.language,code);
   assert.equal(await page.$eval('html',e=>e.lang),code);
   assert.equal(await page.$eval('html',e=>e.dir),['fa','ur'].includes(code)?'rtl':'ltr');
  };
  const pay=()=>page.evaluate(async()=>{
   const c=await import('./core.mjs');const a=JSON.parse(localStorage.getItem(c.ARCHIVE_KEY));
   const policy=c.policyForPeriod('2026-10',a.monthlyPolicies,a.settings);
   return c.calculatePayroll(a.records,2026,9,policy,c.timingAnalysis(a.records,a.monthlyPolicies,a.settings));
  });
  await page.goto(URL,{waitUntil:'networkidle0'});await ready();
  const initial=await archive();
  assert.equal(await page.$('#morning-input'),null);assert.equal(await page.$('#evening-input'),null);
  assert.equal(await page.$('[data-text="shiftNames"]'),null);
  assert.equal(await page.$('#settings-form button[type="submit"]'),null);
  assert.equal((await pay()).totalCents,79500);
  const translations=await page.evaluate(async()=>{const m=await import('./translations-asia.mjs');return m.asianTranslations;});
  for(const code of ['zh','hi','ur']){
   const dict=translations[code];
   await setLanguage(code);
   assert.equal(await page.$eval('[data-text="settingsTitle"]',e=>e.textContent),dict.settingsTitle);
   assert.equal(await page.$eval('[data-text="financeSettings"]',e=>e.textContent),dict.financeSettings);
   assert.equal(await page.$eval('[data-text="defaultTimesTitle"]',e=>e.textContent),dict.defaultTimesTitle);
   assert.equal(await page.$eval('#settings-autosave-status span:last-child',e=>e.textContent),dict.autosaveSaved);
   assert.deepEqual((await archive()).records,initial.records);
   assert.deepEqual((await archive()).monthlyPolicies,initial.monthlyPolicies);
   assert.equal((await archive()).settings.morningName,'Ancien matin','retired label metadata is preserved in backups');
   // The real weekday picker is translated too, without changing salary.
   await tap('#weekstart-picker-trigger');await wait(280);
   assert.equal(await page.$eval('#picker-dialog-title',e=>e.textContent),dict.weekStarts);
   await tap('#picker-root [data-value="1"]');
   for(const theme of ['light','dark']){
    await tap('.appearance-option:has(input[value="'+theme+'"])');
    assert.equal((await archive()).settings.theme,theme);
    for(const width of [320,375,430]){
     await page.setViewport({width,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
     await settings();
     let sizes=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,w:innerWidth}));
     assert.ok(sizes.doc<=sizes.w,code+' settings overflow '+width);
     await home();
     assert.equal((await pay()).totalCents,79500);assert.equal((await pay()).envelopeCents,8400);
     assert.equal(await page.$eval('[data-text="historyTitle"]',e=>e.textContent),dict.historyTitle);
     assert.equal(await page.$eval('#home-view',e=>e.getAttribute('aria-label')),dict.calendarTab);
     const weekdays=await page.$$eval('#weekdays .weekday',items=>items.map(e=>e.textContent));assert.equal(weekdays.length,7);assert.ok(weekdays.every(Boolean));
     sizes=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,w:innerWidth}));assert.ok(sizes.doc<=sizes.w,code+' home overflow '+width);
     if(width===375&&theme==='light'){
      await page.$eval('#go-today',e=>e.click());await wait(280);
      await page.screenshot({path:OUT+'/planning-v24-'+code+'-home.png',fullPage:false});
     }
     await openDay();
     const headings=await page.$$eval('.quick-shift-label strong',items=>items.map(e=>e.textContent));
     assert.deepEqual(headings,[dict.morning,dict.evening]);
     assert.equal(await page.$eval('#sheet-heading',e=>e.textContent),dict.entryTitle);
     assert.equal(await page.$eval('[data-action="pick-time"][data-shift="morning"][data-boundary="start"] strong',e=>e.textContent),'09:15');
     assert.equal(await page.$eval('[data-action="set-shift"][data-shift="morning"][data-state="work"] span:last-child',e=>e.textContent),dict.worked);
     const geometry=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth,sheet:document.querySelector('.quick-sheet').getBoundingClientRect().width,
      controls:[...document.querySelectorAll('#sheet-root .quick-state-btn,#sheet-root .time-value-button')].map(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,scroll:e.scrollWidth,client:e.clientWidth};})}));
     assert.ok(geometry.doc<=geometry.w&&geometry.sheet<=geometry.w,code+' sheet overflow '+width);
     assert.ok(geometry.controls.every(r=>r.h>=44),code+' small tap target');
     assert.ok(geometry.controls.every(r=>r.scroll<=r.client+2),code+' clipped button label '+JSON.stringify(geometry.controls));
     if(width===375&&(theme==='light'||code==='ur'))await page.screenshot({path:OUT+'/planning-v24-'+code+'-editor-'+theme+'.png',fullPage:false});
     if(width===375){
      await tap('[data-action="pick-time"][data-shift="morning"][data-boundary="start"]');await wait(220);
      assert.equal(await page.$eval('#hour-wheel-label',e=>e.textContent),dict.hourWheel);
      assert.equal(await page.$eval('#minute-wheel-label',e=>e.textContent),dict.minuteWheel);
      assert.equal(await page.$eval('.time-wheels',e=>e.dir),'ltr');
      assert.equal(await page.$$eval('#time-picker-root input',es=>es.length),0);
      await page.keyboard.press('Escape');assert.ok(await page.$('.quick-sheet'));
     }
     await closeDay();await settings();
    }
   }
   // Language persists after a full reload and through an actual backup round-trip.
   await page.reload({waitUntil:'networkidle0'});await ready();
   assert.equal((await archive()).settings.language,code);assert.equal(await page.$eval('html',e=>e.lang),code);
   assert.equal((await pay()).totalCents,79500);
   const backup=await page.evaluate(async()=>{const c=await import('./core.mjs'),a=JSON.parse(localStorage.getItem(c.ARCHIVE_KEY));return c.parseBackup(JSON.stringify(c.makeBackup(a.records,a.settings,a.monthlyPolicies,a.audit)));});
   assert.equal(backup.settings.language,code);assert.deepEqual(backup.records,initial.records);
   assert.equal(backup.settings.morningName,'Ancien matin');
   // Move to the previous month, then back: both modes and localization persist.
   await tap('#previous-month');await settings();assert.equal(await page.$eval('#language-select',e=>e.value),code);await home();await tap('#next-month');
  }
  // The original five languages still work after switching out of Urdu RTL.
  for(const code of ['fa','en','de','es','fr']){await setLanguage(code);assert.deepEqual((await archive()).records,initial.records);await home();assert.equal((await pay()).totalCents,79500);}
  // In Urdu the all-month confirmation is translated and the accepted switch autosaves.
  await setLanguage('ur');await tap('.pay-mode-option:has(input[name="payment-mode"][value="single"])');
  assert.equal(dialogs.at(-1),translations.ur.modeConfirm);
  assert.equal((await archive()).settings.paymentMode,'single');await home();assert.equal(await visible('.finance-grid'),false);
  assert.equal((await pay()).totalCents,79500);assert.equal((await pay()).envelopeCents,0);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'networkidle0'});
  await page.setOfflineMode(true);await page.reload({waitUntil:'domcontentloaded'});await ready();
  assert.equal(await page.$eval('html',e=>e.dir),'rtl');assert.equal((await archive()).settings.language,'ur');
  await setLanguage('hi');await home();assert.equal((await pay()).totalCents,79500);
  // Wait for the durable mirror before simulating loss of localStorage.
  await page.waitForFunction(async()=>{const m=await import('./archive-db.mjs'),a=await m.loadArchiveFromDb();return a?.settings.language==='hi'&&a.settings.paymentMode==='single';});
  await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'domcontentloaded'});await ready();
  assert.equal((await archive()).settings.language,'hi');assert.equal(await page.$eval('html',e=>e.dir),'ltr');
  assert.deepEqual((await archive()).records,initial.records);assert.equal((await pay()).totalCents,79500);
  assert.deepEqual(errors,[]);
  console.log('PASS v2.4: eight-language real picker, 3 new complete translations, Urdu RTL, localized fixed shift labels, 18 phone/theme layouts, time wheels, no naming card, autosave, legacy metadata, payroll/history unchanged, reload/backup/offline/IndexedDB recovery.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
