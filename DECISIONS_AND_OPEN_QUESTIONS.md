# DECISIONS_AND_OPEN_QUESTIONS

> Arbitrages rendus, questions ouvertes, risques. Mis à jour en continu.
> Dernière mise à jour : 2026-09-08 (jalon F0).

**Légende** : `✅` tranché · `🟡` ouvert, non bloquant · `🔴` ouvert, bloquant · `⛔` bloqué par un tiers

---

## RÈGLE PERMANENTE — signaler toute lacune du backend

> **Consigne utilisateur du 2026-09-08, valable pour toute la durée du projet.**

À **chaque** jalon, dès qu'une information nécessaire au frontend manque côté backend — endpoint
absent, champ non exposé, filtre indisponible, rôle incohérent, contrat incomplet — je dois :

1. **M'arrêter et le signaler immédiatement**, sans le contourner en silence.
2. Décrire précisément ce qui manque, l'écran empêché et l'impact fonctionnel.
3. Proposer les options (ajout backend, contournement frontend, report du besoin) et une
   recommandation.
4. **Attendre l'arbitrage** avant d'implémenter un contournement.
5. Consigner le point dans ce fichier sous une référence `QF-xx`, et le refléter dans
   `API_INTEGRATION_STATUS.md` et `SCREEN_MAP.md`.

**Ne jamais inventer un endpoint, un champ ou une règle métier pour combler un trou.** Ne jamais
masquer une fonctionnalité pour éviter d'exposer une lacune. Les lacunes déjà relevées lors de
l'audit sont QF-01, QF-02, QF-03, QF-07 et QF-08 — elles servent de modèle de signalement.

---

## DÉCISIONS VALIDÉES

| Date | Réf. | Décision | Impact |
|---|---|---|---|
| 2026-09-08 | **QF-01** | **Le portail Avocat est reporté au jalon F16.** Les 5 profils internes sont livrés d'abord. Un ajout backend limité (lectures cadrées sur l'avocat connecté) le précédera. | Écrans 30 et 33 hors périmètre jusqu'à F16 |
| 2026-09-08 | **QF-05** | **Réutilisation du client Keycloak `audiences-api`** (confidentiel, secret côté serveur Next.js, `redirectUris` inclut déjà `http://localhost:3000/*`). **Aucune modification du realm backend.** ⚠️ Vérifié en réel : le `client_secret` est **obligatoire** — la commande du `README.md` backend, qui l'omet, échoue en `unauthorized_client`. Secret dans `keycloak/audiences-realm.json`, à ne jamais exposer au navigateur. | F2 |
| 2026-09-08 | **QF-15** | **Vitest + Testing Library + MSW** (unitaire/intégration) et **Playwright** (e2e). Le template n'avait aucun test. | F1 |
| 2026-09-08 | — | Pile : Next.js 15 App Router · React 19 · TS strict · Tailwind v4 · shadcn/ui · TanStack Query + Table · react-hook-form + Zod · axios · sonner · date-fns · lucide · recharts. | F1 |
| 2026-09-08 | — | **Routage par fonction, pas par rôle.** Pas de routes parallèles `@role` : les profils se recouvrent (le DJ est un juriste augmenté). Un arbre unique + gardes de route + navigation filtrée. | F2 |
| 2026-09-08 | — | **RBAC frontend dérivé mécaniquement des `@PreAuthorize` backend.** Table unique dans `lib/rbac.ts`. Le backend reste l'arbitre ; masquer n'est pas sécuriser. | F2 |
| 2026-09-08 | — | **Types TS générés depuis `/v3/api-docs`** (`openapi-typescript`), spec figée dans `contracts/openapi.json`. Aucune dépendance à l'exécution (cf. RF-03). | F1 |
| 2026-09-08 | — | **Design : structure anthracite `#231F20`, identité rouge `#ED1C24`.** Rouge dérivé `#B3141B` pour le texte. Couleurs de statut distinctes du rouge de marque. | F3 |
| 2026-09-08 | — | L'authentification du template (provider Credentials vers `/auth/login`) est **supprimée, pas adaptée** : ce chemin a été retiré du backend en M1 pour raison de sécurité (R-03). | F2 |
| 2026-09-08 | — | Le modèle « un rôle par utilisateur » du template est **remplacé par `roles: string[]`** : chaque utilisateur porte simultanément son profil, `ROLE_CONSULTATION` et `ROLE_SAISIE`. | F2 |
| 2026-09-08 | — | **Deux dépôts GitHub distincts.** Le travail courant se fait dans le dépôt frontend. Le backend reste en lecture seule par défaut, mais **sera modifié ponctuellement quand un jalon l'exigera**, sur décision explicite de l'utilisateur. Les lacunes QF-01, QF-03 (et le cas échéant QF-02, QF-07, QF-08) seront traitées ainsi, au jalon concerné. | F13, F16 |
| 2026-09-08 | — | **Flux de branches en deux phases.** (1) Tant que le socle F1→F4 n'est pas prêt : travail **direct sur `main`**, aucune branche. (2) Ensuite **un écran = une branche** ; une fois l'écran testé et approuvé, **l'utilisateur pousse la branche puis la merge dans `dev`**, qui rassemble les écrans fonctionnels. Je crée et j'alimente la branche locale ; **je ne pousse ni ne merge jamais.** | tous |

---

## QUESTIONS OUVERTES

### 🔴 QF-03 — Aucune lecture des décisions définitives

**Constat.** Le backend expose `POST /dossiers/{id}/adjudications`, `POST /dossiers/{id}/
condamnations` et `PATCH /condamnations/{id}/statut`, mais **aucun `GET`**. Vérifié endpoint par
endpoint sur `DecisionDefinitiveController` : trois mappings, aucune lecture.

**Conséquences.**
- L'écran « Suivi des condamnations » (`FUNCTIONAL_MAP.md` §8) n'a aucune source de données.
- L'onglet « Décisions définitives » d'une fiche dossier ne peut rien afficher.
- `PATCH /condamnations/{id}/statut` exige un identifiant que l'interface ne peut obtenir qu'en
  mémoire, juste après la création : après un rechargement de page, la mise à jour du statut de
  paiement devient **définitivement inatteignable**.
- Le pilier « gestion des décisions devenues définitives » — l'un des trois piliers du projet —
  reste aveugle.

**Analyse.** Le jalon backend M15 a comblé exactement ce type de lacune pour les publications
(#59), les constitutions (#60) et les demandes de suppression (#63). Le module `decision` est resté
en dehors, vraisemblablement par omission.

**Options.** (A) Ajouter `GET /dossiers/{id}/decisions` côté backend — symétrique de #56/#57/#58.
(B) Livrer l'onglet en écriture seule, avec la mise à jour de statut accessible uniquement dans la
foulée de la création. (C) Reporter tout le volet décisions.

**Recommandation : A.** L'ajout est mécaniquement identique à trois endpoints déjà livrés en M15 et
sans règle métier nouvelle. **Statut : ouvert, bloque F13 en lecture.**

### 🟡 QF-04 — Qui produit les rapports d'activité ?

**Constat.** `GET /rapports` est réservé à `ROLE_JURISTE` et `GET /tableau-de-bord` à `ROLE_DJ`. Le
DJ ne portant pas `ROLE_JURISTE`, **il ne peut pas générer de rapport** ; le juriste, lui, ne voit
pas le tableau de bord.

**Contradiction.** Le parcours P9 de `FUNCTIONAL_MAP.md` décrit : « le DJ consulte le tableau de
bord temps réel → **génère des rapports** → consulte la vue consolidée d'un client → ajuste les
seuils ». Les rôles implémentés rendent ce parcours impossible pour un seul utilisateur.

**Analyse.** L'attribution vient des user stories (US 8.4 au juriste, US 8.5 au DJ) et
`API_IMPLEMENTATION_STATUS.md` la documente comme conforme. Ce n'est donc pas un défaut
d'implémentation, mais une divergence entre les user stories et le parcours de pilotage.

**Recommandation.** Faire confirmer le comportement attendu par la Direction Juridique. Je
construirai les écrans selon les droits réellement en vigueur — mais découvrir l'écart en recette
serait coûteux. **Statut : ouvert, à trancher avant F15.**

### 🟡 QF-07 — Recherche de dossiers limitée

**Constat.** `GET /dossiers` n'accepte que `nature`, `categorie`, `juridiction`, `page`, `size`. Ni
recherche par référence de dossier, ni par client, ni filtre « mes dossiers ».

**Conséquence.** Un juriste suivant plusieurs dizaines de dossiers n'a aucun moyen direct de
retrouver le sien. Un filtrage effectué côté navigateur sur une liste paginée **donnerait des
résultats faux** (il ne verrait que la page courante).

**Recommandation.** Confirmer si ces trois filtres sont attendus en V1. Si oui, ils relèvent d'un
ajout backend (paramètres supplémentaires sur un endpoint existant). **Statut : ouvert, impacte F6.**

### 🟡 QF-08 — Files d'attente absentes pour le DJ/DJA

**Constat.** Aucun endpoint ne liste les dossiers en attente de validation de sensibilité, ni les
dérogations de seuil en attente d'arbitrage. `GET /dossiers` expose bien `sensibiliteStatut`, mais
sans filtre serveur.

**Conséquence.** Le DJ et le DJA devraient parcourir les dossiers page par page pour trouver ceux
qui requièrent leur intervention — alors que ces deux validations leur sont exclusivement réservées.

**Recommandation.** Un paramètre `?sensibiliteStatut=EN_ATTENTE` sur #2 et une file des dérogations
suffiraient. Même raisonnement que les trois files ajoutées en M15. **Statut : ouvert, impacte F7.**

### 🔴 QF-16 — Provisionnement paresseux : un juriste jamais connecté est inaffectable

**Constat, vérifié en conditions réelles le 2026-09-08** (backend démarré, base fraîche). La table
`utilisateur` est alimentée **paresseusement** : un compte n'y apparaît qu'au premier appel d'un
endpoint qui résout l'utilisateur courant. Séquence observée :

```
GET /utilisateurs                 → []          (juriste.test pourtant authentifié)
GET /alertes/mes-notifications    → 200         (déclenche le provisionnement)
GET /utilisateurs                 → [{id:1, nom:"Juriste", profil:"JURISTE", actif:true}]
```

`GET /dossiers` et `GET /utilisateurs` **ne déclenchent pas** le provisionnement.

**Conséquences.**
1. **Le sélecteur « juristes affectés » de l'écran 06 ne listera que les collègues déjà connectés.**
   Un juriste à qui l'on veut confier un dossier avant sa première connexion est **invisible et
   inaffectable**, alors que `juristesAffectes` est `@NotEmpty`.
2. **Amorçage impossible sur base neuve** : aucun `utilisateur` n'existe, donc **le tout premier
   dossier ne peut pas être créé** tant qu'aucun juriste ne s'est connecté.
3. Le contournement de QF-02 (retrouver son propre `id` par rapprochement d'email) ne fonctionne
   qu'après auto-provisionnement.

**Traitement côté frontend (F2), suffisant pour 2 et 3.** Appeler
`GET /alertes/mes-notifications` **dans l'amorçage de session, juste après la connexion**. Un seul
appel qui auto-provisionne l'utilisateur *et* alimente le badge de notifications dont toutes les
pages ont besoin. C'est une contrainte de conception, pas un contournement caché.

**Reste à arbitrer : le point 1.** Est-il acceptable qu'un juriste doive s'être connecté au moins
une fois pour être affectable ? En pratique la Direction Juridique compte peu d'utilisateurs et
tous se connecteront, mais un dossier urgent confié à un collègue absent resterait bloqué.

**Recommandation.** Accepter la limite pour la V1 et la documenter dans la doc utilisateur (« chaque
utilisateur doit se connecter une fois pour apparaître dans les listes d'affectation »). Si elle est
jugée inacceptable, un pré-provisionnement backend depuis Keycloak serait nécessaire — évolution non
triviale, à ne décider qu'en connaissance de cause. **Statut : ouvert, impacte F2 (traitement) et
F6 (arbitrage).**

### 🟡 QF-02 — Pas d'endpoint « moi »

**Constat.** Le jeton Keycloak porte `sub`, `email`, `given_name`, `family_name` et `roles`, mais
**pas l'`utilisateur.id` numérique** de la table applicative. Or les réponses du backend référencent
partout cet identifiant : `juristesAffectes[]`, `destinataireId`, `auteurChargementId`, `avocatId`.

**Conséquence.** Le frontend ne peut pas déterminer nativement si l'utilisateur courant est affecté
à un dossier, destinataire d'une alerte ou auteur d'un document — trois conditions d'affichage
directement issues des règles de gestion.

**Contournement retenu pour F2.** Rapprochement par email sur `GET /utilisateurs`, encapsulé dans un
hook unique pour être remplaçable en une ligne. **Impossible pour le profil avocat**, qui ne porte
pas `ROLE_CONSULTATION` — ce qui rejoint QF-01.

**Recommandation.** Un `GET /utilisateurs/moi` côté backend rendrait le contournement inutile.
**Statut : ouvert, non bloquant.**

### 🟡 QF-06 — Affichage des documents stockés

Les documents sont servis par des URL MinIO pré-signées sur `http://localhost:9000`. Le CORS de
MinIO et `next.config.ts` doivent être vérifiés ; l'affichage inline des PDF et images peut être
bloqué par le navigateur. **À trancher en F10.**

### 🟡 QF-09 — Internationalisation

Interface intégralement en français, sans mécanisme i18n. Cohérent avec le backend (messages métier
en français). **À confirmer en F3.**

### 🟡 QF-10 — Thème sombre

Le template propose un thème sombre. Pour une application bancaire institutionnelle destinée à un
usage bureautique, sa valeur est discutable et il double le coût de vérification des contrastes.
**À trancher en F3.**

### 🟡 QF-11 — Temps réel ou rafraîchissement périodique

Le push d'alertes est en STOMP sur SockJS et exige `@stomp/stompjs` + `sockjs-client`. Le backend
garantit un repli par `GET /alertes/mes-notifications`. **À trancher en F14.**

### ✅ QF-12 — Dépendance au contrat d'API

`/v3/api-docs` est public côté backend et doit être fermé avant production (R-08 backend). **Tranché
: la spec est figée dans `contracts/openapi.json`**, régénérée manuellement et versionnée. Aucune
dépendance à l'exécution.

### 🟡 QF-13 — Validation de la palette Afriland

**Aucune charte graphique officielle n'est publiée** ; le site institutionnel est inaccessible à la
consultation automatisée (HTTP 403).

**Faits vérifiés** — extraits des fichiers vectoriels officiels de `Park_Logo_Afriland_First_Bank/` :

| Couleur | Hex | Contraste mesuré sur blanc |
|---|---|---|
| Rouge Afriland | `#ED1C24` | **4,38:1** — sous le seuil AA de 4,5:1 pour le texte courant |
| Anthracite Afriland | `#231F20` | **16,30:1** |
| Gris moyen | `#939598` | — |
| Gris clair | `#C7C8CA` | — |

Signature institutionnelle « The Pact with Success » ; le groupe décrit le symbole comme une poignée
de main. L'en-tête officiel comporte une frise de motifs traditionnels camerounais.

**Recommandation soumise à validation.** Structure en anthracite, identité en rouge ; rouge dérivé
`#B3141B` (**6,92:1**) pour les liens et le texte accentué ; couleurs de statut formant une famille
distincte du rouge de marque, faute de quoi un rouge d'erreur et un rouge institutionnel deviennent
indiscernables dans une interface pleine de rejets et de suppressions. **À valider en F3.**

### ✅ QF-14 — Champ `documents` de la fiche dossier

Vide par construction (Q-67 backend, tranché en M15 : « ne pas le consommer côté frontend »).
Utiliser `GET /dossiers/{id}/documents` (#43). **Contrainte connue, pas une question.**

---

## RISQUES

### 🔴 RF-02 — Le refresh token expire AVANT l'access token

**Mesuré le 2026-09-08 sur le Keycloak réel** (et non supposé) :

| Jeton | Durée de vie |
|---|---|
| `access_token` | **3600 s — 60 min** |
| `refresh_token` | **1800 s — 30 min** |

Le refresh token est **deux fois plus court** que l'access token. La rotation naïve — « rafraîchir
quand l'access token approche de son expiration », le patron NextAuth le plus répandu — **échouerait
systématiquement** : à 55 minutes, le refresh token est mort depuis 25 minutes. L'utilisateur serait
déconnecté à chaque session dépassant la demi-heure, en pleine saisie d'un formulaire de création de
dossier qui compte une vingtaine de champs.

**Conception à retenir en F2** : piloter le rafraîchissement sur **`refresh_expires_in`**, pas sur
`expires_in` — se rafraîchir vers **25 minutes**, ce qui fait tourner le refresh token et prolonge
la fenêtre. Prévoir une déconnexion propre si le rafraîchissement échoue, plutôt qu'une boucle de
401. **À traiter en F2, pas après.**

> Ces durées sont celles du realm de développement. À revérifier si le realm de production diffère.

### 🟡 RF-01 — CORS et affichage des documents MinIO

Voir QF-06. **À vérifier en F10.**

### 🟡 RF-03 — Documentation d'API exposée côté backend

`/v3/api-docs` et `/swagger-ui` sont accessibles sans authentification (R-08 backend, à fermer avant
production). Le frontend est conçu pour ne pas en dépendre (QF-12). **Aucune action frontend.**

### 🔴 RF-04 — `.gitignore` absent sur un dépôt déjà publié

**Résolu partiellement le 2026-09-08** : le dépôt est initialisé et poussé
(`git@github.com:loickenmoe/audiences-deliberes-frontend.git`, branche `main`, commit `39de75d`).

**Mais aucun `.gitignore` n'existe.** Le dépôt ne contient aujourd'hui que 13 fichiers sûrs (6
fichiers de contexte, le prompt de cadrage, 6 logos). Dès le premier `npm install` de F1 :

- `node_modules/` (des dizaines de milliers de fichiers) devient committable ;
- `.next/`, les artefacts de build et les rapports de couverture aussi ;
- surtout, un `.env.local` porteur du **secret du client Keycloak `audiences-api`** deviendrait
  committable — et le dépôt est déjà en ligne.

Le backend a connu précisément cette fuite : `env.template` versionné avec des identifiants Neon et
iDrive e2 réels (R-01), dont la rotation reste une action utilisateur en attente. **Ne pas
reproduire.**

**Action : créer le `.gitignore` en tout premier lieu au jalon F1, avant toute installation de
dépendance.** Couvrir au minimum `node_modules/`, `.next/`, `out/`, `build/`, `coverage/`,
`playwright-report/`, `test-results/`, `.env*` (avec exception explicite pour `env.template`),
`*.tsbuildinfo`, `.DS_Store`.

### 🟡 RF-05 — Annuaires non paginés

`GET /utilisateurs` et `GET /intervenants` renvoient des listes complètes. Acceptable à l'échelle de
la Direction Juridique, à surveiller si le référentiel des intervenants croît.

---

## POINTS HÉRITÉS DU BACKEND — ne pas rouvrir

Ces arbitrages ont été rendus pendant le développement du backend. Ils **s'imposent** au frontend.

| Réf. backend | Point |
|---|---|
| Q-08 | `ROLE_SAISIE` est un rôle composite porté par JURISTE, DJ, DJA, ASSISTANTE, SH |
| Q-10 | Le dossier est créé immédiatement (201) ; `estSensible` reste à l'état proposé jusqu'à validation DJ/DJA |
| Q-11 | Validation **ET** des champs conditionnels par catégorie ; catégorie déduite de la nature |
| Q-12 | `?forcer=true` pour confirmer un doublon d'affectation et d'audience |
| Q-17 | Prorogation : **toujours 201**, `alerte: true` au franchissement du seuil — jamais une erreur |
| Q-19 | `GET /deliberes/{id}/recours` est strictement consultatif |
| Q-35 | `EN_DELIBERE→DELIBERE_VIDE` et `DELIBERE_VIDE→EN_COURS` sont exclues de l'endpoint générique de statut |
| Q-45 | `document.typeDocument` est un texte libre, sans taxonomie |
| Q-46 | Le format d'un document est dérivé de l'extension, pas du `Content-Type` |
| Q-47 | `DELETE /ged/documents/{id}` : 202 pour le juriste auteur, 200 pour DJ/DJA |
| Q-52 | Un `AUTRE_PRESTATAIRE` n'a pas de compte et ne reçoit aucune notification applicative |
| Q-55 | La validation de publication est générique aux deux sous-types |
| Q-57 | `restrictionAcces` → 403 `ERR-009` sur la consultation unitaire, non appliqué sur la liste |
| Q-59 | Adjudication : étape `CLOTURE` requise. Condamnation : aucune précondition — asymétrie intentionnelle |
| Q-60 | Aucune bascule automatique vers `ARCHIVE` ; la transition reste manuelle |
| Q-67 | `DossierResponse.documents` est vide par construction — ne pas le consommer |

Source : `../audiences-deliberes-backend/DECISIONS_AND_OPEN_QUESTIONS.md` (lecture seule).

---

## HORS PÉRIMÈTRE V1

Suppression d'un dossier avec workflow · intégration Core Banking · intégration comptabilité/DCPO ·
INTRA V2 · portail client · paiement effectif des frais (traçabilité du statut uniquement) ·
gestion des mots de passe (déléguée à Keycloak).
