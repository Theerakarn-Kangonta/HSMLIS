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
- **Results:** entered only from a received specimen; Pending → Entered → Verified → Approved. Nobody approves a
  result they entered or verified within the last minute. Approved results are corrected by reopening, with a reason.
- **Concurrency:** orders and invoices carry a version; a stale screen gets "changed meanwhile" instead of overwriting.
- **Audit:** every change is logged; the database refuses UPDATE/DELETE/TRUNCATE on `audit_logs` and `result_events`.
- **Sessions:** JWT in an HttpOnly cookie, re-checked each request; password change signs out other sessions;
  5 wrong passwords lock the account for 15 minutes; the screen signs out after the organization's idle time (default 20 min).
- **Numbers:** order `CENTER` + YYMMDD + 4 digits, LSN per container `…-01`, HN `YYMM` + 4 digits, invoice `INV` + YYMMDD + 4 digits.

## Deploying

1. Create a Supabase project; use its session-pooler connection string.
2. Render: New → Blueprint → this repo (`render.yaml`). Set the connection string, the web app's address,
   `Proxy__Key`, and `Bootstrap__OrganizationName` / `Bootstrap__AdminUsername` / `Bootstrap__AdminPassword`
   to create the first organization and administrator on the first start.
3. GitHub: secrets `RENDER_DEPLOY_HOOK_URL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `PROXY_KEY`, and variable `API_ORIGIN`.
   A green push to `main` deploys both.

## Not built yet (from the NDC LIMS spec)

Executive and finance dashboards, the reports tabs (worklist, workload, TAT, TAT alert, criticals), NAP plus,
disease surveillance and R506, appointments and queue, Excel import/export, notification settings (email/SMS/Telegram),
document designer, instruments, external API / webhooks / API tokens, customer groups, entitlements, investigation
criteria, option sets, payment accounts, editable roles, test profiles (sub-items), and department-restricted access.
