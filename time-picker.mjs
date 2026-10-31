// Touch-first 24-hour time wheel; no text entry and no default saved without confirmation.
export function createTimePicker({getText}){
 const root=document.getElementById("time-picker-root");
 let session=null;
 const pad=n=>String(n).padStart(2,"0");
 const esc=x=>String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const itemHeight=44;
 function close(){
  if(!session)return;
  const {trigger,underlying,previousInert}=session;
  session=null;
  root.replaceChildren();
  if(underlying)underlying.inert=previousInert;
  if(trigger?.isConnected)trigger.focus({preventScroll:true});
 }
 function open({value="",label="",trigger,onCommit}){
  close();
  const valid=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const hour=valid?Number(value.slice(0,2)):0;
  const minute=valid?Number(value.slice(3)):0;
  const underlying=document.getElementById("sheet-root");
  session={hour,minute,trigger,onCommit,underlying,previousInert:underlying?.inert||false};
  if(underlying)underlying.inert=true;
  const wheel=(kind,count,selected)=>'<div class="time-wheel-column"><span class="time-wheel-label" id="'+kind+'-wheel-label">'+esc(getText(kind==="hour"?"hourWheel":"minuteWheel"))+'</span><div class="time-wheel-frame"><div class="time-wheel" data-wheel="'+kind+'" role="listbox" tabindex="0" aria-labelledby="'+kind+'-wheel-label" aria-activedescendant="time-'+kind+'-'+selected+'">'+Array.from({length:count},(_,n)=>'<div class="time-wheel-item'+(n===selected?' selected':'')+'" id="time-'+kind+'-'+n+'" role="option" aria-selected="'+(n===selected)+'" data-value="'+n+'">'+pad(n)+'</div>').join("")+'</div><span class="time-wheel-center" aria-hidden="true"></span></div></div>';
  root.innerHTML='<div class="time-picker-overlay"><section class="time-picker-sheet" role="dialog" aria-modal="true" aria-labelledby="time-picker-title">'+
   '<div class="time-picker-grabber"></div><div class="time-picker-heading"><div><span class="time-picker-kicker">'+esc(getText("timeChoose"))+'</span><h2 id="time-picker-title">'+esc(label)+'</h2></div><button type="button" class="time-picker-close" data-picker-action="cancel" aria-label="'+esc(getText("timeCancel"))+'">×</button></div>'+
   '<div class="time-wheels" dir="ltr">'+wheel("hour",24,hour)+'<span class="time-colon" aria-hidden="true">:</span>'+wheel("minute",60,minute)+'</div>'+
   '<p class="time-picker-hint">'+esc(getText("pickerHint"))+'</p><div class="time-picker-actions"><button type="button" data-picker-action="clear" class="time-clear">'+esc(getText("timeClear"))+'</button><button type="button" data-picker-action="apply" class="time-apply">'+esc(getText("timeApply"))+'</button></div></section></div>';
  for(const element of root.querySelectorAll(".time-wheel")){
   const kind=element.dataset.wheel;
   element.scrollTop=session[kind]*itemHeight;
   element.addEventListener("scroll",()=>selectFromScroll(element),{passive:true});
  }
  root.querySelector('.time-wheel[data-wheel="hour"]').focus({preventScroll:true});
 }
 function selectFromScroll(element){
  if(!session)return;
  const kind=element.dataset.wheel;
  const maximum=kind==="hour"?23:59;
  const value=Math.max(0,Math.min(maximum,Math.round(element.scrollTop/itemHeight)));
  session[kind]=value;
  element.setAttribute("aria-activedescendant",'time-'+kind+'-'+value);
  for(const option of element.querySelectorAll("[data-value]")){
   const selected=Number(option.dataset.value)===value;
   option.classList.toggle("selected",selected);
   option.setAttribute("aria-selected",String(selected));
  }
 }
 function choose(element,value){
  const max=element.dataset.wheel==="hour"?23:59;
  const next=Math.max(0,Math.min(max,value));
  // Instant movement keeps the tapped value committed even when Confirm follows immediately.
  element.scrollTop=next*itemHeight;
  selectFromScroll(element);
 }
 root.addEventListener("click",event=>{
  if(!session)return;
  if(event.target.classList.contains("time-picker-overlay")){close();return;}
  const option=event.target.closest(".time-wheel-item");
  if(option){choose(option.closest(".time-wheel"),Number(option.dataset.value));return;}
  const action=event.target.closest("[data-picker-action]")?.dataset.pickerAction;
  if(!action)return;
  if(action==="cancel"){close();return;}
  for(const wheel of root.querySelectorAll(".time-wheel"))selectFromScroll(wheel);
  const callback=session.onCommit;
  const value=action==="clear"?"":pad(session.hour)+":"+pad(session.minute);
  close();callback(value);
 });
 root.addEventListener("keydown",event=>{
  if(!session)return;
  if(event.key==="Escape"){event.preventDefault();event.stopPropagation();close();return;}
  const wheel=event.target.closest(".time-wheel");
  if(wheel&&["ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(event.key)){
   event.preventDefault();
   const value=session[wheel.dataset.wheel];
   choose(wheel,event.key==="Home"?0:event.key==="End"?99:value+({ArrowUp:-1,ArrowDown:1,PageUp:-5,PageDown:5}[event.key]));
  }
  if(event.key==="Tab"){
   const elements=[...root.querySelectorAll('button:not(:disabled),[tabindex="0"]')];
   const index=elements.indexOf(document.activeElement);
   if(event.shiftKey&&index<=0){event.preventDefault();elements.at(-1).focus();}
   else if(!event.shiftKey&&index===elements.length-1){event.preventDefault();elements[0].focus();}
  }
 });
 return {open,close,isOpen:()=>!!session};
}
