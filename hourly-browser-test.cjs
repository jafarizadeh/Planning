/* Optional browser tests. Install Puppeteer or set PUPPETEER_MODULE to its path. */
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer');
const assert=require('node:assert/strict');
const URL=process.env.PLANNING_TEST_URL||'http://127.0.0.1:48628/';
const OUT=process.env.PLANNING_SCREENSHOTS||'/tmp';
const euro=s=>Number(s.replace(/\s/g,'').replace('€','').replace(',','.'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage(),errors=[],dialogs=[];
  let approve=true;
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  page.on('dialog',async d=>{dialogs.push(d.message());await (approve?d.accept():d.dismiss());});
  await page.setViewport({width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  // Tests run in an isolated temporary browser profile, with a deterministic month.
  await page.evaluateOnNewDocument(()=>{
   const RealDate=Date,now=RealDate.parse('2026-10-15T11:00:00Z');
   class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
   window.Date=FixedDate;
   if(location.protocol.startsWith('http')&&!sessionStorage.getItem('seeded-hourly-test')){
    sessionStorage.setItem('seeded-hourly-test','yes');
    const archive={schemaVersion:2,savedAt:now-1000,records:{'2026-09-10':{morning:'work'}},settings:{language:'fr',theme:'light',weekStart:1,shiftRate:40,payslipCap:711},monthlyPolicies:{'2026-09':{shiftRate:52,payslipCap:711}},audit:[]};
    localStorage.setItem('shift-planner-archive-v2',JSON.stringify(archive));
   }
  });
  await page.goto(URL,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  assert.deepEqual(errors,[]);
  const getSalary=async()=>euro(await page.$eval('#salary-total',e=>e.textContent));
  const getArchive=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('shift-planner-archive-v2')));
  const openDay=async(key='2026-10-05')=>{
   await page.$eval('#calendar-grid [data-date="'+key+'"]',e=>e.scrollIntoView({block:'center'}));
   await page.click('#calendar-grid [data-date="'+key+'"]');
   await page.waitForSelector('.quick-sheet');await wait(260);
  };
  const status=async(shift,value)=>page.click('.quick-state-btn[data-shift="'+shift+'"][data-state="'+value+'"]');
  const setMode=async(mode,rate=null)=>{
   await page.click('#nav-settings');
   await page.click('.pay-mode-option:has(input[value="'+mode+'"])');
   if(rate!==null)await page.$eval('#'+(mode==='hourly'?'hourly':'shift')+'-rate-input',(e,r)=>e.value=String(r),rate);
   await page.$eval('#settings-form button[type="submit"]',e=>e.scrollIntoView({block:'center'}));
   await page.click('#settings-form button[type="submit"]');
   await page.click('#nav-home');
  };
  const setTime=async(shift,boundary,value)=>{
   await page.click('[data-action="pick-time"][data-shift="'+shift+'"][data-boundary="'+boundary+'"]');
   await page.waitForSelector('.time-picker-sheet');await wait(220);
   assert.equal(await page.$$eval('#time-picker-root input',e=>e.length),0,'No free-text time inputs');
   const [h,m]=value.split(':').map(Number);
   await page.evaluate(({h,m})=>{
    for(const [kind,v] of [['hour',h],['minute',m]]){
     const wheel=document.querySelector('.time-wheel[data-wheel="'+kind+'"]');
     wheel.scrollTop=v*44;wheel.dispatchEvent(new Event('scroll'));
    }
   },{h,m});
   await page.click('[data-picker-action="apply"]');
   assert.equal(await page.$('.time-picker-sheet'),null);
  };
  assert.equal(await page.$eval('html',e=>e.lang),'fr');
  assert.equal((await getArchive()).schemaVersion,3,'Old archives migrate to timing-aware schema');
  assert.equal((await getArchive()).monthlyPolicies['2026-09'].payMode,'shift');
  await openDay();
  assert.equal(await page.$$eval('.shift-time-section:not([hidden])',e=>e.length),0);
  await status('morning','work');assert.equal(await getSalary(),40);
  await page.click('.quick-close');
  await page.click('#nav-settings');
  assert.equal(await page.$eval('[data-text="financeSettings"]',e=>e.textContent),'Rémunération');
  assert.equal(await page.$eval('#hourly-rate-field',e=>e.hidden),true);
  await page.click('.pay-mode-option:has(input[value="hourly"])');
  assert.equal(await page.$eval('#hourly-rate-field',e=>e.hidden),false);
  assert.equal(await page.$eval('#shift-rate-field',e=>e.hidden),true);
  await page.screenshot({path:OUT+'/planning-hourly-settings.png',fullPage:true});
  await page.click('#settings-form button[type="submit"]');
  assert.ok(dialogs.at(-1).includes('octobre 2026'));
  await page.click('#nav-home');
  assert.equal(await getSalary(),0);
  assert.equal(await page.$eval('#pay-incomplete-notice',e=>e.hidden),false);
  await openDay();
  assert.equal(await page.$$eval('.shift-time-section:not([hidden])',e=>e.length),2);
  assert.equal(await page.$eval('[data-boundary="start"][data-shift="morning"]',e=>e.disabled),false);
  assert.equal(await page.$eval('[data-boundary="start"][data-shift="evening"]',e=>e.disabled),true);
  await page.$eval('.quick-sheet',e=>e.dataset.sentinel='unchanged');
  await setTime('morning','start','09:15');
  assert.equal(await getSalary(),0);
  await setTime('morning','end','12:45');
  assert.equal(await getSalary(),35);
  assert.equal(await page.$eval('.quick-sheet',e=>e.dataset.sentinel),'unchanged');
  assert.equal(await page.$eval('[data-time-section="morning"] .time-range-status',e=>e.textContent),'Durée · 3 h 30 min');
  await status('evening','work');
  await setTime('evening','start','18:00');await setTime('evening','end','22:00');
  assert.equal(await getSalary(),75);
  assert.equal(await page.$eval('#pay-incomplete-notice',e=>e.hidden),true);
  assert.equal(await page.$eval('#month-days',e=>e.textContent),'1');
  await page.screenshot({path:OUT+'/planning-hourly-editor.png',fullPage:false});
  // Touch wheel opens at existing value; Escape cancels without closing the daily editor.
  await page.click('[data-boundary="start"][data-shift="morning"]');await wait(250);
  await page.screenshot({path:OUT+'/planning-hourly-wheel.png',fullPage:false});
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Escape');
  assert.ok(await page.$('.quick-sheet'));assert.equal(await page.$('.time-picker-sheet'),null);
  assert.equal((await getArchive()).records['2026-10-05'].timings.morning.start,'09:15');
  // OFF keeps times but removes their pay; changing back never loses the time range.
  await status('morning','off');assert.equal(await getSalary(),40);
  await status('morning','work');assert.equal(await getSalary(),75);
  await page.click('.quick-close');
  await setMode('shift');assert.equal(await getSalary(),80);
  await openDay();assert.equal(await page.$$eval('.shift-time-section:not([hidden])',e=>e.length),0);await page.click('.quick-close');
  await setMode('hourly');assert.equal(await getSalary(),75);
  assert.equal((await getArchive()).records['2026-10-05'].timings.evening.end,'22:00');
  await page.click('#previous-month');assert.equal(await getSalary(),52);
  await page.click('#nav-settings');
  assert.equal(await page.$eval('input[name="pay-mode"]:checked',e=>e.value),'shift');
  assert.equal(await page.$eval('#shift-rate-input',e=>Number(e.value)),52);
  await page.click('#nav-home');await page.click('#next-month');
  await setMode('hourly',12.5);assert.equal(await getSalary(),93.75);
  // An intentional conversion can be cancelled; no persistent mode/rate rewrite.
  approve=false;await setMode('shift');approve=true;
  assert.equal(await getSalary(),93.75);assert.equal((await getArchive()).monthlyPolicies['2026-10'].payMode,'hourly');
  // The editor and wheel fit small phones, both themes, and all supported languages.
  for(const lang of ['en','de','es','fa','fr']){
   await page.click('#nav-settings');await page.select('#language-select',lang);
   await page.$eval('input[name="theme"][value="dark"]',e=>{e.checked=true;e.dispatchEvent(new Event('change'));});
   await page.$eval('#settings-form button[type="submit"]',e=>e.scrollIntoView({block:'center'}));
   await page.click('#settings-form button[type="submit"]');await page.click('#nav-home');
   for(const width of [320,375,430]){
    await page.setViewport({width,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    await openDay();
    const geometry=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth,sheet:document.querySelector('.quick-sheet').getBoundingClientRect().width,buttons:[...document.querySelectorAll('.time-value-button')].map(e=>e.getBoundingClientRect().height)}));
    assert.ok(geometry.doc<=geometry.w,lang+' horizontal overflow at '+width);
    assert.ok(geometry.sheet<=geometry.w);assert.ok(geometry.buttons.every(n=>n>=44));
    if(lang==='fa'&&width===375)await page.screenshot({path:OUT+'/planning-hourly-persian-dark.png',fullPage:false});
    await page.click('.quick-close');
   }
  }
  await page.setViewport({width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await openDay();await page.screenshot({path:OUT+'/planning-hourly-dark.png',fullPage:false});await page.click('.quick-close');
  const before=await getArchive();
  await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  assert.equal(await getSalary(),93.75);assert.deepEqual((await getArchive()).records,before.records);
  const exported=await page.evaluate(async()=>{
   const c=await import('./core.mjs');const s=JSON.parse(localStorage.getItem(c.ARCHIVE_KEY));
   return c.parseBackup(JSON.stringify(c.makeBackup(s.records,s.settings,s.monthlyPolicies,s.audit)));
  });
  assert.deepEqual(exported.records,before.records);assert.equal(exported.monthlyPolicies['2026-09'].shiftRate,52);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload({waitUntil:'networkidle0'});
  await page.setOfflineMode(true);await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  assert.equal(await getSalary(),93.75);
  await openDay();assert.equal(await page.$eval('[data-boundary="start"][data-shift="morning"] strong',e=>e.textContent),'09:15');
  await setTime('morning','start','09:30');assert.equal(await getSalary(),90.63);
  await page.click('.quick-close');await page.setOfflineMode(false);
  // Confirm the asynchronous on-device mirror before exercising recovery.
  await page.waitForFunction(async()=>{
   const {loadArchiveFromDb}=await import('./archive-db.mjs');const s=await loadArchiveFromDb();
   return s?.schemaVersion===3&&s.records['2026-10-05']?.timings?.morning?.start==='09:30';
  });
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  assert.equal(await getSalary(),90.63);
  assert.equal((await getArchive()).monthlyPolicies['2026-09'].shiftRate,52);
  assert.equal((await getArchive()).records['2026-10-05'].timings.morning.start,'09:30');
  assert.deepEqual(errors,[]);
  console.log('PASS: personal pay modes; time wheels; 7h30 = €75; preserved history; cancel; 15 phone/language layouts; dark/RTL; migration, backup, reload, IndexedDB recovery and offline time entry.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
