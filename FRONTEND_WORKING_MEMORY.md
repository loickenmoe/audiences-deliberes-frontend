# FRONTEND_WORKING_MEMORY

> **Fichier de tête. À lire en premier, à chaque session, avant toute intervention.**
> Les autres fichiers de contexte ne sont ouverts que si le sujet de la session l'exige.
> Dernière mise à jour : 2026-09-08 (jalon **F0** — mémoire persistante posée, aucun code produit).

---

## 1. Le projet en dix lignes

Frontend Next.js de la plateforme **Digitalisation des Audiences et Délibérés** de la Direction
Juridique d'Afriland First Bank Cameroun. Le **backend est achevé** (15 jalons, 67 endpoints HTTP,
255 tests, 85,9 % de couverture) et fait autorité : il n'est **jamais** modifié depuis ce dépôt.

Trois piliers métier : suivi des audiences · suivi des délibérés · gestion des décisions devenues
définitives. Six profils utilisateurs, dont un seul externe (avocat). Cible : **42 écrans en
11 modules**, construits en **18 jalons séquentiels** (F0 → F17), chacun validé manuellement.

Cadre : mémoire de fin d'études KFOKAM-48, KENMOE MBEUKEM Loïc Luc. Encadreur DSI : DEUMO DEUMO
Léonce.

## 2. Frontière absolue

| Répertoire | Droit |
|---|---|
| `audiences-deliberes-frontend` (ici) | **Lecture / écriture** |
| `audiences-deliberes-backend` | **Lecture seule** — jamais modifié sans autorisation explicite |
| `grade-management-frontend` | **Lecture seule** — inspiration architecturale, jamais modifié |

Tout fichier produit (code, config, assets, doc) reste dans le répertoire frontend.

## 3. État courant

| | |
|---|---|
| Jalon achevé | **F0** — mémoire persistante (ce fichier + 5 autres) |
| Jalon suivant | **F1** — squelette Next.js, outillage, types générés depuis l'OpenAPI |
| Code applicatif | **aucun à ce jour** |
| Dépôt git | **non initialisé** — à faire en F1 |
| Artifact d'audit publié | https://claude.ai/code/artifact/0c6cc220-5c2a-4780-b005-fcf34b04e777 |

## 4. Décisions actées (ne pas rouvrir)

| Réf. | Décision | Date |
|---|---|---|
| **QF-01** | Le **portail Avocat est différé au jalon F16**. Les 5 profils internes sont livrés d'abord. Le backend ne permet pas aujourd'hui de construire les écrans avocat (voir §6). | 2026-09-08 |
| **QF-05** | Le frontend **réutilise le client Keycloak `audiences-api`** (confidentiel, `redirectUris` inclut déjà `http://localhost:3000/*`). **Aucune modification du realm backend.** | 2026-09-08 |
| **QF-15** | Tests : **Vitest + Testing Library + MSW** (unitaire/intégration) et **Playwright** (e2e). | 2026-09-08 |
| — | Pile technique : Next.js 15 App Router · React 19 · TS strict · Tailwind v4 · shadcn/ui · TanStack Query + Table · react-hook-form + Zod · axios · sonner · date-fns · lucide · recharts. | 2026-09-08 |
| — | **Routage par fonction, pas par rôle** — pas de routes parallèles `@role` (les profils se recouvrent). | 2026-09-08 |
| — | **RBAC frontend dérivé des `@PreAuthorize` backend**, jamais réinventé. Le backend reste l'arbitre. | 2026-09-08 |
| — | **Types TS générés depuis `/v3/api-docs`**, spec figée dans le dépôt. | 2026-09-08 |
| — | Design : **structure anthracite `#231F20`, identité rouge `#ED1C24`**, couleurs de statut distinctes du rouge de marque. | 2026-09-08 |

## 5. Conventions

- **⚠ RÈGLE PERMANENTE — signaler toute lacune du backend.** Dès qu'une information nécessaire au
  frontend manque côté backend (endpoint absent, champ non exposé, filtre indisponible, rôle
  incohérent, contrat incomplet) : **s'arrêter, le signaler immédiatement**, décrire l'écran empêché
  et l'impact, proposer les options et une recommandation, **attendre l'arbitrage**. Ne jamais
  contourner en silence, ne jamais inventer un endpoint ou une règle métier pour combler un trou, ne
  jamais masquer une fonctionnalité pour éviter d'exposer la lacune. Consigner sous `QF-xx` dans
  `DECISIONS_AND_OPEN_QUESTIONS.md`. *(Consigne utilisateur du 2026-09-08. Modèles de signalement :
  QF-01, QF-02, QF-03, QF-07, QF-08.)*
- **Langue** : interface, libellés, messages et commentaires en **français**. Identifiants
  techniques en français quand ils reprennent le domaine (`dossier`, `delibere`, `etapeId`).
- **Arborescence** : `services/` (miroir 1:1 des endpoints) → `hooks/` (TanStack Query) →
  `components/modules/<module>/`. Clés de cache centralisées.
- **Commits** : Conventional Commits avec scope (`feat(dossiers):`). **Ne jamais committer sans
  demande explicite.**
- **Jalons** : périmètre annoncé → implémentation → vérifications → mise à jour du contexte →
  instructions de test manuel → **STOP et attente de validation**. Les tests automatisés qui
  passent ne valent **pas** validation.

## 6. Contraintes backend à mémoriser

- Base : `http://localhost:8080/api/v1`. Auth `Bearer <JWT Keycloak>` sur **tout**.
- Erreurs : `{code, message, details}`, codes `ERR-001` à `ERR-009` + génériques `ERR-*`.
- Pagination : `{content, totalPages, totalElements}` — pas de `number`/`size` en retour.
- **Les réponses ne portent que des identifiants numériques, jamais de noms.** Charger
  `GET /utilisateurs` et `GET /intervenants` (listes complètes, non paginées) en cache long et
  résoudre les libellés côté client.
- **`DossierResponse.documents` est vide par construction** (Q-67 backend) — utiliser
  `GET /dossiers/{id}/documents`.
- **Multipart** : métadonnées en `@RequestParam`, seul `file` en `@RequestPart`.
- **`ROLE_SAISIE` est composite** : porté automatiquement par JURISTE, DJ, DJA, ASSISTANTE, SH.
- **`AVOCAT` n'a PAS `ROLE_CONSULTATION`** → il n'atteint que 6 endpoints. Cause de QF-01.
- Le jeton ne contient **pas** l'`utilisateur.id` numérique (QF-02).
- Push temps réel : STOMP sur SockJS, endpoint `/ws`, destination `/user/queue/alertes`, jeton dans
  la trame `CONNECT`. Repli garanti : `GET /alertes/mes-notifications`.

## 7. Questions ouvertes

| Réf. | Sujet | Bloque |
|---|---|---|
| **QF-03** | Aucun `GET` sur adjudications/condamnations — écran de suivi sans source | **F13** |
| **QF-04** | Qui génère les rapports ? `GET /rapports` = JURISTE, `GET /tableau-de-bord` = DJ, contredit le parcours P9 | **F15** |
| **QF-07** | `GET /dossiers` ne filtre que nature/catégorie/juridiction — ni référence, ni client, ni « mes dossiers » | F6 |
| **QF-08** | Aucune file « sensibilité à valider » ni « dérogations en attente » pour DJ/DJA | F7 |
| QF-02 | Pas d'endpoint « moi » → contournement par rapprochement d'email | F2 |
| QF-06 | CORS MinIO / affichage inline des documents | F10 |
| QF-09 | Confirmer : français seul, sans i18n | F3 |
| QF-10 | Conserver ou non le thème sombre | F3 |
| QF-11 | Temps réel STOMP ou rafraîchissement périodique | F14 |
| QF-13 | Validation de la palette Afriland | F3 |

Détail complet et recommandations : `DECISIONS_AND_OPEN_QUESTIONS.md`.

## 8. Risques

- **RF-02** — Jetons Keycloak courts : sans rotation du refresh token dans le callback `jwt`,
  déconnexion en pleine saisie. **À traiter en F2, pas après.**
- **RF-01** — URL MinIO pré-signées sur `http://localhost:9000` : CORS et `next.config.ts` à
  vérifier en F10.
- **RF-03** — `/v3/api-docs` public côté backend (R-08), à fermer avant production : figer la spec
  dans le dépôt, ne pas en dépendre à l'exécution.
- **RF-04** — Dépôt git non initialisé.
- **RF-05** — `GET /utilisateurs` et `GET /intervenants` non paginés.

## 9. Où aller ensuite

| Besoin | Fichier |
|---|---|
| Arborescence, couches, auth, RBAC, design system, tests | `FRONTEND_ARCHITECTURE.md` |
| Les 42 écrans, routes, rôles, états, avancement | `SCREEN_MAP.md` |
| Les 67 endpoints et leur état de consommation | `API_INTEGRATION_STATUS.md` |
| Jalons F0→F17, périmètre, avancement | `DEVELOPMENT_ROADMAP.md` |
| Arbitrages, questions ouvertes, risques | `DECISIONS_AND_OPEN_QUESTIONS.md` |
| Source de vérité métier | `../audiences-deliberes-backend/` (lecture seule) |
