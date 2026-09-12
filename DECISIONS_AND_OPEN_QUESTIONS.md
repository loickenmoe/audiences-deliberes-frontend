# DECISIONS_AND_OPEN_QUESTIONS

> Arbitrages rendus, questions ouvertes, risques. Mis à jour en continu.
> Dernière mise à jour : 2026-09-09 (jalon F4).

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
| 2026-09-08 | **QF-19** | **Une seule racine `/`, au contenu adapté au profil** — pas de redirection vers des pages différentes selon le rôle. Aucun des cinq profils internes n'a de métier unique : tous portent `ROLE_SAISIE` et `ROLE_CONSULTATION` en plus de leur profil (le SH lui-même dispose de 11 capacités sur 36). Rediriger reviendrait à choisir à leur place laquelle de leurs casquettes compte, et casserait les liens profonds des notifications. L'écran 02 est enrichi au fil des jalons métier. | 02, F4+ |
| 2026-09-08 | **QF-18** | **Le formulaire d'identification vit dans l'application** (`grant_type=password`), pour la cohérence visuelle avec les applications internes de la banque. Keycloak reste seul détenteur des identités et seul émetteur de jetons. Décision utilisateur prise en connaissance des limites ci-dessous. | F3 |
| 2026-09-08 | **QF-09** | ~~Français uniquement~~ → **révisé le jour même sur décision utilisateur : bilingue français / anglais**, les deux langues officielles du Cameroun. `next-intl`, langue en cookie, **sans préfixe d'URL** pour préserver les liens profonds. Le backend n'a aucun mécanisme de localisation, mais ne renvoie que des **codes stables** : l'interface est donc intégralement traduisible sans le modifier. | **F3b** |
| 2026-09-08 | **QF-10** | **Thème clair uniquement.** L'application interne de référence (GFA) est claire, l'usage est bureautique et diurne, et un second thème doublerait la surface de vérification des contrastes sans bénéfice métier. `next-themes` désinstallé ; les jetons restent structurés pour qu'un thème sombre puisse être ajouté sans refonte. | F3 |
| 2026-09-08 | **QF-13** | **Palette validée et vérifiée par le calcul.** Quatre couleurs officielles inchangées, rouge dérivé `#B3141B` pour le texte, famille de statut distincte du rouge de marque. **L'action principale est anthracite, jamais rouge.** 24 assertions de contraste dans `tests/unit/contraste.test.ts`, calculées sur les jetons réels de `globals.css`. | F3 |
| 2026-09-08 | — | **Conventions d'interface alignées sur GFA**, application Afriland en production (capture fournie par l'utilisateur) : carte blanche centrée sur fond gris clair, lockup horizontal en tête, formule « Bienvenue sur … – First Bank », pied de page de copyright. Écart assumé sur la connexion : la saisie des identifiants reste déléguée à Keycloak, cette page n'en collecte jamais. | F3 |
| 2026-09-08 | — | **Déconnexion OIDC complète** (`lib/deconnexion.ts`) : `signOut()` n'efface que le cookie applicatif ; la session de connexion unique restait ouverte côté Keycloak. Sur un poste partagé, la personne suivante était reconnectée **silencieusement sous l'identité précédente**. La déconnexion enchaîne désormais sur le point de terminaison OIDC du realm avec `id_token_hint`. Défaut découvert par le parcours Playwright réel, gardé fermé par un test. | F2 |
| 2026-09-08 | — | **Rotation des jetons pilotée par `refresh_expires_in`**, jamais par `expires_in` (RF-02). Politique isolée dans `lib/rotation-jeton.ts` pour être testable ; 6 tests dédiés, dont un garde-fou qui atteste que la stratégie naïve échouerait. | F2 |
| 2026-09-08 | — | **Aucune redirection depuis la couche HTTP.** Le projet de référence renvoyait vers `/login` depuis l'intercepteur axios : cela rend les erreurs intestables et court-circuite la gestion d'état des écrans. Les redirections appartiennent aux gardes de route (`lib/serverAuth.ts`). | F2 |
| 2026-09-08 | — | **Navigation rattachée à des capacités, pas à des listes de rôles.** `lib/navigation.ts` référence une capacité de `lib/rbac.ts` ; la correspondance rôle → capacité reste au seul endroit dérivé des `@PreAuthorize`. | F2 |
| 2026-09-08 | — | **Amorçage de session appelant `GET /alertes/mes-notifications`** : auto-provisionne l'utilisateur (QF-16) et alimente le badge de notifications. Un appel, deux usages. | F2 |
| 2026-09-12 | **QF-11** | **Notifications en temps réel (STOMP sur SockJS), avec repli HTTP garanti.** Le canal est ouvert une fois pour toute la session, dans la coquille authentifiée : une alerte atteint le badge quelle que soit la page. Il reste un **accélérateur** — le backend enregistre l'alerte avant de tenter de la pousser, et la liste se rafraîchit toutes les 30 s canal coupé, toutes les 5 min canal ouvert. L'écran 03 affiche lequel des deux régimes s'applique. | F14 |
| 2026-09-12 | **Q-92 / Q-93** (backend) | **Trois listes paginaient sans ordre défini** — notifications, clients, dossiers. Trouvé en construisant l'écran 03, puis démontré en usage : passé vingt clients, celui qu'un juriste venait de créer basculait en page 2, **invisible pour son auteur**. Tri du plus récent au plus ancien, départagé par `id`. Les trois autres listes paginées (frais, publications, jurisprudences) l'étaient déjà. | F14 |
| 2026-09-12 | **Q-91** (backend) | **Les paramètres système sont validés par clé** et publient leur règle de saisie. Évolution backend décidée en ouverture de F14 : sans elle, une saisie erronée du DJ (« 50 000 000 ») ressortait en **erreur 500** dans les frais, les délibérés ou la GED — loin de l'écran fautif. L'écran 41 construit son champ à partir du contrat au lieu d'en redéclarer une copie. | F14 |
| 2026-09-08 | — | **Flux de branches en deux phases.** (1) Tant que le socle F1→F4 n'est pas prêt : travail **direct sur `main`**, aucune branche. (2) Ensuite **un écran = une branche** ; une fois l'écran testé et approuvé, **l'utilisateur pousse la branche puis la merge dans `dev`**, qui rassemble les écrans fonctionnels. Je crée et j'alimente la branche locale ; **je ne pousse ni ne merge jamais.** | tous |

---

## QUESTIONS OUVERTES

### 🟡 QF-40 — Une condamnation se crée toujours « En attente »

**Constat de F13, vérifié dans le code.** US 8.2 fait saisir le statut de paiement dès la création
(« statutPaiement (EN_ATTENTE, PAYE, RECOUVREMENT_FORCE) via POST /dossiers/{id}/condamnations ») ;
`CreerCondamnationRequest` ne le reçoit pas, et le backend part toujours de `EN_ATTENTE`.
**Choix de F13 (sans contournement)** : l'écran crée la condamnation « En attente » et le dit ; le
statut se change ensuite sur sa ligne (#53), comme le prévoit UC-DEF-02 étape 8. **Recommandation
(backend, non bloquante)** : accepter un `statutPaiement` facultatif à la création. **Statut :
ouvert**, rattaché à Q-90 backend avec la question de la mise à jour d'une adjudication.

### ✅ QF-03 — Aucune lecture des décisions définitives *(résolue : Q-88, Q-89 backend)*

**Décision du porteur du projet à l'ouverture de F13 (2026-09-11)** : option A retenue, avec deux
compléments issus de l'audit — `GET /dossiers/{id}/decisions` (Q-88) ; recherche jurisprudentielle
partielle et insensible à la casse, filtrable par dossier (Q-89). La mise à jour d'une adjudication
n'est **pas** ajoutée (les sources ne la prévoient que pour la condamnation) : question ouverte pour
la Direction Juridique (Q-90 backend). Constat d'origine ci-dessous.

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
sans règle métier nouvelle.

### 🔴 QF-20 — L'avocat ne peut pas déposer son compte rendu sous forme de document

**Besoin exprimé par l'utilisateur le 2026-09-09** : l'avocat externe doit pouvoir envoyer un compte
rendu d'audience **en pièce jointe**, pas seulement en texte saisi.

**Constat, vérifié dans le code du backend.** Deux endpoints existent, aucun ne le permet :

| Endpoint | Charge utile | Rattaché à une audience |
|---|---|---|
| `POST /publications/cr-audience` | **JSON** — `contenu` est `@NotBlank String` | ✅ `audienceId` `@NotNull` |
| `POST /publications/autres` | **multipart** — `file` | ❌ aucun `audienceId` |

`TypeAutrePublication` n'admet que `PIECE`, `DECISION`, `CONCLUSION` : aucune valeur ne désigne un
compte rendu.

**Conséquence.** L'avocat doit choisir entre rattacher son compte rendu à l'audience (texte
uniquement) ou déposer un fichier (sans lien avec l'audience, et mal étiqueté).

**Contournement écarté.** Déposer le fichier en `PIECE` ferait perdre le lien à l'audience :
l'Assistante qui valide (US 5.2) ne saurait pas de quelle audience il s'agit, et l'onglet
« Publications » d'une fiche dossier ne pourrait pas le rattacher à la bonne ligne.

**Recommandation.** Rendre `contenu` **optionnel** sur `POST /publications/cr-audience` et lui
accepter un fichier en multipart. L'avocat enverrait alors un texte, un document, ou les deux — et le
lien à l'audience est préservé dans tous les cas. Alternative moins bonne : ajouter `COMPTE_RENDU` à
`TypeAutrePublication` **et** un `audienceId` optionnel à `POST /publications/autres`, ce qui
dupliquerait la notion de compte rendu sur deux endpoints.

**✅ Direction retenue par l'utilisateur le 2026-09-09** : la recommandation ci-dessus est validée
dans son principe — `contenu` devient optionnel sur `POST /publications/cr-audience`, qui accepte un
fichier. **Reste à réaliser le moment venu**, dans le dépôt backend.

**Échéance** : à réaliser avant **F12** (l'écran de validation de l'Assistante doit savoir afficher
un compte rendu documentaire) et impérativement avant **F16** (portail avocat). À rappeler à
l'ouverture de F12.

### ✅ QF-28 — Les dates seules s'affichaient la veille à l'ouest de Greenwich *(corrigée en F8)*

**Constat, dans le frontend.** `formaterDate` lisait `2026-09-10` par `new Date(iso)`, que
JavaScript interprète comme **minuit UTC**. Invisible à Douala (UTC+1), mais partout à l'ouest de
Greenwich chaque date s'affichait **la veille**. Une date d'audience décalée d'un jour n'est pas une
imprécision : c'est une audience manquée.

**Corrigé** : une date seule est lue en heure locale ; les horodatages (`LocalDateTime`, sans
fuseau) l'étaient déjà. Le test construit son attente en date locale, si bien qu'il échouerait avec
l'ancienne lecture sur n'importe quel poste à l'ouest de Greenwich.

### ✅ QF-29 — Une alarme n'est jamais close, sauf en la reprogrammant *(résolue : Q-77 backend)*

**Décision du porteur du projet (2026-09-10)** : suivre la recommandation. `PATCH /alarmes/{id}/traiter`
ajouté au backend (M16, Q-77) ; l'onglet Alarmes propose « Marquer traitée », avec confirmation, à
côté de « Reprogrammer ». Le constat d'origine est conservé ci-dessous.

**Constat, vérifié dans le code.** Les seules actions sur une alarme sont la création (#16) et la
reprogrammation (#17), qui clôt l'ancienne. À l'échéance, `AlarmeEcheanceScheduler` **signale**
l'alarme mais ne change pas son statut. Une alarme traitée par le juriste reste donc `ACTIVE` pour
toujours, et la liste mélange ce qui reste à faire et ce qui est fait.

**Traitement en F8.** Une alarme active échue est marquée « Échue », pour qu'elle se distingue.

**Recommandation (backend, non bloquante).** `PATCH /alarmes/{id}/traiter`, qui la passe
`TRAITEE` avec sa date de traitement, sans en créer une nouvelle. **Statut : soumis à l'utilisateur.**

### ✅ QF-30 — Une audience ne peut être ni annulée ni reportée *(résolue : Q-76 backend)*

**Décision du porteur du projet (2026-09-10)** : suivre la recommandation. `PATCH
/audiences/{id}/annulation` ajouté au backend (M16, Q-76), motif obligatoire ; l'audience annulée
quitte le calendrier, ses exports et ses rappels, et ne compte plus comme doublon. Le report se fait
en annulant puis en replanifiant — l'endpoint de renvoi dédié n'a pas été retenu. L'onglet Audiences
propose « Annuler » sur chaque audience planifiée et affiche le motif. Constat d'origine ci-dessous.

**Constat, vérifié dans le code.** `StatutAudience` prévoit `ANNULEE`, mais **aucun endpoint** ne
le pose, et aucun ne modifie la date d'une audience. Une audience planifiée à la mauvaise date, ou
renvoyée par le tribunal — cas très fréquent —, reste `PLANIFIEE` pour toujours : elle figure au
calendrier, dans les exports, et déclenche ses rappels J-7/J-3/J-1 (FR-AUD-01) à une date qui n'a
plus lieu d'être.

**Contournement écarté.** Planifier une nouvelle audience ne supprime pas l'ancienne : le calendrier
afficherait les deux.

**Recommandation (backend).** Un `PATCH /audiences/{id}/annulation` (motif obligatoire, statut
`ANNULEE`, rappels non envoyés) ; le report consistant alors à annuler puis replanifier, ou un
endpoint de renvoi dédié qui fait les deux en gardant le lien. **Statut : soumis à l'utilisateur.**

### 🟡 QF-31 — Le calendrier compte le premier jour de la période suivante

**Constat, vérifié dans le code.** `PeriodeCalendrier.dateFin` renvoie `début + 1 semaine / 1 mois /
3 mois`, et la requête utilise `BETWEEN`, bornes **incluses**. Une semaine commençant un lundi
ramène donc aussi les audiences du lundi suivant ; deux semaines consécutives affichent le même jour,
et les exports aussi.

**Traitement en F8.** L'écran annonce la période réelle (« du 7 au 14 septembre ») et ne masque
rien : l'écran doit dire la même chose que le document qu'on en exporte.

**Recommandation (backend, non bloquante).** `dateFin` retranchée d'un jour. **Statut : ouvert.**

### 🟡 QF-32 — Une audience est dite « tenue » le jour où l'on saisit son compte rendu

**Constat, vérifié dans le code.** `enregistrerCompteRendu` pose `dateTenue = LocalDate.now()`.
Un compte rendu saisi trois jours après l'audience la date donc de trois jours plus tard, et
ressaisir un compte rendu la déplace encore.

**Recommandation (backend, non bloquante).** `dateTenue = datePlanifiee`, ou une date saisie par le
juriste. **Statut : ouvert.**

### ✅ QF-33 — Prorogation et rabattement n'étaient possibles qu'après la décision *(résolue : Q-78 backend)*

**Constat de l'audit F9, vérifié dans le code et dans les sources.** Le backend ne créait un
délibéré qu'avec son résultat, qui vidait aussitôt l'étape ; prorogation et rabattement ne
portaient donc que sur une décision déjà rendue. Toutes les sources les placent au contraire
**pendant** la délibération : US 3.2 et 3.4 (« l'étape est EN_DELIBERE et un délibéré existe »),
UC-DEL-04 et 05 (précondition « En délibéré »), RG-DEL-06 et 07, le diagramme d'états. Deux manques
s'y ajoutaient : aucune lecture des prorogations, et un délibéré rabattu indiscernable.

**Conséquence si on ne faisait rien** : pour noter « délibéré prorogé au 15 octobre », le juriste
aurait dû saisir un résultat fictif.

**Décision du porteur du projet (2026-09-11)** : aligner le backend (Q-78) — mise en délibéré sans
résultat, prorogation et rabattement pendant l'attente, résultat qui vide le délibéré ; lecture des
prorogations ; état dérivé du délibéré. L'écran 10 suit ce cycle.

### ✅ QF-34 — Une suppression directe laissait la demande orpheline *(résolue : Q-79 backend)*

**Constat de l'audit F10, vérifié dans le code.** Quand le DJ supprime directement une pièce dont le
juriste a demandé la suppression, la demande restait en attente : indécidable (404) et relancée
toutes les 72 h. Notre propre parcours e2e de F7 en créait une à chaque exécution. Et la file ne
nommait ni le fichier ni le dossier. **Décision du porteur du projet (2026-09-11)** : la suppression
directe ferme la demande ; la demande porte nom, type et dossier ; V10 ferme les orphelines
existantes. L'écran 36 s'appuie dessus.

### ✅ QF-35 — Le rapport journalier n'était ouvert qu'au rôle juriste *(résolue : Q-80 backend)*

« Tout juriste » (FR-GED-04), le DJ et la DJA ayant tous les droits d'un juriste, et l'Assistante
selon le document d'analyse. **Décision (2026-09-11)** : ouvert au juriste, au DJ, à la DJA et à
l'Assistante.

### ✅ QF-36 — Le DJ et la DJA n'avaient pas les droits d'un juriste *(résolue : Q-81 backend)*

**Décision du porteur du projet (2026-09-11)** : `ROLE_JURISTE` ajouté aux rôles composites de
`ROLE_DJ` et `ROLE_DJA` (fichier du realm et Keycloak en service). Côté frontend, rien à lister :
le jeton du DJ porte `ROLE_JURISTE`, donc toute capacité « juriste » lui est ouverte, et
`profilPrincipal` l'affiche toujours « Directeur Juridique ». Côté backend, le provisionnement
choisit désormais le profil par priorité — sinon un nouveau DJ aurait pu être enregistré comme
juriste. Constat d'origine ci-dessous.

Dans le realm, `ROLE_DJ` et `ROLE_DJA` n'incluent pas `ROLE_JURISTE`, alors que les sources leur
donnent « tous les droits d'un juriste ». Conséquence visible : aucun des écrans réservés au
juriste (audiences, étapes, délibérés, alarmes…) ne leur propose d'action. **À trancher** : ajouter
`ROLE_JURISTE` aux composites des deux rôles, ou élargir endpoint par endpoint. Non bloquant pour
F10.

### ✅ QF-39 — Publications et constitutions illisibles pour qui devait les instruire *(résolue : Q-86, Q-87 backend)*

**Constat de l'audit F12, vérifié dans le code et les sources.** Le fichier d'une pièce déposée par
l'avocat n'était exposé nulle part ; l'Assistante ne pouvait pas ouvrir une publication à valider
(404 tant qu'elle n'est pas validée) ; les commentaires des juristes, destinés au DJ et à la DJA,
n'étaient lisibles par personne ; publications et constitutions ne portaient que des identifiants ;
aucun juriste n'était prévenu d'une publication validée. À la lecture, un défaut de plus : un avocat
constitué n'était jamais notifié (prestataire chargé en proxy, Q-87).

**Décision du porteur du projet (2026-09-11)** : corriger les cinq points (Q-86) et le défaut de
notification (Q-87). **Reporté à F16** avec le portail avocat : l'observation du DJ/DJA de sa propre
initiative, sans publication (UC-INT-08 étapes 8 à 12), et la lecture de ses correspondances par
l'avocat — ainsi que QF-20 (compte rendu déposé en fichier).

### ✅ QF-37 — Une demande de frais ne se lisait ni seule, ni avec ses décisions *(résolue : Q-82, Q-83 backend)*

**Constat de l'audit F11, vérifié dans le code et les sources.** Aucun `GET /frais/demandes/{id}` :
l'écran 29 aurait dû fouiller la file paginée. Les décisions du circuit, tracées en base, n'étaient
exposées nulle part : le DJ ne pouvait pas voir l'accord de la DJA (US 4.5), et l'écran aurait
proposé un second vote refusé ensuite (409). La réponse ne portait que des identifiants — ni
dossier, ni avocat, ni ce qui déclenche la validation conjointe — et la file n'avait pas d'ordre
stable. La relance CONF04 (5 jours) n'existait pas.

**Décision du porteur du projet (2026-09-11)** : détail, réponse enrichie et tri (Q-82) ; relance
CONF04 par le backend (Q-83). L'écran 29 s'appuie sur les décisions pour n'offrir qu'une action par
profil et par étape.

### ✅ QF-38 — Le compte d'un avocat devait être son identifiant Keycloak interne, pas son identifiant de connexion *(résolue : Q-84 backend)*

**Décision du porteur du projet (2026-09-11), avant la clôture de F11** : le backend reconnaît
désormais l'avocat par son **identifiant de connexion** (`preferred_username`, enregistré sur
l'utilisateur à sa connexion suivante) ; le `sub` reste accepté en second pour les comptes déjà
rattachés ainsi. Le formulaire des intervenants demande l'« Identifiant de connexion », avec un
exemple. En base locale, l'avocat de test « Me Claire Avocat » a été rattaché à `avocat.test`.
Au passage (Q-85) : une violation d'unicité due à deux créations concurrentes rend 409, plus 500.
Constat d'origine ci-dessous.

**Constat de F11, vérifié en base et dans le code.** Le backend reconnaît l'avocat connecté en
comparant `avocat.compte_keycloak` au `sub` du jeton (`FraisService`, `PublicationService`), un
UUID. Or le formulaire des intervenants (F5) demande un « compte applicatif », et tous les avocats
de la base locale en portent un identifiant de connexion (`avocat.socle.e2e`, `avocat.11fepl`…).
Aucun n'est donc reconnu : `avocat.test` ne peut déposer aucune demande de frais, ni publication.
Le parcours e2e F11 contourne en créant, par l'API, un avocat rattaché au `sub` d'`avocat.test`.

**Recommandation (backend).** Reconnaître l'avocat par l'identifiant de connexion
(`preferred_username`), que le DJ connaît, ou lui proposer la liste des comptes Keycloak.

### 🟡 QF-26 — Les pièces justificatives des frais ne sont pas des fichiers

**Constat, vérifié dans le code le 2026-09-10.** `POST /frais/demandes` (#23) exige
`piecesJustificatives: List<String>` non vide — une **liste de noms**, stockée en `TEXT[]`. Aucun
fichier n'est reçu : l'avocat « déclare » ses pièces sans pouvoir les joindre, et l'Assistante qui
contrôle la conformité ne peut rien ouvrir.

**Recommandation.** À trancher à l'ouverture de F11 : soit les pièces passent par la GED (dépôt
préalable, la demande référence des identifiants de documents), soit la demande accepte des
fichiers en multipart. **Statut : ouvert, impacte F16.**

**Décision du porteur du projet à l'ouverture de F11 (2026-09-11)** : en F11, l'écran 29 affiche
les noms déclarés, sans plus ; le choix GED ou multipart se fera avec le dépôt avocat, en F16.

### 🟡 QF-27 — Aucun endpoint ne donne l'identifiant de l'utilisateur connecté

**Constat.** Le backend identifie les auteurs par un identifiant numérique (`auteurChargementId`,
`utilisateurId`…), mais n'expose ni `GET /utilisateurs/moi` ni cet identifiant dans le jeton.
L'interface ne peut donc pas savoir si l'utilisateur est l'auteur d'une pièce.

**Conséquence en F7.** Un juriste voit « Demander la suppression » sur toutes les pièces ; le
backend refuse (403) celles qu'il n'a pas déposées, avec son propre message. Correct, mais moins
précis que de n'afficher l'action qu'à l'auteur. Le besoin reviendra (« mes demandes », « mes
dépôts »).

**Recommandation (non bloquante).** `GET /utilisateurs/moi`, en lecture seule. **Statut : ouvert.**

### ✅ QF-23 — Une dérogation de seuil demandée ne pouvait pas être arbitrée *(résolue le 2026-09-10)*

**Constat, vérifié dans le code du backend le 2026-09-10.** L'arbitrage d'une dérogation
(#7, `PUT /dossiers/{id}/seuil-derogation/{auditId}`) exige l'identifiant de la demande. Or cet
identifiant **n'est exposé nulle part** une fois la demande créée :

| Source possible | Contient l'`auditId` ? |
|---|---|
| Réponse de `POST /dossiers/{id}/seuil-derogation` (#6) | ✅ — mais au **demandeur** seulement |
| Un `GET` des demandes d'un dossier | ❌ n'existe pas |
| `DossierResponse` | ❌ aucun champ |
| Historique (« Demande de dérogation de seuil ») | ❌ `details` = `{nouveauSeuil, motif}` |

**Conséquence.** Le DJ/DJA — seul habilité à arbitrer — n'a aucun moyen de connaître la demande à
arbitrer. L'endpoint #7 est **inatteignable** depuis une interface : l'écran 17 ne peut être livré
qu'à moitié (la demande, pas l'arbitrage). Le dossier reste bloqué avec une demande en attente.

**Contournement écarté.** Retrouver l'identifiant en le devinant ou en l'extrayant d'un champ libre
serait fragile et faux dès la deuxième demande.

**Recommandation (évolution backend, bloquante pour l'écran 17).** Exposer les demandes d'un
dossier : `GET /dossiers/{id}/seuil-derogation` renvoyant `List<AuditSeuilResponse>`, sous
`ROLE_CONSULTATION`. C'est une lecture, sans règle métier nouvelle. Elle résout aussi la moitié de
QF-08 si on lui ajoute un filtre `?statut=EN_ATTENTE`. **Statut : ouvert, soumis à l'utilisateur.**

**✅ Résolue dans le backend le 2026-09-10 (Q-74)**, sur autorisation de l'utilisateur :
`GET /dossiers/{id}/seuil-derogation[?statut=]` renvoie les demandes de seuil du dossier, la plus
récente d'abord. La fiche affiche au DJ/DJA une carte « Dérogations de seuil en attente » avec un
bouton d'arbitrage : l'écran 17 est complet.

**Défaut latent découvert au passage et corrigé dans le même geste.** La proposition initiale de
sensibilité est **elle aussi** un audit `EN_ATTENTE`. Tant que la sensibilité n'est pas validée, #7
permettait de l'« arbitrer » comme une dérogation — fixant un seuil en laissant la sensibilité en
attente. C'était inatteignable faute d'identifiant ; la nouvelle lecture le rendait atteignable.
#7 exige désormais une sensibilité validée, comme #6.

### 🟡 QF-24 — L'historique est rédigé en français par le serveur

**Constat.** `HistoriqueActionResponse.action` est une phrase française (« Changement de statut de
l'étape INSTANCE ») et non un code. C'est la seule donnée du backend qui contredise le principe sur
lequel repose le bilinguisme : *le backend ne renvoie que des codes stables*.

**Conséquence.** En anglais, l'onglet Historique affiche des libellés français. La fiche le signale
explicitement plutôt que de laisser croire à un oubli de traduction.

**Recommandation (évolution backend, non bloquante).** Ajouter un code d'action stable
(`CREATION_DOSSIER`, `CHANGEMENT_STATUT_ETAPE`…) à côté du libellé, que le frontend traduirait.
**Statut : ouvert, non bloquant.**

### ✅ QF-25 — L'affectation pouvait vider un dossier de ses juristes *(résolue le 2026-09-10)*

**Constat.** `PUT /dossiers/{id}/affectation` **remplace** les listes et n'impose aucun minimum :
`ModifierAffectationRequest` ne porte pas le `@NotEmpty` de la création. Un dossier peut donc se
retrouver sans juriste ni avocat, contre RG-DOS-03 (« au moins un juriste par dossier »).

**Traitement retenu côté frontend.** La modale exige au moins un juriste et un avocat, comme la
création. Mais c'est une protection d'interface : un appel direct à l'API passe.

**Recommandation (évolution backend, non bloquante).** Aligner la validation sur la création.

**Observation liée.** Conserver une personne déjà affectée déclenche `ERR-003` puis, sur
confirmation, une alerte au DJ. Comme l'endpoint remplace tout, **presque toute modification**
conserve quelqu'un — le DJ risque d'être alerté à chaque changement d'affectation. Comportement
fidèle à RG-DOS-07 tel qu'implémenté ; à confirmer avec la Direction Juridique.
**Statut : ouvert, non bloquant.**

**✅ Résolue dans le backend le 2026-09-10 (Q-75)** : `@NotEmpty` sur les deux listes et `@Valid`
sur le contrôleur, qui n'en avait pas. Même règle qu'à la création. L'observation sur l'alerte au DJ
reste ouverte : c'est une règle métier, à faire confirmer par la Direction Juridique.

### ✅ QF-22 — La liste des dossiers ne mène pas encore à la fiche *(levée en F7)*

**Constat.** L'écran 05 affiche la référence de chaque dossier en texte simple, et la création
renvoie vers la liste filtrée plutôt que vers le dossier créé. La fiche dossier est l'écran **07**,
livré en **F7**.

**Pourquoi ce choix.** Un lien vers `/dossiers/{id}` serait mort jusque-là — et le routeur App
échoue *en silence* sur une route inexistante : l'URL ne change même pas, ce qui donne l'illusion
d'un bouton cassé. Découvert en testant la création : le backend répondait `201`, mais la
redirection ne se produisait pas.

**À faire à l'ouverture de F7** : rebrancher la colonne « Référence » sur `/dossiers/{id}` et la
redirection de création sur la fiche du dossier créé. Les deux emplacements portent un commentaire
le rappelant. **Statut : dette assumée, levée en F7.**

**✅ Levée le 2026-09-10 (F7)** : la référence mène à la fiche, et la création y redirige.

### ✅ QF-21 — `ERR-CONFLICT` ne disait pas quel champ est en conflit *(résolu le 2026-09-09)*

**Constat, vérifié en provoquant le doublon sur l'instance locale le 2026-09-09.** Une seconde
création de client renvoie :

```
POST /clients  →  409
{"code":"ERR-CONFLICT","message":"La référence client 'CLI-DIAG-101107' est déjà utilisée","details":null}
```

Le code `ERR-002`, que le contrat d'API associe à une référence dupliquée, est en réalité **réservé
aux dossiers** (`DossierService`). Le même `ERR-CONFLICT` sert à **neuf conflits sans rapport** :
référence client, compte Keycloak d'un avocat, étape déjà ouverte, accord de frais déjà donné,
suppression déjà demandée, publication déjà traitée, correspondance déjà transmise, constitution
déjà traitée. Et `details` vaut toujours `null`.

**Conséquence.** Le frontend ne peut pas déduire de la réponse le champ à corriger. Il a coûté
un échec e2e réel : le doublon de référence client s'affichait dans un bandeau au lieu du champ.

**✅ Résolu dans le backend le 2026-09-09**, sur autorisation explicite de l'utilisateur.

La correction **n'est pas** celle que j'avais d'abord proposée. Je voulais mettre le nom du champ
dans `details` — c'était une erreur : `details` porte déjà du texte destiné à un humain
(`"reference: must not be blank"`), et lui faire porter aussi un identifiant machine aurait rendu les
deux illisibles. Le corps d'erreur gagne donc un champ **`champ`** distinct, absent du JSON quand
l'erreur ne vise personne — l'ajout est ainsi rétrocompatible.

```json
POST /clients (doublon)      → {"code":"ERR-CONFLICT", "message":"…", "details":null, "champ":"reference"}
POST /intervenants (doublon) → {"code":"ERR-CONFLICT", "message":"…", "details":null, "champ":"compteKeycloak"}
GET  /dossiers (avocat)      → {"code":"ERR-FORBIDDEN","message":"Droits insuffisants","details":null}
```

Cinq sites nomment désormais leur champ : référence client, compte Keycloak d'un avocat, référence de
dossier (`ERR-002`), étape déjà ouverte, référence de facture (`ERR-006`). Les conflits d'**état**
(« cette demande a déjà été traitée ») n'en nomment aucun, et c'est volontaire : désigner un champ au
hasard serait pire que se taire.

**Côté frontend**, `ErreurApi.champ` est désormais l'autorité. La table déclarée par formulaire
subsiste en **repli de compatibilité** — les deux dépôts se déploient séparément, un backend
antérieur ne renvoie pas `champ` — et devra disparaître quand plus aucun environnement ne fera
tourner un backend d'avant cette date.

**Vérifié en réel le 2026-09-09** contre le backend démarré, sur les quatre cas ci-dessus, plus
257 tests backend et un test d'intégration qui contrôle la présence **et l'absence** de la clé.

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

### ✅ QF-07 — Recherche de dossiers limitée *(résolue le 2026-09-09)*

**Constat.** `GET /dossiers` n'accepte que `nature`, `categorie`, `juridiction`, `page`, `size`. Ni
recherche par référence de dossier, ni par client, ni filtre « mes dossiers ».

**Conséquence.** Un juriste suivant plusieurs dizaines de dossiers n'a aucun moyen direct de
retrouver le sien. Un filtrage effectué côté navigateur sur une liste paginée **donnerait des
résultats faux** (il ne verrait que la page courante).

**✅ Résolue dans le backend le 2026-09-09** (Q-72), sur autorisation explicite de l'utilisateur, à
l'ouverture de F6.

`GET /dossiers` accepte désormais trois paramètres optionnels :
· `reference` — recherche **partielle**, insensible à la casse ;
· `clientId` ;
· `mesDossiers` — booléen, résolu sur **l'utilisateur authentifié** et non sur un identifiant reçu,
  de sorte qu'il ne peut pas servir à consulter le portefeuille d'un collègue.

Le filtre de portefeuille passe par une sous-requête `EXISTS`, non par une jointure, qui aurait
dupliqué les lignes et faussé le total de la pagination.

**Vérifié en réel le 2026-09-09** : `reference=DOS-F6` → 1, `reference=ZZZZ` → 0, `clientId=1` → 1,
`clientId=2` → 0, `mesDossiers` → 1 pour le juriste affecté et 0 pour l'assistante.

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

### ✅ QF-06 — Affichage des documents stockés *(tranchée le 2026-09-10, en F7)*

Les documents sont servis par des URL MinIO pré-signées sur `http://localhost:9000`, valables
10 minutes. **Vérifié en réel** : MinIO répond `Access-Control-Allow-Origin: http://localhost:3000`,
préflight compris, et l'application n'impose aucune politique de sécurité de contenu.

**Tranché** : le contenu est lu dans la page par `fetch` (sans en-tête `Authorization`, que MinIO
vérifierait à la place de la signature), puis affiché depuis une URL `blob:` locale — PDF en
`iframe`, image, texte ; un XLSX se télécharge. Le téléchargement passe par le même contenu et garde
le nom d'origine, ce qu'un lien direct vers MinIO ne permettrait pas (`download` ignoré entre
origines). Vérifié par les parcours e2e : aperçu d'une image stockée, téléchargement d'un PDF.

⚠ En production, l'URL publique de MinIO et son CORS devront être reconfigurés pour l'origine réelle
de l'application : `MINIO_API_URL` est aujourd'hui `localhost`.

### ✅ QF-18 — Saisie des identifiants dans l'application — tranché en F3

**Décision utilisateur du 2026-09-08**, prise après exposé des alternatives et des limites.

Le formulaire d'identification vit dans l'application. Keycloak valide les credentials via le flux
« mot de passe » (`grant_type=password`) et émet les jetons ; il ne présente jamais sa propre page.

**Mise en œuvre.** `authorize` s'exécute **côté serveur Next.js** : le mot de passe va du champ au
serveur, puis du serveur à Keycloak. Il ne figure ni dans le paquet navigateur, ni dans un état
React, ni dans la session, ni dans un journal. Un refus reçoit **toujours le même message**, que le
compte n'existe pas, soit désactivé ou attende une action — deux tests de bout en bout gardent cette
propriété fermée. Seule l'indisponibilité du service se distingue.

**Limites assumées, à rouvrir si le contexte change :**

| Limite | Conséquence |
|---|---|
| Pas de second facteur | Si la DSI active l'OTP sur le realm, ce flux cesse de fonctionner et devra être repris |
| Pas de réinitialisation de mot de passe | Aucun écran « mot de passe oublié » ; l'utilisateur passe par le support |
| Pas de verrouillage après échecs | `bruteForceProtected` est désactivé sur le realm ; à activer côté Keycloak si souhaité |
| Pas de connexion unique | Aucun partage de session avec les autres applications Afriland |
| `grant_type=password` retiré d'OAuth 2.1 | Déconseillé par Keycloak ; fonctionnel mais non pérenne à long terme |

**Alternative écartée**, à reconsidérer si l'une des limites devient bloquante : habiller la page de
connexion de Keycloak d'un thème Afriland. Rendu visuel équivalent, aucune de ces limites, mais
suppose un thème dans le dépôt backend.

**Effet de bord favorable sur la déconnexion** : le navigateur n'ouvrant jamais de session de
connexion unique chez Keycloak, le risque de reconnexion silencieuse sur poste partagé disparaît.
La révocation du jeton se fait désormais **de serveur à serveur** (`app/api/deconnexion/route.ts`),
sans redirection externe — plus simple et plus robuste que le mécanisme précédent.

### ✅ QF-09 — Bilinguisme français / anglais — tranché en F3b

**Première décision (français seul) révisée le 2026-09-08 sur demande de l'utilisateur.** Le Cameroun
est officiellement bilingue et une partie du personnel d'Afriland travaille en anglais.

**Vérification préalable du backend** : aucun `MessageSource`, aucun `LocaleResolver`, aucune prise
en compte d'`Accept-Language`, et une seule colonne `libelle` sur les tables de référentiel — le tout
en français. **Cela ne bloque pourtant presque rien**, parce que le backend ne renvoie que des codes
stables.

| Origine du texte | Traduisible | Mécanisme |
|---|---|---|
| Interface, libellés, boutons | ✅ | `messages/fr.json`, `messages/en.json` |
| Énumérations du domaine | ✅ | Clé = valeur d'énumération, sous `domaine` |
| Erreurs backend | ✅ | Clé = `code` ; le message français du backend n'est qu'un repli |
| Référentiels (17 natures, 3 types, 7 configurations) | ✅ | Clé = `code`, listes fermées relevées en réel |
| Dates, montants FCFA | ✅ | `Intl` avec `fr-CM` / `en-CM` |
| **Contenu saisi par les utilisateurs** | ❌ | Comptes rendus, motifs, noms — reste dans la langue de rédaction |

**Réserve** : si le Directeur Juridique ajoute une nature de dossier directement en base (CONF02 le
permet), elle apparaîtra non traduite jusqu'à son ajout aux fichiers de messages. Le test de parité
ne peut pas l'attraper — il ne connaît que les 17 valeurs relevées.

**Mise en œuvre** : `next-intl` 4.14, langue dans un cookie, **aucun préfixe de langue dans l'URL**
— `/dossiers/42` reste `/dossiers/42`, ce qui préserve les liens profonds des notifications
(cohérent avec QF-19). Bascule accessible depuis l'écran de connexion **et** depuis l'en-tête : un
utilisateur anglophone ne doit pas avoir à deviner le français pour changer de langue.

**Garde-fous** : `tests/unit/messages.test.ts` vérifie la parité stricte des clés entre les deux
fichiers, l'absence de valeur vide, et la présence d'un libellé pour **chaque** valeur d'énumération,
chaque rôle, chaque code d'erreur et chaque entrée de référentiel. Un contrôle supplémentaire atteste
que l'anglais ne recopie pas le français. Six parcours Playwright vérifient la bascule de bout en
bout, y compris les messages d'erreur de connexion.

### ✅ QF-09b — La préférence de langue vit dans un cookie — tranché en F3b

Aucune modification du backend. **Limite** : la préférence est propre à chaque navigateur — un
juriste changeant de poste retrouve le français par défaut. La rattacher au compte supposerait une
colonne `langue` sur la table `utilisateur` et un endpoint pour la lire et l'écrire. À reconsidérer
lorsqu'une évolution backend sera de toute façon nécessaire (QF-03 ou QF-16) : un seul point de
lecture serait à changer.

### 🟡 QF-41 — `GET /clients/{id}/dossiers` n'est pas paginé et s'effondre en volume

**Mesuré le 2026-09-12**, en marge de F14, contre la base de développement. Le client de socle des
parcours porte **310 dossiers** ; la vue consolidée les renvoie **tous**, chacun avec ses étapes
imbriquées — 267 Ko, **11 à 19 secondes** par appel, jusqu'à **70 s** sous charge. L'écran 13 reste
donc en chargement bien au-delà du raisonnable, et l'appel monopolise assez longtemps une connexion
de la réserve pour faire échouer, en parallèle, des requêtes sans rapport (le calendrier, notamment).

Ce n'est pas un défaut du frontend et ce n'est pas apparu avec F14 : c'est le volume de la base de
développement qui a fini par franchir le seuil. Les parcours qui traversent cet écran passent en
exécution seule et échouent par intermittence avec quatre travailleurs en parallèle — l'appel occupe
assez longtemps une connexion pour faire expirer ses voisines. **À ne pas confondre avec Q-93** :
les échecs reproductibles des parcours clients venaient de l'absence de tri, corrigée ; celui-ci
reste une question de volume, non corrigée.

**Options** : (a) paginer la vue consolidée côté backend, par catégorie ; (b) alléger la réponse —
l'écran 13 n'affiche ni les étapes ni les parties ; (c) ne rien changer et l'assumer comme une limite
connue de NF-PERF-01. **Recommandation** : (b) puis (a) — le gros de la charge est la sérialisation
d'étapes que personne ne lit sur cet écran. **À arbitrer ; aucune modification faite.**

### ✅ QF-10 — Thème sombre — tranché en F3

Abandonné. `next-themes` désinstallé, `color-scheme: light` déclaré. Les jetons restent structurés
pour qu'un thème sombre soit ajoutable sans refonte si le besoin apparaît.

### ✅ QF-11 — Temps réel ou rafraîchissement périodique — tranché en F14

**Décision utilisateur (2026-09-12) : temps réel, avec repli HTTP garanti.** `@stomp/stompjs` et
`sockjs-client` sont installés ; l'endpoint `/ws` n'étant exposé qu'en SockJS
(`registry.addEndpoint("/ws").withSockJS()`), une WebSocket native ne négocierait rien.

L'authentification se fait sur la trame STOMP `CONNECT` — les transports de repli de SockJS ne
permettent pas d'en-tête `Authorization` sur la poignée de main HTTP. Le jeton est relu à **chaque**
connexion (`beforeConnect`), pour qu'une reconnexion après rotation reparte avec le jeton courant.

Le canal reste un **accélérateur, jamais la source de vérité** : le backend enregistre l'alerte
avant de tenter de la pousser. La liste se rafraîchit donc de toute façon — toutes les 30 s quand le
canal est coupé, toutes les 5 min quand il est ouvert — et l'écran 03 affiche lequel des deux régimes
s'applique. Vérifié de bout en bout : canal ouvert, une alerte déclenchée par l'API apparaît sans
rechargement ; canal coupé au niveau réseau, la même alerte arrive par le repli.

### ✅ QF-12 — Dépendance au contrat d'API

`/v3/api-docs` est public côté backend et doit être fermé avant production (R-08 backend). **Tranché
: la spec est figée dans `contracts/openapi.json`**, régénérée manuellement et versionnée. Aucune
dépendance à l'exécution.

### ✅ QF-13 — Palette Afriland — tranché en F3

**Faits vérifiés** — extraits des fichiers vectoriels officiels : `#ED1C24` (rouge, **4,38:1** sur
blanc — sous le seuil AA), `#231F20` (anthracite, **16,30:1**), `#939598`, `#C7C8CA`. Signature
« The Pact with Success ». Aucune charte graphique officielle n'est publiée.

**Apport décisif de l'utilisateur** : la capture de **GFA**, application Afriland en production,
fournit des conventions d'interface réelles plutôt que déduites — carte blanche centrée sur fond
gris clair, lockup horizontal, action sobre, pied de page de copyright.

**Retenu** : structure sobre, identité rouge. L'anthracite porte texte et structure ; le rouge signe
l'identité (logo, filet, état actif, anneau de focus) ; **l'action principale est anthracite**. La
famille de statut (`succès`, `attention`, `danger`, `info`) est distincte du rouge de marque, faute
de quoi rouge d'erreur et rouge institutionnel deviendraient indiscernables.

**Vérifié, non affirmé** : `tests/unit/contraste.test.ts` recalcule 24 ratios depuis les jetons réels
de `globals.css`. Deux jetons ont d'ailleurs dû être assombris pour tenir AA sur *toutes* les
surfaces, pas seulement sur blanc.

> Réserve : sur la capture de GFA, le bouton « Connexion » paraît grisé — vraisemblablement un état
> désactivé, le formulaire étant vide. Sa couleur active reste donc inconnue ; le choix de
> l'anthracite repose sur la mesure de contraste, non sur cette capture.
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
