import test from "node:test";
import assert from "node:assert/strict";
import {
  dateKey, validDateKey, calendarCells, monthStats, overallStats,
  getStatus, updateStatus, nextStatus, sanitizeRecords, sanitizeSettings,
  makeBackup, parseBackup
} from "./core.mjs";

test("a shift counts as half a day", () => {
  let records = {};
  records = updateStatus(records,"2026-10-01","morning","work");
  assert.equal(monthStats(records,2026,9).halfDays,0.5);
  records = updateStatus(records,"2026-10-01","evening","work");
  assert.equal(monthStats(records,2026,9).halfDays,1);
  records = updateStatus(records,"2026-10-02","morning","work");
  records = updateStatus(records,"2026-10-02","evening","off");
  const totals = monthStats(records,2026,9);
  assert.equal(totals.work,3);
  assert.equal(totals.off,1);
  assert.equal(totals.unset,58);
  assert.equal(totals.halfDays,1.5);
  assert.equal(overallStats(records).halfDays,1.5);
});

test("unset is different from off and removes empty dates", () => {
  let records = updateStatus({},"2026-10-05","morning","off");
  assert.equal(getStatus(records,"2026-10-05","morning"),"off");
  assert.equal(getStatus(records,"2026-10-05","evening"),"unset");
  records = updateStatus(records,"2026-10-05","morning","unset");
  assert.deepEqual(records,{});
  assert.equal(nextStatus("unset"),"work");
  assert.equal(nextStatus("work"),"off");
  assert.equal(nextStatus("off"),"unset");
});

test("invalid dates are never saved", () => {
  assert.equal(validDateKey("2026-02-29"),false);
  assert.equal(validDateKey("2024-02-29"),true);
  assert.equal(validDateKey("__proto__"),false);
  assert.throws(()=>updateStatus({},"2026-02-29","morning","work"));
  assert.deepEqual(sanitizeRecords({"2026-02-29":{morning:"work"},"2026-10-03":{morning:"work",evening:"other"}}),{"2026-10-03":{morning:"work"}});
});

test("calendar starts on the configured weekday", () => {
  assert.equal(dateKey(2026,9,1),"2026-10-01");
  const monday = calendarCells(2026,9,1);
  const sunday = calendarCells(2026,9,0);
  assert.equal(monday.findIndex(Boolean),3);
  assert.equal(sunday.findIndex(Boolean),4);
  assert.equal(monday.filter(Boolean).length,31);
});

test("backups round-trip and reject unrecognized data", () => {
  const records = {"2026-10-05":{morning:"work",evening:"off"}};
  const settings = sanitizeSettings({language:"fr",weekStart:1,morningName:"A",eveningName:"B"});
  const backup = makeBackup(records,settings);
  assert.deepEqual(parseBackup(JSON.stringify(backup)),{records,settings,monthlyPolicies:{},audit:[]});
  assert.throws(()=>parseBackup("invalid"));
  assert.throws(()=>parseBackup(JSON.stringify({app:"SomethingElse",schemaVersion:1,records:{}})));
});

test("payroll splits at the configured 711 euro cap", async () => {
  const { payrollForMonth } = await import("./core.mjs");
  const under = payrollForMonth(17);
  assert.equal(under.totalCents, 68000);
  assert.equal(under.payslipCents, 68000);
  assert.equal(under.envelopeCents, 0);
  const justOver = payrollForMonth(18);
  assert.equal(justOver.totalCents, 72000);
  assert.equal(justOver.payslipCents, 71100);
  assert.equal(justOver.envelopeCents, 900);
  const over = payrollForMonth(20);
  assert.equal(over.totalCents, 80000);
  assert.equal(over.payslipCents, 71100);
  assert.equal(over.envelopeCents, 8900);
  assert.equal(over.progressPercent, 100);
});

test("pay cap, exact boundary, and cents are configurable", async () => {
  const { payrollForMonth } = await import("./core.mjs");
  const exact = payrollForMonth(2, { shiftRate: 355.5, payslipCap: 711 });
  assert.equal(exact.totalCents, 71100);
  assert.equal(exact.payslipCents, 71100);
  assert.equal(exact.envelopeCents, 0);
  const decimals = payrollForMonth(3, { shiftRate: 0.1, payslipCap: 0.2 });
  assert.equal(decimals.totalCents, 30);
  assert.equal(decimals.payslipCents, 20);
  assert.equal(decimals.envelopeCents, 10);
  assert.equal(payrollForMonth(0).envelopeCents, 0);
  assert.equal(payrollForMonth(5, { shiftRate: 0, payslipCap: 0 }).envelopeCents, 0);
  assert.equal(payrollForMonth(1, { shiftRate: 40, payslipCap: 0 }).envelopeCents, 4000);
});

test("settings and old backup migration preserve the 40 and 711 defaults", () => {
  const old = sanitizeSettings({language:"fr",weekStart:1});
  assert.equal(old.shiftRate,40);
  assert.equal(old.payslipCap,711);
  const custom = sanitizeSettings({language:"fr",weekStart:1,shiftRate:"42.75",payslipCap:"711,25"});
  assert.equal(custom.shiftRate,42.75);
  assert.equal(custom.payslipCap,711.25);
  assert.equal(sanitizeSettings({shiftRate:-4,payslipCap:Infinity}).shiftRate,40);
  const record = {"2026-10-15":{morning:"work"}};
  const oldBackup = {app:"ShiftPlanner",schemaVersion:1,records:record,settings:{language:"fr",weekStart:1}};
  assert.deepEqual(parseBackup(JSON.stringify(oldBackup)),{records:record,settings:old,monthlyPolicies:{},audit:[]});
  const newBackup = makeBackup(record,custom);
  assert.deepEqual(parseBackup(JSON.stringify(newBackup)).settings,custom);
});

test("payroll uses only the displayed month", async () => {
  const { payrollForMonth } = await import("./core.mjs");
  let record = updateStatus({},"2026-10-15","morning","work");
  record = updateStatus(record,"2026-11-15","morning","work");
  assert.equal(payrollForMonth(monthStats(record,2026,9).work).totalCents,4000);
  assert.equal(payrollForMonth(monthStats(record,2026,10).work).totalCents,4000);
});

test("historical months retain their own pay settings after global defaults change", async () => {
  const {monthlyHistory,sanitizeMonthlyPolicies,periodKey} = await import("./core.mjs");
  let r=updateStatus({},"2026-09-15","morning","work");
  r=updateStatus(r,"2026-10-15","morning","work");
  const policies=sanitizeMonthlyPolicies({
    "2026-09":{shiftRate:40,payslipCap:711},
    "2026-10":{shiftRate:65,payslipCap:900}
  });
  const entries=monthlyHistory(r,policies,{shiftRate:88,payslipCap:1000});
  assert.equal(periodKey(2026,8),"2026-09");
  assert.equal(entries.length,2);
  assert.equal(entries[0].key,"2026-10");
  assert.equal(entries[0].pay.totalCents,6500);
  assert.equal(entries[1].key,"2026-09");
  assert.equal(entries[1].pay.totalCents,4000);
});

test("merging backups never overwrites current shifts or monthly rates",async()=>{
  const {mergeHistory,sanitizeAudit} = await import("./core.mjs");
  const a={"2026-10-01":{morning:"work"}};
  const b={"2026-10-01":{morning:"off",evening:"work"},"2025-12-01":{evening:"work"}};
  const merged=mergeHistory(a,b,{"2026-10":{shiftRate:45,payslipCap:750}},
    {"2026-10":{shiftRate:40,payslipCap:711},"2025-12":{shiftRate:35,payslipCap:500}});
  assert.equal(merged.records["2026-10-01"].morning,"work");
  assert.equal(merged.records["2026-10-01"].evening,"work");
  assert.equal(merged.records["2025-12-01"].evening,"work");
  assert.equal(merged.monthlyPolicies["2026-10"].shiftRate,45);
  assert.equal(merged.monthlyPolicies["2025-12"].shiftRate,35);
  assert.equal(merged.conflicts,1);
  const audit=sanitizeAudit([{id:"1",at:"2026-10-30T12:30:00.000Z",type:"shift",period:"2026-10",detail:"first"},
    {id:"1",at:"2026-10-30T12:31:00.000Z",type:"shift",period:"2026-10",detail:"duplicate"}]);
  assert.equal(audit.length,1);
});

test("new backup contains preserved pay periods and audit", async()=>{
  const {sanitizeAudit} = await import("./core.mjs");
  const r={"2026-09-11":{morning:"work"}};
  const policies={"2026-09":{shiftRate:60,payslipCap:777}};
  const audit=sanitizeAudit([{id:"a",at:"2026-09-11T13:15:00.000Z",type:"shift",period:"2026-09",detail:"morning work"}]);
  const backup=makeBackup(r,{language:"fr",shiftRate:40,payslipCap:711},policies,audit);
  assert.equal(backup.schemaVersion,3);
  const copy=parseBackup(JSON.stringify(backup));
  assert.equal(copy.monthlyPolicies["2026-09"].shiftRate,60);
  assert.equal(copy.audit.length,1);
  assert.equal(copy.records["2026-09-11"].morning,"work");
});

test("all five languages and both appearance modes survive normalization", () => {
  for(const language of ["de","en","fr","fa","es"]){
    const dark=sanitizeSettings({language,theme:"dark",shiftRate:40,payslipCap:711});
    assert.equal(dark.language,language);
    assert.equal(dark.theme,"dark");
    assert.equal(parseBackup(JSON.stringify(makeBackup({},dark))).settings.theme,"dark");
  }
  assert.equal(sanitizeSettings({language:"invalid",theme:"unknown"}).theme,"light");
  assert.equal(sanitizeSettings({language:"invalid",theme:"unknown"}).language,"fr");
});
test("legacy backup defaults to light theme without altering old payroll settings", () => {
  const record={"2026-10-07":{morning:"work",evening:"off"}};
  const legacy={app:"ShiftPlanner",schemaVersion:1,records:record,
    settings:{language:"fr",weekStart:1,shiftRate:52.5,payslipCap:711}};
  const restored=parseBackup(JSON.stringify(legacy));
  assert.equal(restored.settings.theme,"light");
  assert.equal(restored.settings.shiftRate,52.5);
  assert.equal(restored.settings.payslipCap,711);
  assert.deepEqual(restored.records,record);
});
