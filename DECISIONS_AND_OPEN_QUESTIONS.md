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
| 2026-09-08 | **QF-05** | **Réutilisation du client Keycloak `audiences-api`** (confidentiel, secret côté serveur Next.js, `redirectUris` inclut déjà `http://localhost:3000/*`). **Aucune modification du realm backend.** | F2 |
| 2026-09-08 | **QF-15** | **Vitest + Testing Library + MSW** (unitaire/intégration) et **Playwright** (e2e). Le template n'avait aucun test. | F1 |
| 2026-09-08 | — | Pile : Next.js 15 App Router · React 19 · TS strict · Tailwind v4 · shadcn/ui · TanStack Query + Table · react-hook-form + Zod · axios · sonner · date-fns · lucide · recharts. | F1 |
| 2026-09-08 | — | **Routage par fonction, pas par rôle.** Pas de routes parallèles `@role` : les profils se recouvrent (le DJ est un juriste augmenté). Un arbre unique + gardes de route + navigation filtrée. | F2 |
| 2026-09-08 | — | **RBAC frontend dérivé mécaniquement des `@PreAuthorize` backend.** Table unique dans `lib/rbac.ts`. Le backend reste l'arbitre ; masquer n'est pas sécuriser. | F2 |
| 2026-09-08 | — | **Types TS générés depuis `/v3/api-docs`** (`openapi-typescript`), spec figée dans `contracts/openapi.json`. Aucune dépendance à l'exécution (cf. RF-03). | F1 |
| 2026-09-08 | — | **Design : structure anthracite `#231F20`, identité rouge `#ED1C24`.** Rouge dérivé `#B3141B` pour le texte. Couleurs de statut distinctes du rouge de marque. | F3 |
| 2026-09-08 | — | L'authentification du template (provider Credentials vers `/auth/login`) est **supprimée, pas adaptée** : ce chemin a été retiré du backend en M1 pour raison de sécurité (R-03). | F2 |
| 2026-09-08 | — | Le modèle « un rôle par utilisateur » du template est **remplacé par `roles: string[]`** : chaque utilisateur porte simultanément son profil, `ROLE_CONSULTATION` et `ROLE_SAISIE`. | F2 |

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

### 🔴 RF-02 — Expiration de session en cours de saisie

Les jetons Keycloak expirent en quelques minutes. Sans rotation du refresh token dans le callback
`jwt` de NextAuth, l'utilisateur serait déconnecté en pleine saisie d'un formulaire long — le
formulaire de création de dossier compte une vingtaine de champs. **À traiter en F2, pas après.**
Prévoir aussi une déconnexion propre si le rafraîchissement échoue, plutôt qu'une boucle de 401.

### 🟡 RF-01 — CORS et affichage des documents MinIO

Voir QF-06. **À vérifier en F10.**

### 🟡 RF-03 — Documentation d'API exposée côté backend

`/v3/api-docs` et `/swagger-ui` sont accessibles sans authentification (R-08 backend, à fermer avant
production). Le frontend est conçu pour ne pas en dépendre (QF-12). **Aucune action frontend.**

### 🟡 RF-04 — Dépôt git non initialisé

Le répertoire frontend n'est pas un dépôt git. **À faire en F1.** Ne jamais versionner de secret :
le backend a connu une fuite d'identifiants réels via un `env.template` versionné (R-01) — ne pas
reproduire.

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
