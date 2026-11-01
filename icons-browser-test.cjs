// Exact user-provided SVG geometry, theme inheritance and offline UI regression.
// Uses an isolated temporary Chrome profile and synthetic data, never user records.
const puppeteer=require(process.env.PUPPETEER_MODULE||'puppeteer');
const assert=require('node:assert/strict');
const URL=process.env.PLANNING_TEST_URL||'http://127.0.0.1:48628/';
const OUT=process.env.PLANNING_SCREENSHOTS||'/tmp';
const paths={
 sun:['M0 0h24v24H0z','M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0','M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7'],
 moon:['M0 0h24v24H0z','M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454l0 .008']
};
(async()=>{
 const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  page.on('dialog',async d=>d.accept());
  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.setViewport({width:375,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.evaluateOnNewDocument(()=>{
   const RealDate=Date,now=RealDate.parse('2026-10-15T11:00:00Z');
   class TestDate extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
   window.Date=TestDate;
   if(!location.protocol.startsWith('http')||sessionStorage.getItem('icons-seeded'))return;
   sessionStorage.setItem('icons-seeded','1');
   const policy={payMode:'hourly',paymentMode:'split',hourlyRate:10,shiftRate:40,payslipCap:711,useDefaultTimes:true,defaultTimes:{morning:{start:'10:00',end:'14:00'},evening:{start:'18:00',end:'22:00'}}};
   localStorage.setItem('shift-planner-archive-v2',JSON.stringify({schemaVersion:5,savedAt:now-1,records:{'2026-10-05':{morning:'work',evening:'work'}},settings:{language:'fr',theme:'light',weekStart:1,...policy},monthlyPolicies:{'2026-10':policy},audit:[]}));
  });
  const tap=async selector=>{await page.$eval(selector,e=>e.scrollIntoView({block:'center'}));await page.click(selector);};
  const archive=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('shift-planner-archive-v2')));
  const inspect=async(selector,kind)=>{
   // Theme/radio transitions can be sampled between parent and child style frames.
   await page.waitForFunction(selector=>{
    const e=document.querySelector(selector);
    return !!e&&getComputedStyle(e).color===getComputedStyle(e.parentElement).color;
   },{timeout:2000},selector);
   const icon=await page.$eval(selector,e=>{
    const box=e.getBoundingClientRect(),parent=e.parentElement.getBoundingClientRect();
    const css=getComputedStyle(e);
    return {ns:e.namespaceURI,viewBox:e.getAttribute('viewBox'),fill:e.getAttribute('fill'),stroke:e.getAttribute('stroke'),weight:e.getAttribute('stroke-width'),cap:e.getAttribute('stroke-linecap'),join:e.getAttribute('stroke-linejoin'),hidden:e.getAttribute('aria-hidden'),focus:e.getAttribute('focusable'),className:e.getAttribute('class'),paths:[...e.querySelectorAll('path')].map(p=>p.getAttribute('d')),emptyText:e.textContent.trim(),w:box.width,h:box.height,inside:box.left>=parent.left&&box.right<=parent.right&&box.top>=parent.top&&box.bottom<=parent.bottom,color:css.color,parentColor:getComputedStyle(e.parentElement).color,transform:css.transform};
   });
   assert.equal(icon.ns,'http://www.w3.org/2000/svg');assert.equal(icon.viewBox,'0 0 24 24');
   assert.equal(icon.fill,'none');assert.equal(icon.stroke,'currentColor');assert.equal(icon.weight,'2');
   assert.equal(icon.cap,'round');assert.equal(icon.join,'round');assert.equal(icon.hidden,'true');assert.equal(icon.focus,'false');
   assert.ok(icon.className.includes('icon-tabler-'+kind));assert.deepEqual(icon.paths,paths[kind]);
   assert.equal(icon.emptyText,'');assert.equal(icon.w,18);assert.equal(icon.h,18);assert.equal(icon.inside,true);
   assert.equal(icon.color,icon.parentColor);assert.equal(icon.transform,'none');
  };
  const checkShiftIcons=async()=>{
   await inspect('[data-editor-shift="morning"] .quick-shift-icon svg','sun');
   await inspect('[data-editor-shift="evening"] .quick-shift-icon svg','moon');
   assert.equal(await page.$$eval('.quick-shift-icon',els=>els.every(e=>e.childElementCount===1&&e.textContent.trim()==='')),true);
  };
  await page.goto(URL,{waitUntil:'networkidle0'});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  const before=await archive();
  let layouts=0;
  for(const lang of ['fr','en','de','es','fa','zh','hi','ur']){
   await page.click('#nav-settings');await page.select('#language-select',lang);
   for(const theme of ['light','dark']){
    await tap('.appearance-option:has(input[value="'+theme+'"])');
    assert.equal(await page.$eval('html',e=>e.dataset.theme),theme);
    for(const width of [320,375,430]){
     await page.setViewport({width,height:812,deviceScaleFactor:2,isMobile:true,hasTouch:true});
     await page.click('#nav-settings');
     await inspect('input[name="theme"][value="light"] + .appearance-value svg','sun');
     await inspect('input[name="theme"][value="dark"] + .appearance-value svg','moon');
     if(lang==='fr'&&width===375){
      await page.$eval('.appearance-field',e=>e.scrollIntoView({block:'center'}));
      await page.screenshot({path:OUT+'/planning-tabler-appearance-'+theme+'.png'});
     }
     await page.click('#nav-home');await tap('#calendar-grid [data-date="2026-10-05"]');
     await checkShiftIcons();
     const size=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,w:innerWidth}));
     assert.ok(size.doc<=size.w,lang+' '+theme+' '+width);
     if(width===375&&(lang==='fr'||lang==='ur'))await page.screenshot({path:OUT+'/planning-tabler-shifts-'+lang+'-'+theme+'.png'});
     await page.click('.quick-close');layouts++;
    }
    await page.click('#nav-settings');
   }
  }
  // The SVGs must also be used in flat-shift mode, not just the hourly editor.
  await tap('.pay-mode-option:has(input[value="shift"])');
  await page.click('#nav-home');await tap('#calendar-grid [data-date="2026-10-05"]');
  await checkShiftIcons();await page.click('.quick-close');
  const after=await archive();assert.deepEqual(after.records,before.records);assert.deepEqual(after.monthlyPolicies,before.monthlyPolicies);
  // Cached inline icons must render without fetching an external icon/font service.
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload({waitUntil:'networkidle0'});
  await page.setOfflineMode(true);await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.archiveReady==='true');
  await page.click('#nav-settings');
  await inspect('input[name="theme"][value="light"] + .appearance-value svg','sun');
  await inspect('input[name="theme"][value="dark"] + .appearance-value svg','moon');
  await page.click('#nav-home');await tap('#calendar-grid [data-date="2026-10-05"]');await checkShiftIcons();
  assert.deepEqual(errors,[]);
  console.log('PASS exact Tabler sun/moon in all four locations; '+layouts+' language/theme/width combinations; 18px currentColor, rounded 2-unit strokes, accessible labels retained, no RTL mirroring, hourly/shift modes, data unchanged, offline.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
