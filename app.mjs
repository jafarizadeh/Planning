import {
  DATA_KEY, SETTINGS_KEY, DEFAULT_SETTINGS, SHIFTS,
  dateKey, calendarCells, getStatus, updateStatus, monthStats,
  overallStats, sanitizeRecords, sanitizeSettings, payrollForMonth, makeBackup, parseBackup,
  ARCHIVE_KEY, ARCHIVE_FALLBACK_KEY, periodKey, sanitizeMonthlyPolicies,
  sanitizeAudit, monthlyHistory, mergeHistory, payPolicy, calculatePayroll, getTiming, updateTiming, timingAnalysis
} from "./core.mjs";
import { loadArchiveFromDb, saveArchiveToDb, requestDurableStorage } from "./archive-db.mjs";
import { setupPickers } from "./ios-picker-v14.mjs";
import { extraTranslations } from "./translations-extra.mjs";
import { hourlyTranslations } from "./hourly-translations.mjs";
import { createTimePicker } from "./time-picker.mjs";
const translations = {
  fa: {
    appTitle:"برنامه شیفت‌ها",appSubtitle:"تقویم کار و استراحت من",today:"امروز",
    monthWorked:"کارکرد این ماه",daysUnit:"روز",workedShifts:"شیفت‌های کاری",offShifts:"شیفت‌های بدون کار",
    calendarHeading:"تقویم شیفت‌ها",tapHintShort:"یک روز را انتخاب کن",amShort:"ص",pmShort:"ع",
    worked:"کار کردم",didNotWork:"کار نکردم",notRecorded:"ثبت نشده",
    tip:"برای ثبت یا تغییر شیفت، روی روز موردنظر بزن.",allTime:"جمع کل کارکرد",
    settingsTitle:"تنظیمات",settingsDescription:"تقویم را به سلیقهٔ خودت تنظیم کن.",
    display:"نمایش تقویم",languageLabel:"زبان برنامه",weekStarts:"اولین روز هفته",
    monday:"دوشنبه",saturday:"شنبه",sunday:"یکشنبه",shiftNames:"نام شیفت‌ها",
    morningLabel:"شیفت صبح",eveningLabel:"شیفت عصر",morning:"صبح",evening:"عصر",
    labelsHint:"خالی بگذار تا نام پیش‌فرض نمایش داده شود.",saveSettings:"ذخیرهٔ تنظیمات",
    dataHeading:"اطلاعات و پشتیبان‌گیری",exportData:"دریافت فایل پشتیبان",
    importData:"بازیابی فایل پشتیبان",deleteRecords:"پاک‌کردن تمام ثبت‌ها",
    privacy:"اطلاعات فقط در مرورگر همین دستگاه ذخیره می‌شود. برای نگهداری امن، گاهی فایل پشتیبان بگیر.",
    calendarTab:"تقویم",settingsTab:"تنظیمات",halfDayRule:"هر شیفت = نیم‌روز",
    shiftsCount:"شیفت کاری در تمام ماه‌ها",dateHeading:"ثبت شیفت‌ها",editDay:"وضعیت هر شیفت را مشخص کن",
    saveDay:"بستن",saved:"ثبت شد",settingsSaved:"تنظیمات ذخیره شد",
    resetConfirm:"تمام ثبت‌های شیفت حذف شوند؟ این کار برگشت‌پذیر نیست. پیش از حذف می‌توانی فایل پشتیبان بگیری.",
    resetDone:"همهٔ ثبت‌ها پاک شدند",importConfirm:"با بازیابی فایل، تمام اطلاعات فعلی جایگزین می‌شود. ادامه می‌دهی؟",
    importSuccess:"فایل پشتیبان بازیابی شد",importError:"این فایل پشتیبان معتبر نیست",
    storageError:"ذخیره در مرورگر ممکن نشد",prevMonth:"ماه قبل",nextMonth:"ماه بعد",
    payBreakdown:"تقسیم دستمزد",salaryTotal:"دستمزد این ماه",shiftCountShort:"شیفت",
    payslipTitle:"فیش حقوقی",payslipLimit:"سقف فیش",payUsage:"از سقف فیش",
    envelopeTitle:"پاکت",envelopeExtra:"مازاد",
    envelopeLocked:"پاکت هنوز غیرفعال است",envelopeTap:"برای باز کردن لمس کن",
    envelopeClose:"برای بستن لمس کن",financeSettings:"تنظیمات دستمزد",
    rateLabel:"دستمزد هر شیفت",capLabel:"سقف فیش حقوقی",
    financeSettingsNote:"نرخ و سقف برای ماه انتخاب‌شده ذخیره می‌شوند؛ ماه‌های قدیمی تغییر نمی‌کنند.",
    historyTitle:"تاریخچه کار و حقوق",historySubtitle:"همهٔ ماه‌های ثبت‌شده",historyEmpty:"هنوز شیفتی ثبت نشده است",
    historyNotice:"حقوق و نرخ هر ماه جداگانه نگهداری می‌شود؛ برای جلوگیری از ازدست‌رفتن اطلاعات، مرتب فایل پشتیبان بگیر.",
    historyProtected:"حفظ سوابق فعال است",historyStatus:"در حال بررسی حافظهٔ دستگاه...",
    historyStatusPersistent:"حافظهٔ پایدار فعال است. برای حذف برنامه یا خرابی دستگاه همچنان پشتیبان خارجی لازم است.",
    historyStatusBestEffort:"حافظهٔ دستگاه ممکن است پاک شود. از تاریخچه فایل پشتیبان تهیه کن.",
    archiveRestored:"اطلاعات از حافظهٔ پشتیبان داخلی بازیابی شد",
    backupMerged:"سوابق پشتیبان بدون حذف اطلاعات قبلی اضافه شدند",
    importConfirm:"اطلاعات جدید به سوابق فعلی اضافه می‌شوند. ثبت‌های فعلی و حقوق ماه‌های قدیمی حذف یا بازنویسی نمی‌شوند. ادامه می‌دهی؟",
    privacy:"سوابق در حافظهٔ این دستگاه ذخیره می‌شوند. حذف برنامه یا پاک‌کردن داده‌های مرورگر ممکن است آن‌ها را از بین ببرد؛ فایل پشتیبان را در جایی امن نگه دار."
  },
  en: {
    appTitle:"Shift Planner",appSubtitle:"My work & rest calendar",today:"Today",
    monthWorked:"Worked this month",daysUnit:"days",workedShifts:"Worked shifts",offShifts:"Shifts off",
    calendarHeading:"Shift calendar",tapHintShort:"Tap any day",amShort:"AM",pmShort:"PM",
    worked:"Worked",didNotWork:"Didn't work",notRecorded:"Not recorded",
    tip:"Tap a day to enter or change the status of each shift.",allTime:"All-time total",
    settingsTitle:"Settings",settingsDescription:"Make your calendar your own.",
    display:"Calendar display",languageLabel:"App language",weekStarts:"First day of week",
    monday:"Monday",saturday:"Saturday",sunday:"Sunday",shiftNames:"Shift names",
    morningLabel:"Morning shift",eveningLabel:"Evening shift",morning:"Morning",evening:"Evening",
    labelsHint:"Leave empty to use the default names.",saveSettings:"Save settings",
    dataHeading:"Data & backup",exportData:"Download backup",importData:"Restore from backup",
    deleteRecords:"Delete all shift records",
    privacy:"Records are stored only in this browser on this device. Download a backup occasionally to keep a safe copy.",
    calendarTab:"Calendar",settingsTab:"Settings",halfDayRule:"Each shift = ½ day",
    shiftsCount:"worked shifts across all months",dateHeading:"Record shifts",editDay:"Set the status of each shift",
    saveDay:"Close",saved:"Saved",settingsSaved:"Settings saved",
    resetConfirm:"Delete all shift records? This cannot be undone. Consider downloading a backup first.",
    resetDone:"All shift records cleared",importConfirm:"Restoring will replace all current records and settings. Continue?",
    importSuccess:"Backup restored",importError:"This isn't a valid backup file",
    storageError:"Could not save in this browser",prevMonth:"Previous month",nextMonth:"Next month",
    payBreakdown:"PAY BREAKDOWN",salaryTotal:"Estimated earnings",shiftCountShort:"shifts",
    payslipTitle:"Payslip",payslipLimit:"Payslip limit",payUsage:"of the limit",
    envelopeTitle:"Envelope",envelopeExtra:"EXTRA",
    envelopeLocked:"Envelope locked",envelopeTap:"Tap to open",
    envelopeClose:"Tap to close",financeSettings:"Pay settings",
    rateLabel:"Rate per shift",capLabel:"Payslip limit",
    financeSettingsNote:"The rate and limit apply to the selected month; earlier months retain their own values.",
    historyTitle:"Work & pay history",historySubtitle:"All recorded months",historyEmpty:"No shifts recorded yet",
    historyNotice:"Each month's rate and payroll are kept separately. Export backups regularly to protect your records.",
    historyProtected:"History preservation enabled",historyStatus:"Checking device storage...",
    historyStatusPersistent:"Persistent device storage is active. Keep an external backup against uninstall or device failure.",
    historyStatusBestEffort:"Device storage can be erased. Export a backup to protect your records.",
    archiveRestored:"History recovered from local archive",backupMerged:"Backup added without deleting existing records",
    importConfirm:"Add missing records from the backup? Current entries and historic payroll settings won't be overwritten.",
    privacy:"History is stored on this device. Uninstalling the app or clearing browser data may erase it. Keep an external backup."
  },
  fr: {
    appTitle:"Mes horaires",appSubtitle:"Mon calendrier de travail",today:"Aujourd’hui",
    monthWorked:"Jours travaillés ce mois",daysUnit:"jours",workedShifts:"Créneaux travaillés",offShifts:"Créneaux non travaillés",
    calendarHeading:"Planning des shifts",tapHintShort:"Touchez un jour",amShort:"M",pmShort:"S",
    worked:"Travaillé",didNotWork:"Non travaillé",notRecorded:"Non renseigné",
    tip:"Touchez une date pour saisir ou modifier chaque créneau.",allTime:"Total depuis le début",
    settingsTitle:"Paramètres",settingsDescription:"Personnalisez votre planning.",
    display:"Affichage du calendrier",languageLabel:"Langue",weekStarts:"Premier jour de la semaine",
    monday:"Lundi",saturday:"Samedi",sunday:"Dimanche",shiftNames:"Nom des créneaux",
    morningLabel:"Matin",eveningLabel:"Soir",morning:"Matin",evening:"Soir",
    labelsHint:"Laissez vide pour conserver les noms par défaut.",saveSettings:"Enregistrer",
    dataHeading:"Données et sauvegarde",exportData:"Télécharger une sauvegarde",
    importData:"Restaurer une sauvegarde",deleteRecords:"Supprimer tous les enregistrements",
    privacy:"Les données sont stockées uniquement dans ce navigateur sur cet appareil. Pensez à faire une sauvegarde.",
    calendarTab:"Calendrier",settingsTab:"Paramètres",halfDayRule:"Un créneau = ½ journée",
    shiftsCount:"créneaux travaillés, tous mois confondus",dateHeading:"Saisir les créneaux",
    editDay:"Choisissez le statut de chaque créneau",saveDay:"Fermer",saved:"Enregistré",
    settingsSaved:"Paramètres enregistrés",resetConfirm:"Supprimer tous les créneaux enregistrés ? Cette action est irréversible.",
    resetDone:"Tous les enregistrements ont été supprimés",importConfirm:"La restauration remplacera les données actuelles. Continuer ?",
    importSuccess:"Sauvegarde restaurée",importError:"Ce fichier de sauvegarde est invalide",
    storageError:"Enregistrement impossible dans ce navigateur",prevMonth:"Mois précédent",nextMonth:"Mois suivant",
    payBreakdown:"RÉPARTITION DU SALAIRE",salaryTotal:"Salaire estimé",shiftCountShort:"créneaux",
    payslipTitle:"Fiche de paie",payslipLimit:"Plafond",payUsage:"du plafond",
    envelopeTitle:"Enveloppe",envelopeExtra:"EXCÉDENT",
    envelopeLocked:"Enveloppe bloquée",envelopeTap:"Touchez pour ouvrir",
    envelopeClose:"Touchez pour refermer",financeSettings:"Paramètres de rémunération",
    rateLabel:"Taux par créneau",capLabel:"Plafond fiche de paie",
    financeSettingsNote:"Le taux et le plafond concernent le mois sélectionné. Les anciens mois conservent leurs valeurs.",
    historyTitle:"Historique travail et salaire",historySubtitle:"Tous les mois enregistrés",historyEmpty:"Aucun créneau enregistré",
    historyNotice:"Le taux et le calcul sont conservés par mois. Exportez régulièrement une sauvegarde pour protéger l'historique.",
    historyProtected:"Historique conservé",historyStatus:"Vérification du stockage...",
    historyStatusPersistent:"Stockage persistant activé. Une sauvegarde externe reste nécessaire en cas de suppression de l'appareil.",
    historyStatusBestEffort:"Le stockage local peut être effacé. Exportez une sauvegarde pour conserver vos données.",
    archiveRestored:"Historique récupéré de l'archive locale",backupMerged:"Sauvegarde ajoutée sans supprimer les données existantes",
    importConfirm:"Ajouter les données manquantes de la sauvegarde ? Les enregistrements actuels et anciens paramètres de salaire seront conservés.",
    privacy:"L'historique reste sur cet appareil. Désinstaller l'application ou effacer les données du navigateur peut le supprimer. Conservez une sauvegarde externe."
  }
};
Object.assign(translations, extraTranslations);
const themeTexts = {
  fa:{themeLabel:"حالت نمایش",themeLight:"روشن",themeDark:"تیره",totalLabel:"مجموع",envelopeLocked:"پاکت قفل است",envelopeTap:"لمس برای باز کردن"},
  en:{themeLabel:"Appearance",themeLight:"Light",themeDark:"Dark",totalLabel:"Total",envelopeLocked:"Envelope locked",envelopeTap:"Tap to open"},
  fr:{themeLabel:"Apparence",themeLight:"Clair",themeDark:"Sombre",totalLabel:"Total",envelopeLocked:"Enveloppe bloquée",envelopeTap:"Touchez pour ouvrir"},
  de:{themeLabel:"Darstellung",themeLight:"Hell",themeDark:"Dunkel",totalLabel:"Gesamt",envelopeLocked:"Umschlag gesperrt",envelopeTap:"Zum Öffnen tippen"},
  es:{themeLabel:"Apariencia",themeLight:"Claro",themeDark:"Oscuro",totalLabel:"Total",envelopeLocked:"Sobre bloqueado",envelopeTap:"Toca para abrir"}
};
for(const [language,content] of Object.entries(themeTexts)){
  Object.assign(translations[language],content);
}
const quickEntryTexts = {
  fa:{entryTitle:"ثبت سریع شیفت",entryAutoSaved:"تغییرات خودکار ذخیره می‌شوند",entryBothWork:"هر دو: کار",entryBothOff:"هر دو: استراحت",entryPrevDay:"روز قبل",entryNextDay:"روز بعد",entryClose:"بستن"},
  en:{entryTitle:"Quick shift entry",entryAutoSaved:"Changes are saved automatically",entryBothWork:"Both worked",entryBothOff:"Both off",entryPrevDay:"Previous day",entryNextDay:"Next day",entryClose:"Close"},
  fr:{entryTitle:"Saisie rapide",entryAutoSaved:"Enregistrement automatique",entryBothWork:"Deux travaillés",entryBothOff:"Deux non travaillés",entryPrevDay:"Jour précédent",entryNextDay:"Jour suivant",entryClose:"Fermer"},
  de:{entryTitle:"Schichten schnell erfassen",entryAutoSaved:"Änderungen werden automatisch gespeichert",entryBothWork:"Beide gearbeitet",entryBothOff:"Beide frei",entryPrevDay:"Vorheriger Tag",entryNextDay:"Nächster Tag",entryClose:"Schließen"},
  es:{entryTitle:"Registro rápido",entryAutoSaved:"Cambios guardados automáticamente",entryBothWork:"Ambos trabajados",entryBothOff:"Ambos libres",entryPrevDay:"Día anterior",entryNextDay:"Día siguiente",entryClose:"Cerrar"}
};
for(const [lang,content] of Object.entries(quickEntryTexts)){Object.assign(translations[lang],content);}
for(const [language,texts] of Object.entries(hourlyTranslations))Object.assign(translations[language],texts);
const weekdays = {
  fa:["ی","د","س","چ","پ","ج","ش"],
  en:["Su","Mo","Tu","We","Th","Fr","Sa"],
  fr:["D","L","M","M","J","V","S"],
  de:["So","Mo","Di","Mi","Do","Fr","Sa"],
  es:["Do","Lu","Ma","Mi","Ju","Vi","Sá"]
};
const locales = { fa:"fa-IR-u-ca-gregory", en:"en-GB", fr:"fr-FR", de:"de-DE", es:"es-ES" };
const $ = id => document.getElementById(id);

function readJSON(key, fallback) {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
}
const rawSnapshot = readJSON(ARCHIVE_KEY,null) || readJSON(ARCHIVE_FALLBACK_KEY,null);
const localSnapshot = [2,3].includes(rawSnapshot?.schemaVersion) ? rawSnapshot : null;
let records = sanitizeRecords(localSnapshot ? localSnapshot.records : readJSON(DATA_KEY, {}));
let settings = sanitizeSettings(localSnapshot ? localSnapshot.settings : readJSON(SETTINGS_KEY, DEFAULT_SETTINGS));
let monthlyPolicies = sanitizeMonthlyPolicies(localSnapshot?.monthlyPolicies);
let audit = sanitizeAudit(localSnapshot?.audit);
let lastSavedAt = Number(localSnapshot?.savedAt) || 0;
let hadLegacyRecords = readJSON(DATA_KEY,null) !== null;
let hasLocalSnapshot = !!localSnapshot;
let hasUnsavedUserEdit = false;
let storageMode = "unknown";
function rememberExistingMonths() {
  for(const day of Object.keys(records)) {
    const key = day.slice(0,7);
    if(!monthlyPolicies[key]) {
      monthlyPolicies[key]=payPolicy(settings);
    }
  }
}
rememberExistingMonths();
const today = new Date();
let year = today.getFullYear();
let month = today.getMonth();
let page = "home";
let chosenDate = null;
let envelopeOpen = false;
let toastTimer = null;

function t(key) { return translations[settings.language]?.[key] || translations.en[key] || key; }
function applyTheme(theme) {
  const next = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  document.querySelector('meta[name="theme-color"]').content = next === "dark" ? "#101419" : "#f5f6f8";
}
function formatToday() {
  return new Intl.DateTimeFormat(locales[settings.language],{
    day:"numeric",month:"short",year:"numeric"
  }).format(new Date());
}
function num(value) {
  return new Intl.NumberFormat(locales[settings.language], {maximumFractionDigits:1}).format(value);
}
function euro(cents) {
  const locale = settings.language === "en" ? "en-GB" : "fr-FR";
  return new Intl.NumberFormat(locale, {minimumFractionDigits:2, maximumFractionDigits:2})
    .format(cents / 100) + "\u00a0€";
}
function dateLocale(key) {
  const [y,m,d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locales[settings.language], {
    weekday:"long", day:"numeric", month:"long", year:"numeric"
  }).format(new Date(y,m-1,d,12));
}
function monthLocale() {
  return new Intl.DateTimeFormat(locales[settings.language], {
    month:"long", year:"numeric"
  }).format(new Date(year,month,15,12));
}
function shiftName(shift) { return settings[shift+"Name"] || t(shift); }
function selectedPolicy() {
  return monthlyPolicies[periodKey(year,month)] || payPolicy(settings);
}
function recordedMonthPolicy(key) {
  if(monthlyPolicies[key]) return monthlyPolicies[key];
  const policy=payPolicy(settings);
  monthlyPolicies[key] = policy;
  return policy;
}
function auditChange(type,period,detail) {
  const at=new Date().toISOString();
  const id=at+"-"+Math.random().toString(36).slice(2,13);
  audit.push({id,at,type,period,detail});
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));
}
function persist(_key, _value) {
  hasUnsavedUserEdit=true;
  const snapshot={
    schemaVersion:3,savedAt:Math.max(Date.now(),lastSavedAt+1),records,settings,
    monthlyPolicies:{...monthlyPolicies},audit:[...audit]
  };
  let savedLocally=true;
  try {
    const previous=localStorage.getItem(ARCHIVE_KEY);
    if(previous) localStorage.setItem(ARCHIVE_FALLBACK_KEY,previous);
    localStorage.setItem(ARCHIVE_KEY,JSON.stringify(snapshot));
    localStorage.setItem(DATA_KEY,JSON.stringify(records));
    localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
    hasLocalSnapshot=true;
    hadLegacyRecords=true;
    lastSavedAt=snapshot.savedAt;
  } catch {
    savedLocally=false;
    showToast(t("storageError"));
  }
  void saveArchiveToDb(snapshot).then(ok=>{
    if(!ok && !savedLocally) showToast(t("storageError"));
  });
  return savedLocally;
}
async function initializeArchive() {
  try {
    const stored=await loadArchiveFromDb();
    const canRestore=stored && [2,3].includes(stored.schemaVersion) && !hasUnsavedUserEdit &&
      ((!hadLegacyRecords && !hasLocalSnapshot) ||
       (hasLocalSnapshot && Number(stored.savedAt)>lastSavedAt));
    if(canRestore){
      records=sanitizeRecords(stored.records);
      settings=sanitizeSettings(stored.settings);
      monthlyPolicies=sanitizeMonthlyPolicies(stored.monthlyPolicies);
      audit=sanitizeAudit(stored.audit);
      rememberExistingMonths();
      persist();
      renderAll();
      showToast(t("archiveRestored"));
    } else if(!hasUnsavedUserEdit) {
      persist();
    }
    storageMode=await requestDurableStorage()?"persistent":"best-effort";
  } catch {
    storageMode="best-effort";
  }
  updateArchiveStatus();
  document.documentElement.dataset.archiveReady="true";
}
function updateArchiveStatus() {
  const el=$("archive-status");
  if(!el) return;
  el.textContent=t(storageMode==="persistent"?"historyStatusPersistent":
    storageMode==="best-effort"?"historyStatusBestEffort":"historyStatus");
}
function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"),2500);
}
let analyzedRecords=null,cachedTimes={};
function getTimeAnalysis(){
  if(analyzedRecords!==records){cachedTimes=timingAnalysis(records);analyzedRecords=records;}
  return cachedTimes;
}
function durationText(minutes){
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return num(hours)+" "+t("hoursUnit")+(rest?" "+num(rest)+" "+t("minutesUnit"):"");
}
function fillPaySettings(){
  const policy=payPolicy(selectedPolicy());
  $("shift-rate-input").value=policy.shiftRate.toFixed(2);
  $("hourly-rate-input").value=policy.hourlyRate.toFixed(2);
  $("payslip-cap-input").value=policy.payslipCap.toFixed(2);
  document.querySelector('input[name="pay-mode"][value="'+policy.payMode+'"]').checked=true;
  $("pay-settings-period").textContent=t("policyPeriod").replace("{month}",monthLocale());
  updatePayModePreview();
}
function updatePayModePreview(){
  const hourly=document.querySelector('input[name="pay-mode"]:checked')?.value==="hourly";
  $("shift-rate-field").hidden=hourly;$("hourly-rate-field").hidden=!hourly;
  $("hourly-mode-note").hidden=!hourly;
  $("shift-rate-input").required=!hourly;$("hourly-rate-input").required=hourly;
}
function decorateCalendarTimes(){
  const hourly=selectedPolicy().payMode==="hourly";
  const analysis=getTimeAnalysis();
  for(const cell of $("calendar-grid").querySelectorAll("button[data-date]")){
    const key=cell.dataset.date;
    const pending=hourly&&SHIFTS.some(shift=>getStatus(records,key,shift)==="work"&&analysis[key+":"+shift]?.state!=="ready");
    cell.classList.toggle("has-time-warning",pending);
    if(pending)cell.setAttribute("aria-description",t("timeMissing"));
    else cell.removeAttribute("aria-description");
  }
}
function updateTimeControls(){
  if(!chosenDate)return;
  const hourly=selectedPolicy().payMode==="hourly";
  const analysis=getTimeAnalysis();
  let dayMinutes=0,pending=0;
  for(const shift of SHIFTS){
    const section=$("sheet-root").querySelector('[data-time-section="'+shift+'"]');
    if(!section)continue;
    section.hidden=!hourly;
    if(!hourly)continue;
    const status=getStatus(records,chosenDate,shift),worked=status==="work";
    const timing=getTiming(records,chosenDate,shift),detail=analysis[chosenDate+":"+shift]||{state:"missing",minutes:0};
    if(!section.firstElementChild){
      section.innerHTML='<div class="time-range-row">'+["start","end"].map(boundary=>
        '<button type="button" class="time-value-button" data-action="pick-time" data-shift="'+shift+'" data-boundary="'+boundary+'" aria-haspopup="dialog">'+
        '<span class="time-value-label">'+escapeHTML(t(boundary==="start"?"timeStart":"timeEnd"))+'</span><strong dir="ltr">--:--</strong></button>').join("")+
        '</div><button type="button" class="time-next-day" data-action="toggle-next-day" data-shift="'+shift+'" aria-pressed="false">'+
        '<span class="time-next-day-check" aria-hidden="true">✓</span>'+escapeHTML(t("timeNextDay"))+'</button>'+
        '<p class="time-range-status" aria-live="polite"></p>';
    }
    for(const boundary of ["start","end"]){
      const button=section.querySelector('[data-boundary="'+boundary+'"]');
      button.disabled=!worked;
      button.querySelector("strong").textContent=timing[boundary]||"--:--";
      button.classList.toggle("has-value",!!timing[boundary]);
      button.setAttribute("aria-label",shiftName(shift)+" — "+t(boundary==="start"?"timeStart":"timeEnd")+": "+(timing[boundary]||t("timeChoose")));
    }
    const toggle=section.querySelector(".time-next-day");
    toggle.disabled=!worked;toggle.setAttribute("aria-pressed",String(timing.nextDay));
    const state=section.querySelector(".time-range-status");
    const warning=worked&&detail.state!=="ready";
    state.classList.toggle("is-warning",warning);
    state.textContent=!worked?t("timeNeedWork"):detail.state==="ready"?
      t("timeDuration")+" · "+durationText(detail.minutes):
      t(detail.state==="invalid"?"timeInvalid":detail.state==="overlap"?"timeOverlap":"timeMissing");
    if(worked&&detail.state==="ready")dayMinutes+=detail.minutes;
    if(warning)pending++;
  }
  const summary=$("time-day-summary");
  summary.hidden=!hourly;
  summary.textContent=t("timeDayTotal")+" · "+durationText(dayMinutes)+(pending?" · "+t("timeMissing"):"");
  $("sheet-root").querySelector(".quick-sheet")?.classList.toggle("is-hourly",hourly);
}
function openTimeForShift(shift,boundary,trigger){
  if(!chosenDate||selectedPolicy().payMode!=="hourly"||getStatus(records,chosenDate,shift)!=="work")return;
  const key=chosenDate;
  timePicker.open({value:getTiming(records,key,shift)[boundary],trigger,
    label:shiftName(shift)+" · "+t(boundary==="start"?"timeStart":"timeEnd"),
    onCommit:value=>commitTime(key,shift,{[boundary]:value})});
}
function commitTime(key,shift,patch){
  if(!key||key!==chosenDate||selectedPolicy().payMode!=="hourly"||getStatus(records,key,shift)!=="work")return;
  recordedMonthPolicy(key.slice(0,7));
  const old=getTiming(records,key,shift);
  records=updateTiming(records,key,shift,patch);
  auditChange("shift",key.slice(0,7),key+" "+shift+" times "+JSON.stringify(old)+" > "+JSON.stringify(getTiming(records,key,shift)));
  envelopeOpen=false;
  updateSheetControls();refreshShiftSummary();
  persist(DATA_KEY,records);
}
function renderTranslations() {
  document.documentElement.lang = settings.language;
  document.documentElement.dir = settings.language === "fa" ? "rtl" : "ltr";
  applyTheme(settings.theme);
  const todayButton = $("go-today");
  todayButton.textContent = formatToday();
  todayButton.setAttribute("aria-label", t("today"));
  todayButton.title = t("today");
  const selectedTheme = document.querySelector('input[name="theme"][value="' + settings.theme + '"]');
  if(selectedTheme) selectedTheme.checked = true;
  document.title = "Planning";
  for(const el of document.querySelectorAll("[data-text]")){
    el.textContent = t(el.dataset.text);
  }
  $("previous-month").setAttribute("aria-label",t("prevMonth"));
  $("next-month").setAttribute("aria-label",t("nextMonth"));
  $("morning-key").textContent = shiftName("morning");
  $("evening-key").textContent = shiftName("evening");
  $("language-select").value = settings.language;
  $("weekstart-select").value = String(settings.weekStart);
  pickerControls.refresh();
  $("morning-input").value = settings.morningName;
  $("evening-input").value = settings.eveningName;
  $("morning-input").placeholder = t("morning");
  $("evening-input").placeholder = t("evening");
  fillPaySettings();
  updateArchiveStatus();
}
function ledMarkup(status) {
  const symbol = status === "work" ? "✓" : status === "off" ? "×" : "";
  return '<span aria-hidden="true" class="led ' + status + '">' + symbol + '</span>';
}
function renderPayroll(stats) {
  const pay = calculatePayroll(records,year,month,selectedPolicy(),getTimeAnalysis());
  const hourly=pay.mode==="hourly";
  $("pay-duration-summary").hidden=!hourly;
  $("pay-duration-summary").textContent=t("hourlySummary")
    .replace("{duration}",durationText(pay.minutes)).replace("{rate}",euro(pay.rateCents));
  $("pay-incomplete-notice").hidden=!hourly||pay.pendingShifts===0;
  $("pay-incomplete-notice").textContent=t("pendingPay").replace("{count}",num(pay.pendingShifts));
  const available = pay.envelopeCents > 0;
  if (!available) envelopeOpen = false;
  $("finance-period").textContent = monthLocale();
  $("salary-total").textContent = euro(pay.totalCents);
  $("payslip-amount").textContent = euro(pay.payslipCents);
  $("payslip-cap").textContent = euro(pay.capCents);
  $("payslip-meter-fill").style.width = pay.progressPercent + "%";
  $("payslip-meter").setAttribute("aria-valuenow", String(Math.round(pay.progressPercent)));
  $("payslip-meter").setAttribute("aria-valuetext", euro(pay.payslipCents) + " / " + euro(pay.capCents));
  $("payslip-meter").setAttribute("aria-label", t("payslipTitle"));
  $("payslip-percent").textContent = num(Math.round(pay.progressPercent)) + " % " + t("payUsage");
  $("envelope-amount").textContent = euro(pay.envelopeCents);
  const card = $("envelope-card");
  card.disabled = false;
  card.setAttribute("aria-disabled", String(!available));
  card.classList.toggle("is-locked", !available);
  card.classList.toggle("is-available", available);
  card.classList.toggle("is-open", available && envelopeOpen);
  card.setAttribute("aria-expanded", String(available && envelopeOpen));
  const message = !available ? t("envelopeLocked") :
    envelopeOpen ? t("envelopeClose") : t("envelopeTap");
  $("envelope-caption").textContent = message;
  card.setAttribute("aria-label", t("envelopeTitle") + " — " + (available && envelopeOpen ? euro(pay.envelopeCents) + " — " : "") + message);
}
function renderHistory() {
  const entries=monthlyHistory(records,monthlyPolicies,settings);
  const root=$("history-months");
  if(!entries.length){
    root.innerHTML='<div class="history-empty">'+t("historyEmpty")+'</div>';
    return;
  }
  root.innerHTML=entries.map(entry=>{
    const stamp=new Intl.DateTimeFormat(locales[settings.language],{month:"long",year:"numeric"})
      .format(new Date(entry.year,entry.month-1,15));
    const details=num(entry.stats.halfDays)+" "+t("daysUnit")+" · "+
      (entry.pay.mode==="hourly"?durationText(entry.pay.minutes)+" · ":"")+
      t("payslipTitle")+" "+euro(entry.pay.payslipCents)+" · "+
      t("envelopeTitle")+" "+euro(entry.pay.envelopeCents)+
      (entry.pay.pendingShifts?" · "+t("pendingPay").replace("{count}",num(entry.pay.pendingShifts)):"");
    return '<button type="button" class="history-month '+
      (entry.key===periodKey(year,month)?"is-current":"")+
      '" data-period="'+entry.key+'"><span class="history-month-main">'+
      '<strong class="history-month-title">'+escapeHTML(stamp)+'</strong>'+
      '<span class="history-month-details">'+escapeHTML(details)+'</span></span>'+
      '<strong class="history-month-total money" dir="ltr">'+euro(entry.pay.totalCents)+
      '</strong></button>';
  }).join("");
}
function renderCalendar() {
  const stats = monthStats(records,year,month);
  const all = overallStats(records);
  $("month-label").textContent = monthLocale();
  $("month-days").textContent = num(stats.halfDays);
  renderPayroll(stats);
  $("alltime-days").textContent = num(all.halfDays);
  $("alltime-shifts").textContent = num(all.work) + " " + t("shiftsCount");
  renderHistory();
  const order = Array.from({length:7},(_,i)=>(settings.weekStart+i)%7);
  $("weekdays").innerHTML = order.map(day=>
    '<span class="weekday">' + weekdays[settings.language][day] + '</span>'
  ).join("");
  const todayKey = dateKey(new Date().getFullYear(),new Date().getMonth(),new Date().getDate());
  $("calendar-grid").innerHTML = calendarCells(year,month,settings.weekStart).map(day=>{
    if(!day) return '<span class="day empty" aria-hidden="true"></span>';
    const am = getStatus(records,day.key,"morning");
    const pm = getStatus(records,day.key,"evening");
    const title = dateLocale(day.key) + " — " + shiftName("morning") + ": " +
      t(am==="work"?"worked":am==="off"?"didNotWork":"notRecorded") + " — " +
      shiftName("evening") + ": " + t(pm==="work"?"worked":pm==="off"?"didNotWork":"notRecorded");
    const classNames = "day" + (day.key === todayKey ? " is-today" : "") +
      (day.key === chosenDate ? " is-selected" : "");
    return '<button type="button" class="' + classNames + '" data-date="' + day.key +
      '"' + (day.key===todayKey ? ' aria-current="date"' : '') +
      ' aria-label="' + escapeHTML(title) + '"><span class="day-num">' +
      num(day.day) + '</span><span class="leds">' + ledMarkup(am) +
      ledMarkup(pm) + '</span></button>';
  }).join("");
  decorateCalendarTimes();
}
function refreshCurrentDay() {
  const now=new Date();
  const key=dateKey(now.getFullYear(),now.getMonth(),now.getDate());
  const grid=$("calendar-grid");
  for(const previous of grid.querySelectorAll('.day.is-today')){
    if(previous.dataset.date!==key){
      previous.classList.remove("is-today");
      previous.removeAttribute("aria-current");
    }
  }
  const todayCell=grid.querySelector('[data-date="'+key+'"]');
  if(todayCell){
    todayCell.classList.add("is-today");
    todayCell.setAttribute("aria-current","date");
  }
  $("go-today").textContent=formatToday();
}
function scheduleCurrentDayRefresh() {
  const now=new Date();
  const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,1);
  setTimeout(()=>{
    refreshCurrentDay();
    scheduleCurrentDayRefresh();
  },Math.max(1000,next-now));
}
document.addEventListener("visibilitychange",()=>{
  if(!document.hidden)refreshCurrentDay();
});
window.addEventListener("pageshow",refreshCurrentDay);
scheduleCurrentDayRefresh();
function showPage(nextPage) {
  page = nextPage;
  $("home-view").hidden = page !== "home";
  $("settings-view").hidden = page !== "settings";
  $("nav-home").classList.toggle("active",page==="home");
  $("nav-settings").classList.toggle("active",page==="settings");
  if(page==="home") {
    $("nav-home").setAttribute("aria-current","page");
    $("nav-settings").removeAttribute("aria-current");
  } else {
    $("nav-settings").setAttribute("aria-current","page");
    $("nav-home").removeAttribute("aria-current");
  }
  $("go-today").hidden = page==="settings";
  if(page!=="settings") applyTheme(settings.theme);
  if(page==="settings"){
    fillPaySettings();
  }
  $("app").scrollTop = 0;
  window.scrollTo({top:0,behavior:"instant"});
}
function stateChoice(key,shift,value) {
  const status = getStatus(records,key,shift);
  const label = value==="work"?"worked":value==="off"?"didNotWork":"notRecorded";
  return '<button type="button" class="state-btn quick-state-btn '+(status===value?"selected":"")+
    '" data-action="set-shift" data-date="'+key+'" data-shift="'+shift+'" data-state="'+value+
    '" role="radio" aria-checked="'+(status===value)+'" aria-label="'+
    escapeHTML(shiftName(shift)+" — "+t(label))+'">'+ledMarkup(value)+
    '<span>'+escapeHTML(t(label))+'</span></button>';
}
function shiftEditor(key,shift) {
  const icon=shift==="morning"?"☀":"☾";
  return '<section class="shift-editor quick-shift-editor" data-editor-shift="'+shift+'">'+
    '<div class="quick-shift-label"><span class="quick-shift-icon" aria-hidden="true">'+icon+
    '</span><strong>'+escapeHTML(shiftName(shift))+'</strong></div>'+
    '<div class="state-choice quick-state-choice" role="radiogroup" aria-label="'+
    escapeHTML(shiftName(shift))+'">'+
    ["work","off","unset"].map(value=>stateChoice(key,shift,value)).join("")+
    '</div><div class="shift-time-section" data-time-section="'+shift+'" hidden></div></section>';
}
function renderSheet() {
  const root=$("sheet-root");
  document.body.style.overflow=chosenDate?"hidden":"";
  if(!chosenDate){root.replaceChildren();return;}
  clearTimeout(toastTimer);$("toast").classList.remove("visible");
  const arrowLeft='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 5-7 7 7 7"/></svg>';
  const arrowRight='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 5 7 7-7 7"/></svg>';
  root.innerHTML='<div class="sheet-overlay quick-overlay" id="sheet-overlay">'+
    '<section class="sheet quick-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-heading" tabindex="-1">'+
    '<div class="sheet-handle"></div>'+
    '<div class="quick-sheet-top"><div class="quick-title-stack"><span class="quick-eyebrow">SHIFT PLANNER</span>'+
    '<h2 id="sheet-heading">'+escapeHTML(t("entryTitle"))+'</h2></div>'+
    '<button class="sheet-close quick-close" type="button" data-action="close-sheet" aria-label="'+
    escapeHTML(t("entryClose"))+'">×</button></div>'+
    '<div class="quick-date-bar">'+
    '<button type="button" class="quick-day-arrow quick-prev" data-action="previous-day" aria-label="'+
    escapeHTML(t("entryPrevDay"))+'">'+arrowLeft+'</button>'+
    '<div class="quick-date-center"><strong id="quick-day-number"></strong>'+
    '<span class="quick-date-words"><b id="quick-day-weekday"></b><small id="quick-day-month"></small></span></div>'+
    '<button type="button" class="quick-day-arrow quick-next" data-action="next-day" aria-label="'+
    escapeHTML(t("entryNextDay"))+'">'+arrowRight+'</button></div>'+
    '<div class="quick-editor-list">'+
    shiftEditor(chosenDate,"morning")+shiftEditor(chosenDate,"evening")+
    '</div><div id="time-day-summary" class="time-day-summary" hidden></div><div class="quick-presets">'+
    '<button type="button" class="quick-preset quick-preset-work" data-action="set-day" data-state="work">'+
    '<span aria-hidden="true">✓✓</span>'+escapeHTML(t("entryBothWork"))+'</button>'+
    '<button type="button" class="quick-preset quick-preset-off" data-action="set-day" data-state="off">'+
    '<span aria-hidden="true">××</span>'+escapeHTML(t("entryBothOff"))+'</button>'+
    '</div><div class="quick-save-note"><span class="quick-save-dot" aria-hidden="true"></span>'+
    escapeHTML(t("entryAutoSaved"))+'</div></section></div>';
  updateSheetControls();
}
function updateSheetControls() {
  if(!chosenDate)return;
  const root=$("sheet-root");
  if(!root.querySelector(".quick-sheet"))return;
  const [y,m,d]=chosenDate.split("-").map(Number);
  const date=new Date(y,m-1,d,12);
  const locale=locales[settings.language];
  root.querySelector("#quick-day-number").textContent=num(d);
  root.querySelector("#quick-day-weekday").textContent=
    new Intl.DateTimeFormat(locale,{weekday:"long"}).format(date);
  root.querySelector("#quick-day-month").textContent=
    new Intl.DateTimeFormat(locale,{month:"long",year:"numeric"}).format(date);
  for(const button of root.querySelectorAll('[data-action="set-shift"]')){
    const shift=button.dataset.shift;
    const selected=getStatus(records,chosenDate,shift)===button.dataset.state;
    button.dataset.date=chosenDate;
    button.classList.toggle("selected",selected);
    button.setAttribute("aria-checked",String(selected));
    button.setAttribute("aria-label",shiftName(shift)+" — "+
      t(button.dataset.state==="work"?"worked":button.dataset.state==="off"?"didNotWork":"notRecorded"));
  }
  for(const button of root.querySelectorAll('[data-action="set-day"]')){
    const state=button.dataset.state;
    const selected=SHIFTS.every(shift=>getStatus(records,chosenDate,shift)===state);
    button.classList.toggle("is-selected",selected);
    button.setAttribute("aria-pressed",String(selected));
  }
  updateTimeControls();
}
function updateCalendarDay(key) {
  const cell=$("calendar-grid").querySelector('[data-date="'+key+'"]');
  if(!cell)return;
  const am=getStatus(records,key,"morning"),pm=getStatus(records,key,"evening");
  const describe=shift=>t(getStatus(records,key,shift)==="work"?"worked":
    getStatus(records,key,shift)==="off"?"didNotWork":"notRecorded");
  cell.setAttribute("aria-label",dateLocale(key)+" — "+shiftName("morning")+": "+describe("morning")+
    " — "+shiftName("evening")+": "+describe("evening"));
  const leds=cell.querySelector(".leds");
  if(leds)leds.innerHTML=ledMarkup(am)+ledMarkup(pm);
}
function refreshShiftSummary() {
  const monthly=monthStats(records,year,month),all=overallStats(records);
  $("month-days").textContent=num(monthly.halfDays);
  $("alltime-days").textContent=num(all.halfDays);
  $("alltime-shifts").textContent=num(all.work)+" "+t("shiftsCount");
  renderPayroll(monthly);
  renderHistory();
  decorateCalendarTimes();
}
function applyShiftBatch(key,updates) {
  if(!key)return false;
  const [y,m]=key.split("-").map(Number);
  const changes=SHIFTS.filter(shift=>updates[shift] &&
    getStatus(records,key,shift)!==updates[shift]);
  if(!changes.length)return false;
  const policy=recordedMonthPolicy(key.slice(0,7));
  const beforePay=calculatePayroll(records,y,m-1,policy,getTimeAnalysis()).totalCents;
  let updated=records;
  for(const shift of changes) {
    const previous=getStatus(updated,key,shift);
    updated=updateStatus(updated,key,shift,updates[shift]);
    auditChange("shift",key.slice(0,7),
      key+" "+shift+" "+previous+" > "+updates[shift]);
  }
  records=updated;
  const afterPay=calculatePayroll(records,y,m-1,policy,getTimeAnalysis()).totalCents;
  if(changes.length)audit[audit.length-1].detail+="; "+beforePay+" > "+afterPay+" cents";
  envelopeOpen=false;
  updateCalendarDay(key);
  updateSheetControls();
  refreshShiftSummary();
  persist(DATA_KEY,records);
  return true;
}
function moveSelectedDay(delta) {
  if(!chosenDate)return;
  const [y,m,d]=chosenDate.split("-").map(Number);
  const next=new Date(y,m-1,d+delta,12);
  if(next.getFullYear()<1900||next.getFullYear()>2200)return;
  const previous=chosenDate;
  chosenDate=dateKey(next.getFullYear(),next.getMonth(),next.getDate());
  if(year!==next.getFullYear()||month!==next.getMonth()){
    year=next.getFullYear();month=next.getMonth();
    envelopeOpen=false;
    renderCalendar();
  } else {
    const previousButton=$("calendar-grid").querySelector('[data-date="'+previous+'"]');
    const nextButton=$("calendar-grid").querySelector('[data-date="'+chosenDate+'"]');
    previousButton?.classList.remove("is-selected");
    nextButton?.classList.add("is-selected");
  }
  updateSheetControls();
}
function renderAll() {
  timePicker.close();
  pickerControls.close(false);
  renderTranslations();
  renderCalendar();
  renderSheet();
  showPage(page);
}
function closeSheet() {
  timePicker.close();
  const oldDate=chosenDate;
  chosenDate=null;
  renderSheet();
  const previous=$("calendar-grid").querySelector('[data-date="'+oldDate+'"]');
  if(previous){
    previous.classList.remove("is-selected");
    previous.focus({preventScroll:true});
  }
}
function changeMonth(delta) {
  envelopeOpen = false;
  const newMonth = new Date(year,month+delta,15);
  year = newMonth.getFullYear();
  month = newMonth.getMonth();
  renderCalendar();
}
$("previous-month").addEventListener("click",()=>changeMonth(-1));
$("next-month").addEventListener("click",()=>changeMonth(1));
$("go-today").addEventListener("click",()=>{
  const now = new Date();
  year = now.getFullYear();
  month = now.getMonth();
  envelopeOpen = false;
  showPage("home");
  renderCalendar();
});
$("nav-home").addEventListener("click",()=>showPage("home"));
$("nav-settings").addEventListener("click",()=>showPage("settings"));
document.querySelectorAll('input[name="theme"]').forEach(input=>{
  input.addEventListener("change",()=>{
    if(input.checked) applyTheme(input.value);
  });
});
$("history-months").addEventListener("click",event=>{
  const button=event.target.closest("button[data-period]");
  if(!button)return;
  const key=button.dataset.period;
  const y=Number(key.slice(0,4)), m=Number(key.slice(5,7))-1;
  if(!Number.isInteger(y)||!Number.isInteger(m)||m<0||m>11)return;
  year=y;month=m;envelopeOpen=false;
  renderCalendar();
  $("finance-period").scrollIntoView({block:"start",behavior:"smooth"});
});
$("envelope-card").addEventListener("click",()=>{
  const card = $("envelope-card");
  if(calculatePayroll(records,year,month,selectedPolicy(),getTimeAnalysis()).envelopeCents <= 0){
    const illustration = card.querySelector(".envelope-illustration");
    illustration.classList.remove("shake-locked");
    void illustration.offsetWidth;
    illustration.classList.add("shake-locked");
    return;
  }
  envelopeOpen = !envelopeOpen;
  renderPayroll(monthStats(records,year,month));
});
$("envelope-card").querySelector(".envelope-illustration").addEventListener("animationend",event=>{
  if(event.animationName === "locked-nudge"){
    event.currentTarget.classList.remove("shake-locked");
  }
});

$("calendar-grid").addEventListener("click",event=>{
  const button=event.target.closest("button[data-date]");
  if(!button)return;
  $("calendar-grid").querySelector(".day.is-selected")?.classList.remove("is-selected");
  chosenDate=button.dataset.date;
  button.classList.add("is-selected");
  renderSheet();
  $("sheet-root").querySelector(".quick-sheet")?.focus({preventScroll:true});
});
$("sheet-root").addEventListener("click",event=>{
  if(event.target.id==="sheet-overlay"){closeSheet();return;}
  const button=event.target.closest("button[data-action]");
  if(!button)return;
  const action=button.dataset.action;
  if(action==="close-sheet"){closeSheet();return;}
  if(action==="previous-day"){moveSelectedDay(-1);return;}
  if(action==="next-day"){moveSelectedDay(1);return;}
  if(action==="pick-time"){
    openTimeForShift(button.dataset.shift,button.dataset.boundary,button);return;
  }
  if(action==="toggle-next-day"){
    const shift=button.dataset.shift;
    commitTime(chosenDate,shift,{nextDay:!getTiming(records,chosenDate,shift).nextDay});return;
  }
  if(action==="set-shift"){
    applyShiftBatch(chosenDate,{[button.dataset.shift]:button.dataset.state});
    return;
  }
  if(action==="set-day"){
    applyShiftBatch(chosenDate,{morning:button.dataset.state,evening:button.dataset.state});
  }
});
let quickSwipeStart=null;
$("sheet-root").addEventListener("touchstart",event=>{
  if(!chosenDate || !event.target.closest(".quick-date-bar") ||
     event.target.closest("button")) return;
  const touch=event.touches[0];
  if(touch)quickSwipeStart={x:touch.clientX,y:touch.clientY};
},{passive:true});
$("sheet-root").addEventListener("touchend",event=>{
  if(!quickSwipeStart || !chosenDate) return;
  const start=quickSwipeStart;quickSwipeStart=null;
  const touch=event.changedTouches[0];
  if(!touch)return;
  const dx=touch.clientX-start.x,dy=touch.clientY-start.y;
  if(Math.abs(dx)<54 || Math.abs(dy)>35)return;
  const rtl=document.documentElement.dir==="rtl";
  moveSelectedDay((dx<0?1:-1)*(rtl?-1:1));
},{passive:true});
$("sheet-root").addEventListener("keydown",event=>{
  if(!chosenDate || event.key!=="Tab")return;
  const sheet=$("sheet-root").querySelector(".quick-sheet");
  if(!sheet)return;
  const buttons=[...sheet.querySelectorAll("button:not(:disabled)")];
  if(!buttons.length)return;
  const index=buttons.indexOf(document.activeElement);
  if(event.shiftKey && index<=0){
    event.preventDefault();buttons[buttons.length-1].focus();
  }else if(!event.shiftKey && index===buttons.length-1){
    event.preventDefault();buttons[0].focus();
  }
});
document.addEventListener("keydown",event=>{
  if(event.key==="Escape" && chosenDate && !timePicker.isOpen()) closeSheet();
});

$("settings-form").addEventListener("submit",event=>{
  event.preventDefault();
  const selectedMonth=periodKey(year,month),oldPolicy=payPolicy(selectedPolicy());
  const updatedPolicy=payPolicy({
    payMode:document.querySelector('input[name="pay-mode"]:checked')?.value||oldPolicy.payMode,
    shiftRate:$("shift-rate-input").value,
    hourlyRate:$("hourly-rate-input").value,
    payslipCap:$("payslip-cap-input").value
  });
  const changedMoney=Object.keys(updatedPolicy).some(key=>updatedPolicy[key]!==oldPolicy[key]);
  if(updatedPolicy.payMode!==oldPolicy.payMode&&monthStats(records,year,month).work>0){
    if(!confirm(t("modeConfirm").replace("{month}",monthLocale())))return;
  }
  rememberExistingMonths();
  if(changedMoney){
    monthlyPolicies[selectedMonth]=updatedPolicy;
    auditChange("settings",selectedMonth,JSON.stringify(oldPolicy)+" > "+JSON.stringify(updatedPolicy));
  }
  const today=new Date(),currentPeriod=periodKey(today.getFullYear(),today.getMonth());
  // Editing a historic month must never change defaults for future months.
  const defaults=changedMoney&&selectedMonth>=currentPeriod?updatedPolicy:payPolicy(settings);
  settings=sanitizeSettings({...defaults,
    language:$("language-select").value,
    theme:document.querySelector('input[name="theme"]:checked')?.value||settings.theme,
    weekStart:Number($("weekstart-select").value),
    morningName:$("morning-input").value,eveningName:$("evening-input").value
  });
  envelopeOpen=false;
  persist(SETTINGS_KEY,settings);renderAll();showToast(t("settingsSaved"));
});
document.querySelectorAll('input[name="pay-mode"]').forEach(input=>{
  input.addEventListener("change",updatePayModePreview);
});

$("export-backup").addEventListener("click",()=>{
  const backup = makeBackup(records,settings,monthlyPolicies,audit);
  const blob = new Blob([JSON.stringify(backup,null,2)],{type:"application/json;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const now = new Date();
  a.download = "shift-planner-backup-" + dateKey(now.getFullYear(),now.getMonth(),now.getDate()) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("import-backup").addEventListener("click",()=>$("backup-file").click());
$("backup-file").addEventListener("change",async event=>{
  const file = event.target.files?.[0];
  event.target.value = "";
  if(!file) return;
  try {
    if(file.size > 25_000_000) throw new Error("too-large");
    const backup = parseBackup(await file.text());
    if(!window.confirm(t("importConfirm"))) return;
    const wasEmpty=Object.keys(records).length===0;
    const incomingPolicies={...backup.monthlyPolicies};
    for(const day of Object.keys(backup.records)) {
      const period=day.slice(0,7);
      if(!incomingPolicies[period]){
        incomingPolicies[period]=payPolicy(backup.settings);
      }
    }
    const merged=mergeHistory(records,backup.records,monthlyPolicies,incomingPolicies);
    records=merged.records;
    monthlyPolicies=merged.monthlyPolicies;
    if(wasEmpty) settings=backup.settings;
    audit=sanitizeAudit([...audit,...backup.audit]);
    auditChange("import",periodKey(year,month),
      "Backup merged; conflicts kept current: "+merged.conflicts);
    envelopeOpen = false;
    persist(DATA_KEY,records);
    renderAll();
    showToast(t("backupMerged"));
  } catch {
    showToast(t("importError"));
  }
});
// Intentionally no "delete all history" action. Existing entries can be corrected individually.
window.addEventListener("storage",event=>{
  if(event.key!==ARCHIVE_KEY || !event.newValue) return;
  let updated;
  try { updated=JSON.parse(event.newValue); } catch { return; }
  if(!updated || ![2,3].includes(updated.schemaVersion) || Number(updated.savedAt)<=lastSavedAt) return;
  records=sanitizeRecords(updated.records);
  settings=sanitizeSettings(updated.settings);
  monthlyPolicies=sanitizeMonthlyPolicies(updated.monthlyPolicies);
  audit=sanitizeAudit(updated.audit);
  lastSavedAt=Number(updated.savedAt);
  envelopeOpen=false;
  renderAll();
});
const timePicker=createTimePicker({getText:t});
const pickerControls = setupPickers({getText:t,getLanguage:()=>settings.language});
renderAll();
void initializeArchive();
if("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
}
