# Planning — personal app

Mobile-first PWA for recording morning/evening shifts and calculating salary,
payslip and envelope excess.

**Production:** https://planning-xi-ruby.vercel.app

## Run

From this directory, serve files with any static HTTP server, for example:

```sh
python3 -m http.server 8080
```

Open http://localhost:8080 in a browser. The included `run.py` is an
Ubuntu-focused desktop launcher.

## Test

```sh
node --test tests.mjs
```

## Local data and privacy

This app stores records and payroll history in the phone/browser's local
storage and IndexedDB; it does not synchronize data to GitHub or Vercel.
Export a backup in Settings and store it separately. Never commit personal
work records or exported backups to this repository.

Default UI language is French. The two apps are developed independently.
