# 📚 Audiences et Délibérés - Frontend

Web interface of the hearings and deliberations platform of the **Legal Department of Afriland
First Bank Cameroon** (version 1.0, branch `quality_gates`).

## 👥 Team

- Loïc Luc KENMOE MBEUKEM - developer (KFOKAM-48 end-of-training project)
- Mr. DEUMO DEUMO Léonce - operational supervisor, Head of the Development Department (DSI)

## 🚀 Getting started

### Prerequisites
- Node.js 18.18 or later (tested with Node.js 24) and npm
- The backend running (`audiences-deliberes-backend`): the frontend does not run on its own

### Installation

1. **Start the backend** - from the `audiences-deliberes-backend` repository:
   ```bash
   docker compose up postgres keycloak minio -d   # PostgreSQL 5433, Keycloak 8081, MinIO 9000/9001
   ./mvnw spring-boot:run                          # API on 8080
   ```
   Check: `curl http://localhost:8080/actuator/health` answers `{"status":"UP"}`.

2. **Clone this repository**
   ```bash
   git clone -b quality_gates https://github.com/loickenmoe/audiences-deliberes-frontend.git
   cd audiences-deliberes-frontend
   ```

3. **Install the dependencies**
   ```bash
   npm install
   ```

### Development
```bash
cp env.template .env.local     # then fill in AUTH_SECRET and KEYCLOAK_CLIENT_SECRET
npm run dev                    # http://localhost:3000
```

### Production
```bash
npm run build
npm run start
```

### Environment variables
Create `.env.local` from `env.template` (see "Configuration and deployment" below).
`AUTH_SECRET` and `KEYCLOAK_CLIENT_SECRET` are empty in the template and must be filled in.

### Test accounts

Realm `audiences-realm`, password `Password1!` for all:

| Account | Profile | Roles |
|---|---|---|
| `juriste.test` | Legal officer | `ROLE_JURISTE`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `dj.test` | Legal Director (DJ) | `ROLE_DJ`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `dja.test` | Deputy Legal Director (DJA) | `ROLE_DJA`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `assistante.test` | Executive Assistant | `ROLE_ASSISTANTE`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `sh.test` | Line manager (SH) | `ROLE_SH`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `avocat.test` | Partner lawyer | `ROLE_AVOCAT` **only** - a deliberately narrow scope |

## 📚 Documentation

Before coding, read the context in `design-notes/` (in French), starting with
`design-notes/FRONTEND_ARCHITECTURE.md`:

| File | Content |
|---|---|
| `design-notes/FRONTEND_ARCHITECTURE.md` | **Developer entry point.** Stack, folder layout, authentication, permissions, API layer, design system |
| `design-notes/SCREEN_MAP.md` | The screens: routes, roles, endpoints, business rules |
| `design-notes/DECISIONS_AND_OPEN_QUESTIONS.md` | Decisions, open questions, risks |
| `design-notes/PISTES_AMELIORATION.md` | Known technical debt and suggested improvements |

The API contract is `contracts/openapi.json`. The reference functional documentation (V1.1) is kept
outside the repositories; each of its files is named in the test request
(`AFB_PS03_TR_AUDIENCES_DELIBERES_V01_21102026`). The user guide, the deployment guide and the test
sheets are delivered in the testers' folder. The backend remains the source of truth for business
rules.

---

# 📚 Functional documentation

## 🎯 Functional objective

The interface lets the Legal Department follow its litigation from end to end - case files,
hearings, deliberations, final decisions, lawyers' fees and publications, appointments, documents
and steering - and gives partner lawyers a portal restricted to their own case files. Each profile
sees only the screens and actions its role allows.

## 🏗️ Functional principles

### Multi-profile architecture
- **Validation flow**: each circuit (fees, publications, appointments, deletions, shares, special
  diligence) moves from one profile to the next, and each screen shows the queue of its profile.
- **Validation step**: every action is checked against the role before it is offered, then again
  by the backend.
- **Role-based access**: the menu only shows the screens of the profile; a forbidden address shows
  "Vous n'avez pas les droits nécessaires".
- **Composite roles**: the DJ and the DJA also hold the legal officer's role.
- **Restrictions**: separation of duties - the legal officer requests, the direction arbitrates,
  the Assistant controls, the SH signs.

### Working principles
- **Authentication**: in-app login form backed by Keycloak; logging out also closes the Keycloak
  session.
- **Authorisation**: capabilities checked on the server before rendering a page.
- **Traceability**: every change appears in the case file history and in the audit.
- **Notifications**: bell with unread counter, list of notifications, real-time arrival.

## 💻 User interfaces

### Legal officer
#### Case files
- **Creation**: nature (the category follows), court, client, amount at risk, parties, originating
  branch, mandatory documents and assignment; the reference is assigned by the system.
- **Case file**: tabs Summary, Steps, Hearings, Deliberations, Alarms, Decisions, History,
  Documents, Publications; the address carries the open tab.
- **List**: filters by reference, client, court, nature, special diligence, step and hearing
  period; sorting without removing anything.
- **Special diligence**: proposal with threshold, client type and reason; threshold derogation.

#### Hearings and deliberations
- **Hearings**: scheduling, duplicate confirmation, cancellation with reason, report, note to the
  lawyer.
- **Calendar**: week, month or quarter, exported in PDF or Excel.
- **Hearings log**: hearings of a day and expected reports.
- **Deliberations**: extension, reversal, result, appeal deadline, enforcement copy.

#### Documents and decisions
- **Documents**: upload, in-app preview, deletion request, sharing with the lawyer.
- **Final decisions**: adjudication, conviction, archiving in the case-law base.

### Legal Director and Deputy
- **Dashboard**: nine indicators, each with its exact detail, per scope.
- **Reports**: activity report, activity per person and per lawyer, exports PDF, Excel, CSV.
- **Arbitration**: deletion requests, shares to validate, special diligence, derogations, joint
  validation of fees (appropriateness for the DJA).
- **Explanations**: requests to lawyers whose hearing reports are missing.
- **Administration**: audit with sealed extraction, configuration and notification grid, branches,
  intervenants.

### Executive Assistant and Line manager
- **Assistant**: fee circuit (compliance, payment), lawyers' publications (acknowledgement of hearing
  reports, validation of documents), appointments.
- **SH**: appointment letters to correct and sign, document sharing.
- **Both**: consultation of the calendar, hearings log, publications, lawyers' directory, reports and
  daily DMS report.

### Partner lawyer
- **My space**: his filings with their status and the reason of a rejection; his case files with
  their hearings, the note of the Legal Department and the shared documents; his appointment
  letters and his activity.
- **Filings**: fee request with supporting documents; hearing report or case document.
- **Explanations**: single answer to each request.

### Common features
#### User interface
- **French and English**: FR / EN switch in the header.
- **Responsive navigation**: below 1024 px, the sidebar becomes a scrolling band at the top;
  wide tables scroll inside their own frame.
- **Contextual sidebar**: only the profile's entries.
- **Real-time notifications**: alerts arrive without reloading; the list catches up within a
  minute if the connection drops.

#### Authentication and security
- **Login**: same message whether the account exists or not.
- **Session**: Keycloak tokens refreshed automatically; after logging out, a page request still
  carrying a session cookie is sent back to the login screen.
- **Password**: managed by the DSI in Keycloak, not by the application.

## 🧾 Management rules

### Case files and hearings
- **Mandatory at creation**: documents of the category, at least one plaintiff and one defendant,
  originating branch among the active ones, at least one legal officer and one lawyer.
- **Hearings**: only on a step in progress; reminders at D-7, D-3 and D-1; a cancellation requires a
  reason.
- **Step changes**: refused with the missing fact named (held hearing, delivered result, final
  decision, paid fees).

### Validations
- **Rejections** (fees, publications, shares, deletions) always require a reason.
- **Special-diligence case file**: shares wait for the direction's validation; a pending proposal
  already counts as sensitive.
- **Fees**: joint DJ + DJA validation on a special-diligence case file or above the threshold.

### Input controls
- **Phone** (client and intervenant): Cameroonian mobile of nine digits starting with 6, or an
  international number with its country code; shown in international format.
- **Documents**: formats and maximum size set in the system parameters; signature PNG or JPEG of
  200 KB at most.

## 🔑 Permission matrix

| Screen | JUR | DJ / DJA | AST | SH | AVO |
|---|:-:|:-:|:-:|:-:|:-:|
| Home, notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Case files, clients, case law, my account | ✅ | ✅ | ✅ | ✅ | ❌ |
| Calendar, hearings log | ✅ | ✅ | ✅ | ✅ | ❌ |
| Publications, appointments, lawyers' directory | ✅ | ✅ | ✅ | ✅ | ❌ |
| Reports, daily DMS report | ✅ | ✅ | ✅ | ✅ | ❌ |
| Intervenants, branches, configuration | 👁️ | ✅ | 👁️ | 👁️ | ❌ |
| Lawyers' fees | ❌ | ✅ | ✅ | ❌ | ✅ |
| Explanations | ❌ | ✅ | ❌ | ❌ | ✅ |
| Dashboard, deletion requests, shares to validate, audit | ❌ | ✅ | ❌ | ❌ | ❌ |
| My space, file a request, file a publication | ❌ | ❌ | ❌ | ❌ | ✅ |

👁️ read only. A screen open to a profile does not open every action: the Assistant and the SH
consult without the other profiles' actions, and the activity per person stays with the DJ and the
DJA.

## 📌 User stories

### Case files
- **US 1.1**: as a legal officer, I create a case file with its documents, parties and assignment,
  and the system assigns its reference
- **US 1.4**: as a legal officer, I move a step forward, and the system names the missing fact when
  it refuses
- **US 1.10**: as a legal officer, I propose the special diligence of an open case file; the DJ or
  the DJA decides

### Hearings and deliberations
- **US 2.1**: as a legal officer, I schedule a hearing and its reminders are programmed
- **US 2.5**: as a legal officer, I generate the hearings calendar per week, month or quarter
- **US 2.7**: as a legal officer, I write a note that the appointed lawyer reads in his portal
- **US 3.2**: as a legal officer, I extend a deliberation; beyond the threshold the direction is
  alerted

### Fees, publications and appointments
- **US 4.1**: as a lawyer, I file a fee request with its supporting documents
- **US 4.5**: as the DJ and the DJA, we validate a sensitive request by two distinct acts
- **US 5.1**: as a lawyer, I file my hearing report, readable at once by the Legal Department
- **US 5.6 / 5.7**: as a legal officer, I request an appointment; the SH signs the letter

### Documents
- **US 6.4**: as a legal officer, I request a deletion; the DJ or the DJA arbitrates
- **US 6.7 / 6.8**: as a legal officer, I share a document with the appointed lawyer; on a sensitive
  case file the direction validates first

### Steering
- **US 8.5**: as the DJ, I read nine indicators and their detail
- **US 8.4 / 8.7**: as the DJ, I export activity reports and read the activity per person and per
  lawyer
- **US 8.8**: as any internal user, I read and download my own activity

## 🚀 Functional status

### Delivered (version 1.0)
✅ **Case files, steps and special diligence**, with history and audit
✅ **Hearings, calendar, hearings log, deliberations and alarms**
✅ **Fee circuit**, from filing to payment
✅ **Publications, correspondence, appointments with signed letters**
✅ **Documents**: preview, deletion arbitration, sharing with the lawyer
✅ **Final decisions and case law**
✅ **Dashboard, reports, audit with sealed extraction**
✅ **Lawyer's portal**
✅ **French / English interface, responsive layout**

### Known limitations
🔄 **External notifications**: prepared and logged, not sent while the Notification Engine is
disabled outside production
🔄 **Preview**: Excel workbooks and old Word `.doc` files are downloaded, not displayed
🔄 **Audit verification**: the fingerprint computation requires HTTPS or localhost

### Next steps
📋 Activation of the Notification Engine after a dedicated campaign
📋 Production prerequisites (see "Security" and the backend README)
📋 Improvements listed in `design-notes/PISTES_AMELIORATION.md` (warning before losing a form in
progress, printing of a case file, growth of the history)

---

# 🛠️ Technical documentation

## 🎯 Technical objective

Next.js 15 web application (App Router) with server-side permission checks, Keycloak
authentication through NextAuth, types generated from the backend's OpenAPI contract, and cached
API calls with TanStack Query.

## 🏗️ Technical architecture

### Stack
- **Frontend**: Next.js 15.3, React 19, TypeScript (strict)
- **Styling**: Tailwind CSS 4, Lucide icons, in-house components (`components/ui`)
- **State**: TanStack Query 5, react-hook-form
- **Authentication**: NextAuth v5 (Auth.js) with Keycloak
- **HTTP client**: Axios with token injection
- **Validation**: Zod schemas
- **Internationalisation**: next-intl (French, English)
- **Real time**: STOMP over SockJS
- **Tests**: Vitest + Testing Library, Playwright

### Project structure
```
audiences-deliberes-frontend/
├── app/                    # App Router
│   ├── (auth)/             # Login
│   ├── (protected)/        # Screens behind authentication (one folder per module)
│   ├── api/                # NextAuth route
│   └── unauthorized/       # "Vous n'avez pas les droits nécessaires"
├── components/
│   ├── global/             # App-wide components (language switch, ...)
│   ├── layout/             # Sidebar, navbar, bell, logout
│   ├── metier/             # Shared business components
│   ├── modules/            # One folder per business module
│   └── ui/                 # Base components (button, card, dialog, table, ...)
├── contracts/openapi.json  # Frozen API contract of the backend
├── hooks/                  # TanStack Query hooks, one per resource
├── i18n/ + messages/       # next-intl configuration, fr.json and en.json
├── lib/                    # Auth, RBAC, API client, utilities
├── providers/              # Session, query, alerts providers
├── services/               # One file per API resource
├── types/                  # Generated API types and domain types
└── tests/                  # unit/ (Vitest) and e2e/ (Playwright)
```

### Architectural patterns
- **Server components** for pages, with the permission check before rendering
- **Client components** for interactive screens
- **Service → hook → component**: `services/` mirrors the API, `hooks/` caches it, `components/modules/`
  displays it
- **Capabilities**: permissions are named capabilities in `lib/rbac.ts`, derived from the backend's
  `@PreAuthorize`
- **URL state**: filters, sorting and open tab live in the address, so a view can be shared

## 📊 Data model

Types are generated from the backend contract (`types/api.generated.ts`) and refined in
`types/domaine.ts`.

#### Client
```typescript
interface Client {
  id: number
  reference: string          // CLI-YYYY-NNNN
  nom: string
  email: string | null
  telephone: string | null   // international format
  createdAt: string
  updatedAt: string
}
```

#### Dossier (case file, excerpt)
```typescript
interface Dossier {
  id: number
  reference: string          // DOS-YYYY-NNNN
  nature: string
  categorie: CategorieDossier
  juridictionSaisie: string
  clientId: number
  parties: { demandeurs: string[]; defendeurs: string[] } | null
  risqueEncouru: number
  codeAgenceOrigine: string | null
  estSensible: boolean
  etapes: EtapeProcedure[]
  // ...
}
```

#### EtapeProcedure (procedure step)
```typescript
interface EtapeProcedure {
  id: number
  dossierId: number
  type: TypeEtape              // INSTANCE | RECOURS_1 | RECOURS_2 | RECOURS_2_CCJA
  statutCycleVie: StatutCycleVie
}
```

## 🔐 Authentication

### Configuration
- NextAuth v5 with a **Credentials** provider: the in-app login form exchanges the username and
  password for Keycloak tokens (`lib/auth.ts`).
- Keycloak remains the only identity holder and token issuer; the client `audiences-api` is
  **confidential**, its secret stays on the Next.js server.

### Workflow
1. **Login**: credentials checked by Keycloak
2. **Session**: encrypted with `AUTH_SECRET`, holding the tokens and the roles
3. **Refresh**: tokens renewed before expiry (`lib/rotation-jeton.ts`)
4. **Logout**: closes the Keycloak session; a marker cookie and `middleware.ts` keep it closed

### Route protection
```typescript
// app/(protected)/clients/page.tsx - checked on the server before rendering
await exigerCapacite("consulterReferentiels");

// lib/serverAuth.ts
export async function exigerCapacite(capacite: Capacite, redirection = "/unauthorized") {
  const session = await exigerSession();
  if (!peut(session.roles, capacite)) {
    redirect(redirection);
  }
  return session;
}
```

## 🌐 API services

### Service pattern
```typescript
// services/clientService.ts - 1:1 mirror of the backend endpoints, no business logic
export const clientService = {
  rechercher: async (params) => {
    const { data } = await apiClient.get<PageReponse<Client>>("/clients", {
      params: { ...params, size: params.size ?? TAILLE_PAGE },
    });
    return data;
  },
  consulter: async (id: number) => (await apiClient.get<Client>(`/clients/${id}`)).data,
  vueConsolidee: async (clientId: number) =>
    (await apiClient.get<VueClientDossiers>(`/clients/${clientId}/dossiers`)).data,
};
```

### Hooks
```typescript
// hooks/useClients.ts
export function useClients(params) {
  return useQuery({
    queryKey: [CLES.clients, params],
    queryFn: () => clientService.rechercher(params),
    placeholderData: (precedent) => precedent, // keep the previous page while the next loads
  });
}
```

### API contract
TypeScript types are **generated** from the backend's OpenAPI and **frozen** in
`contracts/openapi.json`; the specification is never fetched at run time. After a backend change:

```bash
npm run api:fetch && npm run api:types
```

Any contract break then shows up as a compilation error, not as an acceptance-test defect.

## 🎨 Component system

- **Base components** (`components/ui`): button, card, field, dialog, skeleton, table
- **Tailwind CSS 4**: design tokens of the bank (anthracite, brand red, surfaces)
- **Lucide**: consistent icons
- **Accessibility**: labelled fields, readable contrasts, status never carried by colour alone

## 📱 Responsive design

- **Desktop** (≥ 1024 px): fixed sidebar on the left
- **Tablet and mobile** (< 1024 px): navigation as a horizontal scrolling band at the top
- **Tables**: scroll inside their own frame; the page never scrolls horizontally

## 🔧 Configuration and deployment

### Environment variables (`env.template` → `.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL, prefix included (`http://localhost:8080/api/v1`) |
| `NEXT_PUBLIC_WS_URL` | Real-time SockJS/STOMP channel (`http://localhost:8080/ws`) |
| `AUTH_SECRET` | Session encryption key, distinct per environment (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) |
| `AUTH_TRUST_HOST` | `true` |
| `KEYCLOAK_ISSUER` | `http://localhost:8081/realms/audiences-realm` |
| `KEYCLOAK_CLIENT_ID` | `audiences-api` |
| `KEYCLOAK_CLIENT_SECRET` | Secret of the confidential client (value in `keycloak/audiences-realm.json` of the backend repository); server side only |

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check without emitting |
| `npm run format` / `format:check` | Prettier |
| `npm run test` | Unit and integration tests (Vitest) |
| `npm run test:coverage` | Same, with coverage (lcov in `coverage/`) |
| `npm run test:e2e` | End-to-end journeys (Playwright, installed Chrome; both servers must run) |
| `npm run api:fetch` | Fetches the backend's API contract into `contracts/openapi.json` |
| `npm run api:types` | Regenerates `types/api.generated.ts` from that contract |

## 🔒 Technical security

- **No secret may be versioned**: `.env*` is ignored by git, except `env.template`, which only
  holds local values without secrets. The backend repository once leaked real credentials this way
  - do not repeat it.
- **Hiding is not securing**: `lib/rbac.ts` shapes the interface; the backend's `@PreAuthorize`
  remains the only authority (`ERR-FORBIDDEN` otherwise).
- **Tokens** stay on the server side of Next.js; the browser never sees the client secret.
- **Before production**: `/v3/api-docs` is open on the backend and must be closed; the frontend
  never depends on it at run time.

### Error handling
```typescript
// lib/api/errors.ts normalises every backend error into { code, message, champ };
// form errors are shown under the field named by the backend.
```

## 📊 Performance and quality

### Caching
- **TanStack Query**: `staleTime` of 30 s, no retry on 4xx errors, previous page kept while the next
  loads
- **Next.js**: server rendering of pages, client components only where needed

### Tests and quality
- **1,027 unit and integration tests** (Vitest + Testing Library)
- **260 Playwright journeys** across 28 specification files, against the real backend
- **SonarQube** quality gate `AFB_ANGULAR_PROJECT`: passed, coverage 90.5 %, 0 bug, 0 vulnerability,
  0 code smell

### Conventions
- User interface in **French and English**: every visible label exists in `messages/fr.json` and
  `messages/en.json`.
- Code comments in **English**, short and useful; requirement identifiers (`RG-`, `US`, `UC-`,
  `FR-`) kept for traceability.
- Commits: Conventional Commits with a scope, e.g. `feat(dossiers): ...`.
- Every change passes `npm run typecheck`, `npm run lint`, `npm test` and the Playwright journeys
  before delivery.
