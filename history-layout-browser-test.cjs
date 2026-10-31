// Monthly history stays intact when the separate cumulative-total card is removed.
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer');
const assert=require('node:assert/strict');
const URL=process.env.PLANNING_TEST_URL||'http://127.0.0.1:48628/';
const OUT=process.env.PLANNING_SCREENSHOTS||'/tmp';
const euro=s=>Number(s.replace(/\s/g,'').replace('€','').replace(',','.'));
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  await page.setViewport({width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.evaluateOnNewDocument(()=>{
   const RealDate=Date,now=RealDate.parse('2026-10-15T11:00:00Z');
   class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
   window.Date=FixedDate;
   if(!location.protocol.startsWith('http')||sessionStorage.getItem('seed-history-layout'))return;
   sessionStorage.setItem('seed-history-layout','1');
   const policy={payMode:'shift',paymentMode:'single',shiftRate:40,hourlyRate:10,payslipCap:711,useDefaultTimes:true,defaultTimes:{morning:{start:'10:00',end:'14:00'},evening:{start:'18:00',end:'22:00'}}};
   localStorage.setItem('shift-planner-archive-v2',JSON.stringify({schemaVersion:5,savedAt:now-1000,records:{'2026-09-10':{morning:'work'},'2026-10-05':{morning:'work',evening:'off'}},settings:{language:'fr',theme:'light',weekStart:1,...policy},monthlyPolicies:{'2026-09':{...policy,shiftRate:52},'2026-10':policy},audit:[]}));
  });
  const tap=async selector=>{await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.click(selector);};
  const archive=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('shift-planner-archive-v2')));
  const salary=async()=>euro(await page.$eval('#salary-total',e=>e.textContent));
  const assertHistory=async()=>{
   assert.equal(await page.$('.alltime'),null);
   assert.equal(await page.$('#alltime-days'),null);
   assert.equal(await page.$('[data-text="allTime"]'),null);
   assert.equal(await page.$$eval('#history-months [data-period]',items=>items.length),2);
   assert.ok(await page.$eval('.history-section',e=>e.getClientRects().length>0));
  };
  await page.goto(URL,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  await assertHistory();
  assert.equal(await page.$eval('#history-heading',e=>e.textContent),'Historique travail et salaire');
  assert.equal(await page.$eval('body',e=>e.innerText.includes('Total depuis le début')),false);
  assert.equal(await salary(),40);
  const initial=await archive();
  assert.equal(initial.records['2026-09-10'].morning,'work');
  assert.equal(initial.monthlyPolicies['2026-09'].shiftRate,52);
  await tap('#history-months [data-period="2026-09"]');assert.equal(await salary(),52);
  await tap('#history-months [data-period="2026-10"]');assert.equal(await salary(),40);
  await tap('#calendar-grid [data-date="2026-10-05"]');
  await page.click('#sheet-root [data-shift="evening"][data-state="work"]');
  assert.equal(await salary(),80);
  await page.click('.quick-close');await assertHistory();
  assert.equal(euro(await page.$eval('#history-months [data-period="2026-10"] .history-month-total',e=>e.textContent)),80);
  for(const theme of ['light','dark']){
   await page.click('#nav-settings');
   await page.$eval('input[name="theme"][value="'+theme+'"]',e=>{e.checked=true;e.dispatchEvent(new Event('change'));});
   await page.click('#nav-home');
   for(const width of [320,375,430]){
    await page.setViewport({width,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    await page.$eval('#history-heading',e=>e.scrollIntoView({block:'center'}));
    await assertHistory();
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    if(width===375)await page.screenshot({path:OUT+'/planning-monthly-history-'+theme+'.png',fullPage:false});
   }
  }
  const after=await archive();
  assert.deepEqual(after.monthlyPolicies,initial.monthlyPolicies);
  assert.deepEqual(after.records['2026-09-10'],initial.records['2026-09-10']);
  assert.equal(after.records['2026-10-05'].evening,'work');
  const exported=await page.evaluate(async()=>{const c=await import('./core.mjs'),a=JSON.parse(localStorage.getItem(c.ARCHIVE_KEY));return c.parseBackup(JSON.stringify(c.makeBackup(a.records,a.settings,a.monthlyPolicies,a.audit)));});
  assert.deepEqual(exported.records,after.records);
  assert.deepEqual(exported.monthlyPolicies,after.monthlyPolicies);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  await assertHistory();assert.equal(await salary(),80);
  await page.setOfflineMode(true);await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  await assertHistory();assert.equal(await salary(),80);
  assert.deepEqual(errors,[]);
  console.log('PASS: no cumulative-total card; monthly history retained/clickable; live shift totals; no data or monthly-policy loss; 3 phone widths x 2 themes; reload/backup/offline.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
