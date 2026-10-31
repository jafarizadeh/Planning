# Planning — personal app

A standalone, mobile-first Progressive Web App for morning/evening shifts and pay.
Branch: `app/personal`. The employer application is separate on `app/equipe`.

## Development: automatic settings and monthly history (v2.3)

The home screen keeps **Historique travail et salaire**, including every recorded
month and its payroll details. The separate **Total depuis le début** cumulative
card has been removed. This is a presentation-only change: records, stored pay
policies, backups and monthly calculations are unchanged.

Settings → **Rémunération** offers two modes:

- **Par créneau:** the existing flat rate per worked shift (default €40).
- **À l’heure:** an independent hourly rate (initial value €10/hour).

Settings save **automatically**; there is no Save button. Both **Mode de calcul** (shift/hourly) and
**Versement** (single/split) are global preferences: changing the displayed month,
year, reopening the app or going offline never resets them. A choice saved while
viewing a past month applies to all months too.

**Important:** changing either global mode intentionally recalculates the displayed
amounts for all recorded months, using their own rates and times. A confirmation
explains this before applying the switch when any worked shifts exist. Cancelling
restores that switch to its saved choice. Independently edited fields remain saved.
Work statuses and personal times are not erased.

### Automatic settings

- Language, first weekday, theme and accepted mode switches save immediately.
- Names and rates save after a 450 ms pause in typing, on blur, and before leaving
  Settings or hiding the page. Saving does not rebuild the form, move the caret or
  scroll to the top.
- Amounts must be nonempty, nonnegative, at most 100,000, and have no more than
  two decimals. Invalid drafts show an inline message and never overwrite the
  last valid value; leaving the page restores that valid value.
- Confirming a default-time picker immediately saves a valid schedule. Equal or
  overlapping times stay as a visible draft until corrected; other settings can
  still be saved independently.
- A small status reports automatic saving, saved changes, validation problems or
  storage failure. A failed localStorage write can succeed in IndexedDB; if both
  fail, the UI reports an error and retries on focus/online/return.
- Exporting a backup flushes valid pending fields first. All persistence remains
  local; automatic saving is not a cloud backup or a device-sync feature.

Stored rates, payslip caps and default schedules remain associated with their
recorded months. Editing those numeric/time values in an older month does not
replace the defaults used by new months. Only the two mode switches are global.

In hourly mode, each morning/evening section has **Début** and **Fin** below
its three status buttons. Tap either time to open a 24-hour hour/minute wheel;
no text keyboard is needed. Select the time and tap **Valider**. Time edits are
saved automatically. Controls are enabled only for a **Travaillé** shift.

### Default hours and personal overrides

In hourly mode, **Horaires par défaut** is configurable in Settings using the
same time wheels. Initial values are **10:00–14:00** for Matin and
**18:00–22:00** for Soir. These are fallback times, not automatic work records:
unrecorded and non-worked shifts still earn nothing.

Each explicitly entered start/end in the calendar takes priority over the
corresponding monthly default. Changing default hours never overwrites personal
entries. The **Par défaut** action in a time picker resets only that boundary;
the per-shift reset restores both defaults. Switching mode or work status does
not erase custom times.

Work duration and that day's total hours are displayed. The monthly sum uses
worked shifts with valid effective times (personal entries first, then defaults).
Invalid or overlapping ranges remain excluded and visibly provisional.
For example, 09:15–12:45 at €10/hour means 210 minutes and €35.

### Calculation rules

- Minutes are counted exactly. Hourly rates are stored in cents; the aggregate
  monthly amount is rounded to the nearest cent once, not per shift.
- **Versement → En une fois:** show only the **Total** strip on the home screen.
  The entire payslip/envelope card group, cap field and progress meter are hidden.
  No duplicate payslip amount appears in the current month or a history subtitle.
- **Versement → En deux fois:** the configured cap applies; excess goes into
  the envelope. At €800 total and a €711 cap, this remains €711 + €89.
- Pay method and payment split are independent. Each inactive rate/cap field
  is both hidden and disabled; its saved value is retained for switching back.
- Each worked shift still counts as half a day in the day counters.
- The extra **M Matin | S Soir** calendar key has been removed. Both daily shift
  indicators and their accessible labels remain available.
- There is no next-day checkbox. For default-aware periods, an end earlier
  than the start automatically crosses midnight; a small +1 day indicator
  clarifies it. Equal times are invalid, not a 24-hour shift. Legacy manual
  months retain their stored overnight semantics unless explicitly edited.
- Overlapping worked time ranges are flagged and excluded until corrected.
- A shift that crosses midnight is assigned to its start date/month.
- Durations are entered wall-clock hours; the app does not infer unpaid breaks,
  overtime multipliers, taxes, or daylight-saving-time adjustments.
- Switching to flat-shift mode keeps entered times. OFF / not-recorded status
  also preserves entered times but excludes them from pay.

### History and storage

Data remains on this device in localStorage and IndexedDB. Archive schema 5
records globally selected modes together with per-month values; v1/v2/v3/v4
backups still import. Older monthly mode values remain in preserved snapshots,
but no longer override the current global choices. Historical manual-only time
ranges stay manual-only: missing times are visibly pending rather than guessed.
Current/future periods use configured default hours; personal times keep priority.
Exports contain the global modes, both rates, monthly schedules and overrides.
Import keeps current records and current monthly values on conflicts. Importing
into an existing app does not replace its global mode selection.

Keep a separate exported backup before changing devices or deleting browser
site data. GitHub and Vercel do not store the user's work records.

## Run locally

```sh
python3 -m http.server 8080
```

Open `http://localhost:8080`. The optional `run.py` starts a narrow desktop
Chrome window on Ubuntu, using the app's dedicated local profile.

## Tests

```sh
node --test tests.mjs hourly-tests.mjs default-pay-tests.mjs global-modes-tests.mjs
```

Optional mobile browser regression (Puppeteer is needed):

```sh
# Serve this directory separately before running the browser tests.
PLANNING_TEST_URL=http://127.0.0.1:8080/ node hourly-browser-test.cjs
PLANNING_TEST_URL=http://127.0.0.1:8080/ node default-pay-browser-test.cjs
PLANNING_TEST_URL=http://127.0.0.1:8080/ node global-modes-browser-test.cjs
PLANNING_TEST_URL=http://127.0.0.1:8080/ node history-layout-browser-test.cjs
PLANNING_TEST_URL=http://127.0.0.1:8080/ node settings-autosave-browser-test.cjs
```

Set `PUPPETEER_MODULE` to an installed Puppeteer module when it is outside the
normal Node module path. Set `CHROME_PATH` when Chrome is not at
`/usr/bin/google-chrome`. Browser tests use a temporary browser profile and
synthetic work records, never the user's actual profile. Screenshots go to
`PLANNING_SCREENSHOTS` (default `/tmp`).

## Prepare a release

```sh
python3 prepare_publish.py
```

This creates a static-only `publish/` folder. It excludes tests, user data,
backups, and screenshots. This command does **not** deploy to Vercel.
The existing public site is https://planning-xi-ruby.vercel.app; local or Git
changes do not update that site automatically unless deployment is explicitly
configured for this branch.

The app supports French (default), English, German, Persian and Spanish, light
and dark modes, and offline use after the assets have been cached. Real iPhone
or Samsung hardware testing is separate from desktop mobile emulation.
