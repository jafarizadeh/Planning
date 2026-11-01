import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const root=path.dirname(fileURLToPath(import.meta.url));
test("public build changes PWA release fingerprint whenever a public asset changes",()=>{
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),"planning-release-test-"));
 try{
  const source=fs.readFileSync(path.join(root,"prepare_publish.mjs"),"utf8");
  const list=source.match(/export const PUBLIC_ASSETS=\[([\s\S]*?)\];/);
  assert.ok(list,"Public asset allowlist missing");
  const names=[...list[1].matchAll(/"([^"]+)"/g)].map(x=>x[1]);
  assert.ok(names.includes("pwa-updater.mjs"));
  assert.ok(names.includes("pwa-update-translations.mjs"));
  assert.ok(!names.some(x=>/backup|test|sqlite|secret/i.test(x)));
  fs.copyFileSync(path.join(root,"prepare_publish.mjs"),path.join(temporary,"prepare_publish.mjs"));
  for(const name of names)fs.copyFileSync(path.join(root,name),path.join(temporary,name));
  const build=()=>{
   const result=spawnSync(process.execPath,["prepare_publish.mjs"],{cwd:temporary,encoding:"utf8"});
   assert.equal(result.status,0,result.stderr);
   return JSON.parse(fs.readFileSync(path.join(temporary,"publish/version.json"),"utf8")).revision;
  };
  const initial=build();
  assert.match(initial,/^[a-f0-9]{18}$/);
  const firstWorker=fs.readFileSync(path.join(temporary,"publish/service-worker.js"),"utf8");
  assert.ok(firstWorker.includes("planning-offline-"+initial));
  assert.ok(!firstWorker.includes("const CACHE_NAME = "+JSON.stringify("planning-offline-v17-safe-updates")));
  const same=build();
  assert.equal(same,initial,"Repeated builds of the same public files must be reproducible");
  fs.appendFileSync(path.join(temporary,"styles.css"),"\n/* New public CSS version for test */\n");
  const changed=build();
  assert.notEqual(changed,initial,"A CSS change must trigger a new Service Worker");
  const changedWorker=fs.readFileSync(path.join(temporary,"publish/service-worker.js"),"utf8");
  assert.ok(changedWorker.includes("planning-offline-"+changed));
  assert.ok(!changedWorker.includes("planning-offline-"+initial));
  assert.ok(changedWorker.includes('type==="SKIP_WAITING"'),"The update requires explicit approval");
  assert.ok(!changedWorker.includes("then(()=>self.skipWaiting())"),"No unconditional skipWaiting");
  const pub=fs.readdirSync(path.join(temporary,"publish")).sort();
  assert.deepEqual(pub,[...names,"version.json"].sort());
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});
