// Safe, opt-in PWA updates. Application records remain in device storage.
export function createPwaUpdater({getText, beforeReload, onBlocked}){
 const root=document.getElementById("pwa-update-banner");
 const now=document.getElementById("pwa-update-now");
 const later=document.getElementById("pwa-update-later");
 const title=document.getElementById("pwa-update-title");
 const description=document.getElementById("pwa-update-description");
 if(!root||!now||!later)throw Error("PWA update UI missing");
 let registration=null;
 let started=false,checking=false,activating=false,reloadRequested=false;
 let readyToReload=false,dismissed=null,hadController=false;
 let timer=null;

 function refreshCopy(){
  title.textContent=getText("pwaUpdateTitle");
  description.textContent=getText(readyToReload?"pwaUpdateReady":"pwaUpdateDescription");
  later.textContent=getText("pwaUpdateLater");
  now.textContent=getText(activating?"pwaUpdatePreparing":"pwaUpdateNow");
  now.disabled=activating;
  now.setAttribute("aria-busy",String(activating));
 }
 function waiting(){
  return registration?.waiting||null;
 }
 function showAvailable(){
  // The first installation is not an app update.
  if(!hadController&&!navigator.serviceWorker.controller)return;
  const candidate=waiting()||(readyToReload?"ready":null);
  if(!candidate||candidate===dismissed)return;
  root.hidden=false;
  refreshCopy();
 }
 function hide(){root.hidden=true;}
 function registerWorker(worker){
  if(!worker)return;
  const onState=()=>{
   if(worker.state==="installed"&&navigator.serviceWorker.controller)showAvailable();
   if(worker.state==="redundant"&&!waiting()&&!readyToReload){hide();}
  };
  worker.addEventListener("statechange",onState);
  onState();
 }
 function monitor(reg){
  registration=reg;
  hadController=!!navigator.serviceWorker.controller;
  registerWorker(reg.installing);
  reg.addEventListener("updatefound",()=>registerWorker(reg.installing));
  if(reg.waiting&&hadController)showAvailable();
  navigator.serviceWorker.addEventListener("controllerchange",()=>{
   const newController=navigator.serviceWorker.controller;
   // The initial installation may claim the page without changing its contents.
   if(!hadController&&!reloadRequested){
    hadController=!!newController;
    return;
   }
   hadController=!!newController;
   if(reloadRequested){
    reloadRequested=false;
    window.location.reload();
   }else{
    // Another tab activated an update. Never reload an editing session.
    readyToReload=true;dismissed=null;showAvailable();
   }
  });
 }
 async function check(){
  if(!registration||checking||!navigator.onLine)return;
  checking=true;
  try{
   await registration.update();
   if(registration.waiting)showAvailable();
  }catch{
   // An offline or captive-portal check must never disrupt the app.
  }finally{checking=false;}
 }
 async function apply(){
  if(activating)return;
  if(!waiting()&&!readyToReload){hide();return;}
  activating=true;refreshCopy();
  let safe=false;
  try{safe=await beforeReload();}
  catch{safe=false;}
  if(!safe){
   activating=false;refreshCopy();
   onBlocked();
   return;
  }
  if(readyToReload&&!waiting()){
   window.location.reload();
   return;
  }
  const worker=waiting();
  if(!worker){
   activating=false;refreshCopy();hide();return;
  }
  reloadRequested=true;
  try{
   worker.postMessage({type:"SKIP_WAITING"});
  }catch{
   reloadRequested=false;activating=false;refreshCopy();
   onBlocked();
  }
 }
 now.addEventListener("click",()=>{void apply();});
 later.addEventListener("click",()=>{
  dismissed=waiting()||(readyToReload?"ready":null);
  hide();
 });
 async function start(){
  if(started||!("serviceWorker" in navigator)||location.protocol==="file:")return;
  started=true;
  refreshCopy();
  try{
   // Use the browser's built-in Service Worker update checks; no new accounts,
   // push permission, tracking or server-held user data are required.
   const reg=await navigator.serviceWorker.register("./service-worker.js",{updateViaCache:"none"});
   monitor(reg);
   void check();
   // A foreground PWA can remain open for days; recheck periodically.
   timer=window.setInterval(()=>{if(!document.hidden)void check();},60*60*1000);
   window.addEventListener("online",()=>{void check();});
   window.addEventListener("pageshow",()=>{void check();showAvailable();});
   document.addEventListener("visibilitychange",()=>{
    if(!document.hidden){void check();showAvailable();}
   });
  }catch{
   // Unavailable Service Workers do not prevent ordinary PWA use.
  }
 }
 return {start,check,refreshCopy,isAvailable:()=>!root.hidden};
}
