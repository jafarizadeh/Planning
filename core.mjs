export const SHIFTS = ["morning", "evening"];
export const DEFAULT_SETTINGS = { language: "fr", theme: "light", weekStart: 1, morningName: "", eveningName: "", shiftRate: 40, payslipCap: 711 };
export const STATUS = { UNSET: "unset", WORK: "work", OFF: "off" };
export const DATA_KEY = "shift-planner-records-v1";
export const SETTINGS_KEY = "shift-planner-settings-v1";
const validStates = new Set(["work", "off"]);
export const pad = value => String(value).padStart(2, "0");
export function dateKey(year, month, day) { return year + "-" + pad(month + 1) + "-" + pad(day); }
export function validDateKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y,m,d] = key.split("-").map(Number);
  const test = new Date(Date.UTC(y, m-1, d));
  return y >= 1900 && y <= 2200 && test.getUTCFullYear() === y && test.getUTCMonth() === m-1 && test.getUTCDate() === d;
}
export function sanitizeRecords(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const result = {};
  for (const [key, entry] of Object.entries(data)) {
    if (!validDateKey(key) || !entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const clean = {};
    for (const shift of SHIFTS) if (validStates.has(entry[shift])) clean[shift] = entry[shift];
    if (Object.keys(clean).length) result[key] = clean;
  }
  return result;
}
function validMoney(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = typeof value === "string" ? value.trim().replace(",", ".") : value;
  if (normalized === "") return fallback;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 && amount <= 100000 ?
    Math.round(amount * 100) / 100 : fallback;
}
export function sanitizeSettings(data) {
  const x = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  return {
    language: ["fa","en","fr","de","es"].includes(x.language) ? x.language : "fr",
    theme: ["light","dark"].includes(x.theme) ? x.theme : DEFAULT_SETTINGS.theme,
    weekStart: [0,1,6].includes(Number(x.weekStart)) ? Number(x.weekStart) : 1,
    morningName: typeof x.morningName === "string" ? x.morningName.trim().slice(0,25) : "",
    eveningName: typeof x.eveningName === "string" ? x.eveningName.trim().slice(0,25) : "",
    shiftRate: validMoney(x.shiftRate, DEFAULT_SETTINGS.shiftRate),
    payslipCap: validMoney(x.payslipCap, DEFAULT_SETTINGS.payslipCap)
  };
}
export function getStatus(records, key, shift) {
  return validDateKey(key) && SHIFTS.includes(shift) && validStates.has(records?.[key]?.[shift]) ? records[key][shift] : "unset";
}
export function updateStatus(records, key, shift, status) {
  if (!validDateKey(key) || !SHIFTS.includes(shift) || !["unset","work","off"].includes(status)) throw Error("invalid-shift");
  const next = { ...records }, entry = { ...(records[key] || {}) };
  if (status === "unset") delete entry[shift];
  else entry[shift] = status;
  if (!Object.keys(entry).length) delete next[key];
  else next[key] = entry;
  return next;
}
export function nextStatus(state) { return state === "unset" ? "work" : state === "work" ? "off" : "unset"; }
export function monthLength(year, month) { return new Date(year, month+1, 0).getDate(); }
export function calendarCells(year, month, weekStart=1) {
  const lead = (new Date(year,month,1).getDay() - weekStart + 7) % 7, days=monthLength(year,month);
  const length=Math.max(35,Math.ceil((lead+days)/7)*7);
  return Array.from({length},(_,index)=>{
    const day=index-lead+1;
    return day>=1 && day<=days ? {day,key:dateKey(year,month,day)} : null;
  });
}
export function monthStats(records, year, month) {
  const days=monthLength(year,month), result={work:0,off:0,unset:0,days,halfDays:0};
  for(let day=1;day<=days;day++) {
    const date=dateKey(year,month,day);
    for(const shift of SHIFTS) result[getStatus(records,date,shift)]++;
  }
  result.halfDays=result.work/2;
  return result;
}
export function overallStats(records) {
  const result={work:0,off:0,halfDays:0};
  for(const entry of Object.values(sanitizeRecords(records))) for(const shift of SHIFTS) {
    if(entry[shift]==="work") result.work++;
    if(entry[shift]==="off") result.off++;
  }
  result.halfDays=result.work/2;
  return result;
}
export function payrollForMonth(workedShifts, inputSettings = DEFAULT_SETTINGS) {
  const settings = sanitizeSettings(inputSettings);
  const shifts = Number.isSafeInteger(workedShifts) && workedShifts >= 0 ? workedShifts : 0;
  const rateCents = Math.round(settings.shiftRate * 100);
  const capCents = Math.round(settings.payslipCap * 100);
  const totalCents = shifts * rateCents;
  const payslipCents = Math.min(totalCents, capCents);
  const envelopeCents = totalCents - payslipCents;
  const progressPercent = capCents === 0 ? (totalCents > 0 ? 100 : 0) :
    Math.min(100, payslipCents / capCents * 100);
  return { shifts, rateCents, capCents, totalCents, payslipCents, envelopeCents, progressPercent };
}

export function makeBackup(records,settings,monthlyPolicies={},audit=[]) {
  return {
    app:"ShiftPlanner", schemaVersion:2, exportedAt:new Date().toISOString(),
    records:sanitizeRecords(records), settings:sanitizeSettings(settings),
    monthlyPolicies:sanitizeMonthlyPolicies(monthlyPolicies), audit:sanitizeAudit(audit)
  };
}
export function parseBackup(text) {
  let data;
  try { data=JSON.parse(text); } catch { throw Error("not-json"); }
  if (!data || data.app!=="ShiftPlanner" || ![1,2].includes(data.schemaVersion) ||
      !data.records || typeof data.records!=="object" || Array.isArray(data.records)) {
    throw Error("not-backup");
  }
  for(const [key, entry] of Object.entries(data.records)){
    if(!validDateKey(key) || !entry || typeof entry!=="object" || Array.isArray(entry) ||
      Object.keys(entry).some(shift=>!SHIFTS.includes(shift)||!validStates.has(entry[shift]))) throw Error("not-backup");
  }
  if(data.schemaVersion===2 &&
     (!data.monthlyPolicies || typeof data.monthlyPolicies!=="object" ||
      Array.isArray(data.monthlyPolicies) || !Array.isArray(data.audit))) throw Error("not-backup");
  return {
    records:sanitizeRecords(data.records),
    settings:sanitizeSettings(data.settings),
    monthlyPolicies:sanitizeMonthlyPolicies(data.monthlyPolicies),
    audit:sanitizeAudit(data.audit)
  };
}

export const ARCHIVE_KEY = "shift-planner-archive-v2";
export const ARCHIVE_FALLBACK_KEY = "shift-planner-archive-fallback-v2";
export function periodKey(year,monthIndex) {
  return String(year) + "-" + pad(monthIndex+1);
}
export function validPeriodKey(key) {
  return typeof key === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(key)
    && Number(key.slice(0,4)) >= 1900 && Number(key.slice(0,4)) <= 2200;
}
export function sanitizeMonthlyPolicies(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result = {};
  for(const [key,value] of Object.entries(raw)) {
    if(!validPeriodKey(key) || !value || typeof value !== "object" || Array.isArray(value)) continue;
    if(!Number.isFinite(Number(value.shiftRate)) || !Number.isFinite(Number(value.payslipCap)) ||
       Number(value.shiftRate)<0 || Number(value.payslipCap)<0) continue;
    const normalized = sanitizeSettings(value);
    result[key] = {shiftRate:normalized.shiftRate,payslipCap:normalized.payslipCap};
  }
  return result;
}
export function monthlyHistory(records,policies={},settings=DEFAULT_SETTINGS) {
  const r = sanitizeRecords(records);
  const safePolicies = sanitizeMonthlyPolicies(policies);
  const months = [...new Set([
    ...Object.keys(r).map(key=>key.slice(0,7)),
    ...Object.keys(safePolicies)
  ])].sort().reverse();
  return months.map(key=>{
    const [year,month] = key.split("-").map(Number);
    const stats = monthStats(r,year,month-1);
    const policy = safePolicies[key] || settings;
    return {key,year,month,stats,pay:payrollForMonth(stats.work,policy)};
  });
}
export function sanitizeAudit(raw) {
  if(!Array.isArray(raw)) return [];
  const events = [], ids = new Set();
  for(const event of raw) {
    if(!event || typeof event !== "object" || Array.isArray(event)) continue;
    if(typeof event.id!=="string" || event.id.length>100 || !event.id ||
       typeof event.at!=="string" || !/^\d{4}-\d{2}-\d{2}T/.test(event.at) ||
       !["shift","settings","import"].includes(event.type) || ids.has(event.id)) continue;
    ids.add(event.id);
    events.push({
      id:event.id,
      at:event.at.slice(0,36),
      type:event.type,
      period:validPeriodKey(event.period)?event.period:"",
      detail:typeof event.detail==="string" ? event.detail.slice(0,250) : ""
    });
  }
  return events;
}
export function mergeHistory(existingRecords,importedRecords,existingPolicies={},importedPolicies={}) {
  const current = sanitizeRecords(existingRecords), incoming = sanitizeRecords(importedRecords);
  const records = { ...incoming };
  let conflicts = 0;
  for(const [day,entry] of Object.entries(current)){
    const imported = { ...(records[day] || {}) };
    for(const shift of SHIFTS){
      if(entry[shift]!==undefined){
        if(imported[shift]!==undefined && imported[shift]!==entry[shift]) conflicts++;
        imported[shift]=entry[shift];
      }
    }
    records[day] = imported;
  }
  return {
    records,
    monthlyPolicies: { ...sanitizeMonthlyPolicies(importedPolicies), ...sanitizeMonthlyPolicies(existingPolicies) },
    conflicts
  };
}
