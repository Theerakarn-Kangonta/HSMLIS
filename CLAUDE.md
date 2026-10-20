# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

HSMLIS is a multi-tenant laboratory information system built from `NDC_LIMS_Website_Structure.md` (in the user's
Downloads). It follows the stack and conventions of the user's HealthSM project. README.md is the reference for
features, the first admin account, deployment and what is not built yet.

## Commands

The .NET backend is built, run and tested **only through Docker** on this machine (Windows Smart App Control blocks
locally built .NET assemblies), so `dotnet run` / `dotnet test` on the host won't work.

```sh
docker compose up --build -d            # Postgres 127.0.0.1:5433 + API http://localhost:8080 (admin + test catalog seeded)
docker compose run --rm tests           # backend tests
cd frontend && npm run dev              # :5173, proxies /api to :8080
npm run lint && npm test && npm run build
```

EF Core migrations need the SDK, so run them in a container (copy the source in, run, copy `Migrations` back):
```sh
dotnet tool restore && dotnet build src/HsmLis.Api
dotnet dotnet-ef migrations add <Name> --project src/HsmLis.Infrastructure --startup-project src/HsmLis.Api --output-dir Persistence/Migrations
```
The initial migration adds append-only triggers on `audit_logs` and `result_events` by hand; keep them.

## Architecture

**Backend** (`backend/`): `Domain` (entities + pure rules) ← `Application` (services, DTOs, repository interfaces,
`AppException` subclasses) ← `Infrastructure` (EF Core, repositories, JWT, seeder) ← `Api` (controllers, `Program.cs`).

- Request flow is controller → service → repository. Controllers hold no logic, services hold no SQL. List screens
  are read models: repositories project straight into DTOs (`OrderSummaryDto`).
- Services throw `NotFoundException` / `ConflictException` / `BusinessRuleException` … with a stable `code`;
  `AppExceptionHandler` maps them to ProblemDetails and the frontend translates `err.<code>`.
- **Tenancy is automatic:** every `IOrgOwned` entity gets `OwnedByOrganization(e)` in `AppDbContext` (FK + query
  filter), and `SaveChanges` refuses writes to another organization. `IgnoreQueryFilters` only in `...AnyOrg` methods.
- **Permissions:** `Domain/Permissions.cs` maps the 8 roles to permissions; each is an authorization policy of the
  same name. Every endpoint needs a deliberate `[Authorize(Policy = ...)]`.
- `OrgContext` (via `IOrgContextProvider`) holds the organization, the user and "now" for a request; use it for
  local dates (`ctx.Today`, `ctx.Bounds`) and for name snapshots on records.
- Orders change through `OrderState.Refresh`, which re-derives the status and bumps `Version` (concurrency token).
- **Live updates:** `UnitOfWork` reads the change tracker on each save and, after commit, sends a `ChangeNotice`
  (topics + order ids) to the organization's SignalR group (`Api/Infrastructure/LiveUpdates.cs`). The frontend maps
  topics to query keys in `src/lib/live.ts`; a new entity or query key needs an entry on both sides.
- Result rules (flags, reference ranges) live in `Domain/ResultRules.cs` and are mirrored in `frontend/src/lib/results.ts`;
  change both together.

**Frontend** (`frontend/`): React 19 + Vite + TypeScript + Tailwind v4 + TanStack Query.
- `src/lib/api.ts` is the single client; its types mirror the backend DTOs by hand.
- To add a page: add it to `src/lib/nav.ts` and its route in `src/App.tsx` (wrapped in `Need` with its permissions).
- i18n: `src/lib/i18n.tsx`; `th` is `Record<TKey, string>`, so a new English key without Thai fails the build.
  Thai dates use the Buddhist year.
- Design tokens are in `src/index.css` (indigo brand; dark theme via `[data-theme='dark']`). Printable documents use
  the `paper` class (always black on white, Sarabun).
- Settings lists use `components/CrudPage.tsx`.
- Specimen labels print silently through QZ Tray: `lib/specimenLabel.ts` draws the label and sends it as TSPL (TSC
  printers) via `lib/qz.ts`; the API signs requests at `/api/qz` with `Qz:PrivateKey`. PC setup lives in `printing/`.
  QZ's `wss://localhost` ports are allowed in `public/_headers`.

## Working rules

- **Security on every change:** permission policy on new endpoints, length/range limits on request DTOs, API tests for
  the cross-organization and wrong-role cases, no HTML from user text, no SQL built from strings.
- No demo data: an empty database gets only the organization, its admin (`Bootstrap:*`) and the test catalog.
