// Real input events, no manual Save button, isolated browser data only.
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer');
const assert=require('node:assert/strict');
const URL=process.env.PLANNING_TEST_URL||'http://127.0.0.1:48628/';
const OUT=process.env.PLANNING_SCREENSHOTS||'/tmp';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage(),errors=[],dialogs=[];let approve=true;
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  page.on('dialog',async d=>{dialogs.push(d.message());await(approve?d.accept():d.dismiss());});
  await page.setViewport({width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.evaluateOnNewDocument(()=>{
   const RealDate=Date,now=RealDate.parse('2026-10-15T11:00:00Z');
   class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
   window.Date=FixedDate;
   if(!location.protocol.startsWith('http')||sessionStorage.getItem('autosave-test-seed'))return;
   sessionStorage.setItem('autosave-test-seed','1');
   const policy={payMode:'shift',paymentMode:'split',shiftRate:40,hourlyRate:10,payslipCap:711,useDefaultTimes:true,defaultTimes:{morning:{start:'10:00',end:'14:00'},evening:{start:'18:00',end:'22:00'}}};
   localStorage.setItem('shift-planner-archive-v2',JSON.stringify({schemaVersion:5,savedAt:now-1000,records:{'2026-09-10':{morning:'work'}},settings:{language:'fr',theme:'light',weekStart:1,...policy},monthlyPolicies:{'2026-09':{...policy,shiftRate:52}},audit:[]}));
  });
  const tap=async s=>{await page.$eval(s,e=>e.scrollIntoView({block:'center'}));await page.click(s);};
  const archive=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('shift-planner-archive-v2')));
  const input=async(id,value,event='input')=>{
   await page.$eval('#'+id,(e,{value,event})=>{e.focus({preventScroll:true});e.value=value;e.dispatchEvent(new Event(event,{bubbles:true}));},{value,event});
  };
  const savedRate=(key,value)=>page.waitForFunction(({key,value})=>JSON.parse(localStorage.getItem('shift-planner-archive-v2')).settings[key]===value,{}, {key,value});
  const mode=(name,value)=>tap('.pay-mode-option:has(input[name="'+name+'"][value="'+value+'"])');
  const wheel=async(shift,boundary,value)=>{
   await tap('[data-default-time][data-shift="'+shift+'"][data-boundary="'+boundary+'"]');await wait(220);
   await page.evaluate(value=>{
    const [h,m]=value.split(':').map(Number);
    for(const [kind,n] of [['hour',h],['minute',m]]){const e=document.querySelector('[data-wheel="'+kind+'"]');e.scrollTop=n*44;e.dispatchEvent(new Event('scroll'));}
   },value);
   await page.click('[data-picker-action="apply"]');
  };
  await page.goto(URL,{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  const initial=await archive();
  await page.click('#nav-settings');
  assert.equal(await page.$('#settings-form button[type="submit"]'),null);
  assert.equal(await page.$('[data-text="saveSettings"]'),null);
  assert.equal(await page.$eval('#settings-autosave-status',e=>e.dataset.state),'idle');
  // Use the visible language and weekday picker, not only the hidden native select.
  await tap('#language-picker-trigger');
  assert.ok((await page.$eval('.picker-sheet-hint',e=>e.textContent)).includes('automatiquement'));
  await page.click('#picker-root [data-value="en"]');
  assert.equal((await archive()).settings.language,'en');assert.equal(await page.$eval('html',e=>e.lang),'en');
  assert.equal(await page.$('.picker-sheet'),null);
  await tap('#weekstart-picker-trigger');await page.click('#picker-root [data-value="6"]');
  assert.equal((await archive()).settings.weekStart,6);
  await tap('.appearance-option:has(input[value="dark"])');
  assert.equal((await archive()).settings.theme,'dark');assert.equal(await page.$eval('html',e=>e.dataset.theme),'dark');
  // The mode change requires only the important all-month confirmation, no Save.
  await mode('pay-mode','hourly');assert.equal((await archive()).settings.payMode,'hourly');
  assert.ok(/all.*months|every month/i.test(dialogs.at(-1)));
  assert.equal(await page.$eval('#shift-rate-input',e=>e.disabled),true);
  await tap('#hourly-rate-input');
  const startScroll=await page.evaluate(()=>({window:scrollY,app:document.querySelector('#app').scrollTop}));
  await input('hourly-rate-input','12.75');
  assert.equal((await archive()).settings.hourlyRate,10,'debounce must not write mid-keystroke');
  await savedRate('hourlyRate',12.75);
  assert.equal(await page.$eval('#hourly-rate-input',e=>e.value),'12.75');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'hourly-rate-input');
  const endScroll=await page.evaluate(()=>({window:scrollY,app:document.querySelector('#app').scrollTop}));
  assert.ok(Math.abs(startScroll.window-endScroll.window)<3,'autosave must not jump to the top');
  assert.ok(Math.abs(startScroll.app-endScroll.app)<3);
  assert.equal(await page.$eval('#settings-autosave-status',e=>e.dataset.state),'saved');
  // Empty/negative/too precise amounts do not overwrite the last valid value.
  for(const value of ['', '-5', '12.345', '100001']){
   await input('hourly-rate-input',value);await wait(540);
   assert.equal((await archive()).settings.hourlyRate,12.75);
   assert.equal(await page.$eval('#hourly-rate-input',e=>e.getAttribute('aria-invalid')),'true');
   assert.equal(await page.$eval('#hourly-rate-input-feedback',e=>e.hidden),false);
  }
  // An invalid rate cannot block an independent language or theme preference.
  await page.select('#language-select','fr');
  assert.equal((await archive()).settings.language,'fr');
  assert.equal(await page.$eval('#hourly-rate-input',e=>e.value),'100001');
  assert.equal(await page.$eval('#settings-autosave-status',e=>e.dataset.state),'invalid');
  await tap('.appearance-option:has(input[value="light"])');
  assert.equal((await archive()).settings.theme,'light');
  await input('hourly-rate-input','12.50','change');await savedRate('hourlyRate',12.5);
  assert.equal(await page.$eval('#hourly-rate-input-feedback',e=>e.hidden),true);
  // The removed label editor must not leave dead autosave event listeners.
  assert.equal(await page.$('#morning-input'),null);
  assert.equal(await page.$('#evening-input'),null);
  assert.equal(await page.$('[data-text="shiftNames"]'),null);
  // Leaving Settings still flushes the final valid amount before its debounce.
  await input('hourly-rate-input','12.60');await page.click('#nav-home');
  assert.equal((await archive()).settings.hourlyRate,12.6);
  assert.equal(await page.$('.alltime'),null);assert.ok(await page.$('#history-months'));
  await tap('#calendar-grid [data-date="2026-10-05"]');await wait(220);
  await page.click('#sheet-root [data-action="set-day"][data-state="work"]');
  await page.click('.quick-close');
  await page.click('#nav-settings');
  // Picker confirmation commits valid default hours immediately, without saving the form.
  await wheel('morning','start','11:00');
  assert.equal((await archive()).settings.defaultTimes.morning.start,'11:00');
  const goodDefaults=JSON.stringify((await archive()).settings.defaultTimes);
  await wheel('morning','end','11:00');
  assert.equal(JSON.stringify((await archive()).settings.defaultTimes),goodDefaults);
  assert.equal(await page.$eval('#default-hours-error',e=>e.hidden),false);
  await wheel('morning','end','15:00');
  assert.equal((await archive()).settings.defaultTimes.morning.end,'15:00');
  assert.equal(await page.$eval('#default-hours-error',e=>e.hidden),true);
  // Cancel resets the radio to the persisted global mode and does not change history.
  const beforeCancel=await archive();approve=false;
  await mode('pay-mode','shift');approve=true;
  assert.equal((await archive()).settings.payMode,'hourly');
  assert.equal(await page.$eval('input[name="pay-mode"]:checked',e=>e.value),'hourly');
  assert.deepEqual((await archive()).records,beforeCancel.records);
  await mode('payment-mode','single');assert.equal((await archive()).settings.paymentMode,'single');
  assert.equal(await page.$eval('#payslip-cap-input',e=>e.disabled),true);
  await input('payslip-cap-input','-20','change');
  assert.equal((await archive()).settings.payslipCap,711);
  // pagehide synchronously flushes a valid unblurred amount.
  await input('hourly-rate-input','13.25');
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  assert.equal((await archive()).settings.hourlyRate,13.25);
  await page.click('#nav-home');assert.equal(await page.$eval('.finance-grid',e=>e.hidden),true);
  const beforeReload=await archive();
  await page.reload({waitUntil:'networkidle0'});await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  assert.deepEqual((await archive()).settings,beforeReload.settings);
  assert.deepEqual((await archive()).records,beforeReload.records);
  assert.deepEqual((await archive()).monthlyPolicies['2026-09'],initial.monthlyPolicies['2026-09']);
  // A historic month's rate edit is still local to that month, despite automatic saving.
  await tap('#previous-month');await page.click('#nav-settings');await input('hourly-rate-input','7.50','change');
  assert.equal((await archive()).monthlyPolicies['2026-09'].hourlyRate,7.5);
  assert.equal((await archive()).settings.hourlyRate,13.25);
  await page.click('#nav-home');await tap('#next-month');await page.click('#nav-settings');
  // Invalid field on navigation restores the valid value instead of silently replacing it.
  await input('hourly-rate-input','');await page.click('#nav-home');await page.click('#nav-settings');
  assert.equal(await page.$eval('#hourly-rate-input',e=>e.value),'13.25');
  assert.equal((await archive()).settings.hourlyRate,13.25);
  assert.equal(await page.$eval('#settings-autosave-status',e=>e.dataset.state)==='invalid',false);
  await page.$eval('#settings-autosave-status',e=>e.scrollIntoView({block:'center'}));
  await page.screenshot({path:OUT+'/planning-settings-autosave.png',fullPage:false});
  // LocalStorage failure can fall back to IndexedDB, but a total failure cannot say Saved.
  await page.evaluate(()=>{window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('Test quota','QuotaExceededError');};});
  await input('hourly-rate-input','13.50','change');
  await page.waitForFunction(async()=>{const m=await import('./archive-db.mjs'),a=await m.loadArchiveFromDb();return a?.settings?.hourlyRate===13.5;});
  assert.equal(await page.$eval('#settings-autosave-status',e=>e.dataset.state),'saved');
  await page.evaluate(()=>{window.__dbPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new Error('Test storage unavailable');};});
  await input('hourly-rate-input','14.25','change');
  await page.waitForFunction(()=>document.querySelector('#settings-autosave-status').dataset.state==='error');
  await page.evaluate(()=>{Storage.prototype.setItem=window.__setItem;IDBObjectStore.prototype.put=window.__dbPut;window.dispatchEvent(new Event('focus'));});
  await savedRate('hourlyRate',14.25);
  await page.waitForFunction(()=>document.querySelector('#settings-autosave-status').dataset.state==='saved');
  // Offline changes and durable-store recovery require no save button either.
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'networkidle0'});
  await page.setOfflineMode(true);await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  await page.click('#nav-settings');await input('hourly-rate-input','15.25','change');
  await savedRate('hourlyRate',15.25);
  await page.waitForFunction(async()=>{const m=await import('./archive-db.mjs'),a=await m.loadArchiveFromDb();return a?.settings?.hourlyRate===15.25;});
  await page.evaluate(()=>localStorage.clear());await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  assert.equal((await archive()).settings.hourlyRate,15.25);
  assert.equal((await archive()).settings.paymentMode,'single');
  assert.equal((await archive()).records['2026-09-10'].morning,'work');
  assert.deepEqual(errors,[]);
  console.log('PASS automatic settings: real pickers/theme/global modes, debounce without focus/scroll loss, safe validation, independent fields, default-time auto-commit, cancellation, blur/navigation/pagehide, historical rates, storage fallback/failure/retry, reload/offline/IndexedDB recovery.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
