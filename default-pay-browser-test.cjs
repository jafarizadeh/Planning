const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer');
const assert=require('node:assert/strict');
const URL=process.env.PLANNING_TEST_URL||'http://127.0.0.1:48628/';
const OUT=process.env.PLANNING_SCREENSHOTS||'/tmp';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const euros=s=>Number(s.replace(/\s/g,'').replace('€','').replace(',','.'));
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage(),errors=[],dialogs=[];let accept=true;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await(accept?d.accept():d.dismiss());});
  await page.setViewport({width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.evaluateOnNewDocument(()=>{
   const RealDate=Date,now=RealDate.parse('2026-10-15T11:00:00Z');
   class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
   window.Date=FixedDate;
   if(location.protocol.startsWith('http')&&!sessionStorage.getItem('seed-defaults')){
    sessionStorage.setItem('seed-defaults','1');
    localStorage.setItem('shift-planner-archive-v2',JSON.stringify({schemaVersion:3,savedAt:now-1000,
     records:{'2026-09-05':{morning:'work'},'2026-09-06':{morning:'work',timings:{morning:{start:'10:00',end:'12:00',nextDay:false}}}},
     settings:{language:'fr',theme:'light',payMode:'shift',shiftRate:40,hourlyRate:10,payslipCap:711},
     monthlyPolicies:{'2026-09':{payMode:'hourly',shiftRate:40,hourlyRate:11,payslipCap:711}},audit:[]}));
   }
  });
  await page.goto(URL,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  const archive=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('shift-planner-archive-v2')));
  const salary=async()=>euros(await page.$eval('#salary-total',e=>e.textContent));
  const visible=selector=>page.$eval(selector,e=>getComputedStyle(e).display!=='none'&&e.getClientRects().length>0);
  const tap=async selector=>{await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.click(selector);};
  const settings=()=>page.click('#nav-settings');
  const save=async()=>{await tap('#settings-form button[type="submit"]');await page.click('#nav-home');};
  const mode=async(name,value)=>tap('.pay-mode-option:has(input[name="'+name+'"][value="'+value+'"])');
  const open=async(key='2026-10-05')=>{await tap('#calendar-grid [data-date="'+key+'"]');await wait(240);};
  const close=()=>page.click('.quick-close');
  const setStatus=(shift,state)=>page.click('#sheet-root [data-action="set-shift"][data-shift="'+shift+'"][data-state="'+state+'"]');
  const wheel=async(selector,value,settingsWheel=false)=>{
   await tap(selector);await page.waitForSelector('.time-picker-sheet');await wait(210);
   assert.equal(await page.$$eval('#time-picker-root input',els=>els.length),0);
   if(settingsWheel)assert.equal(await visible('[data-picker-action="clear"]'),false);
   await page.evaluate(value=>{
    const [h,m]=value.split(':').map(Number);
    for(const [k,v] of [['hour',h],['minute',m]]){const e=document.querySelector('[data-wheel="'+k+'"]');e.scrollTop=v*44;e.dispatchEvent(new Event('scroll'));}
   },value);
   await page.click('[data-picker-action="apply"]');
  };
  const defaultTime=(shift,which,value)=>wheel('[data-default-time][data-shift="'+shift+'"][data-boundary="'+which+'"]',value,true);
  const dayTime=(shift,which,value)=>wheel('#sheet-root [data-action="pick-time"][data-shift="'+shift+'"][data-boundary="'+which+'"]',value);
  assert.equal((await archive()).schemaVersion,4);
  assert.equal((await archive()).monthlyPolicies['2026-09'].useDefaultTimes,false);
  await settings();assert.equal(await visible('#shift-rate-field'),true);assert.equal(await visible('#hourly-rate-field'),false);
  assert.equal(await visible('#default-hours-settings'),false);assert.equal(await visible('#payslip-cap-field'),true);
  await mode('pay-mode','hourly');assert.equal(await visible('#shift-rate-field'),false);assert.equal(await visible('#hourly-rate-field'),true);
  assert.equal(await page.$eval('#shift-rate-input',e=>e.disabled),true);
  assert.equal(await visible('#default-hours-settings'),true);
  const times=await page.$$eval('[data-default-time] strong',els=>els.map(e=>e.textContent));
  assert.deepEqual(times,['10:00','14:00','18:00','22:00']);
  // Even an invalid inactive rate cannot block saving or overwrite the saved shift rate.
  await page.$eval('#shift-rate-input',e=>e.value='-50');
  assert.equal(await page.$eval('#settings-form',e=>e.checkValidity()),true);
  await save();assert.equal((await archive()).settings.shiftRate,40);
  await open();assert.equal(await page.$('.time-next-day'),null);
  assert.equal(await page.$('[data-action="toggle-next-day"]'),null);
  assert.equal(await page.$eval('#sheet-root [data-shift="morning"][data-boundary="start"] strong',e=>e.textContent),'10:00');
  assert.equal(await salary(),0);
  await page.click('#sheet-root [data-action="set-day"][data-state="work"]');assert.equal(await salary(),80);
  assert.equal((await archive()).records['2026-10-05'].timings,undefined,'defaults must not become custom overrides');
  await dayTime('morning','start','09:15');await dayTime('morning','end','12:45');assert.equal(await salary(),75);
  // Resetting only a start time must never erase the user's custom end.
  await tap('#sheet-root [data-action="pick-time"][data-shift="morning"][data-boundary="start"]');await wait(210);
  await page.click('[data-picker-action="clear"]');
  assert.equal((await archive()).records['2026-10-05'].timings.morning.end,'12:45');
  assert.equal(await salary(),67.5);await dayTime('morning','start','09:15');assert.equal(await salary(),75);
  await close();await settings();
  await defaultTime('morning','start','11:00');await defaultTime('morning','end','15:00');
  await page.screenshot({path:OUT+'/planning-v21-settings.png',fullPage:true});
  await save();assert.equal(await salary(),75,'Changing defaults must not overwrite explicit time ranges');
  assert.equal((await archive()).records['2026-10-05'].timings.morning.end,'12:45');
  await open('2026-10-06');await setStatus('morning','work');assert.equal(await salary(),115);
  assert.equal(await page.$eval('#sheet-root [data-shift="morning"][data-boundary="start"] strong',e=>e.textContent),'11:00');
  await dayTime('morning','start','10:30');assert.equal(await salary(),120);
  await close();await settings();await defaultTime('morning','end','16:00');await save();assert.equal(await salary(),130);
  await open('2026-10-06');
  assert.equal(await page.$eval('#sheet-root [data-shift="morning"][data-boundary="start"] strong',e=>e.textContent),'10:30');
  assert.equal(await page.$eval('#sheet-root [data-shift="morning"][data-boundary="end"] strong',e=>e.textContent),'16:00');
  await setStatus('morning','off');assert.equal(await salary(),75);await setStatus('morning','work');assert.equal(await salary(),130);
  await page.click('#sheet-root [data-action="reset-time"][data-shift="morning"]');assert.equal(await salary(),125);
  assert.equal((await archive()).records['2026-10-06'].timings,undefined);
  await page.screenshot({path:OUT+'/planning-v21-default-day.png',fullPage:false});await close();
  // Reject invalid defaults without changing the archive; cancel a wheel without saving.
  await settings();const beforeBad=JSON.stringify((await archive()).monthlyPolicies);
  await defaultTime('morning','end','11:00');await tap('#settings-form button[type="submit"]');
  assert.equal(JSON.stringify((await archive()).monthlyPolicies),beforeBad);
  await defaultTime('morning','end','14:00');await defaultTime('morning','start','10:00');await save();
  await settings();await mode('pay-mode','shift');assert.equal(await visible('#default-hours-settings'),false);
  assert.equal(await page.$eval('#hourly-rate-input',e=>e.disabled),true);await save();
  await page.evaluate(()=>{
   for(let d=1;d<=10;d++){
    document.querySelector('#calendar-grid [data-date="2026-10-'+String(d).padStart(2,'0')+'"]').click();
    document.querySelector('#sheet-root [data-action="set-day"][data-state="work"]').click();document.querySelector('.quick-close').click();
   }
  });
  assert.equal(await salary(),800);assert.equal(euros(await page.$eval('#payslip-amount',e=>e.textContent)),711);
  assert.equal(euros(await page.$eval('#envelope-amount',e=>e.textContent)),89);
  const recordsBeforePayment=JSON.stringify((await archive()).records);
  await settings();await mode('payment-mode','single');assert.equal(await visible('#payslip-cap-field'),false);
  assert.equal(await page.$eval('#payslip-cap-input',e=>e.disabled),true);
  await page.$eval('#payslip-cap-input',e=>e.value='-4');assert.equal(await page.$eval('#settings-form',e=>e.checkValidity()),true);
  await save();assert.equal(await salary(),800);assert.equal(euros(await page.$eval('#payslip-amount',e=>e.textContent)),800);
  assert.equal(await visible('#envelope-card'),false);assert.equal(await visible('.payslip-footer'),false);
  assert.equal((await archive()).settings.payslipCap,711);assert.equal(JSON.stringify((await archive()).records),recordsBeforePayment);
  await page.screenshot({path:OUT+'/planning-v21-single-payment.png',fullPage:false});
  await settings();await mode('payment-mode','split');assert.equal(await visible('#payslip-cap-field'),true);
  assert.equal(await page.$eval('#payslip-cap-input',e=>Number(e.value)),711);await save();
  assert.equal(await visible('#envelope-card'),true);assert.equal(euros(await page.$eval('#envelope-amount',e=>e.textContent)),89);
  await page.click('#envelope-card');assert.equal(await page.$eval('#envelope-card',e=>e.getAttribute('aria-expanded')),'true');
  await settings();await mode('pay-mode','hourly');await mode('payment-mode','single');await save();
  assert.equal(await salary(),795);assert.equal(await visible('#envelope-card'),false);
  // Automatic overnight handling: no next-day toggle exists, including after changing times.
  await open('2026-10-11');await setStatus('evening','work');await dayTime('evening','start','22:30');await dayTime('evening','end','02:00');
  assert.equal(await salary(),830);assert.equal(await page.$('.time-next-day'),null);
  assert.ok((await page.$eval('[data-time-section="evening"] .time-range-status',e=>e.textContent)).includes('+1 jour'));
  await close();
  // Historical September stays manual-only, even on saving theme/language settings.
  await page.click('#previous-month');assert.equal(await salary(),22);
  const historic=JSON.stringify((await archive()).monthlyPolicies['2026-09']);
  await settings();await page.$eval('input[name="theme"][value="dark"]',e=>{e.checked=true;e.dispatchEvent(new Event('change'));});await save();
  assert.equal(await salary(),22);assert.equal(JSON.stringify((await archive()).monthlyPolicies['2026-09']),historic);
  await page.click('#next-month');assert.equal(await salary(),830);
  for(const lang of ['fr','en','de','es','fa']){
   await settings();await page.select('#language-select',lang);await save();
   for(const width of [320,375,430]){
    await page.setViewport({width,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    await settings();assert.equal(await visible('#shift-rate-field'),false);assert.equal(await visible('#payslip-cap-field'),false);
    const size=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,w:innerWidth}));assert.ok(size.doc<=size.w);
    await page.click('#nav-home');await open();
    const geometry=await page.evaluate(()=>({w:innerWidth,doc:document.documentElement.scrollWidth,
     sheet:document.querySelector('.quick-sheet').getBoundingClientRect().width,
     buttons:[...document.querySelectorAll('#sheet-root .time-value-button')].map(e=>e.getBoundingClientRect().height)}));
    assert.ok(geometry.doc<=geometry.w);assert.ok(geometry.sheet<=geometry.w);assert.ok(geometry.buttons.every(h=>h>=44));
    if(lang==='fa'&&width===375)await page.screenshot({path:OUT+'/planning-v21-rtl-dark.png',fullPage:false});
    await close();
   }
  }
  const before=await archive();await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  assert.equal(await salary(),830);assert.equal(await visible('#envelope-card'),false);assert.deepEqual((await archive()).records,before.records);
  const backup=await page.evaluate(async()=>{const c=await import('./core.mjs'),a=JSON.parse(localStorage.getItem(c.ARCHIVE_KEY));return c.parseBackup(JSON.stringify(c.makeBackup(a.records,a.settings,a.monthlyPolicies,a.audit)));});
  assert.equal(backup.settings.paymentMode,'single');assert.deepEqual(backup.settings.defaultTimes,before.settings.defaultTimes);assert.deepEqual(backup.records,before.records);
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'networkidle0'});
  await page.setOfflineMode(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  await open('2026-10-12');await setStatus('morning','work');assert.equal(await salary(),870);await close();await page.setOfflineMode(false);
  await page.waitForFunction(async()=>{const m=await import('./archive-db.mjs'),a=await m.loadArchiveFromDb();return a?.schemaVersion===4&&a.records['2026-10-12']?.morning==='work';});
  await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  assert.equal(await salary(),870);assert.equal((await archive()).settings.paymentMode,'single');
  assert.equal((await archive()).monthlyPolicies['2026-09'].useDefaultTimes,false);assert.deepEqual(errors,[]);
  console.log('PASS v2.1: default hours + per-day priority + reset; four pay/payment combinations; real hidden/disabled controls; overnight without switch; historical wages unchanged; 15 phone/language layouts; reload, backup, IndexedDB recovery and offline.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
