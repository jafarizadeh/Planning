# Planning Équipe

Employer PWA for team scheduling, employee photographs, two shifts per day,
monthly payslip and envelope calculations, and complete historical tracking.

Online: https://planning-equipe-peach.vercel.app

## Run locally

Run: python3 -m http.server 8080
Open http://localhost:8080 in a browser.

The run.py script starts an Ubuntu-specific desktop app window.

## Test

Run: node --test tests.mjs

## History and deletion

An employee appears only during months of employment. Removing a team member
preserves prior months in read-only mode. Optional permanent deletion,
after a clear warning, deletes all that worker's monthly records.

## Local data

Employee records, photos and salaries are stored on the device, in
IndexedDB and localStorage. GitHub and Vercel host only source files.
Create separate JSON backups from within the app. This public source
repository deliberately contains no real employee or user records.

Default language: French; English and Chinese also supported.
