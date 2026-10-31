// IndexedDB primary mirror + synchronous localStorage snapshot and one previous snapshot.
import {STORAGE_KEY,BACKUP_SLOT_KEY,sanitizeData,emptyData} from "./core.mjs";
const DB_NAME="planning-equipe-employer-db-v1",STORE="snapshots";
let pending=Promise.resolve();
function openDb(){
 return new Promise(resolve=>{
  if(!("indexedDB" in globalThis)){resolve(null);return;}
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>resolve(null);
  req.onblocked=()=>resolve(null);
 });
}
async function readDb(){
 const db=await openDb();
 if(!db)return null;
 return new Promise(resolve=>{
  try{
   const tx=db.transaction(STORE,"readonly");
   const req=tx.objectStore(STORE).get("latest");
   req.onsuccess=()=>{db.close();resolve(req.result||null);};
   req.onerror=()=>{db.close();resolve(null);};
  }catch{db.close();resolve(null);}
 });
}
async function writeDb(snapshot){
 const db=await openDb();
 if(!db)return false;
 return new Promise(resolve=>{
  try{
   const tx=db.transaction(STORE,"readwrite");
   tx.objectStore(STORE).put(snapshot,"latest");
   tx.oncomplete=()=>{db.close();resolve(true);};
   tx.onerror=()=>{db.close();resolve(false);};
   tx.onabort=()=>{db.close();resolve(false);};
  }catch{db.close();resolve(false);}
 });
}
function readSlot(key){
 try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):null;}catch{return null;}
}
export function readInitial(){
 const main=readSlot(STORAGE_KEY),previous=readSlot(BACKUP_SLOT_KEY);
 const usable=[main,previous].filter(x=>x&&x.schema===1&&x.data);
 if(!usable.length)return {data:emptyData(),savedAt:0};
 usable.sort((a,b)=>Number(b.savedAt)-Number(a.savedAt));
 return {data:sanitizeData(usable[0].data),savedAt:Number(usable[0].savedAt)||0};
}
export function createStorage({onWarning}={}){
 let {data,savedAt}=readInitial();
 let revision=0;
 const snapshot=()=>({schema:1,savedAt,data});
 async function initialize(){
  const savedRevision=revision;
  const persisted=await readDb();
  if(persisted&&persisted.schema===1&&Number(persisted.savedAt)>savedAt&&revision===savedRevision){
   data=sanitizeData(persisted.data);
   savedAt=Number(persisted.savedAt);
   try{localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot()));}catch{}
  }
  pending=pending.then(()=>writeDb(snapshot())).catch(()=>false);
  try{if(navigator.storage?.persist)await navigator.storage.persist();}catch{}
  return data;
 }
 function save(next,{purgePrevious=false}={}){
  data=sanitizeData(next);
  savedAt=Math.max(Date.now(),savedAt+1);
  revision++;
  const s=snapshot();
  let localOK=true;
  try{
   if(purgePrevious){
    // Deletion must not leave a restorable snapshot containing this employee.
    localStorage.removeItem(BACKUP_SLOT_KEY);
   } else {
    const previous=localStorage.getItem(STORAGE_KEY);
    if(previous)localStorage.setItem(BACKUP_SLOT_KEY,previous);
   }
   localStorage.setItem(STORAGE_KEY,JSON.stringify(s));
  }catch{
   localOK=false;
   if(purgePrevious){
    // Even if quota is reached, never leave an older deleted-person backup.
    try{localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(BACKUP_SLOT_KEY);}catch{}
   }
  }
  pending=pending.then(()=>writeDb(s)).then(ok=>{
   if(!ok&&!localOK)onWarning?.();
   return ok;
  }).catch(()=>{if(!localOK)onWarning?.();return false;});
  if(!localOK)onWarning?.();
  return data;
 }
 function acceptExternal(external){
  if(!external||external.schema!==1||!external.data||!Number.isFinite(Number(external.savedAt)))return null;
  if(Number(external.savedAt)<=savedAt)return null;
  data=sanitizeData(external.data);
  savedAt=Number(external.savedAt);
  revision++;
  const copy=snapshot();
  pending=pending.then(()=>writeDb(copy)).catch(()=>false);
  return data;
 }
 return {initialize,save,acceptExternal,getData:()=>data,getSavedAt:()=>savedAt,flush:()=>pending};
}
