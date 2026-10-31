# Planning — app source archive

Two standalone Progressive Web Apps, with **separate branches** and distinct
user-data stores.

| Branch | Application | Public deployment |
| --- | --- | --- |
| [app/personal](../../tree/app/personal) | Planning — personal shift calendar | https://planning-xi-ruby.vercel.app |
| [app/equipe](../../tree/app/equipe) | Planning Équipe — employer scheduling & payroll | https://planning-equipe-peach.vercel.app |

**Select an application branch** to find that app's complete deployable root.
The \`main\` branch is only this directory/index. Do not merge the app branches
into \`main\` or into each other.

## Privacy

No work records, real employee photos, browser profiles, exports or backups are
part of this source archive. Both apps store their data locally on each device,
not in GitHub.

This repository is **public**, so do not commit credentials or private records.
Keep user-data backups outside GitHub.

## Deployments

These Git branches are independent of the existing Vercel deployments.
Pushing source here does **not** automatically update Vercel unless each
deployment is separately configured to track its correct branch.
