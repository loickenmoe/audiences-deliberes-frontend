# Audiences et Délibérés - Frontend

Web interface of the hearings and deliberations platform of the **Legal Department of Afriland
First Bank Cameroon**.

KFOKAM-48 end-of-training project - KENMOE MBEUKEM Loïc Luc. Operational supervisor: Mr. DEUMO
DEUMO Léonce, Head of the Development Department.

---

## Before coding: read the context

The `design-notes/` folder holds four context files, in French. **Read
`design-notes/FRONTEND_ARCHITECTURE.md` first**; open the others only when the topic requires it.

| File | Content |
|---|---|
| `design-notes/FRONTEND_ARCHITECTURE.md` | **Developer entry point.** Stack, folder layout, authentication, permissions, API layer, design system |
| `design-notes/SCREEN_MAP.md` | The screens: routes, roles, endpoints, business rules |
| `design-notes/DECISIONS_AND_OPEN_QUESTIONS.md` | Decisions, open questions, risks |
| `design-notes/PISTES_AMELIORATION.md` | Known technical debt and suggested improvements |

The API contract is `contracts/openapi.json`; the reference functional documentation (V1.1) is in
the `Doc/` folder of the backend repository. The user guide, the deployment guide and the test
sheets are delivered separately, in the testers' folder.

The backend repository remains the source of truth for business rules.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · TanStack Query · Zod ·
react-hook-form · NextAuth (Keycloak) · next-intl (French / English) · Vitest + Testing Library ·
Playwright.

## Getting started

### 1. The backend

The frontend does not run on its own. From the `audiences-deliberes-backend` repository:

```bash
docker compose up postgres keycloak minio -d   # PostgreSQL 5433, Keycloak 8081, MinIO 9000/9001
./mvnw spring-boot:run                          # API on 8080
```

Check: `curl http://localhost:8080/actuator/health` must answer `{"status":"UP"}`.

### 2. The frontend

```bash
cp env.template .env.local     # then fill in the variables
npm install
npm run dev                    # http://localhost:3000
```

`AUTH_SECRET` and `KEYCLOAK_CLIENT_SECRET` are empty in `env.template` and must be filled in; see
the comments in that file.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check without emitting |
| `npm run test` | Unit and integration tests (Vitest) |
| `npm run test:e2e` | End-to-end journeys (Playwright, with the installed Chrome; both servers must run) |
| `npm run format` | Prettier |
| `npm run api:fetch` | Fetches the backend's API contract into `contracts/openapi.json` |
| `npm run api:types` | Regenerates `types/api.generated.ts` from that contract |

### API contract

TypeScript types are **generated** from the backend's OpenAPI and **frozen** in
`contracts/openapi.json`. The specification is never fetched at run time: `/v3/api-docs` is
currently reachable without authentication on the backend and must be closed before production.
After a backend change:

```bash
npm run api:fetch && npm run api:types
```

Any contract break then shows up as a compilation error, not as an acceptance-test defect.

## Test accounts

Realm `audiences-realm`, password `Password1!` for all:

| Account | Roles |
|---|---|
| `juriste.test` | `ROLE_JURISTE`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `dj.test` | `ROLE_DJ`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `dja.test` | `ROLE_DJA`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `assistante.test` | `ROLE_ASSISTANTE`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `sh.test` | `ROLE_SH`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `avocat.test` | `ROLE_AVOCAT` **only** - a deliberately narrow scope |

> The Keycloak client `audiences-api` is **confidential**: the `client_secret` is required to
> obtain a token. It stays on the Next.js server side and is never exposed to the browser.

## Security

**No secret may be versioned.** `.env*` is ignored by git, except `env.template`, which only holds
local values without secrets. The backend repository once leaked real credentials this way - do
not repeat it.

## Conventions

- User interface in **French and English**: every visible label exists in `messages/fr.json` and
  `messages/en.json`.
- Code comments in **English**, kept short and useful; requirement identifiers (`RG-`, `US`, `UC-`,
  `FR-`) are kept for traceability.
- `services/` (one file per API resource) → `hooks/` (TanStack Query) → `components/modules/`.
- Permissions are capabilities in `lib/rbac.ts`; the backend remains the only authority.
- Commits: Conventional Commits with a scope, e.g. `feat(dossiers): …`.
- Every change passes `npm run typecheck`, `npm run lint`, `npm test` and the Playwright journeys
  before delivery.
