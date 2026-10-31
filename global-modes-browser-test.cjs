// Regression: saved modes are global, the calendar key is absent, single pay has one total.
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer');
const assert=require('node:assert/strict');
const URL=process.env.PLANNING_TEST_URL||'http://127.0.0.1:48628/';
const OUT=process.env.PLANNING_SCREENSHOTS||'/tmp';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const euro=text=>Number(text.replace(/\s/g,'').replace('€','').replace(',','.'));
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage(),errors=[],dialogs=[];let approve=true;
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await (approve?dialog.accept():dialog.dismiss());});
  await page.setViewport({width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.evaluateOnNewDocument(()=>{
   const RealDate=Date,now=RealDate.parse('2026-10-15T11:00:00Z');
   class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
   window.Date=FixedDate;
   if(!location.protocol.startsWith('http')||sessionStorage.getItem('global-modes-seeded'))return;
   sessionStorage.setItem('global-modes-seeded','yes');
   const records={
    '2026-09-05':{morning:'work',timings:{morning:{start:'09:00',end:'12:00',nextDay:false}}},
    '2026-11-01':{morning:'work',timings:{morning:{start:'08:00',end:'10:00',nextDay:false}}},
    '2027-01-05':{morning:'work'}
   };
   for(let day=1;day<=10;day++)records['2026-10-'+String(day).padStart(2,'0')]={morning:'work',evening:'work'};
   records['2026-10-05'].timings={morning:{start:'09:15',end:'12:45',nextDay:false}};
   const defaults={morning:{start:'10:00',end:'14:00'},evening:{start:'18:00',end:'22:00'}};
   const policy=(extra={})=>({payMode:'shift',paymentMode:'split',shiftRate:40,hourlyRate:10,payslipCap:711,defaultTimes:defaults,useDefaultTimes:true,...extra});
   const archive={schemaVersion:4,savedAt:now-1000,records,
    settings:{language:'fr',theme:'light',weekStart:1,...policy()},
    monthlyPolicies:{
     '2026-09':policy({payMode:'hourly',paymentMode:'single',shiftRate:52,hourlyRate:11}),
     '2026-10':policy({payMode:'hourly',paymentMode:'single'}),
     '2026-11':policy({payMode:'shift',paymentMode:'split',shiftRate:48,hourlyRate:12}),
     '2027-01':policy({payMode:'shift',paymentMode:'split',shiftRate:58,hourlyRate:15})
    },audit:[]};
   localStorage.setItem('shift-planner-archive-v2',JSON.stringify(archive));
  });
  await page.goto(URL,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  const archive=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('shift-planner-archive-v2')));
  const salary=async()=>euro(await page.$eval('#salary-total',e=>e.textContent));
  const visible=selector=>page.$eval(selector,e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
  const tap=async selector=>{await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.click(selector);};
  const checked=async(name,value)=>assert.equal(await page.$eval('input[name="'+name+'"]:checked',e=>e.value),value);
  const setModes=async(payMode,paymentMode)=>{
   await page.click('#nav-settings');
   for(const [name,value] of [['pay-mode',payMode],['payment-mode',paymentMode]])await tap('.pay-mode-option:has(input[name="'+name+'"][value="'+value+'"])');
   await tap('#settings-form button[type="submit"]');await page.click('#nav-home');
  };
  const inspectModes=async(payMode,paymentMode)=>{
   await page.click('#nav-settings');await checked('pay-mode',payMode);await checked('payment-mode',paymentMode);
   assert.equal(await visible('#shift-rate-field'),payMode==='shift');
   assert.equal(await visible('#hourly-rate-field'),payMode==='hourly');
   assert.equal(await visible('#payslip-cap-field'),paymentMode==='split');
   await page.click('#nav-home');
  };
  assert.equal((await archive()).schemaVersion,5);
  assert.equal(await page.$('.shift-key'),null);assert.equal(await page.$('#morning-key'),null);assert.equal(await page.$('#evening-key'),null);
  assert.equal(await salary(),800);await inspectModes('shift','split');
  const original=await archive();
  approve=false;await setModes('hourly','single');approve=true;
  assert.equal(await salary(),800);assert.deepEqual((await archive()).settings,original.settings);
  assert.deepEqual((await archive()).records,original.records);
  assert.ok(dialogs.at(-1).includes('tous les mois'));
  await setModes('hourly','single');assert.equal(await salary(),795);
  assert.equal((await archive()).settings.payMode,'hourly');assert.equal((await archive()).settings.paymentMode,'single');
  // Changing only the two modes must not rewrite stored per-month monetary/time values.
  assert.deepEqual((await archive()).monthlyPolicies,original.monthlyPolicies);
  assert.deepEqual((await archive()).records,original.records);
  assert.equal(await visible('.finance-grid'),false);assert.equal(await visible('.payslip-card'),false);
  assert.equal(await visible('#envelope-card'),false);assert.equal(await visible('.salary-strip'),true);
  assert.equal(await page.$eval('.history-month[data-period="2026-10"] .history-month-details',e=>/Fiche de paie|Enveloppe/.test(e.textContent)),false);
  assert.equal(euro(await page.$eval('.history-month[data-period="2026-10"] .history-month-total',e=>e.textContent)),795);
  // Back/forward across recorded, unrecorded and year-boundary months cannot reset modes.
  await tap('#previous-month');assert.equal(await salary(),33);await inspectModes('hourly','single');
  await page.click('#nav-settings');assert.equal(await page.$eval('#hourly-rate-input',e=>Number(e.value)),11);await page.click('#nav-home');
  await tap('#next-month');assert.equal(await salary(),795);
  await tap('#next-month');assert.equal(await salary(),24);await inspectModes('hourly','single');
  await tap('#next-month');assert.equal(await salary(),0);await inspectModes('hourly','single');
  await tap('#next-month');assert.equal(await salary(),60);await inspectModes('hourly','single');
  await tap('#next-month');assert.equal(await salary(),0);await inspectModes('hourly','single');
  await tap('#calendar-grid [data-date="2027-02-01"]');await wait(250);
  await page.click('#sheet-root [data-action="set-shift"][data-shift="morning"][data-state="work"]');assert.equal(await salary(),40);
  await page.click('.quick-close');
  for(let i=0;i<5;i++)await tap('#previous-month');
  assert.ok((await page.$eval('#month-label',e=>e.textContent)).includes('septembre'));
  // Switching in a HISTORICAL month persists globally, not just in that month's snapshot.
  const beforeHistoricalEdit=await archive();
  await setModes('shift','split');assert.equal(await salary(),52);
  assert.equal((await archive()).settings.payMode,'shift');assert.equal((await archive()).settings.paymentMode,'split');
  assert.deepEqual((await archive()).monthlyPolicies,beforeHistoricalEdit.monthlyPolicies);
  await tap('#next-month');assert.equal(await salary(),800);await inspectModes('shift','split');
  assert.equal(await visible('.finance-grid'),true);assert.equal(await visible('.payslip-card'),true);assert.equal(await visible('#envelope-card'),true);
  assert.equal(euro(await page.$eval('#envelope-amount',e=>e.textContent)),89);
  await tap('#previous-month');await setModes('hourly','single');assert.equal(await salary(),33);
  assert.equal((await archive()).settings.hourlyRate,10,'Global rate must not become the old month rate on mode-only change');
  await tap('#next-month');assert.equal(await salary(),795);
  // Single payment also removes the duplicate card in the ordinary flat-shift mode.
  await setModes('shift','single');assert.equal(await salary(),800);assert.equal(await visible('.finance-grid'),false);
  await setModes('hourly','single');assert.equal(await salary(),795);
  await page.$eval('#go-today',e=>e.click());await page.evaluate(()=>window.scrollTo(0,0));await wait(2800);
  await page.screenshot({path:OUT+'/planning-v22-single-total.png',fullPage:false});
  // All five languages, both themes and narrow-phone layout keep the key removed and one total.
  for(const lang of ['fr','en','de','es','fa']){
   await page.click('#nav-settings');await page.select('#language-select',lang);
   await page.$eval('input[name="theme"][value="dark"]',e=>{e.checked=true;e.dispatchEvent(new Event('change'));});
   await tap('#settings-form button[type="submit"]');await page.click('#nav-home');
   for(const width of [320,375,430]){
    await page.setViewport({width,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    assert.equal(await page.$('.shift-key'),null);assert.equal(await visible('.finance-grid'),false);
    const size=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,width:innerWidth}));
    assert.ok(size.doc<=size.width,lang+' overflow at '+width);
    await tap('#next-month');await inspectModes('hourly','single');await tap('#previous-month');
   }
  }
  await page.setViewport({width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.$eval('#go-today',e=>e.click());await page.evaluate(()=>window.scrollTo(0,0));await wait(2800);
  await page.screenshot({path:OUT+'/planning-v22-single-total-fa-dark.png',fullPage:false});
  // Reload, export/import normalization and offline navigation preserve both global switches.
  const before=await archive();await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  assert.equal(await salary(),795);await inspectModes('hourly','single');assert.deepEqual((await archive()).records,before.records);
  const backup=await page.evaluate(async()=>{const c=await import('./core.mjs'),a=JSON.parse(localStorage.getItem(c.ARCHIVE_KEY));return c.parseBackup(JSON.stringify(c.makeBackup(a.records,a.settings,a.monthlyPolicies,a.audit)));});
  assert.equal(backup.settings.payMode,'hourly');assert.equal(backup.settings.paymentMode,'single');assert.deepEqual(backup.records,before.records);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'networkidle0'});
  await page.setOfflineMode(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  await tap('#next-month');assert.equal(await salary(),24);await inspectModes('hourly','single');await tap('#previous-month');assert.equal(await salary(),795);
  assert.equal(await visible('.finance-grid'),false);await page.setOfflineMode(false);
  await page.waitForFunction(async()=>{const {loadArchiveFromDb}=await import('./archive-db.mjs');const a=await loadArchiveFromDb();return a?.schemaVersion===5&&a.settings.payMode==='hourly'&&a.settings.paymentMode==='single';});
  await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  assert.equal(await salary(),795);await inspectModes('hourly','single');
  assert.deepEqual((await archive()).records,before.records);assert.equal((await archive()).monthlyPolicies['2026-09'].hourlyRate,11);
  assert.deepEqual(errors,[]);
  console.log('PASS v2.2: persistent global switches across past/current/future/new-year months; historical-month save; cancel; rates/times preserved; no calendar key; total-only single payment; 15 phone/language layouts; backup/reload/offline/IndexedDB recovery.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
