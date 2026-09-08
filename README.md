# Audiences et Délibérés — Frontend

Interface web de la plateforme de digitalisation des audiences et délibérés de la **Direction
Juridique d'Afriland First Bank Cameroun**.

Mémoire de fin d'études KFOKAM-48 — KENMOE MBEUKEM Loïc Luc. Encadreur DSI : DEUMO DEUMO Léonce.

---

## Avant de coder : lire le contexte

Ce dépôt tient six fichiers de contexte à sa racine. **Lire `FRONTEND_WORKING_MEMORY.md` en premier**
— il donne l'état courant, les décisions actées, les conventions et les questions ouvertes. Les
autres ne s'ouvrent que si le sujet l'exige.

| Fichier | Contenu |
|---|---|
| `FRONTEND_WORKING_MEMORY.md` | **Point d'entrée.** État courant, décisions, conventions, contraintes |
| `FRONTEND_ARCHITECTURE.md` | Pile, arborescence, authentification, droits, couche API, design system |
| `SCREEN_MAP.md` | Les 42 écrans : routes, rôles, endpoints, règles métier |
| `API_INTEGRATION_STATUS.md` | Les 67 endpoints du backend et leur état de consommation |
| `DEVELOPMENT_ROADMAP.md` | Les 18 jalons, F0 → F17 |
| `DECISIONS_AND_OPEN_QUESTIONS.md` | Arbitrages datés, questions ouvertes, risques |

La source de vérité métier reste le dépôt backend, **en lecture seule** sauf décision explicite.

## Pile technique

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui ·
TanStack Query · Zod · Vitest + Testing Library + MSW · Playwright.

## Démarrer

### 1. Le socle backend

Le frontend ne fonctionne pas seul. Depuis le dépôt `audiences-deliberes-backend` :

```bash
docker-compose up postgres keycloak minio -d   # PostgreSQL 5433, Keycloak 8081, MinIO 9000/9001
./mvnw spring-boot:run                          # API sur 8080
```

Vérification : `curl http://localhost:8080/actuator/health` doit répondre `{"status":"UP"}`.

### 2. Le frontend

```bash
cp env.template .env.local     # puis renseigner les variables
npm install
npm run dev                    # http://localhost:3000
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Construction de production |
| `npm run lint` | ESLint |
| `npm run typecheck` | Vérification TypeScript sans émission |
| `npm run test` | Tests unitaires et d'intégration (Vitest) |
| `npm run test:e2e` | Parcours de bout en bout (Playwright) |
| `npm run format` | Prettier |
| `npm run api:fetch` | Récupère le contrat d'API du backend dans `contracts/openapi.json` |
| `npm run api:types` | Régénère `types/api.generated.ts` depuis ce contrat |

### Contrat d'API

Les types TypeScript sont **générés** depuis l'OpenAPI du backend et **figés** dans
`contracts/openapi.json`. La spécification n'est jamais récupérée à l'exécution : `/v3/api-docs` est
aujourd'hui accessible sans authentification côté backend et doit être fermé avant la mise en
production. Après une évolution du backend :

```bash
npm run api:fetch && npm run api:types
```

Toute rupture de contrat ressort alors en erreur de compilation, et non en anomalie de recette.

## Comptes de test

Realm `audiences-realm`, mot de passe `Password1!` pour tous :

| Compte | Rôles |
|---|---|
| `juriste.test` | `ROLE_JURISTE`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `dj.test` | `ROLE_DJ`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `dja.test` | `ROLE_DJA`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `assistante.test` | `ROLE_ASSISTANTE`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `sh.test` | `ROLE_SH`, `ROLE_SAISIE`, `ROLE_CONSULTATION` |
| `avocat.test` | `ROLE_AVOCAT` **seul** — périmètre volontairement étroit (cf. QF-01) |

> Le client Keycloak `audiences-api` est **confidentiel** : le `client_secret` est obligatoire pour
> obtenir un jeton. Il reste côté serveur Next.js et n'est jamais exposé au navigateur.

## Sécurité

**Aucun secret ne doit être versionné.** `.env*` est ignoré par git, à l'exception d'`env.template`
qui ne contient que des valeurs locales sans secret. Le dépôt backend a connu une fuite
d'identifiants réels par ce biais — ne pas la reproduire.

## Conventions

- Interface, libellés, messages et commentaires en **français**.
- `services/` (miroir des endpoints) → `hooks/` (TanStack Query) → `components/modules/`.
- Commits : Conventional Commits avec scope, `feat(dossiers): …`.
- **Un jalon à la fois**, validé manuellement avant de passer au suivant. Les tests automatisés qui
  passent ne valent pas recette.
- À partir du socle : **un écran, une branche**.
