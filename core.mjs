// Planning Équipe - independent employer data model.
export const STORAGE_KEY="planning-equipe-v1";
export const BACKUP_SLOT_KEY="planning-equipe-v1-previous";
export const DEFAULT_SETTINGS=Object.freeze({language:"fr",theme:"light",weekStart:1});
export const DEFAULT_RATE=40,DEFAULT_CAP=711;
export const SHIFTS=Object.freeze(["morning","evening"]);
const allowedStatuses=new Set(["work","off"]);
const currencies={fr:"fr-FR",en:"en-GB",zh:"zh-CN"};
export const pad=n=>String(n).padStart(2,"0");
export const dayKey=(year,month,day)=>year+"-"+pad(month+1)+"-"+pad(day);
export const periodKey=(year,month)=>year+"-"+pad(month+1);
export function validDayKey(key){
 if(typeof key!=="string"||!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(key))return false;
 const [y,m,d]=key.split("-").map(Number);
 if(y<1900||y>2200)return false;
 const test=new Date(Date.UTC(y,m-1,d));
 return test.getUTCFullYear()===y&&test.getUTCMonth()===m-1&&test.getUTCDate()===d;
}
export function validPeriodKey(key){
 return typeof key==="string"&&/^\d{4}-(0[1-9]|1[0-2])$/.test(key)&&
 Number(key.slice(0,4))>=1900&&Number(key.slice(0,4))<=2200;
}
export function money(value,fallback){
 if(value===null||value===undefined||value==="")return fallback;
 const raw=typeof value==="string"?value.trim().replace(",","."):value;
 const n=Number(raw);
 return Number.isFinite(n)&&n>=0&&n<=100000?Math.round(n*100)/100:fallback;
}
export function sanitizeSettings(v){
 const obj=v&&typeof v==="object"&&!Array.isArray(v)?v:{};
 return {
  language:["fr","en","zh"].includes(obj.language)?obj.language:"fr",
  theme:["light","dark"].includes(obj.theme)?obj.theme:"light",
  weekStart:[0,1,6].includes(Number(obj.weekStart))?Number(obj.weekStart):1
 };
}
export function sanitizeShifts(raw){
 const out={};
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return out;
 for(const [key,row] of Object.entries(raw)){
  if(!validDayKey(key)||!row||typeof row!=="object"||Array.isArray(row))continue;
  const value={};
  for(const shift of SHIFTS)if(allowedStatuses.has(row[shift]))value[shift]=row[shift];
  if(Object.keys(value).length)out[key]=value;
 }
 return out;
}
export function sanitizePolicies(raw){
 const out={};
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return out;
 for(const [key,value] of Object.entries(raw)){
  if(!validPeriodKey(key)||!value||typeof value!=="object"||Array.isArray(value))continue;
  if(money(value.rate,null)===null||money(value.cap,null)===null)continue;
  out[key]={rate:money(value.rate,DEFAULT_RATE),cap:money(value.cap,DEFAULT_CAP)};
 }
 return out;
}
function validPhoto(value){
 return typeof value==="string"&&value.length<250000&&/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(value)?value:"";
}
export function sanitizeEmployee(row){
 if(!row||typeof row!=="object"||Array.isArray(row))return null;
 if(typeof row.id!=="string"||!/^[a-zA-Z0-9_-]{8,64}$/.test(row.id))return null;
 const name=typeof row.name==="string"?row.name.trim().slice(0,65):"";
 if(!name)return null;
 const shifts=sanitizeShifts(row.shifts);
 const rate=money(row.rate,DEFAULT_RATE),cap=money(row.cap,DEFAULT_CAP);
 const policies=sanitizePolicies(row.policies);
 for(const day of Object.keys(shifts)){
  const key=day.slice(0,7);
  if(!policies[key])policies[key]={rate,cap};
 }
 const createdAt=typeof row.createdAt==="string"&&!Number.isNaN(Date.parse(row.createdAt))?
   row.createdAt:new Date().toISOString();
 const joinedDate=new Date(createdAt);
 const createdMonth=periodKey(joinedDate.getFullYear(),joinedDate.getMonth());
 // Migration: pre-existing recorded months must remain visible even if an older
 // version allowed entering shifts retroactively before the employee was created.
 const historicMonths=[...Object.keys(shifts).map(key=>key.slice(0,7)),...Object.keys(policies)]
  .filter(validPeriodKey);
 const inferredStart=historicMonths.reduce((oldest,key)=>key<oldest?key:oldest,createdMonth);
 const joinedMonth=validPeriodKey(row.joinedMonth)?row.joinedMonth:inferredStart;
 return {id:row.id,name,photo:validPhoto(row.photo),rate,cap,
  archived:row.archived===true,joinedMonth,
  inactiveFrom:validPeriodKey(row.inactiveFrom)?row.inactiveFrom:"",
  shifts,policies,createdAt};
}
export function sanitizeData(raw){
 const obj=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};
 const list=Array.isArray(obj.employees)?obj.employees:[];
 const ids=new Set(),employees=[];
 for(const candidate of list){
  const employee=sanitizeEmployee(candidate);
  if(employee&&!ids.has(employee.id)){ids.add(employee.id);employees.push(employee);}
 }
 return {
  schema:1,settings:sanitizeSettings(obj.settings),employees,
  audit:Array.isArray(obj.audit)?obj.audit.filter(x=>x&&typeof x==="object"&&typeof x.at==="string"&&
   typeof x.type==="string"&&typeof x.employeeId==="string").map(x=>({
    at:String(x.at).slice(0,36),type:String(x.type).slice(0,25),
    employeeId:String(x.employeeId).slice(0,64),description:String(x.description||"").slice(0,200)
   })):[]
 };
}
export function employeeVisibleInMonth(employee,year,month){
 if(!employee||employee.archived===true)return false;
 const period=periodKey(year,month);
 const start=validPeriodKey(employee.joinedMonth)?employee.joinedMonth:"1900-01";
 return period>=start&&(!employee.inactiveFrom||period<employee.inactiveFrom);
}
export function nextPeriodKey(current){
 if(!validPeriodKey(current))throw Error("Invalid month");
 const year=Number(current.slice(0,4)),month=Number(current.slice(5,7));
 const next=new Date(year,month,15,12);
 return periodKey(next.getFullYear(),next.getMonth());
}
export function retireEmployeeFrom(employee,lastMonth){
 if(!employee||!validPeriodKey(lastMonth))throw Error("Invalid removal month");
 if(validPeriodKey(employee.joinedMonth)&&lastMonth<employee.joinedMonth)
  throw Error("Removal cannot precede joining month");
 if(employee.inactiveFrom)return employee;
 // The last month IS INCLUDED in history. The first excluded month is next month.
 const inactiveFrom=nextPeriodKey(lastMonth);
 // Preserve all recorded details and rate policies. No retroactive deletion.
 return {...employee,inactiveFrom,archived:false};
}
export const emptyData=()=>sanitizeData({});
export function newEmployee({id,name,photo="",rate=DEFAULT_RATE,cap=DEFAULT_CAP}){
 const now=new Date();
 return sanitizeEmployee({id,name,photo,rate,cap,shifts:{},policies:{},
  joinedMonth:periodKey(now.getFullYear(),now.getMonth()),
  archived:false,createdAt:now.toISOString()});
}
export function getShift(employee,key,shift){
 if(!SHIFTS.includes(shift)||!validDayKey(key))return "unset";
 const value=employee?.shifts?.[key]?.[shift];
 return allowedStatuses.has(value)?value:"unset";
}
export function monthLength(year,month){return new Date(year,month+1,0).getDate();}
export function calendarCells(year,month,weekStart=1){
 const first=(new Date(year,month,1).getDay()-weekStart+7)%7;
 const days=monthLength(year,month),length=Math.max(35,Math.ceil((first+days)/7)*7);
 return Array.from({length},(_,i)=>{
  const day=i-first+1;
  return day>=1&&day<=days?{day,key:dayKey(year,month,day)}:null;
 });
}
export function monthStats(employee,year,month){
 let work=0,off=0,unset=0;
 const totalDays=monthLength(year,month);
 for(let day=1;day<=totalDays;day++){
  const key=dayKey(year,month,day);
  for(const shift of SHIFTS){
   const st=getShift(employee,key,shift);
   if(st==="work")work++;else if(st==="off")off++;else unset++;
  }
 }
 return {work,off,unset,days:work/2,totalDays};
}
export function employeePolicy(employee,year,month){
 return employee.policies?.[periodKey(year,month)]||{rate:employee.rate,cap:employee.cap};
}
export function payroll(employee,year,month){
 const stats=monthStats(employee,year,month);
 const policy=employeePolicy(employee,year,month);
 const totalCents=stats.work*Math.round(policy.rate*100);
 const capCents=Math.round(policy.cap*100);
 const payslipCents=Math.min(totalCents,capCents);
 return {...stats,rate:policy.rate,cap:policy.cap,totalCents,payslipCents,envelopeCents:totalCents-payslipCents};
}
export function employerTotals(data,year,month){
 const sums={employees:0,work:0,days:0,totalCents:0,payslipCents:0,envelopeCents:0};
 for(const e of data.employees){
  if(!employeeVisibleInMonth(e,year,month))continue;
  const p=payroll(e,year,month);
  sums.employees++;sums.work+=p.work;sums.days+=p.days;
  sums.totalCents+=p.totalCents;sums.payslipCents+=p.payslipCents;
  sums.envelopeCents+=p.envelopeCents;
 }
 return sums;
}
export function updateShifts(employee,key,updates){
 if(!validDayKey(key))throw Error("Invalid date");
 if(employee.inactiveFrom)throw Error("Employment history is read-only");
 if(validPeriodKey(employee.joinedMonth)&&key.slice(0,7)<employee.joinedMonth)
  throw Error("Cannot record shifts before employee joined");
 const next={...employee,shifts:{...employee.shifts},policies:{...employee.policies}};
 const row={...(next.shifts[key]||{})};
 let changed=false;
 for(const shift of SHIFTS){
  if(!(shift in updates))continue;
  const status=updates[shift];
  if(!["work","off","unset"].includes(status))throw Error("Invalid status");
  const old=getShift(employee,key,shift);
  if(old===status)continue;
  changed=true;
  if(status==="unset")delete row[shift];else row[shift]=status;
 }
 if(!changed)return employee;
 if(Object.keys(row).length)next.shifts[key]=row;
 else delete next.shifts[key];
 const month=key.slice(0,7);
 if(!next.policies[month])next.policies[month]={...employeePolicy(employee,Number(month.slice(0,4)),Number(month.slice(5,7))-1)};
 return next;
}
export function updatePolicy(employee,year,month,rate,cap){
 if(employee.inactiveFrom)throw Error("Employment history is read-only");
 if(validPeriodKey(employee.joinedMonth)&&periodKey(year,month)<employee.joinedMonth)
  throw Error("Cannot change pay before employee joined");
 const policy={rate:money(rate,null),cap:money(cap,null)};
 if(policy.rate===null||policy.cap===null)throw Error("Invalid money");
 return {...employee,rate:policy.rate,cap:policy.cap,
  policies:{...employee.policies,[periodKey(year,month)]:policy}};
}
export function salaryDisplay(cents,language="fr"){
 return new Intl.NumberFormat(currencies[language]||"fr-FR",{
  style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2
 }).format(cents/100);
}
// Explicit, second-stage hard deletion. Never call during ordinary team removal.
export function permanentlyDeleteEmployee(raw,id){
 const data=sanitizeData(raw);
 if(typeof id!=="string")return {data,deleted:false};
 const target=data.employees.find(employee=>employee.id===id);
 if(!target || !target.inactiveFrom)return {data,deleted:false};
 return {
  deleted:true,
  data:{
   ...data,
   // Removing the full object also removes photos, shift records and per-month pay rules.
   employees:data.employees.filter(employee=>employee.id!==id),
   // Erase internal change history for this person, not the other employees.
   audit:data.audit.filter(event=>event.employeeId!==id)
  }
 };
}
export function makeBackup(data){return {...sanitizeData(data),app:"PlanningEquipe",exportedAt:new Date().toISOString()};}
export function restoreBackup(text){
 let value;try{value=JSON.parse(text);}catch{throw Error("Invalid JSON");}
 if(!value||value.app!=="PlanningEquipe"||value.schema!==1||!Array.isArray(value.employees))throw Error("Invalid backup");
 return sanitizeData(value);
}
export function mergeBackup(current,backup){
 const data=sanitizeData(current),incoming=sanitizeData(backup);
 const ids=new Set(data.employees.map(e=>e.id));
 let added=0;
 for(const e of incoming.employees)if(!ids.has(e.id)){data.employees.push(e);ids.add(e.id);added++;}
 data.audit.push(...incoming.audit.filter(x=>!data.audit.some(y=>y.at===x.at&&y.description===x.description&&y.employeeId===x.employeeId)));
 return {data,added};
}

