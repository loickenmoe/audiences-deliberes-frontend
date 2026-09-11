# FRONTEND_WORKING_MEMORY

> **Fichier de tête. À lire en premier, à chaque session, avant toute intervention.**
> Les autres fichiers de contexte ne sont ouverts que si le sujet de la session l'exige.
> Dernière mise à jour : 2026-09-09 (jalon **F4** livré — composants métier, en attente de validation).

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

## 2. Périmètre de travail

**Frontend et backend sont deux dépôts GitHub distincts**, chacun avec son propre `.git`. Le travail
courant se fait **exclusivement dans le dépôt frontend**.

| Répertoire | Droit |
|---|---|
| `audiences-deliberes-frontend` (ici) | **Dépôt de travail** — lecture / écriture |
| `audiences-deliberes-backend` | **Lecture seule par défaut.** Modifiable **ponctuellement**, sur décision explicite de l'utilisateur, quand un jalon l'exige (arbitrage 2026-09-08) |
| `grade-management-frontend` | **Lecture seule stricte** — inspiration architecturale, jamais modifié |

Une évolution backend n'est donc **ni interdite ni implicite** : elle se décide au cas par cas, au
jalon qui en a besoin. C'est la voie prévue pour QF-01 (portail avocat, F16), QF-03 (lecture des
décisions définitives, F13) et, si retenus, QF-02, QF-07 et QF-08. **La règle permanente de §5
reste entière : signaler, proposer, attendre l'arbitrage — jamais modifier de sa propre initiative.**

Tout fichier produit hors d'une évolution backend décidée reste dans le répertoire frontend.

## 3. État courant

| | |
|---|---|
| Jalons validés | **F0** à **F12** (F3 + F3b `2248918`, F4 `c4548bb`, F5 `f9749b4`, F6 `b96880b`, F7 `0ed36a5` + `08723a8`, F8 `6ed2cd2`, F9 `21b2022`, F10 — PR #6, F11 — PR #7, F12 — PR #8 ; backend PR #22, #23) |
| Jalon livré, **en attente de validation** | **F13** — décisions définitives et jurisprudence (`feat/f13-decisions` depuis `origin/dev` b53096d) ; backend sur `feat/decisions-lecture` (Q-88, Q-89 ; Q-90 laissée ouverte). Rien de commité. |
| Jalon suivant | **F14** — alertes, notifications, configurations |
| Dépôt git | `git@github.com:loickenmoe/audiences-deliberes-frontend.git` · une branche par jalon, fusionnée dans `dev` par l'utilisateur |
| `.gitignore` | ✅ créé et vérifié (RF-04 clos) |
| Décompte | **35 écrans sur 42** · **64 endpoints consommés sur 74** (plus #45 en partie) — mesurés sur `SCREEN_MAP.md` et `API_INTEGRATION_STATUS.md` (l'écran 14 y figure deux fois : compter les numéros distincts) |
| Vérification continue | `npm run smoke` — 17 hypothèses contrôlées sur le backend réel, **à rejouer à chaque jalon** |
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
| — | Design : **structure anthracite `#231F20`, identité rouge `#ED1C24`**, couleurs de statut distinctes du rouge de marque. **L'action principale est anthracite, jamais rouge.** | 2026-09-08 |
| **QF-10** | **Thème clair uniquement** — `next-themes` désinstallé. | 2026-09-08 |
| **QF-13** | Palette validée, **vérifiée par 24 assertions de contraste** calculées sur les jetons réels. | 2026-09-08 |
| **QF-18** | **Formulaire d'identification dans l'application** (`grant_type=password`) ; Keycloak valide en arrière-plan. Limites connues : ni MFA, ni réinitialisation, ni connexion unique. | 2026-09-08 |
| **QF-19** | **Une seule racine `/`**, au contenu adapté au profil. **Pas** de redirection par rôle : aucun profil interne n'a de métier unique. | 2026-09-08 |
| **QF-09** | ~~Français seul~~ → **bilingue français / anglais** (`next-intl`, cookie, sans préfixe d'URL). Libellés dans `messages/*.json`, jamais dans le code. | 2026-09-08 |
| **QF-09b** | Préférence de langue dans un **cookie** — propre au navigateur, pas au compte. | 2026-09-08 |
| — | Conventions d'interface alignées sur **GFA** (application Afriland en production, capture dans `images/`). | 2026-09-08 |

## 5. Conventions

- **⚠ RÈGLE PERMANENTE — signaler toute lacune du backend.** Dès qu'une information nécessaire au
  frontend manque côté backend (endpoint absent, champ non exposé, filtre indisponible, rôle
  incohérent, contrat incomplet) : **s'arrêter, le signaler immédiatement**, décrire l'écran empêché
  et l'impact, proposer les options et une recommandation, **attendre l'arbitrage**. Ne jamais
  contourner en silence, ne jamais inventer un endpoint ou une règle métier pour combler un trou, ne
  jamais masquer une fonctionnalité pour éviter d'exposer la lacune. Consigner sous `QF-xx` dans
  `DECISIONS_AND_OPEN_QUESTIONS.md`. *(Consigne utilisateur du 2026-09-08. Modèles de signalement :
  QF-01, QF-02, QF-03, QF-07, QF-08.)*
- **Langue** : l'interface est **bilingue français / anglais**. **Aucun texte visible en dur dans
  le code** — tout passe par `messages/fr.json` et `messages/en.json`. Le code, les commentaires et
  les identifiants techniques restent en français (`dossier`, `delibere`, `etapeId`).
  Ajouter une clé dans une seule langue fait échouer `tests/unit/messages.test.ts`.
- **Arborescence** : `services/` (miroir 1:1 des endpoints) → `hooks/` (TanStack Query) →
  `components/modules/<module>/`. Clés de cache centralisées.
- **Commits** : Conventional Commits avec scope (`feat(dossiers):`). **Ne jamais committer sans
  demande explicite.**
- **Branches** (arbitrage 2026-09-08) — deux phases :
  1. **Tant que le socle (F1→F4) n'est pas prêt** : travail **directement sur `main`**. Ne créer
     aucune branche, ne proposer aucune PR.
  2. **Ensuite, un écran = une branche.** Chaque écran greffé sur le socle est développé sur sa
     propre branche. Une fois **testé et approuvé** par l'utilisateur, **c'est lui qui pousse**
     la branche puis la **merge dans `dev`**, qui rassemble tous les écrans fonctionnels.
  Je crée la branche locale et j'y travaille ; **je ne pousse ni ne merge jamais moi-même.**
  → **Le socle s'achève avec F4 : la phase 2 s'applique à partir de F5.** Rappelé par l'utilisateur
  le 2026-09-09. `dev` doit être créée par l'utilisateur ; elle n'existe pas encore en ligne.
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
- **Les cinq profils internes sont tous des « juristes augmentés »** : chacun porte `ROLE_SAISIE` et
  `ROLE_CONSULTATION` en plus de son profil. Ne pas se fier aux descriptions fonctionnelles du
  backend (« le SH signe les constitutions ») pour en déduire ses droits — il en a **11 sur 36**.
  Se référer à `lib/rbac.ts`, dérivé des `@PreAuthorize`.
- Le jeton ne contient **pas** l'`utilisateur.id` numérique (QF-02).
- Push temps réel : STOMP sur SockJS, endpoint `/ws`, destination `/user/queue/alertes`, jeton dans
  la trame `CONNECT`. Repli garanti : `GET /alertes/mes-notifications`.

### Pièges d'implémentation rencontrés (à ne pas refaire)

- **Augmentation de type NextAuth** : viser **`@auth/core/jwt`**, jamais `next-auth/jwt` — ce dernier
  n'est qu'un `export *`, et l'augmenter laisse silencieusement tous les champs du jeton en
  `unknown`. Pour `Session`, `next-auth` fonctionne normalement.
- **Frontière serveur/client** : `lib/auth.ts` et `lib/env.server.ts` sont des modules serveur
  (`server-only`). Toute constante partagée avec un composant client vit ailleurs — d'où
  `lib/rotation-jeton.ts`.
- **Vitest et PostCSS** : `postcss.config.mjs` utilise la syntaxe Next (greffons nommés), que Vite ne
  sait pas lire. `vitest.config.ts` court-circuite la découverte PostCSS (`css.postcss.plugins: []`).
- **`npm install` très lent sur ce poste** : les liens de `node_modules/.bin` n'apparaissent qu'en
  toute fin. Ne pas conclure à un échec avant de les avoir vus.
- **`signOut({ callbackUrl })` est déprécié en v5** — l'option courante est `redirectTo`. La
  déprécié est ignorée en silence et renvoie l'utilisateur sur la page courante.
- **`signOut()` ne ferme pas la session Keycloak.** La déconnexion passe par `lib/deconnexion.ts`,
  qui enchaîne sur le point de terminaison OIDC du realm. Sans cela, poste partagé = usurpation
  d'identité silencieuse.
- **Playwright : délai global relevé à 90 s.** En mode développement, Next compile chaque route au
  premier accès, et les parcours d'authentification traversent un vrai Keycloak.
- **`getByLabel` fait une correspondance partielle.** Le bouton « Afficher le mot de passe » capte
  `getByLabel("Mot de passe")` : utiliser `{ exact: true }` plutôt que dégrader un libellé utile aux
  lecteurs d'écran.
- **Ne pas cliquer avant la fin de l'hydratation** dans un script de capture : `waitUntil: "load"`
  puis une pause. Un clic perdu donne l'illusion d'un composant cassé.
- **L'écran de connexion est non défilable** (`h-svh` + `overflow-hidden`) : toute addition de
  contenu doit être vérifiée à 1280×600, sinon elle sera coupée sans avertissement.
- **`npm install <paquet>` sert la dernière majeure.** `@tanstack/react-table` est arrivé en **v9**,
  API incompatible. Épingler la majeure attendue, surtout pour les paquets du projet de référence.
- **`manualPagination: true`** est obligatoire sur `TableDonnees` : le serveur pagine déjà.
- **jsdom n'implémente pas `<dialog>`** : le complément est dans `tests/setup.ts`.
- **`nature` d'un dossier s'envoie par son *libellé*.** Le backend le résout par
  `findByLibelleIgnoreCase` — ni le code, ni l'identifiant. Trois libellés de la taxonomie
  dépassaient la largeur de `dossier.nature` : corrigé par la migration V7 (Q-71 backend).
- **Ne jamais rediriger vers une route non encore livrée.** Le routeur App échoue *en silence* :
  l'URL ne change même pas, et le bouton semble cassé alors que le backend a répondu 201. Découvert
  en renvoyant vers `/dossiers/{id}`, écran livré seulement en F7 (QF-22).
- **`filter({ hasText: "…" })` compare une sous-chaîne sans tenir compte de la casse** (F12) : une
  ligne « Active » dont un bouton dit « Marquer traitée » passe le filtre « Traitée ». Pour un
  statut, viser la cellule exacte : `filter({ has: page.getByRole("cell", { name, exact: true }) })`.
  Et `allInnerTexts()` n'attend rien : attendre d'abord qu'une ligne soit visible.
- **Un `<dialog>` fermé reste dans le DOM.** Deux conséquences, corrigées dans `components/ui/dialog.tsx`
  en F7 : (1) un identifiant de titre **fixe** donnait à toutes les modales montées le nom de la
  première — d'où `useId` ; (2) le navigateur émet `close` **aussi** quand le programme ferme :
  relayer ce cas refermait tout un parcours en cascade (masquer une modale pour afficher sa
  confirmation). `onFermeture` n'est relayé que pour une fermeture décidée par l'utilisateur.
- **Les parcours e2e préparent leur propre socle** (`tests/e2e/preparation.ts` : un client, un
  avocat, via l'API réelle). Une base recréée à neuf avait fait tomber 10 parcours sur 11 : une
  suite qui dépend de l'état laissé par l'exécution précédente teste l'historique de la base.
- **axios 1.x convertit un `FormData` en JSON** quand le type par défaut du client est
  `application/json` — le nôtre. Tout envoi de fichier doit déclarer `multipart/form-data`
  (`gedService.deposer`). Et le tester **sous Node** : sous jsdom, MSW ne relit jamais un corps
  `FormData` et le test expire sans rien vérifier.
- **Une URL MinIO pré-signée se lit par `fetch` nu**, jamais par `apiClient` : notre en-tête
  `Authorization` ferait vérifier le jeton Keycloak à la place de la signature. MinIO autorise
  l'origine `localhost:3000` (CORS vérifié) : aperçu en `blob:` et téléchargement sous le nom
  d'origine. L'URL ne vit que 10 minutes : la demander au clic, pas à l'affichage de la liste.
- **Une date seule (`YYYY-MM-DD`) se lit en heure locale**, jamais par `new Date(iso)` qui la
  prend pour minuit UTC et l'affiche la veille à l'ouest de Greenwich (QF-28). Et elle se
  sérialise par `versIso` (`lib/calendrier.ts`), jamais par `toISOString()`, qui repasse par UTC.
- **Une réponse demandée en binaire reçoit ses erreurs en binaire.** L'intercepteur du client HTTP
  normalisait toute erreur de façon synchrone, et perdait le message d'un corps `Blob`. Il relit
  désormais ces corps (`relireCorpsBinaire`, `lib/api/client.ts`) : ne jamais le refaire service
  par service — une relecture locale arrive trop tard, l'erreur est déjà normalisée.
- **Un endpoint peut exister et rester inatteignable.** #7 est déclaré, codé, testé — mais aucun
  écran ne peut fournir l'`auditId` qu'il exige. Vérifier, pour chaque endpoint qui prend un
  identifiant, **d'où l'interface le tiendrait** ; et le vérifier sur `/v3/api-docs`, pas seulement
  dans le code (QF-23).
- **Les tests e2e tournent contre un build de production** (`next build && next start`). En
  développement, la compilation à la demande produisait quatre échecs *tournants* par exécution sur
  des tests valides. Relever les délais ne faisait que déplacer le problème : 37/37 en 7,8 min
  contre 33/37 en 17,2 min.
- **`ERR-002` ne concerne que les dossiers.** Un doublon de référence **client** remonte en
  `ERR-CONFLICT`. Vérifier le code d'erreur *en provoquant le cas sur le backend* avant de bâtir une
  correspondance champ/erreur — la lecture du contrat d'API ne suffit pas (QF-21).
- **`details` n'est pas un porte-données.** Il contient du texte pour un humain
  (`"reference: must not be blank"`). Ma première idée pour QF-21 était d'y glisser le nom du champ :
  elle aurait rendu les deux illisibles. Un besoin machine réclame une clé à lui — d'où `champ`.
- **Keycloak refuse plus lentement un compte inexistant** qu'un mot de passe faux (protection contre
  l'énumération par mesure du temps de réponse). Les assertions e2e sur ce cas ont besoin d'une
  attente explicite ; les 5 s par défaut de Playwright ne suffisent pas.
- **Rien de décoratif dans un `<label>`.** L'astérisque des champs obligatoires était *à
  l'intérieur* de l'étiquette : le nom accessible du champ devenait « Nom\* », et plus aucun
  `getByLabel("Nom", { exact: true })` ne le trouvait — cinq parcours e2e en échec pour un caractère
  mal placé. L'astérisque vit désormais à côté du `<label>`, `aria-hidden`, l'information
  « obligatoire » restant portée par `required`. Le symptôme trompe : la modale s'ouvrait
  parfaitement, seul le champ semblait absent.
- **Une confirmation rejoue la demande refusée, pas le formulaire.** La planification relisait le
  formulaire (`getValues`) au moment de confirmer un doublon ; entre-temps, un `useEffect` de
  réinitialisation dépendant d'un tableau recréé à chaque rendu (`etapes`) avait vidé la date — le
  second envoi partait sans date, 400 « Requête invalide ». Deux règles : garder la charge refusée
  telle quelle pour la rejouer, et ne réinitialiser un formulaire qu'à l'ouverture (dépendances
  primitives). Le test e2e n'avait rien vu : il attendait le toast, **resté affiché** depuis la
  première tentative — attendre l'effet (la ligne ajoutée), pas le message.
- **Une modale fermée reste dans le DOM, options comprises.** Un `getByText("Favorable")` sur la
  page trouvait l'`<option>` d'une liste « Résultat » d'une modale fermée en plus de la pastille —
  violation du mode strict de Playwright (F9). Cibler le conteneur (la carte, la ligne).
- **Relire les sources métier, pas seulement l'API.** En F9, l'API des délibérés répondait
  correctement mais plaçait prorogation et rabattement après la décision ; seuls les `.docx`
  (US 3.2/3.4, UC-DEL-04/05, diagramme d'états) l'ont révélé (QF-33).
- **next-intl : `{arg}` n'accepte qu'un texte, `<balise>` une fonction.** Passer une fonction à un
  argument simple de `t.rich` n'affiche **rien**, sans erreur à l'exécution (« Du au ») ; `tsc` le
  refuse. Formater la valeur en chaîne avant de la passer.

### Faits vérifiés en conditions réelles (backend démarré, 2026-09-08)

- ✅ Format d'erreur `{code, message, details}` confirmé — 401 `ERR-UNAUTHENTICATED`,
  403 `ERR-FORBIDDEN`, `details: null` quand il n'y a rien à préciser.
- ✅ Pagination `{content, totalPages, totalElements}` confirmée.
- ✅ Claim `roles` = **tableau plat**, composite déjà résolu :
  `["ROLE_JURISTE","ROLE_SAISIE","ROLE_CONSULTATION"]`. Le modèle `roles: string[]` est le bon.
- ✅ `avocat.test` ne porte que `["ROLE_AVOCAT"]` ; `GET /dossiers` → **403 confirmé** (QF-01).
- ⚠️ **Le client `audiences-api` est confidentiel : `client_secret` OBLIGATOIRE.** La commande du
  `README.md` backend (sans secret) échoue en `unauthorized_client`. Le secret figure dans
  `keycloak/audiences-realm.json`. Il vit **côté serveur Next.js uniquement**, jamais exposé au
  navigateur.
- ⚠️ **Durées de vie inversées** : `access_token` **3600 s (60 min)**, `refresh_token`
  **1800 s (30 min)**. Voir RF-02 — la stratégie de rafraîchissement se pilote sur le **refresh**.
- ⚠️ **Provisionnement paresseux** des utilisateurs — voir QF-16.
- ⚠️ Sur base fraîche : `GET /utilisateurs` et `GET /intervenants` renvoient `[]`. Les référentiels
  `natures-dossier` (taxonomie complète) et `types-client-sensible` (VIP / ENTREPRISE /
  PARTICULIER) sont peuplés, ainsi que `configurations` (`SEUIL_MONTANT_DEFAUT` = 50 000 000 FCFA,
  `SEUIL_PROROGATIONS` = 10).

## 7. Questions ouvertes

| Réf. | Sujet | Bloque |
|---|---|---|
| **QF-16** | **Provisionnement paresseux** : un utilisateur n'existe en base qu'après son premier appel à un endpoint « utilisateur courant ». Un juriste jamais connecté est donc **inaffectable** à un dossier | **F2, F6** |
| **QF-03** | Aucun `GET` sur adjudications/condamnations — écran de suivi sans source | **F13** |
| **QF-20** | L'avocat ne peut pas déposer un compte rendu **en document**. ✅ **Direction retenue le 2026-09-09** : rendre `contenu` optionnel sur `POST /publications/cr-audience` et lui accepter un fichier. **Évolution backend à réaliser — rappeler à l'ouverture de F12.** | **F12**, F16 |
| **QF-22** | ✅ Levée en F7 : la liste mène à la fiche, la création y redirige. | — |
| **QF-23** | ✅ Levée le 2026-09-10 : `GET /dossiers/{id}/seuil-derogation` ajouté au backend (Q-74). #7 exige en outre une sensibilité validée — la proposition initiale est aussi un audit `EN_ATTENTE`. | — |
| **QF-24** | L'historique est rédigé **en français** par le backend (`action` = phrase, pas code) : non traduisible. Signalé dans l'interface en anglais. | aucun |
| ~~QF-29~~ | ✅ **Levée** (2026-09-10) : `PATCH /alarmes/{id}/traiter` ajouté au backend (Q-77), « Marquer traitée » dans l'onglet Alarmes. | F8 |
| ~~QF-30~~ | ✅ **Levée** (2026-09-10) : `PATCH /audiences/{id}/annulation` ajouté au backend (Q-76), motif obligatoire ; report = annuler puis replanifier. | F8 |
| **QF-31** | Le calendrier inclut le 1er jour de la période suivante (`BETWEEN` borne incluse). Non bloquant. | aucun |
| **QF-32** | `dateTenue` = jour de saisie du compte rendu, pas de l'audience. Non bloquant. | aucun |
| ~~QF-33~~ | ✅ **Levée** (2026-09-11) : prorogation et rabattement n'existaient qu'après la décision, contre toutes les sources. Backend aligné (Q-78) : mise en délibéré sans résultat, `PUT /deliberes/{id}/resultat`, `GET /deliberes/{id}/prorogations`. | F9 |
| ~~QF-34~~ | ✅ **Levée** (2026-09-11) : demande de suppression orpheline après une suppression directe, file anonyme. Backend corrigé (Q-79), V10. | F10 |
| ~~QF-35~~ | ✅ **Levée** (2026-09-11) : rapport journalier ouvert au DJ, à la DJA et à l'Assistante (Q-80). | F10 |
| ~~QF-36~~ | ✅ **Levée** (2026-09-11) : `ROLE_JURISTE` ajouté aux composites de `ROLE_DJ`/`ROLE_DJA` (realm + Keycloak en service) ; provisionnement par priorité de profil (Q-81). Un jeton antérieur au changement exige une reconnexion. | transverse |
| **QF-26** | Les pièces justificatives des frais sont une **liste de noms**, pas des fichiers (`List<String>`). À trancher à l'ouverture de F11. | **F11**, F16 |
| **QF-27** | Aucun endpoint « utilisateur courant » : l'interface ne sait pas si l'on est l'auteur d'une pièce. Non bloquant. | aucun |
| **QF-25** | ✅ Levée le 2026-09-10 (Q-75) : `@NotEmpty` + `@Valid` sur `PUT /affectation`. Reste ouvert : l'alerte au DJ à presque chaque changement d'affectation (règle métier RG-DOS-07, à confirmer par la DJ). | — |
| **QF-21** | ✅ **Résolu le 2026-09-09 dans le backend** : le corps d'erreur porte un champ `champ`, absent quand aucun champ n'est visé. `ErreurApi.champ` fait autorité côté frontend ; la table par formulaire ne subsiste qu'en repli de version. | — |
| **QF-04** | Qui génère les rapports ? `GET /rapports` = JURISTE, `GET /tableau-de-bord` = DJ, contredit le parcours P9 | **F15** |
| **QF-07** | `GET /dossiers` ne filtre que nature/catégorie/juridiction — ni référence, ni client, ni « mes dossiers » | F6 |
| **QF-08** | Aucune file « sensibilité à valider » ni « dérogations en attente » pour DJ/DJA | F7 |
| QF-02 | Pas d'endpoint « moi » → contournement par rapprochement d'email | F2 |
| QF-06 | CORS MinIO / affichage inline des documents | F10 |
| QF-11 | Temps réel STOMP ou rafraîchissement périodique | F14 |

Détail complet et recommandations : `DECISIONS_AND_OPEN_QUESTIONS.md`.

## 8. Risques

- **RF-02** — 🔴 **Le `refresh_token` (30 min) est plus court que l'`access_token` (60 min)** —
  mesuré, pas supposé. La rotation naïve « rafraîchir quand l'access token approche de son
  expiration » **échouerait systématiquement** : à 55 min, le refresh token est mort depuis 25 min,
  et l'utilisateur est déconnecté. **Piloter le rafraîchissement sur `refresh_expires_in`** — se
  rafraîchir vers 25 min, ce qui fait tourner le refresh token et prolonge la session. **À traiter
  en F2, pas après.**
- **RF-01** — URL MinIO pré-signées sur `http://localhost:9000` : CORS et `next.config.ts` à
  vérifier en F10.
- **RF-03** — `/v3/api-docs` public côté backend (R-08), à fermer avant production : figer la spec
  dans le dépôt, ne pas en dépendre à l'exécution.
- **RF-04** — ✅ **Clos en F1.** `.gitignore` et `.gitattributes` créés **avant** toute installation
  de dépendance ; protection vérifiée en pratique (`node_modules/` et `.env.local` bien ignorés).
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
