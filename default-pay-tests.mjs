import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,payPolicy,sanitizeSettings,sanitizeMonthlyPolicies,sanitizeDefaultTimes,validDefaultSchedule,effectiveTiming,resetTiming,updateTiming,updateStatus,getTiming,calculatePayroll,payrollForMonth,monthlyHistory,makeBackup,parseBackup,mergeHistory,timingAnalysis,timeRangeDetails} from './core.mjs';
const hourly=payPolicy({...DEFAULT_SETTINGS,payMode:'hourly'});
const rate=(records,policy=hourly)=>calculatePayroll(records,2026,9,policy);
const mark=(r={},shift='morning',day='2026-10-05')=>updateStatus(r,day,shift,'work');

test('new settings use editable 10–14 and 18–22 defaults and preserve split pay by default',()=>{
 const s=sanitizeSettings({});assert.equal(s.paymentMode,'split');assert.equal(s.useDefaultTimes,true);
 assert.deepEqual(s.defaultTimes,{morning:{start:'10:00',end:'14:00'},evening:{start:'18:00',end:'22:00'}});
 const a=sanitizeDefaultTimes({}),b=sanitizeDefaultTimes({});a.morning.start='09:00';assert.equal(b.morning.start,'10:00');
});
test('worked shift uses four default hours without creating a false custom override',()=>{
 let r=mark();assert.equal(rate(r).minutes,240);assert.equal(rate(r).totalCents,4000);
 assert.equal(r['2026-10-05'].timings,undefined);assert.equal(rate(r).pendingShifts,0);
 r=mark(r,'evening');assert.equal(rate(r).minutes,480);assert.equal(rate(r).totalCents,8000);
 assert.equal(rate(r).paidShifts,2);
});
test('unset/off dates show effective defaults but never produce wages',()=>{
 let r={};assert.equal(rate(r).totalCents,0);
 assert.equal(effectiveTiming(r,'2026-10-05','morning',hourly).start,'10:00');
 r=updateStatus(r,'2026-10-05','morning','off');assert.equal(rate(r).totalCents,0);
 r=updateTiming(r,'2026-10-05','morning',{start:'09:00',end:'15:00'});
 assert.equal(rate(r).totalCents,0);
});
test('custom start and end always override default hours',()=>{
 let r=mark();r=updateTiming(r,'2026-10-05','morning',{start:'09:15',end:'12:45'});
 assert.equal(rate(r).minutes,210);assert.equal(rate(r).totalCents,3500);
 const changed=payPolicy({...hourly,defaultTimes:{morning:{start:'08:00',end:'16:00'}}});
 assert.equal(rate(r,changed).totalCents,3500);assert.equal(getTiming(r,'2026-10-05','morning').end,'12:45');
});
test('a custom boundary keeps priority while untouched boundary follows default changes',()=>{
 let r=updateTiming(mark(),'2026-10-05','morning',{start:'09:30'});
 assert.equal(rate(r).minutes,270);
 const changed=payPolicy({...hourly,defaultTimes:{morning:{start:'08:00',end:'15:00'}}});
 assert.deepEqual(effectiveTiming(r,'2026-10-05','morning',changed),{start:'09:30',end:'15:00',nextDay:false});
 assert.equal(rate(r,changed).totalCents,5500);
});
test('reset removes only the chosen shift override and retains all status/history data',()=>{
 let r=updateTiming(mark(),'2026-10-05','morning',{start:'09:00',end:'12:00'});
 r=updateTiming(mark(r,'evening'),'2026-10-05','evening',{start:'19:00',end:'21:00'});
 const original=JSON.stringify(r);const reset=resetTiming(r,'2026-10-05','morning');
 assert.equal(JSON.stringify(r),original);assert.equal(reset['2026-10-05'].morning,'work');
 assert.equal(reset['2026-10-05'].timings.morning,undefined);
 assert.equal(reset['2026-10-05'].timings.evening.start,'19:00');
 assert.equal(rate(reset).minutes,360);assert.equal(rate(reset).totalCents,6000);
});
test('overnight is inferred automatically without a next-day UI switch',()=>{
 let r=mark({},'evening');r=updateTiming(r,'2026-10-05','evening',{start:'22:30',end:'02:00'});
 assert.equal(effectiveTiming(r,'2026-10-05','evening',hourly).nextDay,true);
 assert.equal(rate(r).minutes,210);assert.equal(rate(r).totalCents,3500);
 assert.equal(timeRangeDetails({start:'22:30',end:'02:00'}).minutes,210);
 const defaultNight=payPolicy({...hourly,defaultTimes:{evening:{start:'22:00',end:'02:00'}}});
 assert.equal(rate(mark({},'evening'),defaultNight).minutes,240);
});
test('zero-duration or overlapping custom hours are not silently double paid',()=>{
 let r=updateTiming(mark(),'2026-10-05','morning',{start:'10:00',end:'10:00'});
 assert.equal(rate(r).pendingShifts,1);assert.equal(rate(r).totalCents,0);
 r=mark(r,'evening');r=updateTiming(r,'2026-10-05','morning',{start:'10:00',end:'19:00'});
 assert.equal(rate(r).pendingShifts,2);assert.equal(rate(r).totalCents,0);
});
test('default schedules reject invalid clocks, zero duration and recurring overlap',()=>{
 assert.equal(validDefaultSchedule(hourly.defaultTimes),true);
 assert.equal(validDefaultSchedule({...hourly.defaultTimes,morning:{start:'10:00',end:'10:00'}}),false);
 assert.equal(validDefaultSchedule({...hourly.defaultTimes,morning:{start:'10:00',end:'19:00'}}),false);
 assert.equal(validDefaultSchedule({...hourly.defaultTimes,evening:{start:'22:00',end:'11:00'}}),false);
 assert.equal(validDefaultSchedule({...hourly.defaultTimes,evening:{start:'22:00',end:'02:00'}}),true);
 assert.equal(validDefaultSchedule({...hourly.defaultTimes,evening:{start:'25:00',end:'02:00'}}),false);
});
test('single payment uses the entire total with no cap and no envelope',()=>{
 const p=payrollForMonth(20,{...DEFAULT_SETTINGS,paymentMode:'single',payslipCap:1});
 assert.equal(p.totalCents,80000);assert.equal(p.payslipCents,80000);assert.equal(p.envelopeCents,0);
 assert.equal(p.capCents,null);assert.equal(p.paymentMode,'single');assert.equal(p.progressPercent,0);
 let r={};for(let d=1;d<=10;d++){const day='2026-10-'+String(d).padStart(2,'0');r=mark(r,'morning',day);r=mark(r,'evening',day);}
 const h=rate(r,{...hourly,paymentMode:'single'});assert.equal(h.totalCents,80000);assert.equal(h.payslipCents,80000);assert.equal(h.envelopeCents,0);
});
test('two-stage payment retains 711/89 allocation and restoring mode preserves cap',()=>{
 const split=payrollForMonth(20,{...DEFAULT_SETTINGS,paymentMode:'split'});
 assert.equal(split.payslipCents,71100);assert.equal(split.envelopeCents,8900);
 const saved=payPolicy({...DEFAULT_SETTINGS,paymentMode:'single',payslipCap:650});
 assert.equal(saved.payslipCap,650);
 const restored=payrollForMonth(20,{...saved,paymentMode:'split'});
 assert.equal(restored.payslipCents,65000);assert.equal(restored.envelopeCents,15000);
});
test('shift/hourly and single/split switches are independent',()=>{
 const r=updateTiming(mark(),'2026-10-05','morning',{start:'10:00',end:'12:00'});
 for(const mode of ['shift','hourly'])for(const paymentMode of ['single','split']){
  const p=rate(r,{...hourly,payMode:mode,paymentMode,payslipCap:10});
  assert.equal(p.totalCents,mode==='shift'?4000:2000);
  assert.equal(p.envelopeCents,paymentMode==='single'?0:(mode==='shift'?3000:1000));
 }
});
test('stored monthly rates and default hours survive a globally chosen single payment',()=>{
 let r=mark({},'morning','2026-09-05');r=mark(r,'morning','2026-10-05');
 const september=payPolicy({...hourly,paymentMode:'split',payslipCap:20});
 const october=payPolicy({...hourly,paymentMode:'single',defaultTimes:{morning:{start:'09:00',end:'15:00'}}});
 const policies={'2026-09':september,'2026-10':october};
 const history=monthlyHistory(r,policies,{...october,hourlyRate:99});
 assert.equal(history[0].pay.totalCents,6000);assert.equal(history[0].pay.envelopeCents,0);
 assert.equal(history[1].pay.totalCents,4000);assert.equal(history[1].pay.payslipCents,4000);assert.equal(history[1].pay.envelopeCents,0);
 assert.equal(policies["2026-09"].paymentMode,"split");assert.equal(policies["2026-09"].payslipCap,20);
});
test('legacy manual-only hourly months retain pending/incomplete hours and original pay',()=>{
 let r=mark({},'morning','2026-09-05');r=mark(r,'morning','2026-10-05');
 const policies=sanitizeMonthlyPolicies({'2026-09':{payMode:'hourly',hourlyRate:10,shiftRate:40,payslipCap:711},'2026-10':hourly});
 assert.equal(policies['2026-09'].useDefaultTimes,false);assert.equal(policies['2026-10'].useDefaultTimes,true);
 const history=monthlyHistory(r,policies,hourly);
 assert.equal(history[0].pay.totalCents,4000);assert.equal(history[1].pay.totalCents,0);assert.equal(history[1].pay.pendingShifts,1);
});
test('global hourly analysis detects overlap even when an old snapshot says shift mode',()=>{
 let r=mark({},'evening','2026-09-30');r=updateTiming(r,'2026-09-30','evening',{start:'22:00',end:'12:00',nextDay:true});
 r=mark(r,'morning','2026-10-01');
 const policies={'2026-09':payPolicy({...hourly,payMode:'shift'}),'2026-10':hourly};
 const analysis=timingAnalysis(r,policies,hourly);
 assert.equal(analysis['2026-10-01:morning'].state,'overlap');
 assert.equal(calculatePayroll(r,2026,9,hourly,analysis).totalCents,0);
 assert.equal(policies['2026-09'].payMode,'shift');
});
test('schema 5 backup round-trips defaults, custom hours and payment mode',()=>{
 const r=updateTiming(mark(),'2026-10-05','morning',{start:'09:30',end:'12:30'});
 const policy=payPolicy({...hourly,paymentMode:'single',defaultTimes:{morning:{start:'08:00',end:'15:00'}}});
 const b=makeBackup(r,policy,{'2026-10':policy});assert.equal(b.schemaVersion,5);
 const copy=parseBackup(JSON.stringify(b));assert.deepEqual(copy.records,r);
 assert.deepEqual(copy.monthlyPolicies['2026-10'],policy);assert.equal(rate(copy.records,copy.settings).totalCents,3000);
});
test('backup merge preserves current explicit times and current monthly defaults',()=>{
 const ours=updateTiming(mark(),'2026-10-05','morning',{start:'09:00',end:'12:00'});
 const theirs=updateTiming(mark(),'2026-10-05','morning',{start:'08:00',end:'15:00'});
 const policy=payPolicy({...hourly,paymentMode:'single'});
 const merged=mergeHistory(ours,theirs,{'2026-10':policy},{'2026-10':hourly});
 assert.equal(merged.records['2026-10-05'].timings.morning.start,'09:00');
 assert.equal(merged.monthlyPolicies['2026-10'].paymentMode,'single');assert.equal(rate(merged.records,policy).totalCents,3000);
});
test('old v3 hourly backup with missing times remains pending on import',()=>{
 const old={app:'ShiftPlanner',schemaVersion:3,records:mark(),settings:{payMode:'hourly',hourlyRate:10,shiftRate:40,payslipCap:711},monthlyPolicies:{},audit:[]};
 const copy=parseBackup(JSON.stringify(old));assert.equal(copy.settings.useDefaultTimes,false);assert.equal(rate(copy.records,copy.settings).totalCents,0);
});
test('new labels exist in all supported languages with no next-day switch label',async()=>{
 const {hourlyTranslations}=await import('./hourly-translations.mjs');
 for(const lang of ['fr','en','fa','de','es']){
  for(const key of ['defaultTimesTitle','useDefaultTimes','paymentModeLabel','paymentSingle','paymentSplit','singlePaymentNote'])assert.ok(hourlyTranslations[lang][key]);
  assert.equal(hourlyTranslations[lang].timeNextDay,undefined);
 }
});
