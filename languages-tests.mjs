import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {SUPPORTED_LANGUAGES,LANGUAGE_OPTIONS,LANGUAGE_LOCALES,LANGUAGE_WEEKDAYS,LANGUAGE_PICKER_COPY,normalizeLanguage,languageDirection} from './language-config.mjs';
import {asianTranslations} from './translations-asia.mjs';
import {pwaUpdateTranslations} from './pwa-update-translations.mjs';
import {extraTranslations} from './translations-extra.mjs';
import {hourlyTranslations} from './hourly-translations.mjs';
import {sanitizeSettings,makeBackup,parseBackup,calculatePayroll,updateStatus,updateTiming,payPolicy} from './core.mjs';
const root=new URL('./',import.meta.url);
const source=fs.readFileSync(new URL('app.mjs',root),'utf8');
const dictionaries=vm.runInNewContext(source.slice(source.indexOf('const translations ='),source.indexOf('const weekdays='))+';JSON.stringify(translations)',{extraTranslations,hourlyTranslations,asianTranslations,pwaUpdateTranslations});
const all=JSON.parse(dictionaries);
const languages=['de','en','fr','fa','es','zh','hi','ur'];
test('one eight-language registry validates all choices; French stays the default',()=>{
 assert.deepEqual([...SUPPORTED_LANGUAGES],languages);
 assert.equal(new Set(LANGUAGE_OPTIONS.map(x=>x.value)).size,8);
 for(const code of languages){assert.equal(normalizeLanguage(code),code);assert.equal(sanitizeSettings({language:code}).language,code);}
 for(const code of [undefined,null,'','xx','__proto__'])assert.equal(normalizeLanguage(code),'fr');
 assert.equal(sanitizeSettings({}).language,'fr');
});
test('Urdu and Persian are RTL; other supported interfaces are LTR',()=>{
 for(const code of languages)assert.equal(languageDirection(code),['fa','ur'].includes(code)?'rtl':'ltr');
 assert.equal(languageDirection('unknown'),'ltr');
});
test('new dictionaries cover every interface key with identical placeholders',()=>{
 const expected=Object.keys(all.fr).sort();
 for(const code of ['zh','hi','ur']){
  assert.deepEqual(Object.keys(asianTranslations[code]).sort(),expected,code+' missing/extra key');
  const script={zh:/\p{Script=Han}/u,hi:/\p{Script=Devanagari}/u,ur:/\p{Script=Arabic}/u}[code];
  for(const key of expected){
   const str=asianTranslations[code][key];
   assert.equal(typeof str,'string');assert.ok(str.trim().length>0,code+':'+key);
   assert.deepEqual((str.match(/\{\w+\}/g)||[]).sort(),(all.fr[key].match(/\{\w+\}/g)||[]).sort(),code+':'+key);
   assert.ok(script.test(str),code+':'+key+' must not silently fall back to French/English');
  }
 }
});
test('all rendered data-text keys are available in every supported language',()=>{
 const html=fs.readFileSync(new URL('index.html',root),'utf8');
 const keys=[...html.matchAll(/data-text="([^"]+)"/g)].map(x=>x[1]);
 for(const code of languages)for(const key of keys)assert.ok(all[code]?.[key],code+':'+key);
 for(const code of languages)for(const key of ['autosaveReady','autosaveSaving','autosaveSaved','modeConfirm','timeChoose'])assert.ok(all[code][key]);
});
test('all eight locale settings round-trip without losing wages or old label metadata',()=>{
 const records={'2026-10-05':{morning:'work',timings:{morning:{start:'09:15',end:'12:45',nextDay:false}}}};
 for(const language of languages){
  const settings=sanitizeSettings({language,theme:'dark',payMode:'hourly',paymentMode:'single',hourlyRate:12.5,morningName:'Legacy AM',eveningName:'Legacy PM'});
  const b=makeBackup(records,settings,{'2026-10':payPolicy(settings)});
  const parsed=parseBackup(JSON.stringify(b));
  assert.equal(parsed.settings.language,language);assert.equal(parsed.settings.morningName,'Legacy AM');assert.equal(parsed.settings.eveningName,'Legacy PM');
  assert.deepEqual(parsed.records,records);assert.equal(parsed.settings.theme,'dark');
  assert.equal(calculatePayroll(records,2026,9,parsed.settings).totalCents,4375);
 }
});
test('locales keep Gregorian calendar and seven weekday labels for every language',()=>{
 for(const code of languages){
  assert.equal(LANGUAGE_WEEKDAYS[code].length,7);
  assert.equal(new Intl.DateTimeFormat(LANGUAGE_LOCALES[code]).resolvedOptions().calendar,'gregory');
  assert.ok(new Intl.DateTimeFormat(LANGUAGE_LOCALES[code],{month:'long',year:'numeric'}).format(new Date(2026,9,15)));
  assert.ok(LANGUAGE_PICKER_COPY[code].hint);assert.ok(LANGUAGE_PICKER_COPY[code].close);
 }
});
test('shift name editor is removed, but localized morning/evening labels are retained',()=>{
 const html=fs.readFileSync(new URL('index.html',root),'utf8');
 assert.ok(!/morning-input|evening-input|data-text="shiftNames"/.test(html));
 assert.ok(!/morning-input|evening-input|autoTextFields/.test(source));
 assert.ok(source.includes('function shiftName(shift) { return t(shift); }'));
 assert.ok(!source.includes('settings[shift+"Name"]'));
 for(const code of languages){assert.ok(all[code].morning);assert.ok(all[code].evening);}
});
test('locale does not alter shift/hourly wages or single/split allocation',()=>{
 let records={};
 for(let d=1;d<=10;d++)for(const shift of ['morning','evening'])records=updateStatus(records,'2026-10-'+String(d).padStart(2,'0'),shift,'work');
 for(const language of languages)for(const payMode of ['shift','hourly'])for(const paymentMode of ['single','split']){
  const settings=sanitizeSettings({language,payMode,paymentMode,shiftRate:40,hourlyRate:10,payslipCap:711});
  const pay=calculatePayroll(records,2026,9,settings);
  assert.equal(pay.totalCents,80000);assert.equal(pay.envelopeCents,paymentMode==='single'?0:8900);
 }
});
test('new language modules are included in offline cache and the safe publication list',()=>{
 const sw=fs.readFileSync(new URL('service-worker.js',root),'utf8');
 const publish=fs.readFileSync(new URL('prepare_publish.mjs',root),'utf8');
 for(const name of ['language-config.mjs','translations-asia.mjs']){
  assert.ok(sw.includes('"./'+name+'"'));assert.ok(publish.includes('"'+name+'"'));
 }
});
