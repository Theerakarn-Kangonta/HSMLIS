# HSMLIS — Laboratory Information Management System

A multi-tenant LIS for medical and disease-control laboratories, modelled on the NDC LIMS
screen-by-screen spec (`NDC_LIMS_Website_Structure.md`). The full lab workflow is built:

register patient → create order (tests and packages) → print barcode labels → collect specimens →
receive into the lab (or reject and recollect) → enter results → verify → approve & sign → lab report (A4)
→ invoice → payment → accounts receivable.

Built on the same stack and structure as HealthSM.

| Layer | Tech |
| --- | --- |
| Backend | .NET 10, controllers, clean layers (Domain ← Application ← Infrastructure ← Api), EF Core 10 + Npgsql |
| Frontend | React 19, Vite, TypeScript, Tailwind v4, TanStack Query, React Router 7 |
| Database | PostgreSQL 17 (Supabase in production), schema `hsmlis` |
| Hosting | API on Render (Docker), web app on Cloudflare Workers (proxies `/api`), GitHub Actions CI |

## Run it locally

The .NET backend is built, run and tested **in Docker** (Windows Smart App Control blocks unsigned local .NET builds).

```sh
docker compose up --build -d          # Postgres on 127.0.0.1:5433, API on http://localhost:8080
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api to :8080)
```

On an empty database the API creates one organization, a super admin and the starting test catalog
(departments, specimen types, tests with result types, reference ranges and prices, and packages). Locally
`docker-compose.yml` sets the account to `admin` / `Admin@1234567`; add the other staff under Settings.

`docker compose down -v` deletes the database volume.

## Tests

```sh
docker compose run --rm tests        # backend: domain rules + API tests against a throwaway Postgres
cd frontend && npm run lint && npm test && npm run build
```

## Project layout

```
backend/
  src/HsmLis.Domain/          Entities and pure rules: result flags, approval rule, numbering, permissions, password policy
  src/HsmLis.Application/     Services, DTOs (request limits live here), repository interfaces
  src/HsmLis.Infrastructure/  EF Core DbContext + migrations, repositories, JWT, password hashing, seeder
  src/HsmLis.Api/             Controllers, Program.cs pipeline (auth cookie, CSRF check, rate limits)
  tests/HsmLis.Tests/         xUnit: DomainTests, ApiTests
frontend/
  src/lib/                    api.ts (client + types), i18n.tsx (EN/TH), nav.ts (menu), auth, results.ts, code128.ts
  src/components/             ui.tsx (design system), Layout, lab badges, charts, barcode, dialogs, CrudPage
  src/pages/                  dashboard, search, orders, checkin, results, patients, billing, settings
```

## Rules the system enforces

- **Tenancy:** every row belongs to one organization; EF query filters hide other organizations, and saving a
  row of another organization throws.
- **Roles:** 8 roles with fixed permissions (`Domain/Permissions.cs`). Nobody can create or edit a user above their own level.
- **Results:** entered only from a received specimen; Pending → Entered → Verified → Approved. Approving needs
  the approver's licence number and verifies any entered result in the same step. Approved results are corrected by reopening, with a reason.
  The worklist has one row per order and department, and the result screen works on one department at a time, so
  verify/approve never signs off another department's tests.
- **Cancelling:** a whole order, or one test with a reason (not an approved one, not the last one). A cancelled test
  comes off the bill; a package test at its share of the package price (`OrderRules.PackageShares`).
- **Concurrency:** orders and invoices carry a version; a stale screen gets "changed meanwhile" instead of overwriting.
- **Live updates:** every signed-in browser keeps a SignalR connection (`/api/live`). After each save the API tells
  the users of that organization what changed (areas and order ids, never data), and their open screens reload it
  through the normal API, so nobody has to refresh. Notices are sent only after the transaction commits.
- **Audit:** every change is logged; the database refuses UPDATE/DELETE/TRUNCATE on `audit_logs` and `result_events`.
- **Sessions:** JWT in an HttpOnly cookie, re-checked each request; password change signs out other sessions;
  5 wrong passwords lock the account for 15 minutes; the screen signs out after the organization's idle time (default 20 min).
- **Numbers:** order `YYMM` + 4 digits (restarts each month), LSN per container `…-01`, HN `YYMM` + 4 digits, invoice `INV` + YYMMDD + 4 digits.

## Deploying

Production runs on three free services. The browser only ever talks to Cloudflare; the Worker serves the
React app and forwards `/api/*` to the API, so the app and the API look like one site (the sign-in cookie needs that).

```
browser ──► Cloudflare Worker (frontend/worker.js) ──/api/*──► Render: .NET API (Docker) ──► Supabase Postgres
            serves frontend/dist                              backend/Dockerfile            schema "hsmlis"
```

GitHub Actions (`.github/workflows/ci.yml`) tests every push. A push to `main` that passes then deploys both
parts. Until the secrets below are set, the deploy jobs are skipped with a notice instead of failing.

### 1. Database: Supabase

1. Create a project at [supabase.com](https://supabase.com) and note the database password.
2. **Connect → Session pooler** gives the address. Write it as an Npgsql connection string (the API does not
   accept a `postgresql://` URL):
   ```
   Host=aws-0-<region>.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.<project-ref>;Password=<db-password>;SSL Mode=Require
   ```
   Use the **session** pooler (port 5432), not the transaction pooler (6543).

You don't create any tables yourself. The API applies the EF Core migrations on start-up
(`Database__MigrateOnStartup=true`) and keeps everything in the `hsmlis` schema.

### 2. Shared proxy key

Generate one random value of at least 32 characters. It goes into both Render (`Proxy__Key`) and GitHub
(`PROXY_KEY`). The Worker sends it so the API can trust the visitor IP it passes on for rate limiting.

```sh
openssl rand -base64 48
# or in PowerShell:
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

### 3. API: Render

1. Render → **New → Blueprint** → pick this repository. It reads `render.yaml` and creates the `hsmlis-api`
   web service (Docker, free plan, health check `/health`).
2. Fill in the values it asks for:

   | Variable | Value |
   | --- | --- |
   | `ConnectionStrings__Database` | the Supabase connection string from step 1 |
   | `Cors__AllowedOrigins__0` | the web app address, e.g. `https://hsmlis.<your-subdomain>.workers.dev` (no trailing slash) |
   | `Proxy__Key` | the key from step 2 |
   | `Bootstrap__OrganizationName` | your laboratory's name, e.g. `ห้องปฏิบัติการกลาง` |
   | `Bootstrap__AdminUsername` | the first super admin's username |
   | `Bootstrap__AdminPassword` | at least 12 characters with upper case, lower case, a digit and a symbol |

   `Jwt__SigningKey` is generated by Render and `Database__MigrateOnStartup` is already `true`; leave both.
3. After the first deploy, note the service address (e.g. `https://hsmlis-api.onrender.com`) and open
   `<address>/health`. It should return `{"status":"ok"}`.
4. **Settings → Deploy Hook**: copy the URL for GitHub.

The service has `autoDeploy: false`, so later deploys come only from the GitHub workflow after the tests pass.
On the free plan the service sleeps after 15 idle minutes; the first request afterwards takes about a minute.

### 4. Web app: Cloudflare Workers

1. Find your **Account ID** on the Cloudflare dashboard (Workers & Pages → Overview, right-hand side).
2. **My Profile → API Tokens → Create Token** using the **Edit Cloudflare Workers** template.
3. The Worker is named `hsmlis` (`frontend/wrangler.jsonc`). Its address is
   `https://hsmlis.<your-subdomain>.workers.dev`, which is the value for `Cors__AllowedOrigins__0` in step 3.

### 5. GitHub secrets and variables

Repository → **Settings → Secrets and variables → Actions**:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `RENDER_DEPLOY_HOOK_URL` | the Render deploy hook URL |
| Secret | `CLOUDFLARE_API_TOKEN` | the Cloudflare token |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | the Cloudflare account ID |
| Secret | `PROXY_KEY` | the key from step 2 (same as `Proxy__Key` on Render) |
| Variable | `API_ORIGIN` | the Render address, e.g. `https://hsmlis-api.onrender.com` (no trailing slash) |

Then push to `main`, or open **Actions → CI/CD → latest run → Re-run all jobs**.

### 6. First sign-in

1. Open the web app address and sign in with the bootstrap username and password.
2. Change that password under **Settings → General**, then add staff under **Settings → Users** and check the catalog
   under Settings (tests, prices, reference ranges, packages).
3. In Render, delete `Bootstrap__AdminPassword`. Bootstrap only runs on an empty database, so it is no longer
   needed and shouldn't stay in the environment.

### API configuration reference

Environment variables use `__` for nesting (`Jwt__SigningKey` = `Jwt:SigningKey` in `appsettings.json`).

| Setting | Default | Notes |
| --- | --- | --- |
| `ConnectionStrings__Database` | — | Required. Npgsql format. |
| `Jwt__SigningKey` | — | Required, at least 32 characters. Start-up refuses the development key outside Development. |
| `Jwt__ExpiryHours` | `12` | Session length. |
| `Database__MigrateOnStartup` | `false` | `true` applies migrations and runs bootstrap on start. |
| `Cors__AllowedOrigins__0`, `__1`, … | none | Web app address(es). Changing requests from any other origin are refused. |
| `Proxy__Key` | empty | At least 32 characters if set. Must match the Worker's `PROXY_KEY`. |
| `Bootstrap__OrganizationName` / `__AdminUsername` / `__AdminPassword` | empty | Creates the organization, its super admin and the test catalog on an empty database. |
| `Auth__CookieSecure` | `true` | Keep `true` in production (HTTPS). |
| `Auth__CookieSameSite` | `Lax` | |
| `RateLimit__AuthPerMinute` | `10` | Sign-in attempts per visitor per minute. |
| `RateLimit__RequestsPerMinute` | `900` | All requests per user or visitor per minute. |
| `Qz__Certificate` / `Qz__PrivateKey` | empty | Silent label printing (see below). PEM; line breaks may be written as `
`. |
| `Qz__PrivateKeyPassword` | empty | Only for an encrypted private key. |

The Worker needs `API_ORIGIN` (a variable) and `PROXY_KEY` (a secret). The deploy workflow sets both.
`VITE_API_URL` (`frontend/.env.example`) is only for serving the frontend from somewhere other than the Worker.

### Silent label printing (QZ Tray)

Specimen labels go straight to the TSC label printer, without the browser's print dialog, through
[QZ Tray](https://qz.io) on each lab PC. The API signs every print request with the lab's private key, and QZ Tray
prints without asking because it trusts the matching certificate. Reports and invoices still use the browser's print.

1. **Once:** in Git Bash run `bash printing/new-certificate.sh`. It makes a key and a certificate valid for 20 years in
   `~/hsmlis-qz` and copies the certificate to `printing/override.crt` (public, safe to commit).
2. **Render:** set `Qz__PrivateKey` and `Qz__Certificate` from the two `render-*.txt` files it wrote. Keep a backup of
   `qz-private.key` in a safe place, then delete the `render-*.txt` files. The key never goes on a PC or into git.
3. **Each lab PC:** copy the `printing` folder over and double-click `setup-printing.bat`. It installs QZ Tray (or
   uses `qz-tray-2.3.0-x86_64.exe` next to it on a PC without internet), installs the certificate, adds it to QZ
   Tray's allowed list (so QZ Tray doesn't ask "Allow"), lets Chrome/Edge reach QZ Tray from the addresses in its
   `SITES` line without asking, and starts QZ Tray. HealthSM uses the same key under the same names (`Qz__Certificate`,
   `Qz__PrivateKey` on its Render service), so the same run sets up both apps on a PC.
4. On a specimen label page press **Print**. The first TSC printer is picked; another one can be chosen (the printer
   name next to Print). The choice is remembered on that PC.

The label is drawn as one bitmap (Thai text needs no printer fonts) for 50 × 25 mm stock with a 3 mm gap at 203 dpi;
these and the print direction are at the top of `frontend/src/lib/specimenLabel.ts`. If QZ Tray isn't running, the
page says so and offers the browser's print instead. To try it locally, add the two `Qz__…` values to the `api`
service in `docker-compose.yml` (don't commit them).

If the private key ever leaks, run `new-certificate.sh` into a new folder, update Render and run `setup-printing.bat`
again on each PC.

### Troubleshooting

| Symptom | Cause |
| --- | --- |
| Web app shows "The API address is not configured." (502) | `API_ORIGIN` or `PROXY_KEY` missing on the Worker. Set them in GitHub and redeploy. |
| Sign-in or saving fails with `cross_site_request` (403) | `Cors__AllowedOrigins__0` on Render doesn't exactly match the web app address. |
| Render deploy fails at start-up with `Jwt:SigningKey …` or `Proxy:Key …` | The key is missing or shorter than 32 characters. |
| Start-up fails with `Bootstrap:AdminPassword is not strong enough` | The password breaks the policy in step 3. |
| Start-up can't reach the database | Wrong pooler host or password, a `postgresql://` URL, or a missing `SSL Mode=Require`. |
| `28P01: password authentication failed for user "postgres"` | Wrong database password: a leftover `[YOUR-PASSWORD]` or brackets, a URL-encoded value (`%40`), or a `;` / `=` in it (quote it as `Password='…'` or reset it to letters and digits). Username must be `postgres.<project-ref>`. |
| Deploy jobs show "…is not set, so … was not deployed" | A GitHub secret or variable from step 5 is missing. |
| A custom domain is added later | Add it to `Cors__AllowedOrigins__1` on Render. |
| Label page says "QZ Tray is not running" | Start QZ Tray on that PC (or run `setup-printing.bat`). It should start with Windows. |
| QZ Tray asks "Allow / Block" once | Tick "Remember this decision" and press Allow. If it says "Untrusted website", that PC lacks the certificate or it differs from `Qz__Certificate`: run `setup-printing.bat` again. |
| The browser asks to allow access to the local network | Press Allow, or add the site's address to `SITES` in `setup-printing.bat` and run it again. |
| Label page says silent printing is not set up on the server | `Qz__Certificate` / `Qz__PrivateKey` missing or not valid PEM on Render. |
| Screens don't update by themselves until you switch tabs | The live connection is failing: check the browser console for `/api/live`. It must come from an address in `Cors__AllowedOrigins__*`. The 30–60 s polling on the worklist and check-in screens still works. |
| Labels print upside down, or one label spans two | Change `DIRECTION` or `LABEL.gap` in `frontend/src/lib/specimenLabel.ts`. |

## Not built yet (from the NDC LIMS spec)

Executive and finance dashboards, the reports tabs (worklist, workload, TAT, TAT alert, criticals), NAP plus,
disease surveillance and R506, appointments and queue, Excel import/export, notification settings (email/SMS/Telegram),
document designer, instruments, external API / webhooks / API tokens, customer groups, entitlements, investigation
criteria, option sets, payment accounts, editable roles, test profiles (sub-items), and department-restricted access.
