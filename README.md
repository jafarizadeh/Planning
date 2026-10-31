# Planning — personal app

A standalone, mobile-first Progressive Web App for morning/evening shifts and pay.
Branch: `app/personal`. The employer application is separate on `app/equipe`.

## Development: pay modes (v2.0)

Settings → **Rémunération** offers two modes:

- **Par créneau:** the existing flat rate per worked shift (default €40).
- **À l’heure:** an independent hourly rate (initial value €10/hour).

Save settings with **Enregistrer**. The mode/rates apply to the month displayed
in the settings card. Existing other months retain their stored policies.
Editing an older month's rates does not change the default for future months.
A mode change on a month with recorded work requires confirmation.

In hourly mode, each morning/evening section has **Début** and **Fin** below
its three status buttons. Tap either time to open a 24-hour hour/minute wheel;
no text keyboard is needed. Select the time and tap **Valider**. Time edits are
saved automatically. Controls are enabled only for a **Travaillé** shift.

Work duration and that day's total hours are displayed. The monthly sum uses
only worked shifts with complete, valid times. Missing or invalid ranges are
marked as incomplete and the salary is explicitly labelled provisional.
For example, 09:15–12:45 at €10/hour means 210 minutes and €35.

### Calculation rules

- Minutes are counted exactly. Hourly rates are stored in cents; the aggregate
  monthly amount is rounded to the nearest cent once, not per shift.
- The existing payslip/envelope split is unchanged. At €800 total with a €711
  cap, the payslip is €711 and the envelope is €89.
- Each worked shift still counts as half a day in the day counters.
- For overnight work, explicitly choose **Fin le lendemain**. A range must be
  positive and less than 24 hours. Equal or reversed times are not paid.
- Overlapping worked time ranges are flagged and excluded until corrected.
- A shift that crosses midnight is assigned to its start date/month.
- Durations are entered wall-clock hours; the app does not infer unpaid breaks,
  overtime multipliers, taxes, or daylight-saving-time adjustments.
- Switching to flat-shift mode keeps entered times. OFF / not-recorded status
  also preserves entered times but excludes them from pay.

### History and storage

Data remains on this device in localStorage and IndexedDB. Archive schema 3
adds timings and monthly pay modes; v1/v2 backups still import. Existing
shift-only records migrate without changing their amounts. Exports include
the mode, both rates, monthly policies, and times. Import keeps current records
and current monthly policies on conflicts, rather than overwriting them.

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
node --test tests.mjs hourly-tests.mjs
```

Optional mobile browser regression (Puppeteer is needed):

```sh
# Serve this directory separately before running the browser tests.
PLANNING_TEST_URL=http://127.0.0.1:8080/ node hourly-browser-test.cjs
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
