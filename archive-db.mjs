// Redundant on-device archive. Browsers may still delete site data, so export backups too.
const DB_NAME = "shift-planner-history-v2";
const STORE = "archive";
let dbPromise = null;
let writeQueue = Promise.resolve();

function openDb() {
  if (!("indexedDB" in globalThis)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    let request;
    try { request = indexedDB.open(DB_NAME,1); }
    catch { resolve(null); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

export async function loadArchiveFromDb() {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const transaction = db.transaction(STORE,"readonly");
      const req = transaction.objectStore(STORE).get("latest");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function saveDirect(snapshot) {
  const db = await openDb();
  if (!db) return false;
  return new Promise(resolve => {
    try {
      const transaction = db.transaction(STORE,"readwrite");
      transaction.objectStore(STORE).put(snapshot,"latest");
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    } catch { resolve(false); }
  });
}

export function saveArchiveToDb(snapshot) {
  writeQueue = writeQueue.catch(()=>false).then(()=>saveDirect(snapshot));
  return writeQueue;
}

export async function requestDurableStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return false;
    if (navigator.storage.persisted && await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return false; }
}
