// Shared language metadata for validation, dates, the picker and text direction.
export const LANGUAGE_OPTIONS=Object.freeze([
 {value:"de",name:"Deutsch",subtitle:"Deutsch · Deutschland",initials:"DE",locale:"de-DE",dir:"ltr",weekdays:["So","Mo","Di","Mi","Do","Fr","Sa"]},
 {value:"en",name:"English",subtitle:"English · United Kingdom",initials:"EN",locale:"en-GB",dir:"ltr",weekdays:["Su","Mo","Tu","We","Th","Fr","Sa"]},
 {value:"fr",name:"Français",subtitle:"Français · France",initials:"FR",locale:"fr-FR",dir:"ltr",weekdays:["D","L","M","M","J","V","S"]},
 {value:"fa",name:"فارسی",subtitle:"فارسی · ایران",initials:"فا",locale:"fa-IR-u-ca-gregory",dir:"rtl",weekdays:["ی","د","س","چ","پ","ج","ش"]},
 {value:"es",name:"Español",subtitle:"Español · España",initials:"ES",locale:"es-ES",dir:"ltr",weekdays:["Do","Lu","Ma","Mi","Ju","Vi","Sá"]},
 {value:"zh",name:"简体中文",subtitle:"中文 · 简体",initials:"中",locale:"zh-CN-u-ca-gregory",dir:"ltr",weekdays:["日","一","二","三","四","五","六"]},
 {value:"hi",name:"हिन्दी",subtitle:"हिन्दी · भारत",initials:"हि",locale:"hi-IN-u-ca-gregory",dir:"ltr",weekdays:["रवि","सोम","मंगल","बुध","गुरु","शुक्र","शनि"]},
 {value:"ur",name:"اردو",subtitle:"اردو · پاکستان",initials:"اُ",locale:"ur-PK-u-ca-gregory",dir:"rtl",weekdays:["اتوار","پیر","منگل","بدھ","جمعرات","جمعہ","ہفتہ"]}
].map(option=>Object.freeze({...option,weekdays:Object.freeze(option.weekdays)})));
export const SUPPORTED_LANGUAGES=Object.freeze(LANGUAGE_OPTIONS.map(option=>option.value));
export const LANGUAGE_LOCALES=Object.freeze(Object.fromEntries(LANGUAGE_OPTIONS.map(option=>[option.value,option.locale])));
export const LANGUAGE_WEEKDAYS=Object.freeze(Object.fromEntries(LANGUAGE_OPTIONS.map(option=>[option.value,option.weekdays])));
export function languageDirection(code){return LANGUAGE_OPTIONS.find(option=>option.value===code)?.dir||"ltr";}
export function normalizeLanguage(code){return SUPPORTED_LANGUAGES.includes(code)?code:"fr";}
export const LANGUAGE_PICKER_COPY=Object.freeze({
 fa:{close:"بستن",hint:"انتخاب شما خودکار ذخیره می‌شود",weekHint:"شروع هفته در تقویم",weekDetail:"تقویم از این روز شروع می‌شود"},
 en:{close:"Close",hint:"Your selection is saved automatically",weekHint:"Calendar week begins here",weekDetail:"Use this as the first day of the week"},
 fr:{close:"Fermer",hint:"Votre choix est enregistré automatiquement",weekHint:"Début de la semaine du calendrier",weekDetail:"Premier jour affiché dans le calendrier"},
 de:{close:"Schließen",hint:"Ihre Auswahl wird automatisch gespeichert",weekHint:"Beginn der Kalenderwoche",weekDetail:"Erster Tag der Kalenderwoche"},
 es:{close:"Cerrar",hint:"Tu selección se guarda automáticamente",weekHint:"Inicio de la semana del calendario",weekDetail:"Primer día de la semana"},
 zh:{close:"关闭",hint:"选择会自动保存",weekHint:"日历每周的第一天",weekDetail:"将此日设为每周的第一天"},
 hi:{close:"बंद करें",hint:"आपका चयन अपने आप सहेजा जाता है",weekHint:"कैलेंडर में सप्ताह का पहला दिन",weekDetail:"इसे सप्ताह का पहला दिन बनाएँ"},
 ur:{close:"بند کریں",hint:"آپ کا انتخاب خودکار طور پر محفوظ ہوتا ہے",weekHint:"کیلنڈر میں ہفتے کا پہلا دن",weekDetail:"اس دن سے ہفتہ شروع کریں"}
});
