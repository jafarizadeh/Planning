import test from 'node:test';
import assert from 'node:assert/strict';
import {payPolicy,calculatePayroll,updateStatus,updateTiming,getTiming,timeRangeDetails,timingAnalysis,sanitizeRecords,sanitizeMonthlyPolicies,sanitizeSettings,makeBackup,parseBackup,monthlyHistory,mergeHistory} from './core.mjs';
// Legacy manual-only policies intentionally retain their pre-default-hour behaviour.
const hourly={payMode:'hourly',hourlyRate:10,shiftRate:40,payslipCap:711,useDefaultTimes:false};
function add(r,date,shift,start,end,nextDay=false){
 r=updateStatus(r,date,shift,'work');
 return updateTiming(r,date,shift,{start,end,nextDay});
}
const pay=r=>calculatePayroll(r,2026,9,hourly);
test('legacy settings keep shift mode; rates are independent',()=>{
 const old=sanitizeSettings({shiftRate:52.5,payslipCap:800});
 assert.equal(old.payMode,'shift');assert.equal(old.hourlyRate,10);assert.equal(old.shiftRate,52.5);
 const now=payPolicy({...hourly,hourlyRate:'10,75'});assert.equal(now.hourlyRate,10.75);assert.equal(now.shiftRate,40);
 assert.equal(sanitizeSettings({hourlyRate:-5}).hourlyRate,10);
});
test('hourly pay adds both morning and evening minutes exactly',()=>{
 let r=add({},'2026-10-05','morning','09:15','12:45');
 r=add(r,'2026-10-05','evening','18:00','22:00');
 const p=pay(r);assert.equal(p.minutes,450);assert.equal(p.totalCents,7500);
 assert.equal(p.shifts,2);assert.equal(p.paidShifts,2);assert.equal(p.pendingShifts,0);
 assert.equal(p.payslipCents,7500);assert.equal(p.envelopeCents,0);
});
test('the same records still produce the old flat shift amount',()=>{
 const r=add({},'2026-10-05','morning','09:15','12:45');
 assert.equal(calculatePayroll(r,2026,9,{...hourly,payMode:'shift'}).totalCents,4000);
 assert.equal(pay(r).totalCents,3500);
});
test('worked without both times is pending, never guessed',()=>{
 let r=updateStatus({},'2026-10-05','morning','work');
 assert.equal(pay(r).pendingShifts,1);assert.equal(pay(r).totalCents,0);
 r=updateTiming(r,'2026-10-05','morning',{start:'09:00'});
 assert.equal(pay(r).pendingShifts,1);assert.equal(pay(r).totalCents,0);
 r=updateTiming(r,'2026-10-05','morning',{end:'11:30'});
 assert.equal(pay(r).totalCents,2500);assert.equal(pay(r).pendingShifts,0);
});
test('off and unset hours stay preserved but are not paid',()=>{
 let r=add({},'2026-10-05','morning','09:00','13:30');
 r=updateStatus(r,'2026-10-05','morning','off');
 assert.equal(pay(r).totalCents,0);assert.equal(pay(r).pendingShifts,0);
 assert.equal(getTiming(r,'2026-10-05','morning').start,'09:00');
 r=updateStatus(r,'2026-10-05','morning','unset');
 assert.equal(pay(r).totalCents,0);
 r=updateStatus(r,'2026-10-05','morning','work');
 assert.equal(pay(r).totalCents,4500);
});
test('hourly threshold preserves the 711 payslip and 89 envelope split',()=>{
 let r={};for(let i=1;i<=10;i++)r=add(r,'2026-10-'+String(i).padStart(2,'0'),'morning','08:00','16:00');
 const p=pay(r);assert.equal(p.minutes,4800);assert.equal(p.totalCents,80000);
 assert.equal(p.payslipCents,71100);assert.equal(p.envelopeCents,8900);
 assert.equal(p.progressPercent,100);
});
test('one-minute work rounds cents once across the month, not once per shift',()=>{
 let r=add({},'2026-10-01','morning','09:00','09:01');
 r=add(r,'2026-10-02','morning','09:00','09:01');
 r=add(r,'2026-10-03','morning','09:00','09:01');
 const p=pay(r);assert.equal(p.minutes,3);assert.equal(p.totalCents,50);
 assert.equal(calculatePayroll(r,2026,9,{...hourly,hourlyRate:0}).totalCents,0);
});
test('legacy manual policy preserves its previous explicit overnight data',()=>{
 let r=add({},'2026-10-05','evening','22:15','02:30');
 assert.equal(pay(r).pendingShifts,1);assert.equal(pay(r).minutes,0);
 r=updateTiming(r,'2026-10-05','evening',{nextDay:true});
 assert.equal(pay(r).minutes,255);assert.equal(pay(r).totalCents,4250);
});
test('equal or 24-hour and reversed ranges are not paid',()=>{
 for(const nextDay of [false,true]){
  const r=add({},'2026-10-05','morning','09:00','09:00',nextDay);
  assert.equal(pay(r).pendingShifts,1);assert.equal(pay(r).totalCents,0);
 }
 assert.equal(timeRangeDetails({start:'12:00',end:'11:00',nextDay:false}).state,'invalid');
 assert.equal(timeRangeDetails({start:'00:00',end:'23:59'}).minutes,1439);
});
test('overlap excludes both offending shifts instead of double paying',()=>{
 let r=add({},'2026-10-05','morning','09:00','13:00');
 r=add(r,'2026-10-05','evening','12:00','15:00');
 assert.equal(pay(r).pendingShifts,2);assert.equal(pay(r).minutes,0);
 r=updateTiming(r,'2026-10-05','evening',{start:'13:00'});
 assert.equal(pay(r).pendingShifts,0);assert.equal(pay(r).minutes,360);
});
test('overnight and next-morning overlap is detected',()=>{
 let r=add({},'2026-10-05','evening','22:00','02:00',true);
 r=add(r,'2026-10-06','morning','01:00','04:00');
 const analysis=timingAnalysis(r);
 assert.equal(analysis['2026-10-05:evening'].state,'overlap');assert.equal(pay(r).pendingShifts,2);
});
test('a crossing-month shift is counted in the start-date month',()=>{
 const r=add({},'2026-10-31','evening','22:00','02:00',true);
 assert.equal(pay(r).minutes,240);assert.equal(pay(r).totalCents,4000);
 assert.equal(calculatePayroll(r,2026,10,hourly).totalCents,0);
});
test('historic policy stays shift-based when new months become hourly',()=>{
 let r=updateStatus({},'2026-09-05','morning','work');
 r=add(r,'2026-10-05','morning','09:00','12:30');
 const policies=sanitizeMonthlyPolicies({'2026-09':{shiftRate:40,payslipCap:711},'2026-10':hourly});
 const history=monthlyHistory(r,policies,hourly);
 assert.equal(history[0].pay.mode,'hourly');assert.equal(history[0].pay.totalCents,3500);
 assert.equal(history[1].pay.mode,'shift');assert.equal(history[1].pay.totalCents,4000);
});
test('schema 4 export includes complete or partial times and monthly pay modes',()=>{
 let r=add({},'2026-10-05','morning','09:15','12:45');
 r=updateTiming(r,'2026-10-05','evening',{start:'18:00'});
 const backup=makeBackup(r,hourly,{'2026-10':hourly});
 assert.equal(backup.schemaVersion,4);
 const copy=parseBackup(JSON.stringify(backup));
 assert.deepEqual(copy.records,r);assert.equal(copy.settings.payMode,'hourly');
 assert.equal(copy.monthlyPolicies['2026-10'].hourlyRate,10);
 assert.equal(pay(copy.records).totalCents,3500);
});
test('legacy v1 and v2 backups import unchanged with default shift-based pay',()=>{
 for(const schemaVersion of [1,2]){
  const old={app:'ShiftPlanner',schemaVersion,records:{'2026-10-05':{morning:'work'}},settings:{shiftRate:40,payslipCap:711},monthlyPolicies:{'2026-10':{shiftRate:40,payslipCap:711}},audit:[]};
  const copy=parseBackup(JSON.stringify(old));
  assert.equal(copy.settings.payMode,'shift');assert.equal(copy.monthlyPolicies['2026-10'].payMode,'shift');
  assert.equal(calculatePayroll(copy.records,2026,9,copy.monthlyPolicies['2026-10']).totalCents,4000);
 }
});
test('invalid clock data is rejected or safely sanitized without losing statuses',()=>{
 assert.throws(()=>updateTiming({},'2026-10-05','morning',{start:'25:00'}));
 assert.throws(()=>updateTiming({},'2026-10-05','morning',{end:'12:60'}));
 assert.throws(()=>updateTiming({},'2026-10-05','wrong',{start:'09:00'}));
 assert.throws(()=>updateTiming({},'2026-02-29','morning',{start:'09:00'}));
 const r=sanitizeRecords({'2026-10-05':{morning:'work',timings:{morning:{start:'99:00',end:'12:00'}}}});
 assert.equal(r['2026-10-05'].morning,'work');assert.equal(getTiming(r,'2026-10-05','morning').end,'12:00');assert.equal(pay(r).pendingShifts,1);
 const corrupted=makeBackup({},hourly);corrupted.records={'2026-10-05':{morning:'work',timings:{morning:{start:'09:99'}}}};
 assert.throws(()=>parseBackup(JSON.stringify(corrupted)));
});
test('merging time backups preserves the current range atomically',()=>{
 const a=add({},'2026-10-05','morning','09:00','12:00');
 const b=add({},'2026-10-05','morning','08:00','13:00');
 const c=mergeHistory(a,b,{'2026-10':hourly},{'2026-10':{...hourly,hourlyRate:20}});
 assert.equal(getTiming(c.records,'2026-10-05','morning').start,'09:00');
 assert.equal(getTiming(c.records,'2026-10-05','morning').end,'12:00');
 assert.equal(c.monthlyPolicies['2026-10'].hourlyRate,10);assert.equal(pay(c.records).totalCents,3000);
});
test('mode/clock text is available in all five languages',async()=>{
 const {hourlyTranslations}=await import('./hourly-translations.mjs');
 const keys=Object.keys(hourlyTranslations.fr);
 for(const lang of ['fr','en','fa','de','es'])for(const key of keys)assert.ok(hourlyTranslations[lang][key],lang+':'+key);
});
