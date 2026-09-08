# DEVELOPMENT_ROADMAP

> Les 18 jalons du frontend : périmètre, dépendances, critères de sortie, avancement.
> Dernière mise à jour : 2026-09-08 (**F0 achevé**, F1 à préparer).

**Statut** : `✅` validé manuellement · `🔵` en cours · `⏳` à faire · `⛔` bloqué

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

**Achevé le 2026-09-08.** Aucun code.

Les six fichiers de contexte : `FRONTEND_WORKING_MEMORY.md`, `FRONTEND_ARCHITECTURE.md`,
`SCREEN_MAP.md`, `API_INTEGRATION_STATUS.md`, `DEVELOPMENT_ROADMAP.md`,
`DECISIONS_AND_OPEN_QUESTIONS.md`.

**Critère de sortie** : ces fichiers suffisent à reprendre le projet sans relire le backend.

---

## F1 — Squelette et outillage ⏳

**Objectif** : un projet Next.js qui démarre, compile, se vérifie et sait parler au backend.

- `git init`, `.gitignore`, `README.md`, `env.template` (valeurs locales, **aucun secret réel**).
- Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui (`components.json`).
- ESLint + Prettier ; scripts `dev`, `build`, `lint`, `typecheck`, `test`, `test:e2e`.
- `lib/env.ts` — validation Zod de l'environnement, **échec explicite** si une variable manque.
- `contracts/openapi.json` figé + génération de `types/api.generated.ts` (`openapi-typescript`).
- `types/enums.ts` — les 31 énumérations du domaine et leurs libellés français.
- Vitest + Testing Library + MSW + Playwright, avec un test témoin par niveau.
- `app/layout.tsx`, providers (thème, TanStack Query, session, toasts), page `not-found`.

**Vérifications** : `npm run build`, `lint`, `typecheck` et `test` passent ; `npm run dev` sert une
page.
**Dépend de** : F0.

---

## F2 — Authentification et autorisation ⏳

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

**Vérifications** : connexion réussie avec les 5 comptes internes ; la navigation diffère selon le
profil ; un jeton expiré est renouvelé sans déconnexion ; un 403 mène à l'écran non autorisé.
**Dépend de** : F1. **Décisions** : QF-05 ✅.

---

## F3 — Design system Afriland ⏳

**Objectif** : l'identité visuelle et les états standards, avant tout écran métier.

- Jetons de couleur : **structure anthracite `#231F20`, identité rouge `#ED1C24`**, rouge dérivé
  `#B3141B` pour le texte, couleurs de statut **distinctes du rouge de marque**.
- Typographie, échelle de tailles, espacements, comportement responsive.
- Intégration des logos officiels (`public/brand/`), favicon, page de connexion habillée.
- États standards : chargement (squelettes), vide, erreur, succès.
- Accessibilité : contraste AA, focus visible, navigation clavier, `prefers-reduced-motion`.
- Trancher **QF-09** (i18n) et **QF-10** (thème sombre).

**Vérifications** : contrastes mesurés conformes ; parcours clavier complet sur la coquille.
**Dépend de** : F2. **Décisions attendues** : QF-13, QF-09, QF-10.

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

## F13 — Décisions définitives et jurisprudence ⛔

Écrans **14**, **38**. Endpoints **#51-55**.

⛔ **Bloqué en lecture par QF-03** : aucun `GET` sur les adjudications ni les condamnations.
L'onglet 14 ne peut être livré qu'en écriture seule tant que ce point n'est pas tranché. La base
jurisprudentielle (**38**), elle, est complète et livrable.

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

## F16 — Portail Avocat ⛔

Écrans **30**, **33**. Endpoints **#23**, **#29**, **#31**, **#45-46**, **#28**.

⛔ **Conditionné à un ajout backend** (décision QF-01 actée) : l'avocat doit pouvoir découvrir ses
dossiers et les audiences associées, relire ses publications et consulter ses lettres de
constitution. Quatre lectures cadrées sur l'avocat connecté suffiraient.

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
| **Statut** | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

| Jalon | F9 | F10 | F11 | F12 | F13 | F14 | F15 | F16 | F17 |
|---|---|---|---|---|---|---|---|---|---|
| **Statut** | ⏳ | ⏳ | ⏳ | ⏳ | ⛔ | ⏳ | ⏳ | ⛔ | ⏳ |

**1 jalon sur 18 achevé · 0 écran sur 42 · 0 endpoint sur 67.**
