# DEVELOPMENT_ROADMAP

> Les 18 jalons du frontend : périmètre, dépendances, critères de sortie, avancement.
> Dernière mise à jour : 2026-09-08 (**F0 à F2 validés**, **F3 et F3b livrés** en attente de validation).

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

## F3b — Bilinguisme français / anglais 🔵 *(livré, en attente de validation manuelle)*

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

**Vérifications exécutées le 2026-09-08** : `typecheck` ✅ · `lint` ✅ · **98 tests** ✅ ·
`build` ✅ · **20 parcours Playwright** ✅ dont 6 dédiés au bilinguisme · `smoke` ✅.
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

## F4 — Composants métier réutilisables ⏳

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

**Vérifications** : tests de composants sur les quatre états et sur le motif de confirmation.
**Dépend de** : F3.

---

## F5 — Référentiels, clients, intervenants ⏳

**Objectif** : disposer des données sans lesquelles aucun dossier n'est créable.

Écrans **19** recherche clients, **20** vue consolidée, **21** création client, **42** référentiel
des intervenants.
Endpoints **#9-12**, **#61-62**, **#64-66**. Mise en place des caches longs de résolution des noms.

**Vérifications** : créer un client puis un avocat ; les sélecteurs du futur formulaire de dossier
se peuplent ; un avocat sans compte Keycloak est refusé (400), un compte déjà pris aussi (409).
**Dépend de** : F4.

---

## F6 — Dossiers : liste et création ⏳

Écrans **05**, **06**. Endpoints **#1-2**, plus les référentiels de F5.
Formulaire adaptatif par catégorie (Q-11), section affectation obligatoire, case « dossier sensible ».

**Vérifications** : création nominale ; référence en doublon → `ERR-002` sur le bon champ ; champs
conditionnels exigés selon la catégorie ; affectation vide refusée ; pagination et filtres corrects.
**Dépend de** : F5. **Note** : QF-07 conditionne l'étendue de la recherche.

---

## F7 — Fiche dossier ⏳

Écrans **07**, **08**, **15**, **16**, **17**, **18**. Endpoints **#3-8**, **#43**.
Onglets synthèse, étapes (avec `CycleEtape`), historique ; modales affectation, dérogation de seuil,
validation de sensibilité.

**Vérifications** : transition interdite → `ERR-004` avec états permis ; doublon d'affectation →
dialogue puis `?forcer=true` ; création directe de `RECOURS_2` créant les étapes intermédiaires ;
historique chronologique complet ; **le champ `documents` n'est pas consommé**.
**Dépend de** : F6. **Note** : QF-08 conditionne les files DJ/DJA.

---

## F8 — Audiences, alarmes, calendrier ⏳

Écrans **09**, **11**, **22**, **23**, **24**, **25**. Endpoints **#13-17**, **#56-57**.

**Vérifications** : planification refusée sur étape non `EN_COURS` et sur date passée ; doublon
confirmable ; compte rendu refusé sur audience future ; calendrier dans les trois vues ; exports PDF
et Excel téléchargés et ouvrables ; reprogrammation d'alarme chaînée.
**Dépend de** : F7.

---

## F9 — Délibérés ⏳

Écrans **10**, **26**, **27**. Endpoints **#18-22**, **#58**.

**Vérifications** : délibéré refusé hors `EN_DELIBERE` ; échéance de recours exigée pour
`DEFAVORABLE`/`MIXTE` et refusée sinon ; **prorogation au-delà du seuil affichée comme un
avertissement, pas comme une erreur** ; rabattement refusé hors `DELIBERE_VIDE` et motif obligatoire ;
suivi du recours cohérent avec l'état de l'étape.
**Dépend de** : F8.

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
| **Statut** | ✅ | ✅ | ✅ | ✅+🔵 | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

| Jalon | F9 | F10 | F11 | F12 | F13 | F14 | F15 | F16 | F17 |
|---|---|---|---|---|---|---|---|---|---|
| **Statut** | ⏳ | ⏳ | ⏳ | ⏳ | 🔧 | ⏳ | ⏳ | 🔧 | ⏳ |

**3 jalons validés sur 18 · F3 + F3b livrés en attente de validation · 3 écrans transverses sur 42 · 1 endpoint consommé sur 67.**
