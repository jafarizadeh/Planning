import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,payPolicy,policyForPeriod,sanitizeMonthlyPolicies,updateStatus,updateTiming,monthlyHistory,calculatePayroll,makeBackup,parseBackup,mergeHistory,timingAnalysis} from './core.mjs';
const base=payPolicy(DEFAULT_SETTINGS);
const defaults=payPolicy({...base,payMode:'hourly',paymentMode:'single',hourlyRate:10});
const policies={
 '2026-09':payPolicy({...base,payMode:'shift',paymentMode:'split',shiftRate:52,hourlyRate:11,payslipCap:30}),
 '2026-10':payPolicy({...base,payMode:'hourly',paymentMode:'split',shiftRate:44,hourlyRate:12,payslipCap:40}),
 '2027-01':payPolicy({...base,payMode:'shift',paymentMode:'split',shiftRate:48,hourlyRate:15,payslipCap:50})
};
function records(){
 let r={};
 for(const day of ['2026-09-05','2026-10-05','2027-01-05']){
  r=updateStatus(r,day,'morning','work');
  r=updateTiming(r,day,'morning',{start:'09:15',end:'12:45'});
 }
 return r;
}

test('one saved global pair overrides conflicting modes in every month without mutation',()=>{
 const before=JSON.stringify(policies);
 for(const payMode of ['shift','hourly'])for(const paymentMode of ['single','split']){
  const global={...defaults,payMode,paymentMode};
  for(const month of ['2025-01','2026-09','2026-10','2026-11','2027-01','2028-12']){
   const resolved=policyForPeriod(month,policies,global);
   assert.equal(resolved.payMode,payMode,month);
   assert.equal(resolved.paymentMode,paymentMode,month);
  }
 }
 assert.equal(JSON.stringify(policies),before);
});
test('historic rates, cap and hours are independent of globally selected modes',()=>{
 const old=payPolicy({...policies['2026-09'],defaultTimes:{morning:{start:'08:00',end:'13:00'},evening:{start:'17:00',end:'21:00'}}});
 const result=policyForPeriod('2026-09',{'2026-09':old},{...defaults,hourlyRate:99,payslipCap:999});
 assert.equal(result.shiftRate,52);assert.equal(result.hourlyRate,11);assert.equal(result.payslipCap,30);
 assert.equal(result.defaultTimes.morning.start,'08:00');assert.equal(result.paymentMode,'single');
 result.defaultTimes.morning.start='00:00';assert.equal(old.defaultTimes.morning.start,'08:00');
});
test('future and empty months inherit saved global switches and numeric defaults',()=>{
 const global={...defaults,shiftRate:61,hourlyRate:13.5,payslipCap:800};
 const r=policyForPeriod('2028-12',policies,global);
 assert.equal(r.payMode,'hourly');assert.equal(r.paymentMode,'single');
 assert.equal(r.shiftRate,61);assert.equal(r.hourlyRate,13.5);assert.equal(r.payslipCap,800);
});
test('history totals and selected-month calculations use the same global pair',()=>{
 const r=records(),h=monthlyHistory(r,policies,defaults);
 const expected={'2026-09':3850,'2026-10':4200,'2027-01':5250};
 for(const entry of h){
  assert.equal(entry.pay.mode,'hourly');assert.equal(entry.pay.paymentMode,'single');
  assert.equal(entry.pay.totalCents,expected[entry.key]);assert.equal(entry.pay.envelopeCents,0);
  const resolved=policyForPeriod(entry.key,policies,defaults);
  assert.equal(calculatePayroll(r,entry.year,entry.month-1,resolved).totalCents,entry.pay.totalCents);
 }
});
test('switching back to split uses each original cap instead of destroying it',()=>{
 const r=records(),global={...defaults,paymentMode:'split'};
 const h=monthlyHistory(r,policies,global);
 for(const entry of h){
  assert.equal(entry.pay.paymentMode,'split');
  assert.equal(entry.pay.capCents,policies[entry.key].payslipCap*100);
  assert.equal(entry.pay.envelopeCents,entry.pay.totalCents-entry.pay.capCents);
 }
 assert.equal(monthlyHistory(r,policies,defaults).every(e=>e.pay.envelopeCents===0),true);
});
test('switching calculation method globally recalculates without deleting recorded times',()=>{
 const r=records(),before=JSON.stringify(r);
 const h=monthlyHistory(r,policies,{...defaults,payMode:'shift',paymentMode:'single'});
 for(const entry of h){
  assert.equal(entry.pay.mode,'shift');assert.equal(entry.pay.totalCents,policies[entry.key].shiftRate*100);
 }
 assert.equal(JSON.stringify(r),before);
 assert.equal(monthlyHistory(r,policies,defaults).find(e=>e.key==='2026-09').pay.totalCents,3850);
});
test('schema 5 round-trip retains global choices and original conflicting snapshots',()=>{
 const r=records(),archive=makeBackup(r,defaults,policies,[]);
 assert.equal(archive.schemaVersion,5);
 const copy=parseBackup(JSON.stringify(archive));
 assert.deepEqual(copy.records,r);assert.equal(copy.settings.payMode,'hourly');assert.equal(copy.settings.paymentMode,'single');
 assert.equal(copy.monthlyPolicies['2026-09'].payMode,'shift');
 const p=policyForPeriod('2026-09',copy.monthlyPolicies,copy.settings);
 assert.equal(p.payMode,'hourly');assert.equal(p.paymentMode,'single');assert.equal(p.shiftRate,52);
});
test('version 4 archives migrate without discarding work records or saved global switches',()=>{
 const r=records();const old={...makeBackup(r,defaults,policies),schemaVersion:4};
 const copy=parseBackup(JSON.stringify(old));
 assert.deepEqual(copy.records,r);assert.equal(copy.settings.paymentMode,'single');
 assert.equal(policyForPeriod('2027-01',copy.monthlyPolicies,copy.settings).payMode,'hourly');
 assert.equal(copy.monthlyPolicies['2027-01'].hourlyRate,15);
});
test('legacy manual-only times remain explicitly pending instead of silently inventing history',()=>{
 const old=sanitizeMonthlyPolicies({'2026-09':{payMode:'shift',shiftRate:52,hourlyRate:11,payslipCap:711}});
 const r=updateStatus({},'2026-09-05','morning','work');
 const selected=policyForPeriod('2026-09',old,defaults);
 assert.equal(selected.payMode,'hourly');assert.equal(selected.useDefaultTimes,false);
 assert.equal(calculatePayroll(r,2026,8,selected).pendingShifts,1);
 assert.equal(calculatePayroll(r,2026,8,selected).totalCents,0);
 assert.equal(old['2026-09'].shiftRate,52);
});
test('imported monthly mode values cannot override the chosen global preferences',()=>{
 const ours=records(),incoming=updateStatus({},'2026-12-01','evening','work');
 const result=mergeHistory(ours,incoming,policies,{'2026-12':payPolicy({...base,payMode:'shift',paymentMode:'split'})});
 assert.equal(policyForPeriod('2026-12',result.monthlyPolicies,defaults).payMode,'hourly');
 assert.equal(policyForPeriod('2026-12',result.monthlyPolicies,defaults).paymentMode,'single');
 assert.deepEqual(result.records['2026-09-05'],ours['2026-09-05']);
});
test('global shift calculation does not let stale hourly snapshot timings create overlap warnings',()=>{
 const r=records();const modes={...defaults,payMode:'shift'};
 const details=timingAnalysis(r,policies,modes);
 assert.equal(details['2026-10-05:morning'].state,'inactive');
 assert.equal(monthlyHistory(r,policies,modes).every(e=>e.pay.pendingShifts===0),true);
});
