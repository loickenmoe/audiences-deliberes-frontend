# SCREEN_MAP

> Les 42 écrans cibles : route, rôles, endpoints consommés, états, avancement.
> Dernière mise à jour : 2026-09-11 (jalon F12 — écrans 13, 31, 32, 34, 35 livrés).
> Précédente : 2026-09-11 (jalon F11 — écrans 28 et 29 livrés).
> Précédente : 2026-09-11 (jalon F10 — écrans 36 et 37 livrés ; l'écran 12 l'était depuis F7).

**Statut** : `❌` non implémenté · `🟡` partiel · `✅` implémenté et validé manuellement

**Rôles** — `JUR` juriste · `DJ` · `DJA` · `AST` assistante · `SH` supérieur hiérarchique ·
`AVO` avocat · `CONS` = les 5 profils internes (`ROLE_CONSULTATION`) · `SAI` = `ROLE_SAISIE`
(composite : JUR, DJ, DJA, AST, SH).

---

## 0. Transverse

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 01 | Connexion | `/login` | — | flux OIDC Keycloak (Authorization Code) | F2 | ✅ |
| 02 | Accueil contextualisé | `/` | tous | selon profil : `/tableau-de-bord` (DJ), files de travail (AST/DJA/SH), `/alertes/mes-notifications` | F2 puis enrichi | 🟡 socle posé (identité, rôles, droits) — cartes métier à venir |
| 03 | Mes notifications | `/notifications` | authentifié | `GET /alertes/mes-notifications`, `PATCH /alertes/{id}/traiter`, canal `/ws` | F14 | ❌ |
| 04 | Non autorisé | `/unauthorized` | tous | — | F2 | ✅ |
| — | Introuvable | `not-found` | tous | — | F1 | ✅ |

> **02 — décision QF-19** : **une seule racine `/` pour tous**, dont le contenu s'adapte au profil.
> Pas de redirection vers des pages différentes selon le rôle : aucun profil interne n'a de métier
> unique — tous portent `ROLE_SAISIE` et `ROLE_CONSULTATION` en plus du leur, y compris le Supérieur
> Hiérarchique (11 capacités sur 36). Rediriger reviendrait à choisir à leur place, et casserait les
> liens profonds que les notifications pointeront vers des dossiers précis.
>
> Contenu cible, enrichi à chaque jalon métier :
>
> | Profil | Cartes de l'accueil | Disponible à partir de |
> |---|---|---|
> | **Juriste** | Ses dossiers · audiences à J-7/J-3/J-1 · délibérés en attente · alarmes échues | F6, F8, F9 |
> | **DJ** | Les 6 indicateurs · sensibilités à valider · dérogations de seuil · validations conjointes | F7, F11, F15 |
> | **DJA** | Contrôles d'opportunité en attente · validations conjointes · sensibilités à valider | F7, F11 |
> | **Assistante** | Frais à contrôler · publications à valider · frais validés à payer | F11, F12 |
> | **SH** | Constitutions à signer · ses dossiers · documents qu'il a chargés | F7, F10, F12 |
> | **Avocat** | Ses demandes de frais · ses publications | F16 |
>
> Posé minimalement en F2 (identité, rôles, droits résolus).

## 1. Dossiers (Épic 1)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 05 | Liste des dossiers | `/dossiers` | CONS | `GET /dossiers?reference&clientId&mesDossiers&nature&categorie&juridiction&page&size` | F6 | ✅ |
| 06 | Création de dossier | `/dossiers/nouveau` | SAI | `POST /dossiers` + 4 référentiels (voir ci-dessous) | F6 | ✅ |
| 07 | Fiche — Synthèse | `/dossiers/[id]` | CONS | `GET /dossiers/{id}` | F7 | ✅ |
| 08 | Fiche — Étapes | onglet | JUR | `PATCH /dossiers/{id}/etapes/{etapeId}/statut`, `POST /dossiers/{id}/etapes` | F7 | ✅ |
| 09 | Fiche — Audiences | onglet | CONS / JUR | `GET /dossiers/{id}/audiences`, `POST /dossiers/{id}/audiences`, `PATCH /audiences/{id}/annulation` | F8 | ✅ (annulation motivée — QF-30) |
| 10 | Fiche — Délibérés | onglet | CONS / JUR | `GET /dossiers/{id}/deliberes`, `POST /dossiers/{id}/deliberes`, `GET /deliberes/{id}/prorogations` | F9 | ✅ (état de chaque délibéré, historique des prorogations — Q-78) |
| 11 | Fiche — Alarmes | onglet | CONS / JUR | `GET /dossiers/{id}/alarmes`, `POST /dossiers/{id}/alarmes`, `PATCH /alarmes/{id}/traiter` | F8 | ✅ (« Marquer traitée » — QF-29) |
| 12 | Fiche — Documents | onglet | CONS / SAI | `GET /dossiers/{id}/documents`, `POST /ged/documents`, `DELETE /ged/documents/{id}` | F7 | ✅ (dépôt, aperçu, téléchargement, suppression — avancé depuis F10) |
| 13 | Fiche — Publications | onglet | AST, JUR, DJ, DJA | `GET /publications?dossierId=` | F12 | ✅ (Assistante : tout ; autres : validées) |
| 14 | Fiche — Décisions définitives | onglet | JUR | `POST .../adjudications`, `POST .../condamnations` — **aucune lecture, cf. QF-03** | F13 | ❌ |
| 15 | Fiche — Historique | onglet | CONS | inclus dans `GET /dossiers/{id}` (`historique[]`) | F7 | ✅ (libellés en français, QF-24) |
| 16 | Modification des affectations | modale | JUR, DJ | `PUT /dossiers/{id}/affectation[?forcer=true]` | F7 | ✅ |
| 17 | Dérogation de seuil | modale | SAI (demande) / DJ, DJA (validation) | `POST /dossiers/{id}/seuil-derogation`, `PUT /dossiers/{id}/seuil-derogation/{auditId}` | F7 | ✅ (arbitrage débloqué par Q-74) |
| 18 | Validation de sensibilité | modale | DJ, DJA | `POST /dossiers/{id}/sensibilite/validation` | F7 | ✅ |

**Référentiels du formulaire 06** : `GET /referentiels/natures-dossier?categorie=`,
`GET /referentiels/types-client-sensible`, `GET /utilisateurs?profil=JURISTE`,
`GET /intervenants?type=AVOCAT`, `GET /clients`.

**Formulaire adaptatif (RG-DOS-02, Q-11)** : les champs conditionnels dépendent de la catégorie
déduite de la nature choisie. `RECOUVREMENT` → `dossierCreditOrigine`, `pvTransfert` ;
`EXPLOITATION_LITIGES` → `incidentCompteReference`, `elementsJustificatifs`.
`juristesAffectes` et `avocatsAffectes` sont **obligatoires et non vides**.

**Cas particuliers** :
- `POST /dossiers` → 409 `ERR-002` si la référence existe déjà.
- `PUT .../affectation` → 409 `ERR-003` : dialogue de confirmation, puis rejeu `?forcer=true`.
- `PATCH .../statut` → 400 `ERR-004` : transition interdite, afficher les états permis.
- Les transitions `EN_DELIBERE→DELIBERE_VIDE` et `DELIBERE_VIDE→EN_COURS` sont **exclues** de
  l'endpoint générique (Q-35 backend) : elles passent par les endpoints dédiés du module délibéré.
- `sensibiliteStatut` est visible dans `GET /dossiers` mais **non filtrable côté serveur** (QF-08).

## 2. Clients (Épic 1 / US 8.6)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 19 | Recherche clients | `/clients` | CONS | `GET /clients?nom&reference&page&size` | F5 | ✅ |
| 20 | Vue consolidée par client | `/clients/[id]` | CONS | `GET /clients/{id}`, `GET /clients/{clientId}/dossiers` | F5 | ✅ |
| 21 | Création client | modale (écran 19) | SAI | `POST /clients` | F5 | ✅ |

> **20** : la réponse regroupe les dossiers en `{recouvrement[], exploitationLitiges[]}` et est
> **indépendante de l'affectation du juriste**. Structure vide (200) si aucun dossier.

## 3. Audiences (Épic 2)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 22 | Calendrier des audiences | `/audiences/calendrier` | JUR, DJ | `GET /audiences/calendrier?periode&dateDebut&format` | F8 | ✅ (agenda par jour, exports PDF et Excel) |
| 23 | Planifier une audience | modale (fiche 09) | JUR | `POST /dossiers/{id}/audiences[?forcer=true]` | F8 | ✅ (doublon confirmable, ERR-005) |
| 24 | Saisie du compte rendu | modale | JUR | `PUT /audiences/{id}/compte-rendu` | F8 | ✅ (proposé à partir du jour de l'audience) |
| 25 | Créer / reprogrammer une alarme | modale (fiche 11) | JUR | `POST /dossiers/{id}/alarmes`, `PUT /alarmes/{id}/reprogrammer` | F8 | ✅ |

**Règles à porter dans l'UI** : étape au statut `EN_COURS` requise pour planifier · date future
obligatoire · doublon (même étape + même date) → 409 `ERR-005` confirmable · compte rendu refusé sur
une audience future, non vide obligatoire · vues `HEBDOMADAIRE`/`MENSUELLE`/`TRIMESTRIELLE`, export
`JSON`/`PDF`/`EXCEL`.

## 4. Délibérés (Épic 3)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 26 | Enregistrer / proroger / rabattre / expédition | modales (fiche 10) | JUR | `POST /dossiers/{id}/deliberes`, `PUT /deliberes/{id}/resultat`, `POST /deliberes/{id}/prorogations`, `POST /deliberes/{id}/rabattement`, `PUT /deliberes/{id}/expedition` | F9 | ✅ (mise en délibéré, décision, prorogation — seuil en avertissement —, rabattement) |
| 27 | Suivi du délai de recours | panneau (fiche 10) | JUR | `GET /deliberes/{id}/recours` | F9 | ✅ |

**Règles** : étape `EN_DELIBERE` requise · `dateEcheanceRecours` **obligatoire et postérieure** si
`resultat ∈ {DEFAVORABLE, MIXTE}`, **absente sinon** (Q-42) · prorogation **toujours 201**, corps
`{..., alerte: boolean}` — `alerte:true` signale le franchissement du seuil, ce n'est pas une erreur
(Q-17) · rabattement réservé aux étapes `DELIBERE_VIDE`, **motif obligatoire** · `GET .../recours`
est strictement consultatif (Q-19) · `statutExpedition ∈ {A_LEVER, LEVEE}`.

## 5. Frais d'avocats (Épic 4)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 28 | File des demandes | `/frais` | AVO, AST, DJA, DJ | `GET /frais/demandes?statut&page&size` | F11 | ✅ (vue par défaut selon le profil, vue dans l'URL) |
| 29 | Détail et action de circuit | `/frais/[id]` | selon l'étape | `GET /frais/demandes/{id}` (Q-82), `PUT .../conformite` (AST), `PUT .../opportunite` (DJA), `POST .../validation-conjointe` (DJ+DJA), `PATCH .../paiement` (AST) | F11 | ✅ (règle RG-INT-03 expliquée, décisions nommées, une seule action par profil et par étape) |
| 30 | Déposer une demande | `/frais/nouvelle` | AVO | `POST /frais/demandes` | **F16** | ❌ |

**Circuit** : `DEPOSEE → CONFORMITE → [OPPORTUNITE] → VALIDEE → PAYEE`, avec `REJETEE` terminal
depuis n'importe quelle étape. La validation conjointe DJ **et** DJA n'est requise que si
`estSensible = true` **ou** `montant > seuilMontant`. Seuil = `dossier.seuilMontant` si
`seuilOrigine = DEROGATION`, sinon `SEUIL_MONTANT_DEFAUT` (50 000 000 FCFA).

**Règles UI** : motif de rejet obligatoire à chaque étape · `referenceFacture` unique tous statuts
confondus, y compris rejetés → 409 `ERR-006` · `GET /frais/demandes` est automatiquement filtré sur
ses propres demandes pour un avocat · les deux accords sont requis, un seul refus rejette.

## 6. Publications et intervenants (Épic 5)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 31 | File des publications | `/publications` | AST, JUR, DJ, DJA | `GET /publications?dossierId&statut&page&size` | F12 | ✅ (Assistante : à valider, validées, rejetées ; autres : validées) |
| 32 | Détail, commentaire, correspondance | `/publications/[id]` | CONS / JUR / DJ, DJA | `GET /publications/{id}`, `PUT /publications/{id}/validation` (AST), `POST /publications/{id}/commentaires` (JUR), `POST /publications/{id}/correspondance` (DJ, DJA) | F12 | ✅ (fichier consultable, accès restreint en écran dédié, correspondance unique — Q-86) |
| 33 | Dépôt de compte rendu / pièce | `/publications/nouvelle` | AVO | `POST /publications/cr-audience` (texte), `POST /publications/autres` (fichier) — ⚠ **QF-20** : pas de compte rendu en pièce jointe | **F16** | ❌ |
| 34 | Répertoire des avocats | `/repertoire/avocats` | JUR, AST | `GET /repertoire/avocats?nom=` | F12 | ✅ (trié par charge croissante, recherche par nom) |
| 35 | Constitutions à signer | `/constitutions` | SH, JUR | `GET /constitutions/prestataires?statut=`, `POST /constitutions/prestataires` (JUR, modale de la fiche 07), `PUT /constitutions/prestataires/{id}/validation` (SH) | F12 | ✅ (lettre consultable depuis la ligne, nommée — Q-86) |

**Règles** : `statut=DEPOSE` alimente la file de l'assistante · `GET /publications/{id}` renvoie 403
`ERR-009` si `restrictionAcces` désigne un autre utilisateur — traiter comme un écran « accès
restreint », pas comme une erreur technique · une publication `DEPOSE` ou `REJETE` renvoie 404 ·
**un juriste ne commente jamais directement l'avocat** : son commentaire va au DJ/DJA (RG-INT-07),
qui transmet une correspondance **unique** (409 si déjà transmise) · la liste 31 n'applique pas la
restriction d'accès individuelle (métadonnées seulement) · l'approbation d'une constitution génère
la lettre PDF et l'attache à la GED · un `AUTRE_PRESTATAIRE` n'a pas de compte et ne reçoit aucune
notification applicative (Q-52).

## 7. Gestion documentaire (Épic 6)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 36 | Demandes de suppression | `/ged/demandes-suppression` | DJ, DJA | `GET /ged/demandes-suppression?statut=`, `PUT /ged/documents/{id}/approbation-suppression` | F10 | ✅ (fichier et dossier nommés, aperçu, rejet motivé, historique — Q-79) |
| 37 | Rapport journalier | `/ged/rapport-journalier` | JUR, DJ, DJA, AST | `GET /ged/rapport-journalier?date=` | F10 | ✅ (état vide explicite ; ouvert à 4 profils — Q-80) |

**`DELETE /ged/documents/{id}` a deux comportements** selon le profil résolu côté serveur :
**202** pour le juriste auteur du chargement (demande créée, document intact), **200** pour DJ/DJA
(suppression immédiate). 409 si une demande est déjà en attente, 403 pour un juriste non auteur.
L'interface doit interpréter le code de retour, pas le rôle local.

**Contraintes de dépôt** : formats `PDF, PNG, JPG, TXT, XLSX` (dérivés de l'extension, pas du
`Content-Type`), poids ≤ 10 Mo → 400 `ERR-008`. `typeDocument` est un texte libre (Q-45).
`urlTelechargement` est une URL MinIO pré-signée (cf. RF-01/QF-06).

## 8. Décisions définitives et jurisprudence (Épic 8)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 14 | Décisions du dossier | onglet (fiche) | JUR | `POST /dossiers/{id}/adjudications`, `POST /dossiers/{id}/condamnations`, `PATCH /condamnations/{id}/statut` | F13 | ❌ |
| 38 | Base jurisprudentielle | `/jurisprudences` | CONS / JUR | `GET /jurisprudences?motCle&natureDecision&juridiction&page&size`, `POST /jurisprudences` | F13 | ❌ |

> ⚠ **QF-03 — bloquant fonctionnel.** Il n'existe **aucun `GET`** sur les adjudications ni les
> condamnations. L'écran « Suivi des condamnations » prévu par `FUNCTIONAL_MAP.md` §8 n'a pas de
> source, et `PATCH /condamnations/{id}/statut` exige un identifiant que l'interface ne peut obtenir
> qu'en mémoire, juste après la création. L'onglet 14 restera en écriture seule tant que ce point
> n'est pas tranché.

**Règles** : adjudication → étape `CLOTURE` requise (RG-DEF-01), `reliquat ≥ 0` · condamnation →
**aucune précondition d'étape** (asymétrie assumée, Q-59), `sens ∈ {BANQUE_REDEVABLE,
TIERS_REDEVABLE}` · jurisprudence → indexation obligatoire (mots-clés, nature, juridiction, date),
PDF ≤ 10 Mo, `dossierId` optionnel · aucune bascule automatique vers `ARCHIVE` (Q-60), la
transition reste manuelle via l'endpoint générique d'étape.

## 9. Pilotage (Épic 8)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 39 | Tableau de bord exécutif | `/tableau-de-bord` | **DJ seul** | `GET /tableau-de-bord` | F15 | ❌ |
| 40 | Générer un rapport d'activité | `/rapports` | **JUR seul** | `GET /rapports?type&dateDebut&dateFin&format` | F15 | ❌ |

> ⚠ **QF-04** — le parcours P9 du backend décrit « le DJ consulte le tableau de bord **puis génère
> des rapports** », mais les rôles implémentés séparent les deux. À trancher avant F15.

**39** — 6 indicateurs temps réel : `nbDossiersActifs`, `nbAudiencesPlanifiees`,
`nbDemandesFraisEnAttente`, `nbProrogationsAlerte`, `tauxSuccesRecouvrement`, `provisionsReprises`.
**40** — `type ∈ {JOURNALIER…ANNUEL}`, `format ∈ {JSON, PDF, EXCEL, CSV}`, **204 si aucune donnée**
sur la période : traiter comme un état vide, pas comme une erreur.

## 10. Administration (Épic 7)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 41 | Configurations et seuils | `/admin/configurations` | lecture CONS / écriture DJ | `GET /configurations`, `PUT /configurations/{cle}`, `PUT /alertes/seuils` | F14 | ❌ |
| 42 | Référentiel des intervenants | `/admin/intervenants` | DJ, DJA (écriture) / CONS (lecture) | `GET /intervenants?type=`, `POST /intervenants` | F5 | ✅ |

**41** — clés `CONF01` à `CONF07` : `SEUIL_MONTANT_DEFAUT`, `SEUIL_PROROGATIONS`,
`CANAUX_NOTIFICATION_DEFAUT`, `DELAI_VALIDATION_CONJOINTE`, `TAILLE_MAX_GED`, `FORMATS_GED`.
`PUT /alertes/seuils` n'accepte que `type = CHARGE_MAX_AVOCAT` et délègue en interne à
`PUT /configurations/{cle}`.

**42** — un `AVOCAT` exige un `compteKeycloak` **unique** (400 s'il manque, 409 s'il est pris) et
refuse le champ `notification` ; un `AUTRE_PRESTATAIRE` refuse tout compte applicatif. **Ni
modification ni suppression** : non demandées par les user stories. Cet écran est indispensable en
F5 — sans lui, aucun avocat n'existe, et `avocatsAffectes` est obligatoire à la création d'un
dossier.

---

## Récapitulatif par jalon

| Jalon | Écrans | Total |
|---|---|---|
| F1 | introuvable | 1 |
| F2 | 01, 02, 04 | 3 |
| F5 | 19, 20, 21, 42 | 4 |
| F6 | 05, 06 | 2 |
| F7 | 07, 08, 15, 16, 17, 18 | 6 |
| F8 | 09, 11, 22, 23, 24, 25 | 6 |
| F9 | 10, 26, 27 | 3 |
| F10 | 12, 36, 37 | 3 |
| F11 | 28, 29 | 2 |
| F12 | 13, 31, 32, 34, 35 | 5 |
| F13 | 14, 38 | 2 |
| F14 | 03, 41 | 2 |
| F15 | 39, 40 | 2 |
| F16 | 30, 33 | 2 |
| | **Total** | **43 entrées / 42 écrans numérotés** — la 43e est `not-found` (F1), non numérotée |
