# DEVELOPMENT_ROADMAP

> Les 18 jalons du frontend : périmètre, dépendances, critères de sortie, avancement.
> Dernière mise à jour : 2026-09-11 (**F0 à F8 validés**, **F9 livré** en attente de validation).

**Statut** : `✅` validé manuellement · `🔵` livré, en attente de validation · `⏳` à faire ·
`🔧` à faire, **comprend une évolution du dépôt backend** à décider au début du jalon

---

## Règle de conduite des jalons

Pour **chaque** jalon, dans cet ordre :

1. Annoncer l'objectif et le périmètre exact.
2. Identifier les fichiers touchés et les endpoints concernés.
3. Expliquer les décisions d'architecture ou d'UX significatives.
4. Implémenter **uniquement** le périmètre approuvé.
5. Lancer les vérifications automatisées (`lint`, `tsc`, `test`, `build`).
6. Vérifier l'absence de régression sur l'existant.
7. Mettre à jour les fichiers de contexte.
8. Fournir des instructions de test manuel, avec résultats attendus et cas limites.
9. **STOP** — attendre la validation manuelle explicite.
10. Une fois validé, proposer un message de commit. **Ne jamais committer sans demande.**

> **Les tests automatisés qui passent ne valent pas validation.** La validation manuelle est la
> porte obligatoire entre deux jalons.

Ordre imposé par les dépendances de données : rien avant les référentiels, aucune audience avant un
dossier, aucun délibéré avant une audience.

---

## F0 — Mémoire persistante ✅

**Achevé, committé et poussé le 2026-09-08** (`39de75d`). Aucun code.

Les six fichiers de contexte : `FRONTEND_WORKING_MEMORY.md`, `FRONTEND_ARCHITECTURE.md`,
`SCREEN_MAP.md`, `API_INTEGRATION_STATUS.md`, `DEVELOPMENT_ROADMAP.md`,
`DECISIONS_AND_OPEN_QUESTIONS.md`.

**Critère de sortie** : ces fichiers suffisent à reprendre le projet sans relire le backend.

---

## F1 — Squelette et outillage ✅

**Objectif** : un projet Next.js qui démarre, compile, se vérifie et sait parler au backend.

- 🔴 **`.gitignore` EN TOUT PREMIER**, avant `npm install` (RF-04) — le dépôt est déjà en ligne et
  n'en a pas. Puis `README.md` et `env.template` (valeurs locales, **aucun secret réel**).
  *(`git init` : fait le 2026-09-08, hors jalon.)*
- Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui (`components.json`).
- ESLint + Prettier ; scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`.
- `lib/env.ts` — validation Zod de l'environnement, **échec explicite** si une variable manque.
- `contracts/openapi.json` figé + génération de `types/api.generated.ts` (`openapi-typescript`).
- `types/enums.ts` — les **28 énumérations exposées par l'API** (sur 31 côté backend ; 3 sont internes, recoupé avec `contracts/openapi.json`) et leurs libellés français.
- Vitest + Testing Library + MSW + Playwright, avec un test témoin par niveau.
- `app/layout.tsx`, providers (thème, TanStack Query, session, toasts), page `not-found`.

**Validé le 2026-09-08** (commit `4cc0cd0`). Vérifications : `typecheck` ✅ · `lint` ✅ · **27 tests unitaires** ✅ ·
`build` ✅ (4 pages, 101 kB de JS partagé) · **3 parcours Playwright** ✅ ·
**`npm run smoke` : 17 hypothèses vérifiées contre le backend réel** ✅.
**Dépend de** : F0.

> **Ajouts hors périmètre annoncé, justifiés en cours de jalon :**
> `scripts/smoke-backend.mjs` (`npm run smoke`) — vérifie que les hypothèses du code frontend tiennent
> sur le backend réel : forme des erreurs, forme de la pagination, claim `roles`, durées de vie des
> jetons, provisionnement paresseux, périmètre du profil avocat. À rejouer **à chaque jalon**.
> `.gitattributes` — normalisation des fins de ligne, git signalait des conversions LF/CRLF.

---

## F2 — Authentification et autorisation ✅

**Objectif** : se connecter avec un compte Keycloak réel et voir une navigation conforme à ses rôles.

- NextAuth v5 + provider Keycloak sur le client existant `audiences-api` (QF-05).
- Callbacks `jwt`/`session` : `accessToken`, `refreshToken`, `expiresAt`, **`roles: string[]`**,
  `keycloakId`, identité.
- **Rotation du jeton** avant expiration, déconnexion propre si le rafraîchissement échoue (RF-02).
- `lib/api/client.ts` — intercepteurs jeton (chemins serveur et client) et erreurs.
- `lib/api/errors.ts` — normalisation `{code, message, details}` et messages français des 15 codes.
- `lib/rbac.ts` — table unique dérivée des `@PreAuthorize`.
- `lib/serverAuth.ts` — `authenticate()` / `authorize()`.
- Écrans **01** connexion, **04** non autorisé, **02** accueil minimal, coquille `(protected)`
  (barre latérale + navbar filtrées par rôles).
- **QF-02** — résolution de l'`utilisateur.id` par rapprochement d'email sur `GET /utilisateurs`,
  encapsulée dans un seul hook pour être remplaçable si le backend ajoute un endpoint « moi ».

**Validé le 2026-09-08** (commit `d49f36d`). Vérifications : `typecheck` ✅ · `lint` ✅ · **51 tests** ✅ ·
`build` ✅ · **parcours d'authentification Playwright contre le Keycloak réel** ✅.
**Dépend de** : F1. **Décisions** : QF-05 ✅.

> **Points d'implémentation à retenir :**
> - `lib/rotation-jeton.ts` isole la politique de rotation pour la rendre testable — c'est la pièce
>   la plus facile à se tromper. Six tests y couvrent le piège de RF-02.
> - L'augmentation de type JWT vise **`@auth/core/jwt`**, pas `next-auth/jwt` : ce dernier n'est
>   qu'une réexportation, et l'augmenter laisse silencieusement tous les champs en `unknown`.
> - `ERREUR_RAFRAICHISSEMENT` vit dans `lib/rotation-jeton.ts` (module partagé) et non dans
>   `lib/auth.ts` (module serveur) : le provider client doit pouvoir le lire.
> - L'amorçage de session appelle `GET /alertes/mes-notifications` pour contourner QF-16.

---

## F3 — Design system Afriland ✅ *(livré avec F3b)*

**Objectif** : l'identité visuelle et les états standards, avant tout écran métier.

- Jetons de couleur : **structure anthracite `#231F20`, identité rouge `#ED1C24`**, rouge dérivé
  `#B3141B` pour le texte, couleurs de statut **distinctes du rouge de marque**.
- Typographie, échelle de tailles, espacements, comportement responsive.
- Intégration des logos officiels (`public/brand/`), favicon, page de connexion habillée.
- États standards : chargement (squelettes), vide, erreur, succès.
- Accessibilité : contraste AA, focus visible, navigation clavier, `prefers-reduced-motion`.
- Trancher **QF-10** (thème sombre). *(QF-09 traité en F3b.)*

**Vérifications exécutées le 2026-09-08** : `typecheck` ✅ · `lint` ✅ · **83 tests** ✅ dont
**24 assertions de contraste recalculées depuis `globals.css`** · `build` ✅ · parcours Playwright ✅.
**Dépend de** : F2. **Décisions rendues** : QF-09 ✅, QF-10 ✅, QF-13 ✅, **QF-18** ✅, **QF-19** ✅.

> **Apport de l'utilisateur** : la capture de **GFA**, application Afriland en production
> (`images/login_page_template.png`), a fourni des conventions d'interface réelles plutôt que
> déduites. Elle a confirmé la direction proposée et fermé QF-13.
>
> **Points à retenir :**
> - Le test de contraste lit les jetons **dans la feuille de style**, pas des valeurs recopiées :
>   éclaircir une couleur de texte fait échouer la suite. Deux jetons ont dû être assombris.
> - L'action principale est **anthracite**. Un bouton rouge se confondrait avec le rouge d'erreur.
> - `classesBouton()` existe parce qu'imbriquer un `<a>` dans un `<button>` produit du HTML invalide.
>
> **Reprise de l'authentification en cours de jalon (QF-18)** — décision utilisateur : le formulaire
> d'identification vit désormais dans l'application, Keycloak validant en arrière-plan
> (`grant_type=password`). Le provider Keycloak OIDC est remplacé par un provider Credentials ; la
> déconnexion révoque le jeton **de serveur à serveur**, sans redirection externe. Limites assumées
> et consignées en QF-18. Deux tests garantissent qu'un refus ne révèle jamais si un compte existe.
>
> **QF-19** : une seule racine `/`, au contenu adapté au profil — pas de redirection par rôle.
> Aucun profil interne n'a de métier unique ; le SH lui-même dispose de 11 capacités sur 36.
> Le détail par profil est dans `SCREEN_MAP.md`, écran 02.

---

## F3b — Bilinguisme français / anglais ✅

**Objectif** : rendre l'interface disponible dans les **deux langues officielles du Cameroun**.
Ouvert en cours de F3 sur décision utilisateur, révisant QF-09.

**Pourquoi maintenant** : extraire les chaînes de 5 écrans coûte une soirée ; les extraire de 42
écrans après coup en coûterait dix, avec le risque d'en oublier.

- `next-intl` 4.14, langue dans un cookie, **sans préfixe de langue dans l'URL** — `/dossiers/42`
  reste `/dossiers/42`, ce qui préserve les liens profonds des notifications (cohérent avec QF-19).
- `messages/fr.json` et `messages/en.json` : interface, 28 énumérations, 8 rôles, 15 codes d'erreur,
  17 natures de dossier, 3 types de client sensible, 7 clés de configuration.
- Les libellés quittent `types/enums.ts`, qui ne porte plus que le **contrat**.
- `lib/actions/connexion.ts` renvoie une **clé** de message, jamais un texte : la traduction
  appartient au composant, qui connaît la langue au moment du rendu.
- Sélecteur de langue sur l'écran de connexion **et** dans l'en-tête.
- Typographie française : apostrophe courbe `’` dans tous les messages.

**Ajustements de l'écran de connexion demandés en fin de jalon :**
- **Bascule de visibilité du mot de passe** — l'utilisateur doit pouvoir relire sa saisie avant de
  valider ; une faute de frappe invisible est la première cause d'échec de connexion. Libellé et
  `aria-pressed` traduits, l'état est donc lisible par les technologies d'assistance.
- **Filet rouge retiré** de la connexion — et, par cohérence, des pages « introuvable » et « accès
  refusé », qui forment la même famille hors application. Le rouge de marque subsiste sur l'anneau de
  focus et l'indicateur de navigation active.
- **Écran non défilable** (`h-svh` + `overflow-hidden`). Espacements resserrés en conséquence :
  vérifié à 1280×600 et 1280×720, débordement nul et pied de page visible aux deux hauteurs.

**Validé le 2026-09-08** (commit `2248918`, avec F3). Vérifications : `typecheck` ✅ · `lint` ✅ ·
**98 tests** ✅ · `build` ✅ · **20 parcours Playwright** ✅ dont 6 dédiés au bilinguisme · `smoke` ✅.
**Dépend de** : F3. **Décisions rendues** : QF-09 (révisée) ✅, QF-09b ✅.

> **Le garde-fou qui compte** : `tests/unit/messages.test.ts` vérifie la **parité stricte des clés**
> entre les deux fichiers et la présence d'un libellé pour chaque valeur d'énumération, chaque rôle,
> chaque code d'erreur et chaque entrée de référentiel. Le risque n'est pas de mal traduire, c'est
> d'**oublier** de traduire — un oubli passerait inaperçu jusqu'à ce qu'un utilisateur anglophone
> tombe sur un code technique.
>
> **Le backend n'a aucun mécanisme de localisation**, mais ne renvoie que des codes stables :
> l'interface est intégralement traduisible sans le modifier. Seul le contenu **saisi par les
> utilisateurs** (comptes rendus, motifs de rejet) reste dans sa langue de rédaction — c'est normal.

---

## F4 — Composants métier réutilisables ✅

**Objectif** : ne plus jamais réécrire une table, un filtre ou un formulaire.

- `DataTable` — TanStack Table, **pagination serveur** `{content, totalPages, totalElements}`, tri,
  états intégrés.
- `FiltersBar` — filtres synchronisés à l'URL.
- Socle de formulaire react-hook-form + Zod, erreurs de champ alimentées par `ERR-001`/
  `ERR-VALIDATION`.
- `ConfirmDialog` — motif de reprise pour `ERR-003`/`ERR-005` (`?forcer=true`).
- `FileUpload` — multipart, contrôle format/poids côté client **en plus** du contrôle serveur.
- `ExportMenu` — téléchargement binaire PDF/Excel/CSV.
- `CycleEtape` — frise d'états avec boucles prorogation et rabattement.
- `StatutChip`, `MontantFcfa`, `DateFr`, hook `useLibelles()` (résolution des identifiants).

**Validé le 2026-09-09** (commit `c4548bb`). Vérifications : `typecheck` ✅ · `lint` ✅ ·
**119 tests** ✅ · `build` ✅ · **20 parcours Playwright** ✅ sans régression · `smoke` ✅.
**Dépend de** : F3.

> **Décisions et pièges du jalon :**
> - **`@tanstack/react-table` figé en v8.** `npm install` a d'abord posé la **v9**, une réécriture à
>   l'API incompatible (`getCoreRowModel` → `createCoreRowModel`). La v8 est celle du projet de
>   référence et de l'écosystème. Toujours vérifier la majeure servie par `latest`.
> - **`manualPagination: true`** sur la table : sans cela TanStack repagine une page déjà paginée par
>   le serveur et n'affiche qu'une fraction des lignes. Un test le garde fermé.
> - **`<dialog>` natif plutôt qu'une bibliothèque de modale** : piégeage du focus, fermeture par
>   Échap et inertie de l'arrière-plan sont fournis par le navigateur. jsdom ne l'implémente pas —
>   `tests/setup.ts` fournit le minimum comportemental.
> - **Filtres dans l'URL, pas dans un état React** : un juriste doit pouvoir partager le lien de sa
>   recherche filtrée. Tout changement de filtre remet à la première page, sinon l'utilisateur
>   atterrit sur une page vide qu'il lit comme « aucun résultat ».
> - **Le format d'un fichier se dérive de l'extension**, pas du type MIME — c'est la règle du backend
>   (Q-46). S'en écarter ferait accepter localement ce que le serveur refusera.
> - `userEvent.upload` respecte `accept` : les tests de refus passent `applyAccept: false`, car un
>   navigateur laisse de toute façon choisir « tous les fichiers ».

---

## F5 — Référentiels, clients, intervenants 🔵 *(livré, en attente de validation manuelle)*

**Objectif** : disposer des données sans lesquelles aucun dossier n'est créable.

Écrans **19** recherche clients, **20** vue consolidée, **21** création client, **42** référentiel
des intervenants.
Endpoints **#9-12**, **#61-62**, **#64-66**. Mise en place des caches longs de résolution des noms.

**Livré le 2026-09-09** sur la branche `feat/f5-referentiels-clients`, première fonctionnalité
suivant la convention « un écran = une branche ».

**Premier jalon consommant l'API métier** — 7 endpoints branchés, 2 prêts (référentiels de
formulaire, dont les écrans arrivent en F6).

- `services/` : `clientService`, `intervenantService`, `referentielService` — miroir 1:1 des
  endpoints, sans logique métier.
- `hooks/` : clés de cache centralisées, `useClients`, `useIntervenants`, `useReferentiels`,
  et **`useLibelles`** qui résout les identifiants numériques en noms.
- `types/domaine.ts` : formes de données relevées dans les DTO du backend.
- Écrans **19** recherche clients, **20** vue consolidée, **21** création client (modale),
  **42** référentiel des intervenants.

**Vérifications exécutées le 2026-09-09** : `typecheck` ✅ · `lint` ✅ · **132 tests** ✅ (8 sur les
services via MSW, 5 sur le rattachement des erreurs aux champs) · `build` ✅ · **28 parcours
Playwright contre le backend réel** ✅ · `smoke` 17/17 ✅.
**Dépend de** : F4.

> **Points à retenir :**
> - **Les référentiels sont mis en cache 30 minutes** : ils changent au rythme d'une décision
>   d'administration, pas d'une session. Ils ne sont pas paginés côté backend (RF-05).
> - **`useLibelles` existe parce que le backend ne renvoie jamais de nom** — un dossier expose
>   `juristesAffectes: [3, 7]`. Un juriste jamais connecté n'y figure pas (QF-16) : la résolution
>   retombe sur `#id` plutôt que sur un blanc trompeur.
> - **Le formulaire d'intervenant s'adapte au type** : un avocat exige un compte applicatif et
>   refuse `notification` ; un autre prestataire refuse tout compte. Afficher les deux champs en
>   permanence produirait des refus incompréhensibles.
> - **Le doublon de référence client remonte en `ERR-CONFLICT`, pas en `ERR-002`** — vérifié en
>   provoquant le cas sur le backend. `ERR-002` ne concerne que les dossiers, et `ERR-CONFLICT` sert
>   à neuf conflits différents sans jamais nommer de champ. C'est donc le formulaire, seul à savoir
>   quel endpoint il appelle, qui déclare le champ visé (QF-21). Un parcours e2e vérifie
>   l'`aria-invalid` sur `reference`, un autre sur `compteKeycloak`.
> - **Rien de décoratif dans un `<label>`** : l'astérisque des champs obligatoires y rendait le nom
>   accessible « Nom\* ». Cinq parcours e2e échouaient, et un lecteur d'écran annonçait « Nom
>   étoile ». Elle vit désormais à côté de l'étiquette, `aria-hidden`.
> - **Keycloak refuse plus lentement un compte inexistant** qu'un mot de passe faux : c'est sa
>   protection contre l'énumération de comptes. Les assertions e2e sur ce cas exigent une attente
>   explicite.
> - Les filtres passent par l'URL, écrits **au `blur`** et non à la frappe : sinon une requête et une
>   entrée d'historique par caractère.
> - Délai de démarrage Playwright porté à **300 s** : après un `rm -rf .next`, la compilation à
>   froid dépasse largement 120 s sur ce poste. Budget **par test** porté à 180 s : mesuré serveur
>   chaud, une navigation douce du routeur App demande ~5 s en développement — l'URL ne change qu'à
>   l'arrivée de la charge RSC. La suite gagnerait à tourner contre un build de production ; à
>   trancher en **F17**.

---

## F6 — Dossiers : liste et création 🔵 *(livré, en attente de validation manuelle)*

Écrans **05** liste des dossiers, **06** création. Endpoints **#1**, **#2**, plus les référentiels
de F5. **Livré le 2026-09-09** sur la branche `feat/f6-dossiers`.

- `services/dossierService.ts`, `hooks/useDossiers.ts`, types `CreerDossier` et `FiltresDossiers`.
- Formulaire adaptatif : la **catégorie est dérivée de la nature**, jamais demandée — le backend la
  déduit (RG-DOS-02) et refuse une valeur divergente.
- Sections identification, parties, pièces conditionnelles, affectation, sensibilité.

**Trois blocages backend levés au passage** (jalon **M16** du dépôt backend, sur autorisation
explicite de l'utilisateur) : voir Q-71, Q-72, Q-73 côté backend, QF-07 côté frontend.

**Vérifications exécutées le 2026-09-09** : `typecheck` ✅ · `lint` ✅ · **141 tests unitaires** ✅ ·
`build` ✅ · **37 parcours Playwright contre le backend réel** ✅ · `smoke` 17/17 ✅ ·
**265 tests backend** ✅.
**Dépend de** : F5.

> **Points à retenir :**
> - **`nature` s'envoie par son libellé**, pas par son code ni son identifiant : le backend le résout
>   par `findByLibelleIgnoreCase`. Trois libellés de la taxonomie dépassaient la largeur de
>   `dossier.nature` et rendaient ces natures inutilisables — corrigé par la migration V7 (Q-71).
> - **La catégorie ne se demande pas, elle se déduit.** La demander créerait une contradiction
>   possible avec la nature, pour aucun gain. Elle est affichée en lecture seule.
> - **Les champs conditionnels sont exigés en ET, pas en OU** (Q-11) : recouvrement → dossier de
>   crédit **et** PV de transfert ; litige → incident de compte **et** éléments justificatifs.
>   N'afficher que la paire concernée évite de laisser croire que les quatre sont exigés.
> - **`typeClientSensible` s'envoie par son code**, désormais validé contre le référentiel (Q-73).
> - **Ne jamais rediriger vers une route non livrée.** La création renvoyait vers `/dossiers/{id}`,
>   écran 07 livré en F7 : le routeur App échoue *en silence*, l'URL ne change même pas et le bouton
>   semble cassé alors que le backend a répondu 201. Redirection vers la liste filtrée, et référence
>   affichée sans lien, jusqu'à F7 (QF-22).
> - **La suite e2e tourne désormais contre un build de production.** En développement, la
>   compilation à la demande produisait quatre échecs *tournants* par exécution, sur des tests
>   valides, pour 17 minutes. Contre `next build && next start` : 37/37 en 7,8 minutes, build
>   compris. Relever les délais n'avait fait que déplacer le problème.

---

## F7 — Fiche dossier 🔵 *(livré, en attente de validation manuelle)*

Écrans **07** synthèse, **08** étapes, **15** historique, **16** affectation, **18** sensibilité,
plus un onglet documents (#43, lecture), et **17** dérogation de seuil — demande et arbitrage, ce
dernier débloqué par l'ajout de `GET /dossiers/{id}/seuil-derogation` au backend (Q-74, QF-23). **Livré le 2026-09-10** sur `feat/f7-fiche-dossier`, branchée sur F6.

- `services/dossierService.ts` étendu (#3 à #8, positionnement direct), `services/gedService.ts`
  (#43), hooks de mutation qui rafraîchissent la fiche **et** les listes.
- `lib/transitions.ts` : miroir exact du validateur de transitions du backend — seules les
  transitions permises sont proposées.
- Fiche à onglets accessible (motif WAI-ARIA, navigation aux flèches), trois modales.
- QF-22 levée : la liste mène à la fiche, la création y redirige.
- **Pièces jointes** (demandées à la recette de F7) : pièces facultatives dès la création, lisibles
  avant l'envoi ; onglet Documents complet — dépôt, aperçu, téléchargement, suppression (écran 12
  avancé depuis F10). Endpoints #38, #39, #40. QF-06 tranchée.

**Vérifications exécutées le 2026-09-10** : `typecheck` ✅ · `lint` ✅ · **174 tests unitaires** ✅ ·
`build` ✅ · **52 parcours Playwright contre le backend réel et MinIO** ✅ · `smoke` 17/17 ✅.
**Dépend de** : F6. **Note** : QF-08 (files transverses DJ/DJA) reste ouverte ; QF-23 levée (Q-74).

> **Points à retenir :**
> - **Un endpoint peut exister et rester inatteignable.** #7 exige l'`auditId` d'une demande de
>   dérogation, que rien n'expose (ni `GET`, ni champ du dossier, ni historique) — vérifié sur
>   `/v3/api-docs`. Pour chaque endpoint qui prend un identifiant : d'où l'interface le tiendra-t-elle ?
> - **Annoncer les effets de bord du backend avant confirmation** : exercer un recours ouvre
>   l'étape suivante ; positionner au second recours crée le premier. Tous deux passent par un
>   dialogue qui les nomme.
> - **`PUT /affectation` remplace, n'ajoute pas** : les sélections partent de l'affectation
>   actuelle. Conserver quelqu'un déclenche `ERR-003`, traité comme une demande de confirmation.
> - **Deux défauts de `Dialog`, révélés par les parcours de F7 et corrigés à la racine** : titres
>   à identifiant fixe (toutes les modales s'appelaient comme la première) et relais de la fermeture
>   programmatique (masquer une modale refermait tout le parcours). Ils touchaient toute
>   l'application.
> - **Les parcours e2e préparent leur socle** (`tests/e2e/preparation.ts`) : une base recréée à
>   neuf avait fait tomber 10 parcours sur 11 sans qu'aucune ligne de l'application soit en cause.
> - L'historique est rédigé en français par le serveur (QF-24) : l'interface anglaise le dit.
> - **Les pièces partent après le dossier, jamais avec lui** : le dépôt en GED exige son identifiant
>   (et le module dossier ne dépend pas de la GED, Q-67). Un dépôt qui échoue n'annule pas le
>   dossier : la fiche s'ouvre sur ses documents en nommant les pièces à redéposer.
> - **axios 1.x convertit un `FormData` en JSON** sous notre type par défaut `application/json` :
>   l'envoi déclare `multipart/form-data`, et son test tourne sous Node — sous jsdom, MSW ne relit
>   jamais le corps et le test expire sans rien prouver.
> - **Une URL pré-signée se lit sans `Authorization`** et au clic (10 minutes de vie). Le CORS de
>   MinIO autorise l'application : aperçu en `blob:`, téléchargement sous le nom d'origine.

---

## F8 — Audiences, alarmes, calendrier 🔵 *(livré, en attente de validation manuelle)*

Écrans **09**, **11**, **22**, **23**, **24**, **25**. Endpoints **#13-17**, **#56-57**. **Livré le
2026-09-10** sur `feat/f8-audiences`, branchée sur F7.

- `services/audienceService.ts`, `hooks/useAudiences.ts` : mutations qui rafraîchissent les listes
  du dossier, la fiche **et** le calendrier.
- Fiche : onglets **Audiences** (planification, doublon `ERR-005` confirmable, compte rendu proposé
  seulement à partir du jour de l'audience) et **Alarmes** (création, reprogrammation chaînée,
  alarme échue signalée).
- `/audiences/calendrier` : agenda par jour, semaine / mois / trimestre alignés sur des bornes
  naturelles, exports PDF et Excel nommés par période.
- `lib/calendrier.ts` : dates locales, jamais `toISOString` (QF-28 corrigée : les dates seules
  s'affichaient la veille à l'ouest de Greenwich).
- Client HTTP : une erreur arrivée en binaire (export) est relue dans l'intercepteur, pour que le
  message du backend atteigne l'utilisateur.

**Vérifications exécutées le 2026-09-10** : `typecheck` ✅ · `lint` ✅ · **188 tests unitaires** ✅ ·
`build` ✅ · **58 parcours Playwright contre le backend réel, Keycloak et MinIO** ✅ (build de
production) · `smoke` ✅. *Piège relevé* : `reuseExistingServer` réutilise un `next dev` resté
ouvert sur le port 3000 — la suite tourne alors, sans le dire, contre le serveur de développement.

**Complément du 2026-09-10 (décision du porteur du projet)** : QF-29 et QF-30 levées par deux
endpoints ajoutés au backend (M16, Q-76, Q-77). Annulation motivée d'une audience planifiée — elle
quitte calendrier, exports et rappels, et ne compte plus comme doublon ; « Marquer traitée » sur une
alarme active. **Revérifié** : **190 tests unitaires** ✅ · **60 parcours Playwright** contre le
backend réel (build de production) ✅, dont l'annulation suivie d'une replanification à la même date
sans demande de confirmation. Backend : 277 tests, `BUILD SUCCESS`, V8 appliquée.

**Dépend de** : F7. **Non bloquants** : QF-31, QF-32.

> **Points à retenir :**
> - **Une confirmation rejoue la demande refusée, pas le formulaire.** Relire le formulaire au
>   moment de confirmer un doublon envoyait une date vide : un `useEffect` de réinitialisation
>   dépendait d'un tableau recréé à chaque rendu. Même défaut corrigé dans la création d'alarme.
> - **Un test qui attend un message peut lire celui d'avant.** Le toast de la première
>   planification masquait l'échec de la seconde : attendre l'effet (la ligne ajoutée).
> - **next-intl** : un argument `{debut}` n'accepte qu'un texte ; une fonction n'y affiche rien.
> - **Le compte rendu ne peut pas être joué en e2e** : le backend n'accepte qu'une audience future,
>   et son compte rendu qu'à partir de sa date. Le parcours vérifie qu'il n'est pas proposé trop
>   tôt ; la saisie est couverte par les tests du backend et par la recette manuelle.

---

## F9 — Délibérés 🔵 *(livré, en attente de validation manuelle)*

Écrans **10**, **26**, **27**. Endpoints **#18-22**, **#58**, plus deux ajouts du backend (Q-78).
**Livré le 2026-09-11** sur `feat/f9-deliberes`, branchée sur `dev` (F8 fusionné).

**L'audit a changé le jalon.** Le backend plaçait prorogation et rabattement **après** la décision ;
toutes les sources les placent pendant « En délibéré » (QF-33). Sur décision du porteur du projet,
le backend a été aligné (M16, Q-78) avant l'écran : mise en délibéré sans résultat, prorogation et
rabattement pendant l'attente, décision qui vide le délibéré, historique des prorogations. Le
critère « rabattement refusé hors `DELIBERE_VIDE` » de ce jalon, écrit d'après l'ancien backend,
devient « rabattement refusé une fois la décision rendue ».

- `services/delibereService.ts` (8 endpoints), `hooks/useDeliberes.ts`, énumération `EtatDelibere`.
- Onglet **Délibérés** de la fiche : mettre en délibéré (ou enregistrer une décision déjà rendue),
  proroger — **au-delà du seuil, un avertissement, pas une erreur** —, historique des prorogations,
  rabattre, enregistrer la décision (échéance exigée si défavorable ou mixte), expédition, suivi du
  délai de recours. Seules les actions recevables à chaque état sont proposées.
- L'onglet Étapes renvoie vers l'onglet Délibérés pour une étape en délibéré.

**Vérifications exécutées le 2026-09-11** : `typecheck` ✅ · `lint` ✅ · **196 tests unitaires** ✅ ·
`build` ✅ · **64 parcours Playwright contre le backend réel** ✅ (build de production ; suite
complète à 62/64, puis les 2 parcours corrigés — sélecteurs ambigus — rejoués à 4/4). Backend :
287 tests, `BUILD SUCCESS`, V9 appliquée.
**Dépend de** : F8.

> **Points à retenir :**
> - **Auditer contre les sources, pas seulement contre l'API.** L'API « marchait » (Q-44 l'avait
>   rendue appelable) ; elle ne faisait pas ce que la procédure fait. Seules les US, les UC et le
>   diagramme d'états, lus dans les `.docx`, l'ont montré.
> - **Une modale fermée reste dans la page.** Ses `<option>` portent les mêmes libellés que les
>   pastilles : un `getByText("Favorable")` sur toute la page est ambigu. Cibler la carte.
> - **`next build` a dépassé les 300 s** de `webServer` sur un poste chargé (894 s) : construire à
>   la main, démarrer `next start`, laisser Playwright le réutiliser.

---

## F10 — Gestion documentaire ⏳

Écrans **12**, **36**, **37**. Endpoints **#38-43**, **#63**.

**Vérifications** : format non conforme et fichier > 10 Mo refusés avec message explicite ;
**suppression par un juriste auteur → 202 (demande), par un DJ → 200 (immédiate)**, les deux
correctement interprétés ; approbation et rejet avec motif ; document supprimé → 404 ; rapport
journalier à zéro affiché comme état vide. Trancher **QF-06** (affichage des URL MinIO).
**Dépend de** : F7.

---

## F11 — Frais d'avocats (profils internes) ⏳

Écrans **28**, **29**. Endpoints **#24-28**. **#23 (dépôt avocat) reporté à F16.**

**Vérifications** : le circuit complet parcouru avec quatre comptes différents ; cas non sensible
sous seuil validé par le seul DJA ; cas sensible exigeant les deux accords ; double vote du même
profil refusé ; un seul refus rejette ; paiement refusé sur demande non validée ; motif obligatoire
à chaque rejet ; la file est bien filtrée par profil.
**Dépend de** : F7.

---

## F12 — Publications, constitutions, répertoire ⏳

Écrans **13**, **31**, **32**, **34**, **35**. Endpoints **#30**, **#32-37**, **#59-60**.
**#29 et #31 (dépôts avocat) reportés à F16.**

**Vérifications** : publication non validée invisible ; restriction d'accès → écran dédié, pas une
erreur technique ; commentaire de juriste transmis au DJ/DJA et **jamais directement à l'avocat** ;
correspondance en doublon refusée ; constitution sans motif refusée ; approbation SH générant la
lettre consultable dans la GED ; répertoire trié par charge croissante.
**Dépend de** : F8, F10.

---

## F13 — Décisions définitives et jurisprudence ⏳ *(inclut une évolution backend)*

Écrans **14**, **38**. Endpoints **#51-55**.

🔧 **Comprend une évolution backend (QF-03)** : aucun `GET` n'existe sur les adjudications ni les
condamnations, l'onglet 14 serait sinon en écriture seule. Ajout attendu :
`GET /dossiers/{id}/decisions`, symétrique de #56/#57/#58 livrés en M15, sans règle métier nouvelle.
**À décider et à réaliser au début de ce jalon**, dans le dépôt backend. La base jurisprudentielle
(**38**) est livrable sans cette évolution.

**Vérifications** : adjudication refusée hors étape `CLOTURE` ; reliquat négatif refusé ; indexation
jurisprudentielle incomplète refusée ; recherche par mots-clés, nature et juridiction ;
téléchargement du PDF.
**Dépend de** : F9 + arbitrage QF-03.

---

## F14 — Alertes, notifications, configurations ⏳

Écrans **03**, **41**. Endpoints **#44-48**, canal `/ws`.
Badge de notifications, marquage traité, configurations CONF01-07, seuil `CHARGE_MAX_AVOCAT`.

**Vérifications** : une alerte déclenchée côté backend apparaît sans rechargement ; le repli HTTP
fonctionne canal coupé ; un non-destinataire ne peut pas traiter une alerte (403) ; un seuil modifié
par le DJ est pris en compte immédiatement.
**Dépend de** : F2. **Décision attendue** : QF-11.

---

## F15 — Rapports et tableau de bord ⏳

Écrans **39**, **40**. Endpoints **#49-50**.

**Vérifications** : les 6 indicateurs cohérents avec les données des jalons précédents ; **204 sur
période vide affiché comme état vide** ; les 4 formats d'export téléchargés et ouvrables ; les
restrictions de rôle respectées.
**Dépend de** : F6→F13. **Décision attendue** : QF-04.

---

## F16 — Portail Avocat ⏳ *(inclut une évolution backend)*

Écrans **30**, **33**. Endpoints **#23**, **#29**, **#31**, **#45-46**, **#28**.

🔧 **Comprend une évolution backend** (décision QF-01 actée) : l'avocat doit pouvoir découvrir ses
dossiers et les audiences associées, relire ses publications et consulter ses lettres de
constitution. Quatre lectures cadrées sur l'avocat connecté suffiraient — **sans** lui accorder
`ROLE_CONSULTATION`, qui lui ouvrirait tous les dossiers, clients et employés.
**À spécifier et à réaliser au début de ce jalon**, dans le dépôt backend.

**Vérifications** : un avocat ne voit **que** ses dossiers, ses demandes et ses publications ; il ne
peut énumérer ni le personnel interne, ni les clients, ni les autres dossiers.
**Dépend de** : F11, F12 + jalon backend.

---

## F17 — Durcissement ⏳

Accessibilité (audit AA complet), responsive sur les trois points de rupture, performance
(< 2 s sur les vues courantes, conformément à NF-PERF-01), parcours e2e couvrant P1 à P9,
documentation utilisateur, revue de sécurité frontend.

**Dépend de** : tous.

---

## Avancement

| Jalon | F0 | F1 | F2 | F3 | F4 | F5 | F6 | F7 | F8 |
|---|---|---|---|---|---|---|---|---|---|
| **Statut** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

| Jalon | F9 | F10 | F11 | F12 | F13 | F14 | F15 | F16 | F17 |
|---|---|---|---|---|---|---|---|---|---|
| **Statut** | 🔵 | ⏳ | ⏳ | ⏳ | 🔧 | ⏳ | ⏳ | 🔧 | ⏳ |

**9 jalons validés sur 18 (F0 à F8) · F9 livré en attente de validation · 24 écrans sur 42 ·
40 endpoints consommés sur 72** (plus #45 en partie ; 72 depuis les ajouts de M16, dont Q-78) —
mesurés sur `SCREEN_MAP.md` et `API_INTEGRATION_STATUS.md` le 2026-09-11.
