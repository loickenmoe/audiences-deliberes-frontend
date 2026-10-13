# API_INTEGRATION_STATUS

> Les **88 endpoints HTTP** exposés par le backend (67 d'origine, sept ajouts de M16 : Q-74,
> Q-76, Q-77, les deux de Q-78, le détail d'une demande de frais, Q-82, et les décisions d'un
> dossier, Q-88, puis les cinq du référentiel des agences en N1) et leur état de consommation par
> le frontend.
> Numérotation reprise de `../audiences-deliberes-backend/API_IMPLEMENTATION_STATUS.md`.
> Dernière mise à jour : 2026-10-05 (jalon N1 — **référentiel des agences** : #67 à #70 consommés,
> écran 44 livré, contrat régénéré, 91 chemins avec N4. Le code d'agence n'est plus un champ de
> texte ;
> la fermeture d'une agence se défait, #71, demande du 2026-10-06).
> Précédente : 2026-09-29 (**contrat régénéré depuis le backend** : `contracts/openapi.json`
> passe de 62 à 86 chemins, aucun retiré. Il datait d’avant le Notification Engine, le portail
> Avocat, l’audit et le journal des audiences — et ne portait donc ni la référence attribuée par le
> système, ni la juridiction d’audience, ni les filtres d’étape. Il ne sert qu’à la vérification :
> `/v3/api-docs` est ouvert sans authentification (R-08) et le frontend n’en dépend pas à
> l’exécution. À régénérer après chaque jalon backend, par `npm run api:fetch && npm run api:types`).
> Précédente : 2026-09-15 (M22 — **huit endpoints passent en `PageResponse`** et dix filtres
> s'ajoutent ; `GET /dossiers/{id}/historique` créé. Le décompte reste **74 sur 74** : ce sont les
> mêmes endpoints, sous une autre forme).
> Précédente : 2026-09-14 (Q-98 — **#29 passe en multipart** avec une pièce facultative ;
> QF-20 rouverte puis tranchée. Le décompte est inchangé : **74 sur 74**).
> Précédente : 2026-09-14 (jalon F16 — **74 endpoints consommés sur 74**, plus les cinq
> endpoints du portail Avocat (Q-96, Q-97) et le canal `/ws` ; QF-01, QF-20 et QF-26 closes).
> Précédente : 2026-09-14 (jalon F15 — 71 sur 74, plus le canal `/ws` ; rapports et tableau de bord,
> QF-04 close, tableau de bord ouvert à la DJA par Q-95).
> Précédente : 2026-09-12 (jalon F14 — 69 sur 74, plus le canal `/ws` ; alertes, notifications et
> paramètres système, QF-11 tranché, validation par clé Q-91).
> Précédente : 2026-09-11 (jalon F13 — 64 sur 74, plus #45 en partie ; décisions et jurisprudence, Q-88/Q-89).
> Précédente : 2026-09-11 (jalon F12 — 58 sur 73, publications et constitutions s'appuient sur Q-86/Q-87).
> Précédente : 2026-09-11 (jalon F11 — 49 sur 73, le circuit des frais s'appuie sur Q-82/Q-83).
> Précédente : 2026-09-11 (jalon F10 — 43 sur 72, la file des suppressions et le rapport journalier
> s'appuient sur Q-79/Q-80).
> Précédente : 2026-09-11 (jalon F9 — 40 sur 72, cycle du délibéré aligné sur les sources, QF-33/Q-78).
> Précédente : 2026-09-10 (jalon F8 — 32 sur 70, après l'annulation d'audience et le traitement d'alarme ;
> décompte mesuré sur ce tableau. Le « 22 » annoncé en fin de F7 était faux : c'était 23, #64 et #65
> étant restés marqués 🟡 alors que l'écran les consommait depuis F6).

> **Décompte** — le backend annonce « 66 endpoints » : ce sont les **66 numérotés** `#1` à `#66`.
> S'y ajoute `POST /dossiers/{id}/etapes`, réel mais laissé **non numéroté** par le backend
> (ligne `—` en §1). Soit **67 endpoints HTTP** réellement exposés, vérifiés un par un contre les
> 18 contrôleurs le 2026-09-08.
>
> ⚠ **Piège de vérification** : `#57` (`GET /dossiers/{id}/alarmes`) et `#60`
> (`GET /constitutions/prestataires`) sont déclarés avec l'annotation **pleinement qualifiée**
> `@org.springframework.web.bind.annotation.GetMapping`. Un `grep "@GetMapping"` les manque et
> conclut à tort à 65 endpoints. Utiliser `grep -E "annotation\.(Get|Post|Put|Patch|Delete)Mapping"`
> en complément.

**Base URL** : `http://localhost:8080/api/v1`
**Authentification** : `Authorization: Bearer <JWT Keycloak>` sur **tous** les endpoints.
**Statut** : `❌` non consommé · `🟡` partiellement · `✅` consommé et validé manuellement

**Rôles** : `CONS` = `ROLE_CONSULTATION` (5 profils internes, **pas l'avocat**) ·
`SAI` = `ROLE_SAISIE` (composite : JUR, DJ, DJA, AST, SH).

---

## 1. Dossiers

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 1 | POST | `/dossiers` | SAI | 06 | F6 | ✅ |
| 2 | GET | `/dossiers?reference&clientId&mesDossiers&nature&categorie&juridiction&estSensible&sensibiliteStatut&typeEtape&statutEtape&dateDebut&dateFin&tri&page&size` | CONS | 05 | F6 | ✅ |
| 3 | GET | `/dossiers/{id}` | CONS | 07, 15 | F7 | ✅ |
| 4 | PUT | `/dossiers/{id}/affectation?forcer=` | JUR, DJ | 16 | F7 | ✅ |
| 5 | PATCH | `/dossiers/{id}/etapes/{etapeId}/statut` | JUR | 08 | F7 | ✅ |
| — | POST | `/dossiers/{id}/etapes` | JUR | 08 | F7 | ✅ |
| 6 | POST | `/dossiers/{id}/seuil-derogation` | SAI | 17 | F7 | ✅ |
| 7 | PUT | `/dossiers/{id}/seuil-derogation/{auditId}` | DJ, DJA | 17 | F7 | ✅ |
| — | GET | `/dossiers/{id}/seuil-derogation[?statut=]` 🆕 Q-74 | CONS | 17 | F7 | ✅ |
| 8 | POST | `/dossiers/{id}/sensibilite/validation` | DJ, DJA | 18 | F7 | ✅ |
| 72 | POST | `/dossiers/{id}/sensibilite/proposition` | JUR (SAISIE) | 07, 45 | N4 | ✅ |
| 73 | PUT | `/dossiers/{id}/sensibilite` | DJ, DJA | 07, 45 | N4 | ✅ |
| 74 | GET | `/utilisateurs/moi/signature` | authentifié | 46 | N8 | ✅ |
| 75 | GET | `/utilisateurs/moi/signature/image` | authentifié | 46 | N8 | ✅ |
| 76 | PUT | `/utilisateurs/moi/signature` | authentifié | 46 | N8 | ✅ |
| 77 | DELETE | `/utilisateurs/moi/signature` | authentifié | 46 | N8 | ✅ |

**Notes d'intégration**
- **#1** — corps `CreerDossierRequest` : `reference`, `nature`, `categorie`, `juridictionSaisie`,
  `clientId`, `parties{demandeur,defendeur}`, `risqueEncouru`, champs conditionnels par catégorie,
  `estSensible`, `seuilMontant`, `typeClientSensible`, **`juristesAffectes[]` et `avocatsAffectes[]`
  obligatoires et non vides**. 409 `ERR-002` (avec `champ: "reference"`) si la référence existe.
  Crée l'étape `INSTANCE` en `OUVERTURE`.

  ⚠ **Trois pièges, vérifiés en sondant l'endpoint** (F6) :
  · `nature` est le **libellé** du référentiel, résolu par `findByLibelleIgnoreCase` — ni le code,
    ni l'identifiant. Trois libellés de la taxonomie dépassaient la largeur de `dossier.nature` et
    rendaient ces natures inutilisables : corrigé par la migration backend V7 (Q-71) ;
  · `categorie` est **déduite** de la nature (RG-DOS-02). La transmettre n'apporte rien et provoque
    un 400 si elle diverge : le frontend ne l'envoie pas ;
  · `typeClientSensible` attend le **code** (`VIP`, `ENTREPRISE`, `PARTICULIER`), désormais validé
    contre le référentiel (Q-73).
  · `reference` **n'est plus envoyée** depuis le 2026-09-29 : le serveur l'attribue
    (`DOS-2026-0001`) et elle a quitté le corps de la requête. Elle se lit dans la réponse de
    création. Idem pour `POST /clients` (`CLI-2026-0001`).
  · `champAlarme` **n'est plus envoyé** depuis le 2026-09-28 : le champ ne déclenchait rien et son
    nom promettait un rappel. Le backend l'accepte toujours ; les alarmes qui agissent passent par
    `POST /dossiers/{id}/alarmes`.
  · `dossierCreditOrigine`, `pvTransfert`, `incidentCompteReference` et `elementsJustificatifs`
    sont **facultatifs depuis le 2026-09-29** (Q-11 amendée, migration V35) : le serveur ne les
    exige plus. L'obligation porte sur les **fichiers**, déposés par `POST /ged/documents` après la
    création — le serveur ne peut donc pas la tenir, seul l'écran le fait.
- **#2** — `reference` (partielle, insensible à la casse), `clientId` et `mesDossiers` ont été
  ajoutés au backend en M16 (Q-72, QF-07). `mesDossiers` se résout sur **l'utilisateur
  authentifié** : il ne permet pas de consulter le portefeuille d'un collègue.
  · `estSensible` et `sensibiliteStatut` datent de Q-101 ; `estSensible=false` est un filtre
    légitime, à ne pas confondre avec « non renseigné ».
  · `typeEtape` et `statutEtape` (2026-09-28) portent sur une **même** étape : les envoyer
    ensemble donne « les appels en cours », non « un appel, et par ailleurs quelque chose en cours ».
  · `dateDebut`/`dateFin` (ISO, bornes incluses) portent sur les **audiences** du dossier, les
    annulées exclues — pas sur sa date d'ouverture.
  · `tri` est un énuméré fermé : `RECENT` (défaut, inutile à transmettre), `ANCIEN`,
    `REFERENCE`, `RISQUE`. Une autre valeur est refusée par le serveur.
- **#3** — `documents[]` est **vide par construction** (Q-67 backend) : ne pas le consommer, passer
  par #43. `historique[]` et `etapes[]` sont en revanche renseignés.
- **#4** — 409 `ERR-003` en cas de doublon → dialogue de confirmation, rejeu avec `?forcer=true`.
- **#5** — 400 `ERR-004` si la transition est interdite. `EN_DELIBERE→DELIBERE_VIDE` et
  `DELIBERE_VIDE→EN_COURS` sont **exclues** de cet endpoint (Q-35) : endpoints dédiés du module
  délibéré. `DELIBERE_VIDE` + recours ouvre automatiquement `RECOURS_1`/`RECOURS_2`.
- **#6** — 400 si le dossier n'est pas sensible. Motif obligatoire.
- ⚠ **QF-07** — #2 n'offre ni recherche par référence, ni par client, ni filtre « mes dossiers ».
- ⚠ **QF-08** — aucun filtre sur `sensibiliteStatut` ni file des dérogations en attente.
- ✅ **QF-23** — #7 exigeait l'`auditId` d'une demande, que rien n'exposait. Levée le 2026-09-10 par
  `GET /dossiers/{id}/seuil-derogation` (Q-74 backend). La liste inclut la proposition initiale de
  sensibilité ; #7 n'est recevable que sur une sensibilité **validée**.
- **#4** — l'endpoint **remplace** les listes ; conserver une personne déjà affectée renvoie
  `ERR-003`, rejoué avec `?forcer=true` après confirmation. Au moins un juriste et un avocat, depuis
  Q-75 (QF-25) : sinon 400 `ERR-VALIDATION`.
- **#3** — `historique[].action` est une phrase française, non traduisible (QF-24).

## 2. Clients

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 9 | GET | `/clients?nom&reference&page&size` | CONS | 19 | F5 | ✅ |
| 10 | GET | `/clients/{id}` | CONS | 20 | F5 | ✅ |
| 11 | GET | `/clients/{clientId}/dossiers` | CONS | 20 | F5 | ✅ |
| 12 | POST | `/clients` | SAI | 21 | F5 | ✅ |
| 12 bis | PUT | `/clients/{id}` | SAI | 20 | Q-116 | ✅ |

- **#11** — renvoie `{clientId, clientNom, recouvrement[], exploitationLitiges[]}`, indépendant de
  l'affectation du juriste. 404 si le client n'existe pas ; structure vide (200) sinon.
- **#12 bis** (Q-116, 2026-09-22) — `PUT /clients/{id}` : nom, courriel, téléphone. **La référence est
  figée** et ne part pas dans le corps ; un champ vidé part en `null`. Même modale que la création,
  ouverte depuis la fiche (écran 20).

## 3. Audiences et alarmes

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 13 | POST | `/dossiers/{id}/audiences?forcer=` | JUR | 23 | F8 | ✅ |
| 14 | PUT | `/audiences/{id}/compte-rendu` | JUR | 24 | F8 | ✅ |
| 15 | GET | `/audiences/calendrier?periode&dateDebut&format` | JUR, DJ | 22 | F8 | ✅ |
| 16 | POST | `/dossiers/{id}/alarmes` | JUR | 25 | F8 | ✅ |
| 17 | PUT | `/alarmes/{id}/reprogrammer` | JUR | 25 | F8 | ✅ |
| 56 | GET | `/dossiers/{id}/audiences` | CONS | 09 | F8 | ✅ |
| 57 | GET | `/dossiers/{id}/alarmes` | CONS | 11 | F8 | ✅ |
| — | PATCH | `/audiences/{id}/annulation` 🆕 Q-76 | JUR | 09 (annulation motivée) | F8 | ✅ (QF-30) |
| — | PATCH | `/alarmes/{id}/traiter` 🆕 Q-77 | JUR | 11 (« Marquer traitée ») | F8 | ✅ (QF-29) |

- **#13** — étape au statut `EN_COURS` requise, date future obligatoire. 409 `ERR-005` sur doublon
  (même étape + même date) → confirmable par `?forcer=true`. Programme les rappels J-7/J-3/J-1.
- **#14** — date passée requise, compte rendu non vide. Statut → `TENUE`.
- **#15** — `periode ∈ {HEBDOMADAIRE, MENSUELLE, TRIMESTRIELLE}`,
  `format ∈ {JSON, PDF, EXCEL}` (JSON par défaut). PDF/Excel reviennent en binaire avec
  `Content-Disposition` → téléchargement, pas de parsing JSON.
- **#56** trié par date planifiée décroissante, **#57** par échéance croissante. 404 si le dossier
  est inconnu.

## 4. Délibérés

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 18 | POST | `/dossiers/{id}/deliberes` | JUR | 26 | F9 | ✅ |
| 19 | POST | `/deliberes/{id}/prorogations` | JUR | 26 | F9 | ✅ |
| 20 | POST | `/deliberes/{id}/rabattement` | JUR | 26 | F9 | ✅ |
| 21 | GET | `/deliberes/{id}/recours` | JUR | 27 | F9 | ✅ |
| 22 | PUT | `/deliberes/{id}/expedition` | JUR | 26 | F9 | ✅ |
| 58 | GET | `/dossiers/{id}/deliberes` | CONS | 10 | F9 | ✅ |
| — | PUT | `/deliberes/{id}/resultat` 🆕 Q-78 | JUR | 26 (enregistrer la décision) | F9 | ✅ (QF-33) |
| — | GET | `/deliberes/{id}/prorogations` 🆕 Q-78 | CONS | 10 (historique) | F9 | ✅ (QF-33) |

**Cycle depuis Q-78 (QF-33)** : mise en délibéré sans résultat → prorogations et rabattement pendant
l'attente → décision, qui vide le délibéré. La réponse porte `etat` (`EN_ATTENTE`/`VIDE`/`RABATTU`),
`nombreProrogations`, `dateRabattement`, `motifRabattement` ; `resultat` et `statutExpedition` sont
nuls tant que la décision n'est pas rendue.

- **#18** — étape `EN_DELIBERE` requise. **Sans** `resultat` : mise en délibéré, l'étape ne bouge
  pas, aucune échéance admise ; un seul délibéré en attente par étape (409). **Avec** `resultat` :
  délibéré déjà rendu, vidé d'un même geste — `dateEcheanceRecours` **obligatoire et postérieure à
  `dateDeliberee`** si `resultat ∈ {DEFAVORABLE, MIXTE}`, **absente sinon** (Q-42).
- **#19** — **toujours 201**, corps `{...prorogation, compteur, alerte}`. `alerte: true` signale le
  franchissement de `SEUIL_PROROGATIONS` — **ce n'est pas une erreur** (Q-17) : l'écran l'affiche en
  avertissement. Délibéré en attente et date **future** exigés ; elle devient la date annoncée.
- **#20** — délibéré en attente, étape `EN_DELIBERE` (le juge rouvre les débats avant de statuer).
  **Motif obligatoire**, conservé sur le délibéré. Ne rouvre jamais l'étape suivante — distinct de
  l'exercice d'un recours.
- **#22** — refusé tant que le délibéré n'est pas vidé.
- **#21** — strictement consultatif (Q-19) : `{delibereId, dateEcheanceRecours, recoursExerce,
  delaiExpire, cloture}`. Le suivi réel est assuré par un planificateur backend.

## 5. Frais d'avocats

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 23 | POST | `/frais/demandes` | AVOCAT | 30 | **F16** | ✅ |
| 24 | PUT | `/frais/demandes/{id}/conformite` | ASSISTANTE | 29 | F11 | ✅ |
| 25 | PUT | `/frais/demandes/{id}/opportunite` | DJA | 29 | F11 | ✅ |
| 26 | POST | `/frais/demandes/{id}/validation-conjointe` | DJ **et** DJA | 29 | F11 | ✅ |
| 27 | PATCH | `/frais/demandes/{id}/paiement` | ASSISTANTE | 29 | F11 | ✅ |
| 28 | GET | `/frais/demandes?statut&page&size` | AVOCAT, AST, DJA, DJ | 28 | F11 | ✅ (vue selon le profil) |
| — | GET | `/frais/demandes/{id}` | AVOCAT (les siennes), AST, DJA, DJ | 29 | F11 | ✅ (ajouté par Q-82) |

- **#23** — avocat affecté au dossier requis. `piecesJustificatives` non vide. `referenceFacture`
  **unique tous statuts confondus, y compris `REJETEE`** → 409 `ERR-006`.
- **#24/#25/#26** — motif de rejet **obligatoire** au refus. Statut préalable exigé à chaque étape.
- **#26** — les **deux** accords sont requis pour `VALIDEE` ; **un seul refus** rejette. Un même
  profil ne peut pas voter deux fois.
- **#27** — statut `VALIDEE` requis (400 sinon).
- **#28** — filtré automatiquement sur ses propres demandes pour `ROLE_AVOCAT`, transverse pour les
  profils internes. Plus récente d'abord depuis Q-82. **L'écran choisit les statuts selon le
  profil** (`lib/frais.ts`) : l'Assistante ouvre sur `DEPOSEE` puis `VALIDEE`, la DJA sur
  `CONFORMITE` puis `OPPORTUNITE`, le DJ sur `OPPORTUNITE` ; « toutes » pour chacun.
- **Réponse (Q-82)** — dossier et avocat nommés, `dossierSensible`, `seuilApplicable`,
  `validationConjointeRequise` et `validations` (étape, décision, motif, auteur nommé, date) : le DJ
  voit l'accord de la DJA, et l'écran ne propose jamais un second vote au même profil.
- **Relance CONF04 (Q-83)** — côté backend seulement : alerte `VALIDATION_CONJOINTE_REQUISE` au DJ
  et/ou à la DJA qui n'ont pas voté après `DELAI_VALIDATION_CONJOINTE` jours. Aucun endpoint.

## 6. Publications

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 29 | POST | `/publications/cr-audience` (multipart, pièce facultative — Q-98) | AVOCAT | 33 | **F16**, revu Q-98 | ✅ |
| 30 | PUT | `/publications/{id}/validation` | ASSISTANTE | 32 | F12 | ✅ |
| 31 | POST | `/publications/autres` *(multipart)* | AVOCAT | 33 | **F16** | ✅ |
| 32 | GET | `/publications/{id}` | CONS | 32 | F12 | ✅ (fichier, commentaires, correspondance — Q-86) |
| 33 | POST | `/publications/{id}/commentaires` | JURISTE | 32 | F12 | ✅ |
| 34 | POST | `/publications/{id}/correspondance` | DJ, DJA | 32 | F12 | ✅ |
| 59 | GET | `/publications?dossierId&statut&page&size` | AST, JUR, DJ, DJA | 13, 31 | F12 | ✅ (vue selon le profil) |

- **#29** — l'audience doit être **rattachée au dossier** (404 sinon).
- **#30** — chemin **généralisé aux deux sous-types** (Q-55). Motif obligatoire au rejet.
- **#31** — multipart : `dossierId`, `typeDocument ∈ {PIECE, DECISION, CONCLUSION}`,
  `restrictionAcces` (optionnel) en `@RequestParam` ; `file` en `@RequestPart`.
- **#32** — consultable seulement si `VALIDE`, **sauf par l'Assistante** qui doit la lire pour la
  valider (Q-86). `restrictionAcces` désignant un autre utilisateur → **403 `ERR-009`** : écran
  « accès restreint », pas une erreur technique ; elle ne s'oppose ni à l'Assistante ni au DJ/DJA
  (Q-86). `DEPOSE`/`REJETE` → 404 pour les autres. Le détail porte `urlTelechargement` (10 min),
  `commentaires` et `correspondance` ; publications et listes sont nommées (Q-86).
- **#33** — le juriste **ne commente jamais directement l'avocat** : le commentaire va au DJ/DJA.
- **#34** — correspondance **unique** → 409 si déjà transmise.
- **#59** — n'applique **pas** la restriction d'accès individuelle (métadonnées seulement).
  `statut=DEPOSE` en ordre d'arrivée, sinon la plus récente d'abord (Q-86). L'écran 31 ouvre
  l'Assistante sur « à valider » ; les autres profils ne voient que les publications validées.
- **Validation (#30)** — notifie désormais les juristes du dossier, ou le seul destinataire désigné
  (Q-86, UC-INT-08 étape 1).

## 7. Constitutions et répertoire

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 35 | POST | `/constitutions/prestataires` | JURISTE, **ASSISTANTE** | 07 (modale) | F12 | ✅ |
| 36 | PUT | `/constitutions/prestataires/{id}/validation` | SH | 35 | F12 | ✅ |
| 37 | GET | `/repertoire/avocats?nom=` | JUR, AST | 34 | F12 | ✅ |
| 60 | GET | `/constitutions/prestataires?statut=` | SH, JURISTE, **ASSISTANTE** | 35 | F12 | ✅ (nommée — Q-86 ; porte `redactionPossible` — Q-126) |
| — | POST | `/demandes-explication` 🆕 N7 | **DJ, DJA** | 47 | N7 | ✅ |
| — | GET | `/demandes-explication?enAttente=` 🆕 N7 | DJ, DJA, **AVOCAT** (périmètre décidé par le serveur) | 47 | N7 | ✅ |
| — | PUT | `/demandes-explication/{id}/reponse` 🆕 N7 | **AVOCAT**, la sienne seule | 47 | N7 | ✅ |
| 61 | POST | `/intervenants` | DJ, DJA | 42 | F5 | ✅ |
| 61 bis | PUT | `/intervenants/{id}` | DJ, DJA | 42 | Q-117 | ✅ |
| 62 | GET | `/intervenants?type=` | CONS | 06, 42 | F5 | ✅ |

- **#35** — `dossierId`, `prestataireId`, **motif obligatoire**. Notifie les SH.
- **#36** — l'approbation **génère la lettre de constitution** (PDF) et l'attache comme document
  GED. Rejet → motif obligatoire. 409 si la décision est déjà prise. Depuis Q-87, l'avocat constitué
  est réellement notifié (le prestataire chargé à la demande n'était jamais reconnu comme avocat).
- **#37** — `indicateurCharge` (dossiers actifs) et `indicateurPerformance` (taux de succès),
  calculés à la demande, **triés par charge croissante**.
- **#61** — un `AVOCAT` exige un `compteKeycloak` **unique** (400 s'il manque, 409 s'il est pris) et
  refuse `notification` ; un `AUTRE_PRESTATAIRE` refuse tout compte. **Ni PUT ni DELETE.**
- **#62** — alimente les sélecteurs d'affectation de l'écran 06 et le cache de résolution des noms.

## 8. Gestion documentaire

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 38 | POST | `/ged/documents` *(multipart)* | SAI | 06 (pièces à la création), 12 | F7 · F10 | ✅ |
| 39 | GET | `/ged/documents/{id}` | CONS | 12 (consulter, télécharger) | F7 · F10 | ✅ |
| 40 | DELETE | `/ged/documents/{id}` | JUR (202) / DJ, DJA (200) | 12 | F7 · F10 | ✅ |
| 41 | PUT | `/ged/documents/{id}/approbation-suppression` | DJ, DJA | 36 | F10 | ✅ (rejet : motif obligatoire, 255 car.) |
| 42 | GET | `/ged/rapport-journalier?date=` | JUR, DJ, DJA, AST (Q-80) | 37 | F10 | ✅ |
| 43 | GET | `/dossiers/{id}/documents` | CONS | 07 (onglet Documents), 12 | F7 (lecture) · F10 | ✅ |
| 63 | GET | `/ged/demandes-suppression?statut=` | DJ, DJA | 36 | F10 | ✅ (nomme fichier et dossier depuis Q-79) |

- **#38** — multipart : `dossierId`, `typeDocument` (texte libre) en `@RequestParam` ; `file` en
  `@RequestPart`. Format **dérivé de l'extension** (pas du `Content-Type`) parmi
  `PDF, PNG, JPG, TXT, XLSX`, poids ≤ 10 Mo → 400 `ERR-008`.
- **#39** — renvoie `urlTelechargement`, **URL MinIO pré-signée** (cf. RF-01/QF-06). 404 si le
  document est supprimé.
- **#40** — **deux comportements selon le profil résolu côté serveur** : juriste auteur → demande
  créée, **202**, document intact ; DJ/DJA → suppression immédiate, **200**. 409 si une demande est
  déjà en attente, 403 pour un juriste non auteur. **L'interface interprète le code de retour, pas
  le rôle local.**
- **#41** — motif de rejet obligatoire.
- **#42** — `dossiersManipules`, `piecesAjoutees`, `affairesNouvelles`, `planificationActes[]`.
  Zéros si aucune donnée : état vide, pas erreur.

## 9. Alertes, configurations, reporting

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 44 | PUT | `/alertes/seuils` | **DJ + DJA** (Q-108) | 41 | F14 | ✅ |
| 45 | GET | `/alertes/mes-notifications?statut&page&size` | authentifié | 03, **amorçage de session**, badge | F14 | ✅ |
| 46 | PATCH | `/alertes/{id}/traiter` | destinataire | 03 | F14 | ✅ |
| 47 | GET | `/configurations` | CONS | 41 | F14 | ✅ |
| 48 | PUT | `/configurations/{cle}` | **DJ + DJA** (Q-108) | 41 | F14 | ✅ |
| 49 | GET | `/rapports?type&dateDebut&dateFin&format` | **JURISTE** | 40 | F15 | ✅ |
| 50 | GET | `/tableau-de-bord` | **DJ + DJA** (Q-95) | 39 | F15 | ✅ |
| — | GET | `/tableau-de-bord/details?indicateur&page&size` 🆕 Q-137 | **DJ + DJA** | 39 (modale de détail) | Q-137 | ✅ |
| — | GET | `/rapports/activite?dateDebut&dateFin&utilisateurId&avocatId` 🆕 Q-133, élargi Q-135 | **CONS + AVOCAT** — chacun sur lui-même ; DJ et DJA sur quiconque, avocats compris | 44 (Mon compte), 40, 30 (Mon espace), 34 (répertoire) | Q-135 | ✅ |
| — | GET | `/rapports/activite/export?…&format` 🆕 Q-133, élargi Q-135 | **CONS + AVOCAT** | 44, 40, 30, 34 | Q-135 | ✅ |
| — | GET | `/rapports/activite/details?…&code&page&size` 🆕 Q-133, élargi Q-135 | **CONS + AVOCAT** | 44, 40, 30, 34 (modale) | Q-135 | ✅ |
| — | GET | `/rapports/nominatif/avocats?dateDebut&dateFin` 🆕 Q-136 | **DJ + DJA** | 40 (bloc « Activité des avocats ») | Q-136 | ✅ |
| — | GET | `/rapports/nominatif?dateDebut&dateFin` 🆕 Q-132 | **DJ + DJA** — plus étroit que `#49` à dessein | 40 (bloc « Activité par personne ») | N6 | ✅ |
| — | GET | `/alertes/statistiques-diffusion?dateDebut&dateFin` 🆕 Q-109 | **DJ + DJA** | 41 (supervision) | F18 | ✅ |
| — | GET | `/historique?perimetre&dossierId&utilisateurId&code&dateDebut&dateFin&page&size` 🆕 Q-112 | **DJ + DJA** | 43 (audit) | F18 | ✅ |
| — | GET | `/historique/export?…&format=PDF|EXCEL` 🆕 Q-113 | **DJ + DJA** | 43 (audit) | F18 | ✅ |
| — | GET | `/historique/exports?page&size` 🆕 Q-113 | **DJ + DJA** | 43 (archives) | F18 | ✅ |
| — | GET | `/historique/exports/{id}/telechargement` 🆕 Q-113 | **DJ + DJA** | 43 (archives) | F18 | ✅ |
| — | GET | `/historique/exports/verification?empreinte` 🆕 Q-114 | **DJ + DJA** | 43 (vérification) | F18 | ✅ |
| — | GET | `/constitutions/prestataires/{id}/lettre` 🆕 Q-115 B2 | **SH + JURISTE + ASSISTANTE** | file des constitutions | F18 | ✅ |
| — | PUT | `/constitutions/prestataires/{id}/lettre` 🆕 Q-115 B2 | **son demandeur, ou le SH** (Q-126) | file des constitutions | F18 | ✅ |
| — | WS | `/ws` (STOMP/SockJS) → `/user/queue/alertes` | authentifié | 03, badge | F14 | ✅ |

- **#44** — `type` doit valoir `CHARGE_MAX_AVOCAT` (400 sinon), `seuil` entier positif. C'est la
  voie **désignée par le contrat** pour ce seuil : l'écran 41 l'emprunte pour cette clé et passe par
  #48 pour les six autres. Les deux aboutissent à la même ligne et à la même validation.
- **#47/#48** — chaque clé publie sa **règle de saisie** (`typeValeur`, `valeurMinimale`,
  `valeurMaximale`, `valeursPossibles`, Q-91) : l'écran 41 en déduit le champ, le frontend ne
  redéclare aucune borne. #48 refuse en 400 une valeur qui casserait les frais, les délibérés ou la
  GED, et renvoie la valeur **normalisée**.
- **Tri des listes (Q-92, Q-93)** — `/alertes/mes-notifications`, `/clients` et `/dossiers` ne
  triaient rien : au-delà d'une page, une ligne pouvait apparaître deux fois ou disparaître, et un
  client fraîchement créé n'était plus visible par son auteur. Les trois renvoient désormais du plus
  récent au plus ancien, comme les frais, les publications et les jurisprudences.
- **#45** — **plus récente d'abord depuis Q-92.** Le tri n'existait pas : l'ordre était laissé à
  PostgreSQL, une notification pouvait atterrir sur n'importe quelle page. Sans `statut`, les deux
  statuts sont confondus.
- **#46** — seul le **destinataire** peut traiter (403 sinon) — vérifié en service, pas par rôle.
- **#49** — **204 si aucune donnée** sur la période : état vide, pas erreur.
  `format ∈ {JSON, PDF, EXCEL, CSV}` ; les trois derniers reviennent en binaire.
- **WS** — jeton dans l'en-tête `Authorization` de la trame STOMP `CONNECT`, **pas** dans la requête
  de négociation SockJS. Push best-effort : **#45 est le repli garanti**.
- ✅ **QF-04 close en F15.** #49 reste `hasRole('JURISTE')` et #50 passe à `hasAnyRole('DJ','DJA')`
  (Q-95). Le DJ et la DJA portant `ROLE_JURISTE` depuis Q-81, ils atteignent les deux : le parcours
  de pilotage P9 est jouable d'un bout à l'autre. Le juriste, lui, n'a pas le tableau de bord — c'est
  voulu par US 8.5.
- **#50** — six indicateurs **temps réel, tous dossiers confondus** : ni période, ni filtre sur le
  portefeuille de l'appelant. `tauxSuccesRecouvrement` est un **ratio de 0 à 1**.

## 10. Décisions définitives

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 51 | POST | `/dossiers/{id}/adjudications` | JURISTE | 14 | F13 | ✅ |
| 52 | POST | `/dossiers/{id}/condamnations` | JURISTE | 14 | F13 | ✅ |
| 53 | PATCH | `/condamnations/{id}/statut` | JURISTE | 14 | F13 | ✅ |
| 54 | POST | `/jurisprudences` *(multipart)* | JURISTE | 14, 38 | F13 | ✅ |
| 55 | GET | `/jurisprudences?motCle&natureDecision&juridiction&dossierId&page&size` | CONS | 14, 38 | F13 | ✅ (partielle, insensible à la casse, par dossier — Q-89) |
| — | GET | `/dossiers/{id}/decisions` | CONS | 14 | F13 | ✅ (ajouté par Q-88, ferme QF-03) |

- **#51** — étape `CLOTURE` requise (RG-DEF-01). `reliquat ≥ 0`.
- **#52** — **aucune précondition d'étape** (asymétrie assumée, Q-59).
  `sens ∈ {BANQUE_REDEVABLE, TIERS_REDEVABLE}`.
- **#54** — multipart : `dossierId` (optionnel), `typeArchive`, `motsCles[]`, `natureDecision`,
  `juridiction`, `dateDecision` en `@RequestParam` ; `file` (PDF ≤ 10 Mo) en `@RequestPart`.
- ⚠ **QF-03 — aucun `GET` sur #51/#52.** Une décision créée n'est jamais relisible, et #53 exige un
  identifiant inatteignable après rechargement de page. **Bloque l'écran 14 en lecture.**

## 11. Référentiels, agences et utilisateurs

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 64 | GET | `/referentiels/natures-dossier?categorie=` | CONS | 05 (filtre), 06 | F5 · F6 | ✅ consommé à l'écran en F6 *(statut corrigé en F8 : resté à 🟡 par oubli)* |
| 65 | GET | `/referentiels/types-client-sensible` | CONS | 06, 18 | F5 · F6 | ✅ consommé à l'écran en F6 et F7 *(statut corrigé en F8 : resté à 🟡 par oubli)* |
| 66 | GET | `/utilisateurs?profil=&inclureInactifs=` | CONS | 06, 16 | F5 | ✅ consommé par `useLibelles` |
| 67 | GET | `/referentiels/agences?recherche=&actifSeulement=` | CONS | 06, 44 | N1 | ✅ |
| 68 | POST | `/referentiels/agences` | DJ, DJA | 44 | N1 | ✅ |
| 69 | PUT | `/referentiels/agences/{id}` | DJ, DJA | 44 | N1 | ✅ |
| 70 | DELETE | `/referentiels/agences/{id}` | DJ, DJA | 44 | N1 | ✅ |
| 71 | PATCH | `/referentiels/agences/{id}/reactivation` | DJ, DJA | 44 | N1 | ✅ |

- **#67 à #70** — le seul référentiel **écrit depuis l'application**. Il est aussi le seul
  **paginé et cherché côté serveur** : 82 agences ne tiennent pas dans une liste déroulante
  lisible. Le sélecteur de l'écran 06 affiche « code · nom · ville », l'adresse en seconde ligne
  pour séparer les agences homonymes. `actifSeulement` vaut vrai partout sauf sur l'écran 44 : la
  saisie ne doit pas proposer une agence que le backend refusera. **`DELETE` désactive** - le
  service rend l'agence modifiée, non `void`, et l'écran affiche son nouvel état. **#71 rouvre**
  (2026-10-06) : la fermeture est réversible, code inchangé. Les deux mutations sont distinctes et
  non un bascule, pour que l'écran puisse nommer celle qui a échoué.
- **#64** — filtrable par catégorie, entrées actives seulement. Lecture seule (administré en base
  par le DJ, CONF02).
- **#66** — `keycloakId` **n'est pas exposé**. Comptes actifs seuls par défaut. `ROLE_CONSULTATION`
  requis — **l'avocat ne peut pas énumérer le personnel interne**, par conception.
- Ces trois endpoints alimentent aussi le cache de résolution des libellés (cf.
  `FRONTEND_ARCHITECTURE.md` §5).

---

## 12. Endpoints accessibles au profil AVOCAT

**Six endpoints seulement** — l'avocat ne porte pas `ROLE_CONSULTATION` :

| # | Endpoint | Objet |
|---|---|---|
| 23 | `POST /frais/demandes` | Déposer une demande de frais |
| 28 | `GET /frais/demandes` | Ses propres demandes |
| 29 | `POST /publications/cr-audience` | Déposer un compte rendu, avec sa pièce facultative |
| 31 | `POST /publications/autres` | Déposer une pièce |
| 45 | `GET /alertes/mes-notifications` | Ses notifications |
| 46 | `PATCH /alertes/{id}/traiter` | Traiter une notification |

✅ **QF-01 close en F16.** Quatre lectures lui ont été ajoutées (backend **Q-96**), toutes
restreintes au prestataire connecté **dans la requête** et non par un filtre appliqué après coup :

| Endpoint | Objet |
|---|---|
| `GET /avocat/mes-dossiers` | Ses dossiers — **identification seule** : référence, nature, juridiction |
| `GET /avocat/mes-dossiers/{id}/audiences` | Les audiences d'un de ses dossiers (403 sur un autre) |
| `GET /avocat/mes-publications` | Ses dépôts, avec statut et motif de rejet |
| `GET /avocat/mes-constitutions` | Les lettres de constitution qui le désignent |
| `POST /avocat/pieces-justificatives` *(multipart)* | **Téléverse une pièce** et renvoie sa clé (Q-97) |

Les deux premières répondent à une exigence écrite — US 4.1 fait soumettre un `dossierId` et US 5.1
demande de déposer « **en choisissant le dossier et l'audience** ». Les deux dernières sont du
**périmètre ajouté** sur arbitrage (2026-09-14), **à confirmer avec la Direction Juridique**.

✅ **QF-20 close, sans modification.** Le compte rendu est un `contenu` textuel dans la story 5.1 ;
un document se dépose par `POST /publications/autres` (story 5.3). Le backend est conforme — l'écran
33 expose les deux voies côte à côte.

## 13. Codes d'erreur à traiter

| Code | HTTP | Traitement UI |
|---|---|---|
| `ERR-001` | 400 | Erreurs de champ sur le formulaire |
| `ERR-002` | 409 | Erreur sur `reference` — **référence de dossier uniquement** (`DossierService`) |
| `ERR-003` | 409 | **Dialogue de confirmation** → rejeu `?forcer=true` |
| `ERR-004` | 400 | Message + états de transition permis |
| `ERR-005` | 409 | **Dialogue de confirmation** → rejeu `?forcer=true` |
| `ERR-006` | 409 | Erreur sur `referenceFacture` |
| `ERR-008` | 400 | Formats et plafond admis rappelés |
| `ERR-009` | 403 | Écran « accès restreint » |
| `ERR-VALIDATION` | 400 | Erreurs de champ |
| `ERR-UNAUTHENTICATED` | 401 | Reconnexion |
| `ERR-FORBIDDEN` | 403 | Écran non autorisé |
| `ERR-NOT-FOUND` | 404 | Écran introuvable |
| `ERR-CONFLICT` | 409 | **Générique : 9 conflits distincts.** Le corps nomme le champ visé dans `champ` quand il y en a un |
| `ERR-BUSINESS-RULE` | 422 | Message métier tel quel |
| `ERR-INTERNAL` | 500 | Message générique |

`ERR-007` **n'existe pas** : au-delà du seuil, une prorogation renvoie 201 avec `alerte: true`.

### `ERR-CONFLICT` et le champ fautif (constat, puis correction — 2026-09-09)

Le doublon de **référence client** ne renvoie pas `ERR-002` — réservé aux dossiers — mais le code
générique `ERR-CONFLICT` :

```
POST /clients (2e fois)  →  409
{"code":"ERR-CONFLICT","message":"La référence client 'CLI-DIAG-101107' est déjà utilisée","details":null}
```

Le backend emploie ce même code pour **neuf conflits sans rapport entre eux** : référence client
prise (`ClientService`), compte Keycloak déjà rattaché à un avocat (`IntervenantService`), étape
déjà ouverte (`DossierService`), accord de frais déjà enregistré, demande de suppression déjà en
attente, publication déjà traitée, correspondance déjà transmise, demande de constitution déjà
traitée. `details` est toujours `null` : **aucun champ n'est nommé**.

**Corrigé le jour même dans le backend** (QF-21). Le corps d'erreur porte désormais un champ
`champ`, distinct de `details`, présent uniquement quand une erreur vise un champ précis :

```
POST /clients (doublon)  →  409
{"code":"ERR-CONFLICT","message":"La référence client '…' est déjà utilisée","details":null,"champ":"reference"}
```

Cinq erreurs le renseignent : référence client, `compteKeycloak` d'un avocat, `ERR-002` référence de
dossier, `type` d'une étape déjà ouverte, `ERR-006` référence de facture. Les conflits d'état n'en
nomment aucun et la clé est alors **absente** du JSON — l'ajout ne change rien aux réponses
existantes. Côté frontend, `ErreurApi.champ` fait autorité ; la table déclarée par formulaire ne
subsiste qu'en repli, le temps que tous les environnements portent ce backend.

## 14. Récapitulatif

| | Endpoints | Consommés |
|---|---|---|
| **Total HTTP exposé par le backend** | **74** (66 numérotés + 8 non numérotés, dont 7 de M16) | **64** (plus #45 en partie) |
| Accessibles aux profils internes | 64 | 0 |
| Accessibles au profil avocat | 6 | 0 |
| — dont accessibles **aux deux** | 3 (`#28`, `#45`, `#46`) | 0 |
| — dont **exclusivement** avocat | 3 (`#23`, `#29`, `#31`) — reportés à F16 | — |
| Bloqués par une lacune backend (QF-03) | lecture des décisions définitives | — |
| Canal temps réel (hors décompte HTTP) | 1 (`/ws` STOMP) | 0 |

> Les deux ensembles **se recouvrent** : 64 + 6 ≠ 67. Trois endpoints (`GET /frais/demandes`,
> `GET /alertes/mes-notifications`, `PATCH /alertes/{id}/traiter`) servent les internes **et**
> l'avocat ; seuls trois sont exclusivement avocat.
