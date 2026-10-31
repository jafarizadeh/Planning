import {
 STORAGE_KEY,BACKUP_SLOT_KEY,DEFAULT_SETTINGS,DEFAULT_RATE,DEFAULT_CAP,
 SHIFTS,emptyData,sanitizeData,sanitizeEmployee,newEmployee,
 getShift,monthStats,payroll,employerTotals,updateShifts,updatePolicy,
 salaryDisplay,calendarCells,dayKey,periodKey,makeBackup,restoreBackup,mergeBackup,
 employeeVisibleInMonth,retireEmployeeFrom,permanentlyDeleteEmployee
} from "./core.mjs";
import {createStorage} from "./storage.mjs";
import {translations,dateLocales,tr} from "./translations.mjs";
const $=id=>document.getElementById(id);
const storage=createStorage({onWarning:()=>notify(t("storageWarning"))});
let data=storage.getData();
let route="team",selectedId=null,modalId=null,pendingPhoto="",selectedDay=null;
let currentEnvelopeId=null,toastTimer=null,modalHasUpload=false;
const now=new Date();
let year=now.getFullYear(),month=now.getMonth();
const locale=()=>dateLocales[data.settings.language]||"fr-FR";
const t=key=>tr(data.settings.language,key);
const format=amount=>salaryDisplay(amount,data.settings.language);
const number=n=>new Intl.NumberFormat(locale(),{maximumFractionDigits:1}).format(n);
const escapeHTML=value=>String(value).replace(/[&<>"']/g,ch=>({
 "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));
const dateText=date=>new Intl.DateTimeFormat(locale(),{day:"numeric",month:"short",year:"numeric"}).format(date);
const monthText=()=>new Intl.DateTimeFormat(locale(),{month:"long",year:"numeric"}).format(new Date(year,month,15,12));
function findEmployee(id){return data.employees.find(e=>e.id===id);}
function generatedId(){
 if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
 return "emp_"+Date.now()+"_"+Math.random().toString(36).slice(2,13);
}
function recordAudit(type,employeeId,description){
 return {at:new Date().toISOString(),type,employeeId,description};
}
function saveData(next){
 data=storage.save(next);
 return data;
}
function mutateEmployee(id,transform,type="edit",description=""){
 const employees=data.employees.map(e=>e.id===id?transform(e):e);
 if(!employees.some(e=>e.id===id))return false;
 saveData({...data,employees,audit:[...data.audit,recordAudit(type,id,description)]});
 return true;
}
async function removeEmployeeFromCurrentMonth(id){
 const employee=findEmployee(id);
 if(!employee||employee.inactiveFrom)return;
 // Always use the ACTUAL local calendar month, not a historical month on screen.
 const today=new Date();
 const effectivePeriod=periodKey(today.getFullYear(),today.getMonth());
 const monthLabel=new Intl.DateTimeFormat(locale(),{month:"long",year:"numeric"})
  .format(new Date(today.getFullYear(),today.getMonth(),15,12));
 const confirmation=t("removeFromMonthConfirm")
  .replace("{name}",employee.name).replace("{month}",monthLabel);
 if(!confirm(confirmation))return;
 const employees=data.employees.map(e=>e.id===id?retireEmployeeFrom(e,effectivePeriod):e);
 data=storage.save({...data,employees,audit:[...data.audit,
  recordAudit("retire",id,"Last visible month "+effectivePeriod+"; history preserved")]});
 if(selectedId===id){
  selectedId=null;selectedDay=null;route="team";
  $("shift-root").replaceChildren();
 }
 if(currentEnvelopeId===id)currentEnvelopeId=null;
 closeEmployeeForm();renderAll();
 const saved=await storage.flush();
 notify(saved?t("employeeRemoved"):t("storageWarning"));
}
async function deleteHistoricalEmployeePermanently(id){
 const employee=findEmployee(id);
 // A full wipe must be an explicit action on a retired historical record.
 if(!employee?.inactiveFrom || !employeeVisibleInMonth(employee,year,month))return;
 const warning=t("permanentDeleteWarning").replaceAll("{name}",employee.name);
 if(!confirm(warning))return;
 const result=permanentlyDeleteEmployee(data,id);
 if(!result.deleted)return;
 // Replacing the current record AND purging the previous local snapshot prevents
 // a browser reload from reviving the removed employee.
 data=storage.save(result.data,{purgePrevious:true});
 if(selectedId===id){
  selectedId=null;selectedDay=null;route="team";
  $("shift-root").replaceChildren();
  document.body.style.overflow="";
 }
 if(currentEnvelopeId===id)currentEnvelopeId=null;
 renderAll();
 const saved=await storage.flush();
 notify(saved?t("permanentDeleteSuccess"):t("storageWarning"));
}
const svg={
 gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 14 5.1l2.8-.1.8 2.8L20 9.5l-1.2 2.5 1.2 2.5-2.4 1.7-.8 2.8-2.8-.1L12 21l-2-2.1-2.8.1-.8-2.8L4 14.5 5.2 12 4 9.5l2.4-1.7.8-2.8 2.8.1L12 3Z"/><circle cx="12" cy="12" r="3.1"/></svg>',
 camera:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h4l2-3h6l2 3h4v13H3V7Z"/><circle cx="12" cy="13" r="3.5"/></svg>',
 gallery:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m4 18 5-5 3 3 3-4 6 6"/></svg>',
 previous:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 5-7 7 7 7"/></svg>',
 next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 5 7 7-7 7"/></svg>',
};
function initials(name){
 return String(name).split(/\s+/).slice(0,2).map(s=>[...s][0]||"").join("").toUpperCase();
}
function avatarHTML(emp){
 return emp.photo?'<img src="'+emp.photo+'" alt="'+escapeHTML(emp.name)+'">':
 '<span class="avatar-initials">'+escapeHTML(initials(emp.name))+'</span>';
}
function notify(msg){
 const el=$("toast");
 el.textContent=msg;
 el.classList.add("visible");clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>el.classList.remove("visible"),2100);
}
function setTheme(){
 document.documentElement.dataset.theme=data.settings.theme;
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.content=data.settings.theme==="dark"?"#10151b":"#f5f7fa";
}
function renderStatic(){
 document.documentElement.lang=data.settings.language==="zh"?"zh-Hans":data.settings.language;
 document.documentElement.dir="ltr";
 document.title=t("appTitle");
 for(const el of document.querySelectorAll("[data-i18n]"))el.textContent=t(el.dataset.i18n);
 setTheme();
 $("today-badge").textContent=dateText(new Date());
 $("month-prev").setAttribute("aria-label",t("monthBack"));
 $("month-next").setAttribute("aria-label",t("monthNext"));
 $("detail-month-prev").setAttribute("aria-label",t("monthBack"));
 $("detail-month-next").setAttribute("aria-label",t("monthNext"));
 $("add-employee").setAttribute("aria-label",t("addEmployee"));
 for(const button of document.querySelectorAll("[data-lang]"))
  button.classList.toggle("selected",button.dataset.lang===data.settings.language);
 for(const button of document.querySelectorAll("[data-theme]"))
  button.classList.toggle("selected",button.dataset.theme===data.settings.theme);
 for(const button of document.querySelectorAll("[data-week]"))
  button.classList.toggle("selected",Number(button.dataset.week)===data.settings.weekStart);
}
function employeeHTML(e){
 const pay=payroll(e,year,month);
 const isOpen=currentEnvelopeId===e.id&&pay.envelopeCents>0;
 const ready=pay.envelopeCents>0;
 return '<article class="employee-row '+(isOpen?'envelope-expanded':'')+'" data-id="'+e.id+'">'+
  '<button type="button" class="employee-open" data-action="open" data-id="'+e.id+'" aria-label="'+
  escapeHTML(e.name)+' — '+t("personalCalendar")+'">'+
  '<span class="person-block"><span class="avatar">'+avatarHTML(e)+'</span>'+
  '<strong class="person-name" title="'+escapeHTML(e.name)+'">'+escapeHTML(e.name)+'</strong></span>'+
  '<span class="row-data">'+
  '<span class="row-stat work-stat"><small>'+t("days")+'</small><strong>'+
  number(pay.days)+' '+t("dayUnit")+'</strong></span>'+
  '<span class="row-stat total-stat"><small>'+t("total")+'</small><strong>'+
  format(pay.totalCents)+'</strong></span>'+
  '<span class="row-payslip"><small>'+t("payslip")+'</small>'+
  '<strong>'+format(pay.payslipCents)+'</strong></span></span></button>'+
  '<span class="employee-tools">'+
  '<button type="button" class="envelope-btn '+(ready?'is-ready':'is-locked')+
    (isOpen?' is-open':'')+'" data-action="envelope" data-id="'+e.id+'"'+
    ' aria-expanded="'+isOpen+'" aria-label="'+escapeHTML(t("envelope")+
     (ready?": "+format(pay.envelopeCents):" — "+t("envelopeLocked")))+'">'+
    '<span class="mini-envelope" aria-hidden="true"><span class="mini-envelope-back"></span>'+
    '<span class="mini-note">'+format(pay.envelopeCents)+'</span>'+
    '<span class="mini-envelope-flap"></span><span class="mini-envelope-front"></span></span>'+
    '<span class="blocked-icon" aria-hidden="true">×</span></button>'+
  '</span></article>';
}
function renderDashboard(){
 $("month-title").textContent=monthText();
 $("totals-period").textContent=monthText();
 const active=data.employees.filter(e=>employeeVisibleInMonth(e,year,month));
 $("staff-count").textContent=number(active.length);
 $("employee-list").innerHTML=active.map(employeeHTML).join("");
 $("empty-roster").hidden=active.length!==0;
 $("empty-roster").setAttribute("aria-hidden",String(active.length!==0));
 const totals=employerTotals(data,year,month);
 $("totals-payslip").textContent=format(totals.payslipCents);
 $("totals-envelope").textContent=format(totals.envelopeCents);
 $("totals-all").textContent=format(totals.totalCents);
}
function calendarLamp(status){
 return '<span class="lamp '+status+'" aria-hidden="true">'+
 (status==="work"?"✓":status==="off"?"×":"")+'</span>';
}
function monthLabel(date){
 return new Intl.DateTimeFormat(locale(),{month:"long",year:"numeric"}).format(date);
}
const weekdayShort={fr:["D","L","M","M","J","V","S"],
 en:["Su","Mo","Tu","We","Th","Fr","Sa"],
 zh:["日","一","二","三","四","五","六"]};
function cellHTML(e,day){
 if(!day)return '<span class="day-cell blank" aria-hidden="true"></span>';
 const morning=getShift(e,day.key,"morning"),evening=getShift(e,day.key,"evening");
 const today=new Date();
 const current=day.key===dayKey(today.getFullYear(),today.getMonth(),today.getDate());
 const selected=day.key===selectedDay;
 const aria=day.key+" — "+t("morning")+": "+t(morning==="work"?"worked":morning==="off"?"off":"unset")+
  " — "+t("evening")+": "+t(evening==="work"?"worked":evening==="off"?"off":"unset");
 return '<button type="button" class="day-cell'+(current?" is-today":"")+
  (selected?" is-selected":"")+'" data-day="'+day.key+'"'+
  (current?' aria-current="date"':"")+' aria-label="'+escapeHTML(aria)+'">'+
  '<strong class="number">'+number(day.day)+'</strong>'+
  '<span class="day-lights">'+calendarLamp(morning)+calendarLamp(evening)+'</span></button>';
}
function refreshDetailFinancials(e){
 const p=payroll(e,year,month);
 $("detail-subtitle").textContent=number(p.work)+" "+t("timesWorked");
 $("detail-stats").innerHTML=[
  ["days",number(p.days)+" "+t("dayUnit")],
  ["payslip",format(p.payslipCents)],
  ["envelope",format(p.envelopeCents)]
 ].map(entry=>'<div class="detail-stat"><small>'+t(entry[0])+'</small><strong>'+entry[1]+'</strong></div>').join("");
}
function renderDetail(){
 const e=findEmployee(selectedId);
 if(!employeeVisibleInMonth(e,year,month)){
  selectedId=null;route="team";renderDashboard();updateRoute();return;
 }
 const historical=!!e.inactiveFrom;
 $("detail-settings").hidden=historical;
 $("historical-note").hidden=!historical;
 $("historical-delete").hidden=!historical;
 $("detail-avatar").innerHTML=avatarHTML(e);
 $("detail-name").textContent=e.name;
 refreshDetailFinancials(e);
 $("detail-month-title").textContent=monthText();
 const order=Array.from({length:7},(_,i)=>(data.settings.weekStart+i)%7);
 $("weekdays").innerHTML=order.map(day=>'<span>'+weekdayShort[data.settings.language][day]+'</span>').join("");
 $("calendar-grid").innerHTML=calendarCells(year,month,data.settings.weekStart).map(day=>cellHTML(e,day)).join("");
}
function refreshCalendarCell(key){
 const e=findEmployee(selectedId);
 if(!e)return;
 const button=$("calendar-grid").querySelector('[data-day="'+key+'"]');
 if(!button)return;
 const day=Number(key.slice(-2));
 const holder=document.createElement("div");
 holder.innerHTML=cellHTML(e,{key,day});
 button.replaceWith(holder.firstElementChild);
}
function renderSettings(){
 const archived=data.employees.filter(e=>e.archived);
 $("legacy-archived-panel").hidden=archived.length===0;
 $("archived-list").innerHTML=archived.map(e=>
  '<div class="archived-row"><span>'+escapeHTML(e.name)+'</span>'+
  '<span class="legacy-row-actions"><button data-restore="'+e.id+'" type="button">'+t("restore")+'</button></span></div>'
 ).join("");
}
function renderAll(){
 renderStatic();renderDashboard();renderSettings();
 if(selectedId)renderDetail();
 updateRoute();
}
function updateRoute(){
 for(const [name,id] of [["team","dashboard-view"],["employee","employee-view"],["settings","settings-view"]])
  $(id).hidden=route!==name;
 $("totals-dock").hidden=route!=="team";
 $("bottom-nav").hidden=route==="employee";
 $("nav-team").classList.toggle("active",route==="team");
 $("nav-settings").classList.toggle("active",route==="settings");
}
function showView(view){
 route=view;
 selectedDay=null;
 updateRoute();
 $("main")?.scrollTo?.({top:0});
 document.querySelector(".main").scrollTop=0;
 if(view==="team")renderDashboard();
 else if(view==="employee")renderDetail();
 else if(view==="settings")renderSettings();
}
function changeMonth(delta){
 const next=new Date(year,month+delta,15,12);
 if(next.getFullYear()<1900||next.getFullYear()>2200)return;
 year=next.getFullYear();month=next.getMonth();
 selectedDay=null;currentEnvelopeId=null;
 if(route==="employee"&&!employeeVisibleInMonth(findEmployee(selectedId),year,month)){
  selectedId=null;route="team";updateRoute();renderDashboard();return;
 }
 if(route==="employee")renderDetail();
 else renderDashboard();
}
function updateCalendarToday(){
 const now=new Date();
 const key=dayKey(now.getFullYear(),now.getMonth(),now.getDate());
 $("today-badge").textContent=dateText(now);
 for(const cell of $("calendar-grid").querySelectorAll(".day-cell[data-day]")){
  const current=cell.dataset.day===key;
  cell.classList.toggle("is-today",current);
  if(current)cell.setAttribute("aria-current","date");
  else cell.removeAttribute("aria-current");
 }
}
function bindMainNavigation(){
 $("month-prev").addEventListener("click",()=>changeMonth(-1));
 $("month-next").addEventListener("click",()=>changeMonth(1));
 $("detail-month-prev").addEventListener("click",()=>changeMonth(-1));
 $("detail-month-next").addEventListener("click",()=>changeMonth(1));
 $("add-employee").addEventListener("click",()=>openEmployeeForm());
 $("empty-add").addEventListener("click",()=>openEmployeeForm());
 $("detail-settings").addEventListener("click",()=>openEmployeeForm(selectedId));
 $("historical-delete").addEventListener("click",()=>{
  void deleteHistoricalEmployeePermanently(selectedId);
 });
 $("detail-back").addEventListener("click",()=>showView("team"));
 $("nav-team").addEventListener("click",()=>showView("team"));
 $("nav-settings").addEventListener("click",()=>showView("settings"));
 $("employee-list").addEventListener("click",event=>{
  const button=event.target.closest("button[data-action]");
  if(!button)return;
  const {action,id}=button.dataset;
  if(action==="open"){selectedId=id;showView("employee");}
  else if(action==="envelope")toggleEnvelope(id,button);
 });
 $("calendar-grid").addEventListener("click",event=>{
  const button=event.target.closest("button[data-day]");
  if(!button)return;
  const employee=findEmployee(selectedId);
  if(!employee)return;
  if(employee.inactiveFrom){notify(t("historyReadOnly"));return;}
  selectedDay=button.dataset.day;
  $("calendar-grid").querySelector(".day-cell.is-selected")?.classList.remove("is-selected");
  button.classList.add("is-selected");
  openShiftEditor();
 });
 $("archived-list").addEventListener("click",event=>{
  // Pre-migration archived employees can be reactivated, then retired under the new rules.
  const btn=event.target.closest("[data-restore]");
  if(!btn)return;
  const id=btn.dataset.restore;
  if(!confirm(t("restoreConfirm")))return;
  mutateEmployee(id,e=>({...e,archived:false}),"restore","legacy archived employee restored");
  notify(t("employeeRestored"));renderAll();
 });
 $("language-options").addEventListener("click",event=>{
  const b=event.target.closest("[data-lang]");if(!b)return;
  data.settings.language=b.dataset.lang;saveData(data);renderAll();
 });
 $("theme-options").addEventListener("click",event=>{
  const b=event.target.closest("[data-theme]");if(!b)return;
  data.settings.theme=b.dataset.theme;saveData(data);renderAll();
 });
 $("weekday-options").addEventListener("click",event=>{
  const b=event.target.closest("[data-week]");if(!b)return;
  data.settings.weekStart=Number(b.dataset.week);saveData(data);renderAll();
 });
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)updateCalendarToday();});
 window.addEventListener("pageshow",updateCalendarToday);
}
function toggleEnvelope(id,button){
 const e=findEmployee(id);
 if(!e)return;
 const p=payroll(e,year,month);
 if(p.envelopeCents<=0){
  button.classList.remove("is-shaking");void button.offsetWidth;
  button.classList.add("is-shaking");
  button.addEventListener("animationend",()=>button.classList.remove("is-shaking"),{once:true});
  return;
 }
 currentEnvelopeId=currentEnvelopeId===id?null:id;
 const all=$("employee-list").querySelectorAll(".employee-row");
 for(const row of all){
  const active=row.dataset.id===currentEnvelopeId;
  row.classList.toggle("envelope-expanded",active);
  const envelope=row.querySelector(".envelope-btn");
  envelope.classList.toggle("is-open",active);
  envelope.setAttribute("aria-expanded",String(active));
 }
}
function modalPhoto(name){
 if(pendingPhoto)return '<img src="'+pendingPhoto+'" alt="">';
 return '<span class="avatar-initials">'+escapeHTML(initials(name||"?"))+'</span>';
}
function updatePhotoPreview(){
 const form=$("modal-root").querySelector("#employee-form");
 if(!form)return;
 form.querySelector(".photo-preview").innerHTML=modalPhoto(form.elements.name.value);
 const remove=form.querySelector("#remove-photo");
 if(remove)remove.hidden=!pendingPhoto;
}
function openEmployeeForm(id=null){
 const e=id?findEmployee(id):null;
 if(id&&!e)return;
 if(e?.inactiveFrom){notify(t("historyReadOnly"));return;}
 modalId=id;
 pendingPhoto=e?.photo||"";
 const title=t(e?"editEmployee":"newEmployee");
 const current=e?e.policies?.[periodKey(year,month)]||{rate:e.rate,cap:e.cap}:
  {rate:DEFAULT_RATE,cap:DEFAULT_CAP};
 const root=$("modal-root");
 root.innerHTML='<div class="overlay" id="employee-overlay"><section class="sheet employee-sheet" role="dialog" aria-modal="true" aria-labelledby="employee-sheet-heading">'+
  '<div class="sheet-grabber"></div><div class="sheet-top"><div class="sheet-heading"><h2 id="employee-sheet-heading">'+title+'</h2>'+
  '</div>'+
  '<button type="button" class="sheet-close" data-modal-close aria-label="'+escapeHTML(t("close"))+'">×</button></div>'+
  '<form id="employee-form" autocomplete="off">'+
  '<div class="photo-control"><div class="photo-preview">'+modalPhoto(e?.name||"")+'</div>'+
  '<div class="photo-content"><strong>'+t("photoLabel")+'</strong><div class="photo-action-buttons">'+
  '<button type="button" data-photo-action="camera">'+svg.camera+t("camera")+'</button>'+
  '<button type="button" data-photo-action="gallery">'+svg.gallery+t("gallery")+'</button>'+
  '<button type="button" id="remove-photo" data-photo-action="remove"'+(!pendingPhoto?" hidden":"")+'>'+
  t("removePhoto")+'</button></div></div></div>'+
  '<label class="form-field"><span>'+t("fullName")+'</span>'+
  '<input name="name" maxlength="65" required placeholder="'+escapeHTML(t("namePlaceholder"))+
  '" value="'+escapeHTML(e?.name||"")+'"></label>'+
  '<div class="form-grid"><label class="form-field"><span>'+t("rateLabel")+'</span>'+
  '<span class="money-wrapper"><input name="rate" type="number" min="0" max="100000" step="0.01" inputmode="decimal" value="'+
  Number(current.rate).toFixed(2)+'" required><b>€</b></span></label>'+
  '<label class="form-field"><span>'+t("capLabel")+'</span>'+
  '<span class="money-wrapper"><input name="cap" type="number" min="0" max="100000" step="0.01" inputmode="decimal" value="'+
  Number(current.cap).toFixed(2)+'" required><b>€</b></span></label></div>'+
  '<p class="form-subnote">'+escapeHTML(t("photoOptional"))+'</p>'+
  '<div class="form-buttons"><button type="submit" class="form-save">'+t("save")+'</button>'+
  (e?'<button type="button" id="delete-employee" class="form-delete">'+t("removeFromMonth")+'</button>':"")+
  '</div></form></section></div>';
 document.body.style.overflow="hidden";
 root.querySelector('input[name="name"]').focus({preventScroll:true});
}
function closeEmployeeForm(){
 $("modal-root").replaceChildren();
 document.body.style.overflow="";
 modalId=null;
 pendingPhoto="";
}
function setupEmployeeForm(){
 $("modal-root").addEventListener("click",event=>{
  const el=event.target;
  if(el.id==="employee-overlay"||el.closest("[data-modal-close]")){closeEmployeeForm();return;}
  const photo=el.closest("[data-photo-action]");
  if(photo){
   const action=photo.dataset.photoAction;
   if(action==="remove"){pendingPhoto="";updatePhotoPreview();}
   else $(action==="camera"?"camera-input":"gallery-input").click();
   return;
  }
  if(el.closest("#delete-employee") && modalId){
   void removeEmployeeFromCurrentMonth(modalId);
   return;
  }
 });
 $("modal-root").addEventListener("input",event=>{
  if(event.target.matches('input[name="name"]'))updatePhotoPreview();
 });
 $("modal-root").addEventListener("submit",event=>{
  if(event.target.id!=="employee-form")return;
  event.preventDefault();
  const form=event.target;
  const name=String(form.elements.name.value||"").trim();
  if(!name){notify(t("nameRequired"));return;}
  const rate=Number(form.elements.rate.value);
  const cap=Number(form.elements.cap.value);
  if(!Number.isFinite(rate)||!Number.isFinite(cap)||rate<0||cap<0||rate>100000||cap>100000){
   notify(t("invalidRate"));return;
  }
  if(modalId){
   const id=modalId,employee=findEmployee(id);
   if(!employee)return;
   if(employee.inactiveFrom){notify(t("historyReadOnly"));return;}
   const updated=updatePolicy({...employee,name,photo:pendingPhoto},year,month,rate,cap);
   mutateEmployee(id,()=>updated,"edit","employee details and period policy");
  }else{
   const person=newEmployee({id:generatedId(),name,photo:pendingPhoto,rate,cap});
   if(!person)return;
   saveData({...data,employees:[...data.employees,person],
    audit:[...data.audit,recordAudit("add",person.id,"employee created")]});
   // Show the actual joining month immediately, regardless of which period was open.
   const today=new Date();year=today.getFullYear();month=today.getMonth();
  }
  closeEmployeeForm();renderAll();notify(t("employeeSaved"));
 });
 for(const type of ["camera","gallery"]){
  $(type+"-input").addEventListener("change",async event=>{
   const file=event.target.files?.[0];
   event.target.value="";
   if(!file)return;
   if(file.size>10_000_000){notify(t("photoTooLarge"));return;}
   try{
    pendingPhoto=await convertPhoto(file);
    updatePhotoPreview();
   }catch{notify(t("photoError"));}
  });
 }
}
async function convertPhoto(file){
 if(!file.type.startsWith("image/"))throw Error("Invalid photo");
 const src=URL.createObjectURL(file);
 try{
  const img=await new Promise((resolve,reject)=>{
   const element=new Image();
   element.onload=()=>resolve(element);
   element.onerror=reject;
   element.src=src;
  });
  const canvas=document.createElement("canvas");
  canvas.width=210;canvas.height=235;
  const context=canvas.getContext("2d");
  if(!context)throw Error("Canvas missing");
  context.fillStyle="#f4f7fa";
  context.fillRect(0,0,canvas.width,canvas.height);
  // Center crop: portrait photographs remain consistent in every employee row.
  const scale=Math.max(canvas.width/img.width,canvas.height/img.height);
  const w=img.width*scale,h=img.height*scale;
  context.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  const result=canvas.toDataURL("image/jpeg",.78);
  if(result.length>230000)throw Error("Compressed photo exceeds safe storage size");
  return result;
 }finally{URL.revokeObjectURL(src);}
}
function lampLabel(value){
 return value==="work"?"✓":value==="off"?"×":"";
}
function shiftChoice(employee,key,shift,status){
 const checked=getShift(employee,key,shift)===status;
 return '<button type="button" class="'+status+(checked?" selected":"")+'" data-shift="'+shift+
  '" data-status="'+status+'" aria-checked="'+checked+'" role="radio">'+
  '<span class="lamp '+status+'" aria-hidden="true">'+lampLabel(status)+'</span>'+
  t(status==="work"?"worked":status==="off"?"off":"unset")+'</button>';
}
function quickShiftRow(employee,key,shift){
 return '<div class="quick-shift-group" data-group="'+shift+'">'+
  '<div class="quick-shift-name"><i aria-hidden="true">'+(shift==="morning"?"☀":"☾")+'</i>'+
  t(shift==="morning"?"morning":"evening")+'</div>'+
  '<div class="quick-options" role="radiogroup" aria-label="'+
  t(shift==="morning"?"morning":"evening")+'">'+
  ["work","off","unset"].map(status=>shiftChoice(employee,key,shift,status)).join("")+
  '</div></div>';
}
function quickDateLabel(key){
 const [y,m,d]=key.split("-").map(Number);
 const date=new Date(y,m-1,d,12);
 return new Intl.DateTimeFormat(locale(),{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(date);
}
function openShiftEditor(){
 const e=findEmployee(selectedId);
 if(!e||!selectedDay)return;
 if(e.inactiveFrom){notify(t("historyReadOnly"));return;}
 $("shift-root").innerHTML='<div class="overlay" id="shift-overlay">'+
  '<div class="sheet quick-sheet" role="dialog" aria-modal="true" aria-labelledby="quick-heading">'+
  '<div class="sheet-grabber"></div>'+
  '<div class="quick-top"><div class="quick-title"><span>'+escapeHTML(e.name)+'</span>'+
  '<h2 id="quick-heading">'+t("quickTitle")+'</h2></div>'+
  '<button type="button" class="sheet-close" data-close-shift aria-label="'+t("close")+'">×</button></div>'+
  '<div class="quick-date-navigation">'+
  '<button type="button" data-step="-1" aria-label="'+t("previousDay")+'">'+svg.previous+'</button>'+
  '<div class="quick-date-text"><strong id="quick-date-label">'+quickDateLabel(selectedDay)+'</strong>'+
  '<small>'+t("autoSaved")+'</small></div>'+
  '<button type="button" data-step="1" aria-label="'+t("nextDay")+'">'+svg.next+'</button>'+
  '</div>'+
  '<div id="quick-shifts">'+SHIFTS.map(shift=>quickShiftRow(e,selectedDay,shift)).join("")+'</div>'+
  '<div class="quick-presets"><button type="button" class="work" data-bulk="work">'+
  t("bothWorked")+'</button><button type="button" class="off" data-bulk="off">'+t("bothOff")+
  '</button></div><p class="quick-auto">'+t("autoSaved")+'</p>'+
  '</div></div>';
 document.body.style.overflow="hidden";
}
function refreshQuickDay(){
 if(!selectedDay)return;
 const e=findEmployee(selectedId);
 if(!e)return;
 const root=$("shift-root");
 const dateEl=root.querySelector("#quick-date-label");
 if(!dateEl)return;
 dateEl.textContent=quickDateLabel(selectedDay);
 for(const button of root.querySelectorAll("[data-shift][data-status]")){
  const selected=getShift(e,selectedDay,button.dataset.shift)===button.dataset.status;
  button.classList.toggle("selected",selected);
  button.setAttribute("aria-checked",String(selected));
 }
}
function closeShiftEditor(){
 $("shift-root").replaceChildren();
 $("calendar-grid").querySelector(".day-cell.is-selected")?.classList.remove("is-selected");
 selectedDay=null;
 document.body.style.overflow="";
}
function applyShiftChanges(changes){
 const e=findEmployee(selectedId),key=selectedDay;
 if(!e||!key)return;
 if(e.inactiveFrom){notify(t("historyReadOnly"));return;}
 if(SHIFTS.every(shift=>!(shift in changes)||getShift(e,key,shift)===changes[shift]))return;
 mutateEmployee(e.id,old=>updateShifts(old,key,changes),"shift",key+" "+JSON.stringify(changes));
 refreshCalendarCell(key);
 refreshDetailFinancials(findEmployee(e.id));
 // Dashboard is hidden here; recalculate it only when returning to the roster.
 refreshQuickDay();
}
function moveQuickDay(delta){
 if(!selectedDay)return;
 const [y,m,d]=selectedDay.split("-").map(Number);
 const next=new Date(y,m-1,d+delta,12);
 if(next.getFullYear()<1900||next.getFullYear()>2200)return;
 const old=selectedDay;
 selectedDay=dayKey(next.getFullYear(),next.getMonth(),next.getDate());
 if(next.getFullYear()!==year||next.getMonth()!==month){
  year=next.getFullYear();month=next.getMonth();
  renderDetail();
 }else{
  const calendar=$("calendar-grid");
  calendar.querySelector('[data-day="'+old+'"]')?.classList.remove("is-selected");
  calendar.querySelector('[data-day="'+selectedDay+'"]')?.classList.add("is-selected");
 }
 refreshQuickDay();
}
function setupQuickEditor(){
 $("shift-root").addEventListener("click",event=>{
  if(event.target.id==="shift-overlay"||event.target.closest("[data-close-shift]")){
   closeShiftEditor();return;
  }
  const b=event.target.closest("button");if(!b)return;
  if(b.dataset.step)moveQuickDay(Number(b.dataset.step));
  else if(b.dataset.shift)applyShiftChanges({[b.dataset.shift]:b.dataset.status});
  else if(b.dataset.bulk)applyShiftChanges({morning:b.dataset.bulk,evening:b.dataset.bulk});
 });
 let swipe=null;
 $("shift-root").addEventListener("touchstart",event=>{
  if(!event.target.closest(".quick-date-text"))return;
  const p=event.touches[0];
  if(p)swipe={x:p.clientX,y:p.clientY};
 },{passive:true});
 $("shift-root").addEventListener("touchend",event=>{
  if(!swipe)return;const start=swipe;swipe=null;
  const p=event.changedTouches[0];if(!p)return;
  const dx=p.clientX-start.x,dy=p.clientY-start.y;
  if(Math.abs(dx)>53&&Math.abs(dy)<32)moveQuickDay(dx<0?1:-1);
 },{passive:true});
 document.addEventListener("keydown",event=>{
  if(event.key!=="Escape")return;
  if($("shift-root").firstElementChild){closeShiftEditor();return;}
  if($("modal-root").firstElementChild)closeEmployeeForm();
 });
}
function setupBackups(){
 $("export-backup").addEventListener("click",()=>{
  const backup=makeBackup(data);
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  const n=new Date();
  a.href=url;a.download="planning-equipe-backup-"+dayKey(n.getFullYear(),n.getMonth(),n.getDate())+".json";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
 });
 $("import-backup").addEventListener("click",()=>$("backup-file").click());
 $("backup-file").addEventListener("change",async event=>{
  const file=event.target.files?.[0];event.target.value="";
  if(!file)return;
  try{
   if(file.size>20_000_000)throw Error("Backup too large");
   const restored=restoreBackup(await file.text());
   if(!confirm(t("importConfirm")))return;
   const merged=mergeBackup(data,restored);
   if(data.employees.length===0)merged.data.settings=restored.settings;
   saveData(merged.data);
   renderAll();notify(t("backupImported"));
  }catch{notify(t("importFailed"));}
 });
}
function initialize(){
 bindMainNavigation();
 setupEmployeeForm();
 setupQuickEditor();
 setupBackups();
 renderAll();
 storage.initialize().then(restored=>{
  data=restored;renderAll();
 }).catch(()=>{});
 window.addEventListener("storage",event=>{
  if(event.key===STORAGE_KEY&&event.newValue){
   try{
    const accepted=storage.acceptExternal(JSON.parse(event.newValue));
    if(!accepted)return;
    data=accepted;
    if(selectedId&&!findEmployee(selectedId)){
     selectedId=null;selectedDay=null;route="team";
     $("shift-root").replaceChildren();
     closeEmployeeForm();
    }
    renderAll();
   }catch{}
  }
 });
 document.addEventListener("visibilitychange",()=>{
  if(!document.hidden)updateCalendarToday();
 });
}
initialize();
if("serviceWorker" in navigator && location.protocol!=="file:"){
 navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
}
