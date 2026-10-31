// Accessible iPhone-style selection sheets; native selects remain the form's source of truth.
const LANGUAGES = [
  {value:"de", name:"Deutsch", subtitle:"Deutsch · Deutschland", initials:"DE"},
  {value:"en", name:"English", subtitle:"English · United Kingdom", initials:"EN"},
  {value:"fr", name:"Français", subtitle:"Français · France", initials:"FR"},
  {value:"fa", name:"فارسی", subtitle:"فارسی · ایران", initials:"فا"},
  {value:"es", name:"Español", subtitle:"Español · España", initials:"ES"}
];
const COPY = {
  fa:{close:"بستن",hint:"انتخاب خود را در تنظیمات ذخیره کن",weekHint:"شروع هفته در تقویم",weekDetail:"تقویم از این روز شروع می‌شود"},
  en:{close:"Close",hint:"Save changes in Settings",weekHint:"Calendar week begins here",weekDetail:"Use this as the first day of the week"},
  fr:{close:"Fermer",hint:"Enregistrez votre choix dans les paramètres",weekHint:"Début de la semaine du calendrier",weekDetail:"Premier jour affiché dans le calendrier"},
  de:{close:"Schließen",hint:"Änderungen in den Einstellungen speichern",weekHint:"Beginn der Kalenderwoche",weekDetail:"Erster Tag der Kalenderwoche"},
  es:{close:"Cerrar",hint:"Guarda los cambios en Ajustes",weekHint:"Inicio de la semana del calendario",weekDetail:"Primer día de la semana"}
};
const LOCALES = {fa:"fa-IR",en:"en-GB",fr:"fr-FR",de:"de-DE",es:"es-ES"};
const escapeHTML = value => String(value).replace(/[&<>"']/g,ch=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));

function nativeLanguageName(code,language) {
  try {return new Intl.DisplayNames([LOCALES[language]],{type:"language"}).of(code);}
  catch {return LANGUAGES.find(item=>item.value===code)?.name || code;}
}

export function setupPickers({getText,getLanguage}) {
  const root=document.getElementById("picker-root");
  const elements={
    language:{select:document.getElementById("language-select"),trigger:document.getElementById("language-picker-trigger"),titleKey:"languageLabel"},
    weekstart:{select:document.getElementById("weekstart-select"),trigger:document.getElementById("weekstart-picker-trigger"),titleKey:"weekStarts"}
  };
  let active=null;
  let previousBodyOverflow="";
  function labelFor(type,value) {
    if(type==="language") return LANGUAGES.find(entry=>entry.value===value)?.name || value;
    const option=[...elements.weekstart.select.options].find(el=>el.value===value);
    return option?.textContent?.trim() || value;
  }
  function detailsFor(type,value) {
    const language=getLanguage();
    if(type==="language") return LANGUAGES.find(entry=>entry.value===value)?.subtitle || "";
    return COPY[language]?.weekHint || COPY.en.weekHint;
  }
  function refresh() {
    for(const [type,item] of Object.entries(elements)) {
      const value=item.select.value;
      document.getElementById(type+"-picker-current").textContent=labelFor(type,value);
      document.getElementById(type+"-picker-subtitle").textContent=detailsFor(type,value);
    }
  }
  function close(restoreFocus=true) {
    if(!active) return;
    const previous=active;
    active=null;
    root.replaceChildren();
    previous.item.trigger.setAttribute("aria-expanded","false");
    document.body.style.overflow=previousBodyOverflow;
    if(restoreFocus) previous.item.trigger.focus({preventScroll:true});
  }
  const checkSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  const closeSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg>';
  function open(type) {
    if(!elements[type]) return;
    if(active) close(false);
    const item=elements[type];
    const language=getLanguage();
    const copy=COPY[language] || COPY.en;
    const title=getText(item.titleKey);
    const values=type==="language" ? LANGUAGES.map(entry=>entry.value) :
      [...item.select.options].map(option=>option.value);
    const entries=values.map(value=>{
      const isSelected=item.select.value===value;
      const name=labelFor(type,value);
      const subtitle=type==="language" ? nativeLanguageName(value,language) : copy.weekDetail;
      const symbol=type==="language" ? LANGUAGES.find(entry=>entry.value===value)?.initials :
        value==="0"?"7":value;
      return '<button type="button" class="picker-choice'+(isSelected?' is-selected':'')+
        '" data-value="'+escapeHTML(value)+'" role="radio" aria-checked="'+isSelected+'">'+
        '<span class="picker-choice-glyph" aria-hidden="true">'+escapeHTML(symbol)+'</span>'+
        '<span class="picker-choice-copy"><strong>'+escapeHTML(name)+'</strong><small>'+
        escapeHTML(subtitle)+'</small></span><span class="picker-choice-check" aria-hidden="true">'+
        checkSvg+'</span></button>';
    }).join("");
    root.innerHTML='<div class="picker-scrim" id="picker-scrim">'+
      '<section class="picker-sheet" role="dialog" aria-modal="true" aria-labelledby="picker-dialog-title">'+
      '<div class="picker-grabber" aria-hidden="true"></div>'+
      '<div class="picker-dialog-head"><div class="picker-dialog-heading">'+
      '<span class="picker-dialog-kicker">SHIFT PLANNER</span>'+
      '<h2 id="picker-dialog-title">'+escapeHTML(title)+'</h2></div>'+
      '<button type="button" class="picker-dismiss" data-picker-close="true" aria-label="'+
      escapeHTML(copy.close)+'">'+closeSvg+'</button></div>'+
      '<div class="picker-choice-list" role="radiogroup" aria-label="'+escapeHTML(title)+'">'+
      entries+'</div><p class="picker-sheet-hint">'+escapeHTML(copy.hint)+'</p>'+
      '</section></div>';
    item.trigger.setAttribute("aria-expanded","true");
    previousBodyOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    active={type,item};
    const selected=root.querySelector(".picker-choice.is-selected") || root.querySelector(".picker-choice");
    selected?.focus({preventScroll:true});
  }

  for(const [type,item] of Object.entries(elements)) {
    item.trigger.addEventListener("click",()=>open(type));
    item.select.addEventListener("change",()=>refresh());
  }
  root.addEventListener("click",event=>{
    if(!active) return;
    if(event.target.id==="picker-scrim" || event.target.closest("[data-picker-close]")) {
      close();
      return;
    }
    const option=event.target.closest(".picker-choice");
    if(!option) return;
    const selected=option.dataset.value;
    const item=active.item;
    if([...item.select.options].some(node=>node.value===selected)) {
      item.select.value=selected;
      item.select.dispatchEvent(new Event("change",{bubbles:true}));
    }
    close();
  });
  root.addEventListener("keydown",event=>{
    if(!active) return;
    const options=[...root.querySelectorAll(".picker-choice")];
    if(["ArrowDown","ArrowUp","Home","End"].includes(event.key) && options.length){
      event.preventDefault();
      let index=options.indexOf(document.activeElement);
      if(event.key==="Home") index=0;
      else if(event.key==="End") index=options.length-1;
      else if(event.key==="ArrowDown") index=(index+1)%options.length;
      else index=(index+options.length-1)%options.length;
      options[index].focus();
    } else if(event.key==="Tab") {
      const focusable=[...root.querySelectorAll(".picker-dismiss,.picker-choice")];
      if(!focusable.length) return;
      const index=focusable.indexOf(document.activeElement);
      if(event.shiftKey && index<=0){
        event.preventDefault();
        focusable[focusable.length-1].focus();
      } else if(!event.shiftKey && index===focusable.length-1){
        event.preventDefault();
        focusable[0].focus();
      }
    }
  });
  document.addEventListener("keydown",event=>{
    if(active && event.key==="Escape"){
      event.preventDefault();
      close();
    }
  });
  refresh();
  return {refresh,close,isOpen:()=>!!active};
}
