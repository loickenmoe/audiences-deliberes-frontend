# API_INTEGRATION_STATUS

> Les **67 endpoints HTTP** exposés par le backend et leur état de consommation par le frontend.
> Numérotation reprise de `../audiences-deliberes-backend/API_IMPLEMENTATION_STATUS.md`.
> Dernière mise à jour : 2026-09-09 (jalon F5 — 7 endpoints consommés, 2 prêts).

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
| 2 | GET | `/dossiers?reference&clientId&mesDossiers&nature&categorie&juridiction&page&size` | CONS | 05 | F6 | ✅ |
| 3 | GET | `/dossiers/{id}` | CONS | 07, 15 | F7 | ❌ |
| 4 | PUT | `/dossiers/{id}/affectation?forcer=` | JUR, DJ | 16 | F7 | ❌ |
| 5 | PATCH | `/dossiers/{id}/etapes/{etapeId}/statut` | JUR | 08 | F7 | ❌ |
| — | POST | `/dossiers/{id}/etapes` | JUR | 08 | F7 | ❌ |
| 6 | POST | `/dossiers/{id}/seuil-derogation` | SAI | 17 | F7 | ❌ |
| 7 | PUT | `/dossiers/{id}/seuil-derogation/{auditId}` | DJ, DJA | 17 | F7 | ❌ |
| 8 | POST | `/dossiers/{id}/sensibilite/validation` | DJ, DJA | 18 | F7 | ❌ |

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
- **#2** — `reference` (partielle, insensible à la casse), `clientId` et `mesDossiers` ont été
  ajoutés au backend en M16 (Q-72, QF-07). `mesDossiers` se résout sur **l'utilisateur
  authentifié** : il ne permet pas de consulter le portefeuille d'un collègue.
- **#3** — `documents[]` est **vide par construction** (Q-67 backend) : ne pas le consommer, passer
  par #43. `historique[]` et `etapes[]` sont en revanche renseignés.
- **#4** — 409 `ERR-003` en cas de doublon → dialogue de confirmation, rejeu avec `?forcer=true`.
- **#5** — 400 `ERR-004` si la transition est interdite. `EN_DELIBERE→DELIBERE_VIDE` et
  `DELIBERE_VIDE→EN_COURS` sont **exclues** de cet endpoint (Q-35) : endpoints dédiés du module
  délibéré. `DELIBERE_VIDE` + recours ouvre automatiquement `RECOURS_1`/`RECOURS_2`.
- **#6** — 400 si le dossier n'est pas sensible. Motif obligatoire.
- ⚠ **QF-07** — #2 n'offre ni recherche par référence, ni par client, ni filtre « mes dossiers ».
- ⚠ **QF-08** — aucun filtre sur `sensibiliteStatut` ni file des dérogations en attente.

## 2. Clients

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 9 | GET | `/clients?nom&reference&page&size` | CONS | 19 | F5 | ✅ |
| 10 | GET | `/clients/{id}` | CONS | 20 | F5 | ✅ |
| 11 | GET | `/clients/{clientId}/dossiers` | CONS | 20 | F5 | ✅ |
| 12 | POST | `/clients` | SAI | 21 | F5 | ✅ |

- **#11** — renvoie `{clientId, clientNom, recouvrement[], exploitationLitiges[]}`, indépendant de
  l'affectation du juriste. 404 si le client n'existe pas ; structure vide (200) sinon.
- Pas de `PUT /clients/{id}` — non retenu par le backend (Q-23).

## 3. Audiences et alarmes

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 13 | POST | `/dossiers/{id}/audiences?forcer=` | JUR | 23 | F8 | ❌ |
| 14 | PUT | `/audiences/{id}/compte-rendu` | JUR | 24 | F8 | ❌ |
| 15 | GET | `/audiences/calendrier?periode&dateDebut&format` | JUR, DJ | 22 | F8 | ❌ |
| 16 | POST | `/dossiers/{id}/alarmes` | JUR | 25 | F8 | ❌ |
| 17 | PUT | `/alarmes/{id}/reprogrammer` | JUR | 25 | F8 | ❌ |
| 56 | GET | `/dossiers/{id}/audiences` | CONS | 09 | F8 | ❌ |
| 57 | GET | `/dossiers/{id}/alarmes` | CONS | 11 | F8 | ❌ |

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
| 18 | POST | `/dossiers/{id}/deliberes` | JUR | 26 | F9 | ❌ |
| 19 | POST | `/deliberes/{id}/prorogations` | JUR | 26 | F9 | ❌ |
| 20 | POST | `/deliberes/{id}/rabattement` | JUR | 26 | F9 | ❌ |
| 21 | GET | `/deliberes/{id}/recours` | JUR | 27 | F9 | ❌ |
| 22 | PUT | `/deliberes/{id}/expedition` | JUR | 26 | F9 | ❌ |
| 58 | GET | `/dossiers/{id}/deliberes` | CONS | 10 | F9 | ❌ |

- **#18** — étape `EN_DELIBERE` requise. `dateEcheanceRecours` **obligatoire et postérieure à
  `dateDeliberee`** si `resultat ∈ {DEFAVORABLE, MIXTE}`, **absente sinon** (Q-42). Bascule l'étape
  en `DELIBERE_VIDE`.
- **#19** — **toujours 201**, corps `{...prorogation, compteur, alerte}`. `alerte: true` signale le
  franchissement de `SEUIL_PROROGATIONS` — **ce n'est pas une erreur** (Q-17). Aucune précondition
  de statut d'étape (Q-44).
- **#20** — réservé aux délibérés dont l'étape est encore `DELIBERE_VIDE`. **Motif obligatoire.**
  Ne rouvre jamais l'étape suivante — distinct de l'exercice d'un recours.
- **#21** — strictement consultatif (Q-19) : `{delibereId, dateEcheanceRecours, recoursExerce,
  delaiExpire, cloture}`. Le suivi réel est assuré par un planificateur backend.

## 5. Frais d'avocats

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 23 | POST | `/frais/demandes` | AVOCAT | 30 | **F16** | ❌ |
| 24 | PUT | `/frais/demandes/{id}/conformite` | ASSISTANTE | 29 | F11 | ❌ |
| 25 | PUT | `/frais/demandes/{id}/opportunite` | DJA | 29 | F11 | ❌ |
| 26 | POST | `/frais/demandes/{id}/validation-conjointe` | DJ **et** DJA | 29 | F11 | ❌ |
| 27 | PATCH | `/frais/demandes/{id}/paiement` | ASSISTANTE | 29 | F11 | ❌ |
| 28 | GET | `/frais/demandes?statut&page&size` | AVOCAT, AST, DJA, DJ | 28 | F11 | ❌ |

- **#23** — avocat affecté au dossier requis. `piecesJustificatives` non vide. `referenceFacture`
  **unique tous statuts confondus, y compris `REJETEE`** → 409 `ERR-006`.
- **#24/#25/#26** — motif de rejet **obligatoire** au refus. Statut préalable exigé à chaque étape.
- **#26** — les **deux** accords sont requis pour `VALIDEE` ; **un seul refus** rejette. Un même
  profil ne peut pas voter deux fois.
- **#27** — statut `VALIDEE` requis (400 sinon).
- **#28** — filtré automatiquement sur ses propres demandes pour `ROLE_AVOCAT`, transverse pour les
  profils internes.

## 6. Publications

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 29 | POST | `/publications/cr-audience` | AVOCAT | 33 | **F16** | ❌ |
| 30 | PUT | `/publications/{id}/validation` | ASSISTANTE | 32 | F12 | ❌ |
| 31 | POST | `/publications/autres` *(multipart)* | AVOCAT | 33 | **F16** | ❌ |
| 32 | GET | `/publications/{id}` | CONS | 32 | F12 | ❌ |
| 33 | POST | `/publications/{id}/commentaires` | JURISTE | 32 | F12 | ❌ |
| 34 | POST | `/publications/{id}/correspondance` | DJ, DJA | 32 | F12 | ❌ |
| 59 | GET | `/publications?dossierId&statut&page&size` | AST, JUR, DJ, DJA | 13, 31 | F12 | ❌ |

- **#29** — l'audience doit être **rattachée au dossier** (404 sinon).
- **#30** — chemin **généralisé aux deux sous-types** (Q-55). Motif obligatoire au rejet.
- **#31** — multipart : `dossierId`, `typeDocument ∈ {PIECE, DECISION, CONCLUSION}`,
  `restrictionAcces` (optionnel) en `@RequestParam` ; `file` en `@RequestPart`.
- **#32** — consultable seulement si `VALIDE`. `restrictionAcces` désignant un autre utilisateur →
  **403 `ERR-009`** : écran « accès restreint », pas une erreur technique. `DEPOSE`/`REJETE` → 404.
- **#33** — le juriste **ne commente jamais directement l'avocat** : le commentaire va au DJ/DJA.
- **#34** — correspondance **unique** → 409 si déjà transmise.
- **#59** — n'applique **pas** la restriction d'accès individuelle (métadonnées seulement).

## 7. Constitutions et répertoire

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 35 | POST | `/constitutions/prestataires` | JURISTE | 35 | F12 | ❌ |
| 36 | PUT | `/constitutions/prestataires/{id}/validation` | SH | 35 | F12 | ❌ |
| 37 | GET | `/repertoire/avocats?nom=` | JUR, AST | 34 | F12 | ❌ |
| 60 | GET | `/constitutions/prestataires?statut=` | SH, JURISTE | 35 | F12 | ❌ |
| 61 | POST | `/intervenants` | DJ, DJA | 42 | F5 | ✅ |
| 62 | GET | `/intervenants?type=` | CONS | 06, 42 | F5 | ✅ |

- **#35** — `dossierId`, `prestataireId`, **motif obligatoire**. Notifie les SH.
- **#36** — l'approbation **génère la lettre de constitution** (PDF) et l'attache comme document
  GED. Rejet → motif obligatoire. 409 si la décision est déjà prise.
- **#37** — `indicateurCharge` (dossiers actifs) et `indicateurPerformance` (taux de succès),
  calculés à la demande, **triés par charge croissante**.
- **#61** — un `AVOCAT` exige un `compteKeycloak` **unique** (400 s'il manque, 409 s'il est pris) et
  refuse `notification` ; un `AUTRE_PRESTATAIRE` refuse tout compte. **Ni PUT ni DELETE.**
- **#62** — alimente les sélecteurs d'affectation de l'écran 06 et le cache de résolution des noms.

## 8. Gestion documentaire

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 38 | POST | `/ged/documents` *(multipart)* | SAI | 12 | F10 | ❌ |
| 39 | GET | `/ged/documents/{id}` | CONS | 12 | F10 | ❌ |
| 40 | DELETE | `/ged/documents/{id}` | JUR (202) / DJ, DJA (200) | 12 | F10 | ❌ |
| 41 | PUT | `/ged/documents/{id}/approbation-suppression` | DJ, DJA | 36 | F10 | ❌ |
| 42 | GET | `/ged/rapport-journalier?date=` | JURISTE | 37 | F10 | ❌ |
| 43 | GET | `/dossiers/{id}/documents` | CONS | 12 | F10 | ❌ |
| 63 | GET | `/ged/demandes-suppression?statut=` | DJ, DJA | 36 | F10 | ❌ |

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
| 44 | PUT | `/alertes/seuils` | DJ | 41 | F14 | ❌ |
| 45 | GET | `/alertes/mes-notifications?statut&page&size` | authentifié | 03, **amorçage de session** | F14 | 🟡 **consommé en F2** pour l'amorçage (QF-16) ; l'écran 03 reste à faire |
| 46 | PATCH | `/alertes/{id}/traiter` | destinataire | 03 | F14 | ❌ |
| 47 | GET | `/configurations` | CONS | 41 | F14 | ❌ |
| 48 | PUT | `/configurations/{cle}` | DJ | 41 | F14 | ❌ |
| 49 | GET | `/rapports?type&dateDebut&dateFin&format` | **JURISTE** | 40 | F15 | ❌ |
| 50 | GET | `/tableau-de-bord` | **DJ** | 39 | F15 | ❌ |
| — | WS | `/ws` (STOMP/SockJS) → `/user/queue/alertes` | authentifié | 03 | F14 | ❌ |

- **#44** — `type` doit valoir `CHARGE_MAX_AVOCAT` (400 sinon), `seuil` entier positif.
- **#46** — seul le **destinataire** peut traiter (403 sinon) — vérifié en service, pas par rôle.
- **#49** — **204 si aucune donnée** sur la période : état vide, pas erreur.
  `format ∈ {JSON, PDF, EXCEL, CSV}` ; les trois derniers reviennent en binaire.
- **WS** — jeton dans l'en-tête `Authorization` de la trame STOMP `CONNECT`, **pas** dans la requête
  de négociation SockJS. Push best-effort : **#45 est le repli garanti**.
- ⚠ **QF-04** — #49 est réservé au juriste et #50 au DJ, ce qui contredit le parcours P9 du backend.

## 10. Décisions définitives

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 51 | POST | `/dossiers/{id}/adjudications` | JURISTE | 14 | F13 | ❌ |
| 52 | POST | `/dossiers/{id}/condamnations` | JURISTE | 14 | F13 | ❌ |
| 53 | PATCH | `/condamnations/{id}/statut` | JURISTE | 14 | F13 | ❌ |
| 54 | POST | `/jurisprudences` *(multipart)* | JURISTE | 38 | F13 | ❌ |
| 55 | GET | `/jurisprudences?motCle&natureDecision&juridiction&page&size` | CONS | 38 | F13 | ❌ |

- **#51** — étape `CLOTURE` requise (RG-DEF-01). `reliquat ≥ 0`.
- **#52** — **aucune précondition d'étape** (asymétrie assumée, Q-59).
  `sens ∈ {BANQUE_REDEVABLE, TIERS_REDEVABLE}`.
- **#54** — multipart : `dossierId` (optionnel), `typeArchive`, `motsCles[]`, `natureDecision`,
  `juridiction`, `dateDecision` en `@RequestParam` ; `file` (PDF ≤ 10 Mo) en `@RequestPart`.
- ⚠ **QF-03 — aucun `GET` sur #51/#52.** Une décision créée n'est jamais relisible, et #53 exige un
  identifiant inatteignable après rechargement de page. **Bloque l'écran 14 en lecture.**

## 11. Référentiels et utilisateurs

| # | Méthode | Endpoint | Rôle | Écran | Jalon | Statut |
|---|---|---|---|---|---|---|
| 64 | GET | `/referentiels/natures-dossier?categorie=` | CONS | 06 | F5 | 🟡 service et hook prêts, consommés à l'écran en F6 |
| 65 | GET | `/referentiels/types-client-sensible` | CONS | 06 | F5 | 🟡 service et hook prêts, consommés à l'écran en F6 |
| 66 | GET | `/utilisateurs?profil=&inclureInactifs=` | CONS | 06, 16 | F5 | ✅ consommé par `useLibelles` |

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
| 29 | `POST /publications/cr-audience` | Déposer un compte rendu |
| 31 | `POST /publications/autres` | Déposer une pièce |
| 45 | `GET /alertes/mes-notifications` | Ses notifications |
| 46 | `PATCH /alertes/{id}/traiter` | Traiter une notification |

⚠ **QF-01** — Il ne peut découvrir **ni `dossierId` ni `audienceId`**, pourtant obligatoires dans
les corps de #23 et #29. Il ne peut pas relire ses propres publications (#32 exige `CONSULTATION`)
ni consulter ses lettres de constitution. **Décision actée : le portail Avocat est reporté au
jalon F16**, précédé d'un ajout backend limité à quelques lectures cadrées sur l'avocat connecté.

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
| **Total HTTP exposé par le backend** | **67** (66 numérotés + 1 non numéroté) | **10** |
| Accessibles aux profils internes | 64 | 0 |
| Accessibles au profil avocat | 6 | 0 |
| — dont accessibles **aux deux** | 3 (`#28`, `#45`, `#46`) | 0 |
| — dont **exclusivement** avocat | 3 (`#23`, `#29`, `#31`) — reportés à F16 | — |
| Bloqués par une lacune backend (QF-03) | lecture des décisions définitives | — |
| Canal temps réel (hors décompte HTTP) | 1 (`/ws` STOMP) | 0 |

> Les deux ensembles **se recouvrent** : 64 + 6 ≠ 67. Trois endpoints (`GET /frais/demandes`,
> `GET /alertes/mes-notifications`, `PATCH /alertes/{id}/traiter`) servent les internes **et**
> l'avocat ; seuls trois sont exclusivement avocat.
