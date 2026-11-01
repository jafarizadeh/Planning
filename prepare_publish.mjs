// Build only the public app files. Used locally and by the Vercel Git build.
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";

const root=path.dirname(fileURLToPath(import.meta.url));
const output=path.join(root,"publish");
export const PUBLIC_ASSETS=[
 "index.html","styles.css","theme-v13.css","ios-picker-v14.css",
 "quick-shifts-v15.css","hourly-pay.css","app.mjs","core.mjs",
 "archive-db.mjs","ios-picker-v14.mjs","translations-extra.mjs",
 "hourly-translations.mjs","language-config.mjs","translations-asia.mjs",
 "time-picker.mjs","pwa-updater.mjs","pwa-update-translations.mjs",
 "service-worker.js","manifest.webmanifest","icon.svg",
 "favicon-v2.png","apple-touch-icon-v2.png","icon-192-v2.png",
 "icon-512-v2.png","vercel.json"
];
const files=new Set(PUBLIC_ASSETS);
for(const filename of files){
 if(filename.includes("/")||filename.startsWith("."))throw Error("Invalid public file "+filename);
 if(!fs.statSync(path.join(root,filename)).isFile())throw Error("Not a file: "+filename);
}
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const worker=fs.readFileSync(path.join(root,"service-worker.js"),"utf8");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"manifest.webmanifest"),"utf8"));
const refs=[
 ...[...worker.matchAll(/"\.\/([^"]+)"/g)].map(match=>match[1]),
 ...[...html.matchAll(/(?:href|src)="\.\/([^"]+)"/g)].map(match=>match[1]),
 ...manifest.icons.map(icon=>icon.src.replace(/^\.?\//,""))
];
for(const ref of refs){
 if(!files.has(ref))throw Error("Unexpected asset referenced: "+ref);
}
// Fingerprint public bytes rather than relying on an incremented version string.
// Any change in HTML/CSS/JS/images automatically changes the Service Worker.
const hash=createHash("sha256");
for(const filename of [...files].sort()){
 hash.update(filename);hash.update("\0");
 hash.update(fs.readFileSync(path.join(root,filename)));
}
const revision=hash.digest("hex").slice(0,18);
const marker='const CACHE_NAME = "planning-offline-v17-safe-updates";';
if(!worker.includes(marker)||worker.split(marker).length!==2){
 throw Error("Service worker release marker missing or ambiguous");
}
fs.mkdirSync(output,{recursive:true});
const allowed=new Set([...files,"version.json"]);
for(const entry of fs.readdirSync(output)){
 if(!allowed.has(entry))throw Error("Unknown publish artifact: "+entry);
}
for(const filename of files){
 const target=path.join(output,filename);
 fs.copyFileSync(path.join(root,filename),target);
}
fs.writeFileSync(path.join(output,"service-worker.js"),
 worker.replace(marker,'const CACHE_NAME = "planning-offline-'+revision+'";'));
fs.writeFileSync(path.join(output,"version.json"),
 JSON.stringify({app:"Planning",revision,version:"2.5"},null,2)+"\n");
console.log("Public release "+revision+": "+allowed.size+" files in "+output);
console.log("Excluded: tests, local backups, device data and private credentials.");
