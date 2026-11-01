import { normalizeLanguage } from "./language-config.mjs";
export const SHIFTS = ["morning", "evening"];
export const DEFAULT_TIMES = Object.freeze({
 morning:Object.freeze({start:"10:00",end:"14:00"}),
 evening:Object.freeze({start:"18:00",end:"22:00"})
});
export const DEFAULT_SETTINGS = { language:"fr",theme:"light",weekStart:1,morningName:"",eveningName:"",
 shiftRate:40,hourlyRate:10,payMode:"shift",payslipCap:711,paymentMode:"split",
 defaultTimes:DEFAULT_TIMES,useDefaultTimes:true };
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
    const timings = sanitizeTimings(entry.timings);
    if(Object.keys(timings).length) clean.timings=timings;
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
    language: normalizeLanguage(x.language),
    theme: ["light","dark"].includes(x.theme) ? x.theme : DEFAULT_SETTINGS.theme,
    weekStart: [0,1,6].includes(Number(x.weekStart)) ? Number(x.weekStart) : 1,
    // Legacy label fields are retained for lossless backup round-trips, not used by the UI.
    morningName: typeof x.morningName === "string" ? x.morningName.trim().slice(0,25) : "",
    eveningName: typeof x.eveningName === "string" ? x.eveningName.trim().slice(0,25) : "",
    shiftRate: validMoney(x.shiftRate, DEFAULT_SETTINGS.shiftRate),
    hourlyRate: validMoney(x.hourlyRate, DEFAULT_SETTINGS.hourlyRate),
    payMode: x.payMode === "hourly" ? "hourly" : "shift",
    payslipCap: validMoney(x.payslipCap, DEFAULT_SETTINGS.payslipCap),
    paymentMode:x.paymentMode==="single"?"single":"split",
    defaultTimes:sanitizeDefaultTimes(x.defaultTimes),
    useDefaultTimes:x.useDefaultTimes!==false
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
export function splitPayment(totalCents, inputSettings=DEFAULT_SETTINGS){
 const settings=sanitizeSettings(inputSettings);
 const single=settings.paymentMode==="single";
 const capCents=single?null:Math.round(settings.payslipCap*100);
 const payslipCents=single?totalCents:Math.min(totalCents,capCents);
 const envelopeCents=single?0:totalCents-payslipCents;
 const progressPercent=single?0:capCents===0?(totalCents>0?100:0):Math.min(100,payslipCents/capCents*100);
 return {paymentMode:settings.paymentMode,capCents,totalCents,payslipCents,envelopeCents,progressPercent};
}
export function payrollForMonth(workedShifts, inputSettings = DEFAULT_SETTINGS) {
 const settings=sanitizeSettings(inputSettings);
 const shifts=Number.isSafeInteger(workedShifts)&&workedShifts>=0?workedShifts:0;
 const rateCents=Math.round(settings.shiftRate*100);
 return {shifts,rateCents,...splitPayment(shifts*rateCents,settings)};
}

export function makeBackup(records,settings,monthlyPolicies={},audit=[]) {
  return {
    app:"ShiftPlanner", schemaVersion:5, exportedAt:new Date().toISOString(),
    records:sanitizeRecords(records), settings:sanitizeSettings(settings),
    monthlyPolicies:sanitizeMonthlyPolicies(monthlyPolicies), audit:sanitizeAudit(audit)
  };
}
export function parseBackup(text) {
  let data;
  try { data=JSON.parse(text); } catch { throw Error("not-json"); }
  if (!data || data.app!=="ShiftPlanner" || ![1,2,3,4,5].includes(data.schemaVersion) ||
      !data.records || typeof data.records!=="object" || Array.isArray(data.records)) {
    throw Error("not-backup");
  }
  for(const [key, entry] of Object.entries(data.records)){
    if(!validDateKey(key) || !entry || typeof entry!=="object" || Array.isArray(entry)) throw Error("not-backup");
    for(const field of Object.keys(entry)){
      if(field==="timings" && data.schemaVersion>=3){
        if(!validTimingMap(entry.timings)) throw Error("not-backup");
      }else if(!SHIFTS.includes(field)||!validStates.has(entry[field])) throw Error("not-backup");
    }
  }
  if(data.schemaVersion>=2 &&
     (!data.monthlyPolicies || typeof data.monthlyPolicies!=="object" ||
      Array.isArray(data.monthlyPolicies) || !Array.isArray(data.audit))) throw Error("not-backup");
  return {
    records:sanitizeRecords(data.records),
    settings:sanitizeSettings({...data.settings,useDefaultTimes:data.schemaVersion<4&&data.settings?.payMode==="hourly"?false:data.settings?.useDefaultTimes}),
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
    // Older policies did not have fallback hours. Preserve their historical totals.
    const normalized=sanitizeSettings({...value,useDefaultTimes:
      typeof value.useDefaultTimes==="boolean"?value.useDefaultTimes:!!value.defaultTimes});
    result[key] = payPolicy(normalized);
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
  const analysis=timingAnalysis(r,safePolicies,settings);
  return months.map(key=>{
    const [year,month] = key.split("-").map(Number);
    const stats = monthStats(r,year,month-1);
    const policy = policyForPeriod(key,safePolicies,settings);
    return {key,year,month,stats,pay:calculatePayroll(r,year,month-1,policy,analysis)};
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
    const timings={...(imported.timings||{})};
    for(const shift of SHIFTS){
      const ownTiming=entry.timings?.[shift];
      if(entry[shift]!==undefined){
        if(imported[shift]!==undefined && imported[shift]!==entry[shift]){
          conflicts++;
          // Never pair an imported time range with a conflicting status.
          delete timings[shift];
        }
        imported[shift]=entry[shift];
      }
      if(ownTiming){
        if(timings[shift] && JSON.stringify(timings[shift])!==JSON.stringify(ownTiming)) conflicts++;
        // A time range is atomic: never combine starts and ends from different backups.
        timings[shift]={...ownTiming};
      }
    }
    if(Object.keys(timings).length) imported.timings=timings;
    else delete imported.timings;
    records[day] = imported;
  }
  return {
    records,
    monthlyPolicies: { ...sanitizeMonthlyPolicies(importedPolicies), ...sanitizeMonthlyPolicies(existingPolicies) },
    conflicts
  };
}


// Hourly pay uses integer minutes and integer cents; round once per month.
export function payPolicy(value=DEFAULT_SETTINGS){
 const clean=sanitizeSettings(value);
 return {payMode:clean.payMode,shiftRate:clean.shiftRate,hourlyRate:clean.hourlyRate,
  payslipCap:clean.payslipCap,paymentMode:clean.paymentMode,
  defaultTimes:sanitizeDefaultTimes(clean.defaultTimes),useDefaultTimes:clean.useDefaultTimes};
}
// Calculation and payment modes are global preferences. A saved month owns its
// rates and time defaults, never the switches selected in Settings. Keep stored
// snapshots intact: explicit times/rates can still be inspected and exported.
export function policyForPeriod(key,monthlyPolicies={},globalSettings=DEFAULT_SETTINGS){
 const global=payPolicy(globalSettings);
 const saved=validPeriodKey(key)&&monthlyPolicies&&Object.hasOwn(monthlyPolicies,key)?monthlyPolicies[key]:null;
 const values=payPolicy(saved||globalSettings);
 return {...values,payMode:global.payMode,paymentMode:global.paymentMode};
}
export function validClock(value){
 return typeof value==="string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function sanitizeDefaultTimes(value){
 const clean={};
 for(const shift of SHIFTS){
  const range=value?.[shift];
  clean[shift]={start:validClock(range?.start)?range.start:DEFAULT_TIMES[shift].start,
   end:validClock(range?.end)?range.end:DEFAULT_TIMES[shift].end};
 }
 return clean;
}
export function validDefaultSchedule(value){
 if(!value||SHIFTS.some(shift=>!validClock(value[shift]?.start)||!validClock(value[shift]?.end)))return false;
 const a=timeRangeDetails(value.morning),b=timeRangeDetails(value.evening);
 if(a.state!=="ready"||b.state!=="ready")return false;
 // A recurring default schedule cannot overlap itself on neighbouring dates.
 return [-1440,0,1440].every(offset=>a.end<=b.start+offset||b.end+offset<=a.start);
}
export function effectiveTiming(records,key,shift,inputPolicy=DEFAULT_SETTINGS){
 const policy=payPolicy(inputPolicy),own=getTiming(records,key,shift);
 const fallback=policy.useDefaultTimes?policy.defaultTimes[shift]:{start:"",end:""};
 const start=own.start||fallback?.start||"",end=own.end||fallback?.end||"";
 // New default-aware months infer overnight. Old manual-only months keep their
 // explicit overnight bit so updating the app cannot rewrite historical wages.
 const nextDay=policy.useDefaultTimes?!!(start&&end&&end<start):own.nextDay;
 return {start,end,nextDay};
}
export function resetTiming(records,key,shift){
 if(!validDateKey(key)||!SHIFTS.includes(shift))throw Error("invalid-time");
 const entry={...(records[key]||{})},timings={...(entry.timings||{})};
 delete timings[shift];
 if(Object.keys(timings).length)entry.timings=timings;else delete entry.timings;
 const result={...records};
 if(Object.keys(entry).length)result[key]=entry;else delete result[key];
 return result;
}
function validTimingMap(value){
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 return Object.entries(value).every(([shift,range])=>SHIFTS.includes(shift)&&
   range&&typeof range==="object"&&!Array.isArray(range)&&
   Object.entries(range).every(([field,v])=>
    (field==="start"||field==="end") ? (v===""||validClock(v)) : field==="nextDay"&&typeof v==="boolean"));
}
export function sanitizeTimings(value){
 const result={};
 if(!value||typeof value!=="object"||Array.isArray(value))return result;
 for(const shift of SHIFTS){
  const r=value[shift];
  if(!r||typeof r!=="object"||Array.isArray(r))continue;
  const start=validClock(r.start)?r.start:"",end=validClock(r.end)?r.end:"";
  if(start||end||r.nextDay===true) result[shift]={start,end,nextDay:r.nextDay===true};
 }
 return result;
}
export function getTiming(records,key,shift){
 const timing=sanitizeTimings(records?.[key]?.timings)[shift];
 return timing?{...timing}:{start:"",end:"",nextDay:false};
}
export function updateTiming(records,key,shift,patch){
 if(!validDateKey(key)||!SHIFTS.includes(shift)||!patch||typeof patch!=="object"||Array.isArray(patch))throw Error("invalid-time");
 if(Object.entries(patch).some(([k,v])=>
    (k==="start"||k==="end")?!(v===""||validClock(v)):k!=="nextDay"||typeof v!=="boolean"))throw Error("invalid-time");
 const range={...getTiming(records,key,shift),...patch};
 const entry={...(records[key]||{})};
 const timings={...(entry.timings||{})};
 if(!range.start&&!range.end&&!range.nextDay)delete timings[shift];
 else timings[shift]=range;
 if(Object.keys(timings).length)entry.timings=timings;
 else delete entry.timings;
 const result={...records};
 if(Object.keys(entry).length)result[key]=entry;
 else delete result[key];
 return result;
}
export function timeRangeDetails(range){
 if(!validClock(range?.start)||!validClock(range?.end))return {state:"missing",minutes:0};
 const parse=v=>Number(v.slice(0,2))*60+Number(v.slice(3));
 const overnight=typeof range.nextDay==="boolean"?range.nextDay:range.end<range.start;
 const start=parse(range.start),end=parse(range.end)+(overnight?1440:0);
 const minutes=end-start;
 // Infer overnight when no legacy flag exists. Equal times never mean 24 hours.
 if(minutes<=0||minutes>=1440)return {state:"invalid",minutes:0,start,end};
 return {state:"ready",minutes,start,end};
}
export function timingAnalysis(records,policies=null,fallbackPolicy=DEFAULT_SETTINGS){
 const details={},intervals=[];
 for(const [key,entry] of Object.entries(records)){
  if(!validDateKey(key))continue;
  const [y,m,d]=key.split("-").map(Number);
  const base=Date.UTC(y,m-1,d)/60000;
  const policy=policies===null?null:policyForPeriod(key.slice(0,7),policies,fallbackPolicy);
  for(const shift of SHIFTS){
   const id=key+":"+shift;
   if(getStatus(records,key,shift)!=="work"||(policy&&policy.payMode!=="hourly")){
    details[id]={state:"inactive",minutes:0};continue;
   }
   const detail=timeRangeDetails(policy?effectiveTiming(records,key,shift,policy):entry.timings?.[shift]);
   details[id]=detail;
   if(detail.state==="ready")intervals.push({id,start:base+detail.start,end:base+detail.end});
  }
 }
 intervals.sort((a,b)=>a.start-b.start);
 // Compare only intervals still active: an end exactly equal to the next start is valid.
 let active=[];
 for(const interval of intervals){
  active=active.filter(old=>old.end>interval.start);
  for(const old of active){
   details[old.id]={...details[old.id],state:"overlap",minutes:0};
   details[interval.id]={...details[interval.id],state:"overlap",minutes:0};
  }
  active.push(interval);
 }
 return details;
}
export function calculatePayroll(records,year,month,inputPolicy=DEFAULT_SETTINGS,analysis=null){
 const policy=payPolicy(inputPolicy),stats=monthStats(records,year,month);
 if(policy.payMode==="shift")return {...payrollForMonth(stats.work,policy),mode:"shift",minutes:0,paidShifts:stats.work,pendingShifts:0};
 const details=analysis||timingAnalysis(records,{[periodKey(year,month)]:policy},policy);
 let minutes=0,paidShifts=0,pendingShifts=0;
 const prefix=periodKey(year,month);
 for(const [key,entry] of Object.entries(records)){
  if(!validDateKey(key)||key.slice(0,7)!==prefix)continue;
  for(const shift of SHIFTS){
   if(getStatus(records,key,shift)!=="work")continue;
   const range=details[key+":"+shift];
   if(range?.state==="ready"){minutes+=range.minutes;paidShifts++;}
   else pendingShifts++;
  }
 }
 const rateCents=Math.round(policy.hourlyRate*100);
 const totalCents=Math.round(minutes*rateCents/60);
 return {mode:"hourly",shifts:stats.work,minutes,paidShifts,pendingShifts,rateCents,...splitPayment(totalCents,policy)};
}
