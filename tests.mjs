import test from "node:test";
import assert from "node:assert/strict";
import {
 emptyData,newEmployee,payroll,employerTotals,updateShifts,updatePolicy,
 calendarCells,monthStats,getShift,dayKey,money,sanitizeData,
 makeBackup,restoreBackup,mergeBackup,sanitizeSettings
} from "./core.mjs";
const A=()=>newEmployee({id:"employee_A11",name:"Camille Duval"});
const B=()=>newEmployee({id:"employee_B22",name:"Alex Martin"});
test("empty employer starts French and with no shared personal data",()=>{
 const e=emptyData();assert.equal(e.settings.language,"fr");assert.deepEqual(e.employees,[]);
});
test("work status for each shift is independent and each is half a day",()=>{
 let a=A();a=updateShifts(a,"2026-10-03",{morning:"work"});
 assert.equal(monthStats(a,2026,9).days,.5);
 a=updateShifts(a,"2026-10-03",{evening:"off"});
 assert.equal(monthStats(a,2026,9).days,.5);
 assert.equal(getShift(a,"2026-10-03","evening"),"off");
 a=updateShifts(a,"2026-10-03",{evening:"work"});
 assert.equal(monthStats(a,2026,9).days,1);
 a=updateShifts(a,"2026-10-03",{morning:"unset"});
 assert.equal(monthStats(a,2026,9).days,.5);
});
test("default 40 per shift and 711 cap allocate the 89 envelope correctly",()=>{
 let e=A();
 for(let i=1;i<=10;i++)e=updateShifts(e,dayKey(2026,9,i),{morning:"work",evening:"work"});
 const p=payroll(e,2026,9);
 assert.equal(p.days,10);assert.equal(p.totalCents,80000);
 assert.equal(p.payslipCents,71100);assert.equal(p.envelopeCents,8900);
});
test("exact cap locks envelope and 18 shifts leave 9 euro envelope",()=>{
 let e=newEmployee({id:"employee_C33",name:"Léa",rate:355.5,cap:711});
 e=updateShifts(e,"2026-10-04",{morning:"work",evening:"work"});
 assert.equal(payroll(e,2026,9).envelopeCents,0);
 const f=A();
 let g=f;
 for(let i=1;i<=9;i++)g=updateShifts(g,dayKey(2026,9,i),{morning:"work",evening:"work"});
 assert.equal(payroll(g,2026,9).envelopeCents,900);
});
test("two employees are isolated and employer totals equal sums",()=>{
 let a=updateShifts(A(),"2026-10-02",{morning:"work",evening:"work"});
 let b=updateShifts(B(),"2026-10-03",{morning:"work"});
 const data={schema:1,settings:{language:"fr"},employees:[a,b],audit:[]};
 const total=employerTotals(data,2026,9);
 assert.equal(total.employees,2);assert.equal(total.work,3);
 assert.equal(total.days,1.5);assert.equal(total.totalCents,12000);
 assert.equal(total.payslipCents,12000);assert.equal(total.envelopeCents,0);
 assert.equal(getShift(a,"2026-10-03","morning"),"unset");
 assert.equal(getShift(b,"2026-10-02","morning"),"unset");
});
test("archived employees are excluded from active totals but retain history",()=>{
 const a=updateShifts(A(),"2026-10-02",{morning:"work"});
 const data={employees:[{...a,archived:true}],settings:{language:"fr"}};
 assert.equal(employerTotals(data,2026,9).totalCents,0);
 assert.equal(payroll(data.employees[0],2026,9).totalCents,4000);
});
test("old months keep rates when employee's monthly rate changes",()=>{
 let a=updateShifts({...A(),joinedMonth:"2026-09"},"2026-09-10",{morning:"work"});
 a=updatePolicy(a,2026,9,80,900);
 a=updateShifts(a,"2026-10-10",{morning:"work"});
 assert.equal(payroll(a,2026,8).totalCents,4000);
 assert.equal(payroll(a,2026,9).totalCents,8000);
});
test("same calendar works with Monday and Saturday week starts",()=>{
 const monday=calendarCells(2026,9,1),saturday=calendarCells(2026,9,6);
 assert.equal(monday.findIndex(Boolean),3);
 assert.equal(saturday.findIndex(Boolean),5);
 assert.equal(monday.filter(Boolean).length,31);
});
test("money is rounded in cents and invalid rates revert safely",()=>{
 assert.equal(money("40,25",40),40.25);
 assert.equal(money(-1,40),40);
 assert.equal(money("not-a-number",40),40);
 let a=updatePolicy(A(),2026,9,.1,.2);
 a=updateShifts(a,"2026-10-03",{morning:"work",evening:"work"});
 assert.equal(payroll(a,2026,9).totalCents,20);
});
test("backup contains all employees, photos, history, and settings",()=>{
 const a=updateShifts(A(),"2026-10-03",{morning:"work"});
 const data={schema:1,employees:[a,B()],settings:{language:"zh",theme:"dark",weekStart:6},audit:[]};
 const restored=restoreBackup(JSON.stringify(makeBackup(data)));
 assert.equal(restored.settings.language,"zh");assert.equal(restored.settings.theme,"dark");
 assert.equal(restored.employees.length,2);
 assert.equal(restored.employees[0].shifts["2026-10-03"].morning,"work");
});
test("backup merge preserves current employees and only adds missing employee IDs",()=>{
 const original=updateShifts(A(),"2026-10-03",{morning:"work"});
 const incoming=updateShifts(A(),"2026-10-03",{morning:"off"});
 const merged=mergeBackup({employees:[original],settings:{language:"fr"}},
   {employees:[incoming,B()],settings:{language:"en"}});
 assert.equal(merged.added,1);
 assert.equal(merged.data.employees.length,2);
 assert.equal(merged.data.employees[0].shifts["2026-10-03"].morning,"work");
});
test("invalid dates and image payloads are rejected",()=>{
 const a=A();
 assert.throws(()=>updateShifts(a,"2026-02-29",{morning:"work"}));
 assert.throws(()=>updateShifts(a,"2026-10-03",{morning:"bad"}));
 const scrub=sanitizeData({employees:[{...a,photo:"javascript:alert(1)"}]});
 assert.equal(scrub.employees[0].photo,"");
 assert.deepEqual(sanitizeSettings({language:"other"}).language,"fr");
});

test("October join and November departure: only October and November appear",async()=>{
 const {employeeVisibleInMonth,retireEmployeeFrom,nextPeriodKey}=await import("./core.mjs");
 const original={...A(),joinedMonth:"2026-10",photo:"data:image/jpeg;base64,YWJj"};
 let employee=updateShifts(original,"2026-10-10",{morning:"work",evening:"work"});
 employee=updateShifts(employee,"2026-11-11",{morning:"work"});
 const octBefore=payroll(employee,2026,9);
 const novBefore=payroll(employee,2026,10);
 const salaryBefore={oct:octBefore.totalCents,nov:novBefore.totalCents};
 const shiftsBefore=JSON.stringify(employee.shifts);
 const policiesBefore=JSON.stringify(employee.policies);
 assert.equal(nextPeriodKey("2026-11"),"2026-12");
 assert.equal(employeeVisibleInMonth(employee,2026,8),false);
 assert.equal(employeeVisibleInMonth(employee,2026,9),true);
 assert.equal(employeeVisibleInMonth(employee,2026,10),true);
 const retired=retireEmployeeFrom(employee,"2026-11");
 assert.equal(retired.inactiveFrom,"2026-12");
 assert.equal(retired.joinedMonth,"2026-10");
 assert.equal(employeeVisibleInMonth(retired,2026,8),false);
 assert.equal(employeeVisibleInMonth(retired,2026,9),true);
 assert.equal(employeeVisibleInMonth(retired,2026,10),true);
 assert.equal(employeeVisibleInMonth(retired,2026,11),false);
 assert.equal(JSON.stringify(retired.shifts),shiftsBefore);
 assert.equal(JSON.stringify(retired.policies),policiesBefore);
 assert.equal(retired.photo,original.photo);
 assert.equal(payroll(retired,2026,9).totalCents,salaryBefore.oct);
 assert.equal(payroll(retired,2026,10).totalCents,salaryBefore.nov);
 for(const [month,want] of [[8,0],[9,8000],[10,4000],[11,0]]){
  const sum=employerTotals({employees:[retired]},2026,month);
  assert.equal(sum.totalCents,want);
  assert.equal(sum.employees,want?1:0);
 }
 assert.throws(()=>updateShifts(retired,"2026-10-10",{morning:"off"}));
 assert.throws(()=>updatePolicy(retired,2026,9,200,900));
 const backup=restoreBackup(JSON.stringify(makeBackup({employees:[retired]})));
 assert.equal(backup.employees[0].joinedMonth,"2026-10");
 assert.equal(backup.employees[0].inactiveFrom,"2026-12");
 assert.equal(payroll(backup.employees[0],2026,9).totalCents,8000);
});
test("removal during joining month keeps that month but excludes the next",async()=>{
 const {employeeVisibleInMonth,retireEmployeeFrom}=await import("./core.mjs");
 let employee={...B(),joinedMonth:"2026-10"};
 employee=updateShifts(employee,"2026-10-31",{evening:"work"});
 assert.throws(()=>updateShifts(employee,"2026-09-30",{morning:"work"}));
 assert.throws(()=>updatePolicy(employee,2026,8,30,711));
 const retired=retireEmployeeFrom(employee,"2026-10");
 assert.equal(retired.inactiveFrom,"2026-11");
 assert.equal(employeeVisibleInMonth(retired,2026,8),false);
 assert.equal(employeeVisibleInMonth(retired,2026,9),true);
 assert.equal(employeeVisibleInMonth(retired,2026,10),false);
 assert.equal(employerTotals({employees:[retired]},2026,9).totalCents,4000);
 assert.equal(employerTotals({employees:[retired]},2026,10).totalCents,0);
 assert.equal(retireEmployeeFrom(retired,"2026-10").inactiveFrom,"2026-11");
});
test("per-employee historic presence never leaks to other months",async()=>{
 const {employeeVisibleInMonth,retireEmployeeFrom}=await import("./core.mjs");
 let oct=updateShifts({...A(),joinedMonth:"2026-10"},"2026-10-05",{morning:"work"});
 let sep=updateShifts({...B(),joinedMonth:"2026-09"},"2026-09-05",{morning:"work"});
 oct=retireEmployeeFrom(oct,"2026-11");
 const data={employees:[oct,sep],settings:{language:"fr"}};
 assert.equal(employerTotals(data,2026,8).employees,1);
 assert.equal(employerTotals(data,2026,9).employees,2);
 assert.equal(employerTotals(data,2026,10).employees,2);
 assert.equal(employerTotals(data,2026,11).employees,1);
 assert.equal(employeeVisibleInMonth(oct,2026,8),false);
 assert.equal(employeeVisibleInMonth(sep,2026,8),true);
});

test("migration preserves work months recorded before old createdAt timestamp",async()=>{
 const {employeeVisibleInMonth}=await import("./core.mjs");
 const old=updateShifts({...A(),joinedMonth:"2026-09"},"2026-09-03",{morning:"work"});
 const legacy={...old,createdAt:"2026-10-22T12:00:00.000Z"};
 delete legacy.joinedMonth;
 const migrated=sanitizeData({employees:[legacy]}).employees[0];
 assert.equal(migrated.joinedMonth,"2026-09");
 assert.equal(employeeVisibleInMonth(migrated,2026,8),true);
 assert.equal(payroll(migrated,2026,8).totalCents,4000);
 assert.equal(migrated.shifts["2026-09-03"].morning,"work");
 // Explicit new-version joining months are authoritative and never inferred away.
 const modern=sanitizeData({employees:[{...legacy,joinedMonth:"2026-10"}]}).employees[0];
 assert.equal(modern.joinedMonth,"2026-10");
 assert.equal(employeeVisibleInMonth(modern,2026,8),false);
});

test("second-stage permanent deletion removes a retired worker from ALL months",async()=>{
 const {permanentlyDeleteEmployee,retireEmployeeFrom,employeeVisibleInMonth}=await import("./core.mjs");
 const portrait="data:image/jpeg;base64,"+"YWJj";
 let departed={...A(),joinedMonth:"2026-10",photo:portrait};
 departed=updateShifts(departed,"2026-10-06",{morning:"work",evening:"work"});
 departed=updateShifts(departed,"2026-11-09",{morning:"work"});
 departed=updatePolicy(departed,2026,9,40,711);
 departed=retireEmployeeFrom(departed,"2026-11");
 let colleague={...B(),joinedMonth:"2026-10"};
 colleague=updateShifts(colleague,"2026-10-08",{morning:"work"});
 const data={
  schema:1,settings:{language:"fr"},employees:[departed,colleague],
  audit:[
   {at:"2026-10-06T09:00:00.000Z",type:"shift",employeeId:departed.id,description:"October worked"},
   {at:"2026-11-09T09:00:00.000Z",type:"shift",employeeId:departed.id,description:"November worked"},
   {at:"2026-10-08T09:00:00.000Z",type:"shift",employeeId:colleague.id,description:"Colleague worked"},
   {at:"2026-11-15T09:00:00.000Z",type:"retire",employeeId:departed.id,description:"End of employment"}
  ]
 };
 assert.equal(employeeVisibleInMonth(departed,2026,9),true);
 assert.equal(employeeVisibleInMonth(departed,2026,10),true);
 assert.equal(employerTotals(data,2026,9).totalCents,12000);
 assert.equal(employerTotals(data,2026,10).totalCents,4000);
 const done=permanentlyDeleteEmployee(data,departed.id);
 assert.equal(done.deleted,true);
 assert.equal(done.data.employees.length,1);
 assert.equal(done.data.employees[0].id,colleague.id);
 assert.equal(done.data.audit.length,1);
 assert.equal(done.data.audit[0].employeeId,colleague.id);
 assert.equal(employerTotals(done.data,2026,9).totalCents,4000);
 assert.equal(employerTotals(done.data,2026,10).totalCents,0);
 assert.equal(employerTotals(done.data,2026,11).totalCents,0);
 assert.equal(JSON.stringify(done.data).includes(departed.id),false);
 assert.equal(JSON.stringify(done.data).includes(departed.name),false);
 assert.equal(JSON.stringify(done.data).includes(portrait),false);
 const exported=makeBackup(done.data);
 const imported=restoreBackup(JSON.stringify(exported));
 assert.equal(imported.employees.length,1);
 assert.equal(JSON.stringify(imported).includes(departed.id),false);
});
test("permanent deletion is forbidden until a worker has first left the team",async()=>{
 const {permanentlyDeleteEmployee,retireEmployeeFrom}=await import("./core.mjs");
 const worker={...A(),joinedMonth:"2026-10"};
 const record={employees:[worker],audit:[]};
 const attempted=permanentlyDeleteEmployee(record,worker.id);
 assert.equal(attempted.deleted,false);
 assert.equal(attempted.data.employees.length,1);
 assert.equal(permanentlyDeleteEmployee(record,"wrong").deleted,false);
 const retired=retireEmployeeFrom(worker,"2026-10");
 assert.equal(permanentlyDeleteEmployee({employees:[retired],audit:[]},worker.id).deleted,true);
});

test("full deletion warning and action are translated for FR, EN and Chinese", async()=>{
 const {tr}=await import("./translations.mjs");
 for(const lang of ["fr","en","zh"]){
  const label=tr(lang,"permanentDeleteLabel");
  const warning=tr(lang,"permanentDeleteWarning");
  const done=tr(lang,"permanentDeleteSuccess");
  assert.ok(label.length>=5);
  assert.ok(warning.includes("{name}"));
  assert.ok(warning.length>75);
  assert.ok(done.length>=5);
 }
});
