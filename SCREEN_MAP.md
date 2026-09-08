# SCREEN_MAP

> Les 42 écrans cibles : route, rôles, endpoints consommés, états, avancement.
> Dernière mise à jour : 2026-09-08 (jalon F2 — écrans 01 et 04 livrés, 02 en socle).

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

> **02** : l'accueil n'est pas un écran unique mais un assemblage de cartes filtrées par rôle. Il
> est posé minimalement en F2 et enrichi à chaque jalon métier.

## 1. Dossiers (Épic 1)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 05 | Liste des dossiers | `/dossiers` | CONS | `GET /dossiers?nature&categorie&juridiction&page&size` | F6 | ❌ |
| 06 | Création de dossier | `/dossiers/nouveau` | SAI | `POST /dossiers` + 4 référentiels (voir ci-dessous) | F6 | ❌ |
| 07 | Fiche — Synthèse | `/dossiers/[id]` | CONS | `GET /dossiers/{id}` | F7 | ❌ |
| 08 | Fiche — Étapes | onglet | JUR | `PATCH /dossiers/{id}/etapes/{etapeId}/statut`, `POST /dossiers/{id}/etapes` | F7 | ❌ |
| 09 | Fiche — Audiences | onglet | CONS / JUR | `GET /dossiers/{id}/audiences`, `POST /dossiers/{id}/audiences` | F8 | ❌ |
| 10 | Fiche — Délibérés | onglet | CONS / JUR | `GET /dossiers/{id}/deliberes`, `POST /dossiers/{id}/deliberes` | F9 | ❌ |
| 11 | Fiche — Alarmes | onglet | CONS / JUR | `GET /dossiers/{id}/alarmes`, `POST /dossiers/{id}/alarmes` | F8 | ❌ |
| 12 | Fiche — Documents | onglet | CONS / SAI | `GET /dossiers/{id}/documents`, `POST /ged/documents`, `DELETE /ged/documents/{id}` | F10 | ❌ |
| 13 | Fiche — Publications | onglet | AST, JUR, DJ, DJA | `GET /publications?dossierId=` | F12 | ❌ |
| 14 | Fiche — Décisions définitives | onglet | JUR | `POST .../adjudications`, `POST .../condamnations` — **aucune lecture, cf. QF-03** | F13 | ❌ |
| 15 | Fiche — Historique | onglet | CONS | inclus dans `GET /dossiers/{id}` (`historique[]`) | F7 | ❌ |
| 16 | Modification des affectations | modale | JUR, DJ | `PUT /dossiers/{id}/affectation[?forcer=true]` | F7 | ❌ |
| 17 | Dérogation de seuil | modale | SAI (demande) / DJ, DJA (validation) | `POST /dossiers/{id}/seuil-derogation`, `PUT /dossiers/{id}/seuil-derogation/{auditId}` | F7 | ❌ |
| 18 | Validation de sensibilité | modale | DJ, DJA | `POST /dossiers/{id}/sensibilite/validation` | F7 | ❌ |

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
| 19 | Recherche clients | `/clients` | CONS | `GET /clients?nom&reference&page&size` | F5 | ❌ |
| 20 | Vue consolidée par client | `/clients/[id]` | CONS | `GET /clients/{id}`, `GET /clients/{clientId}/dossiers` | F5 | ❌ |
| 21 | Création client | modale | SAI | `POST /clients` | F5 | ❌ |

> **20** : la réponse regroupe les dossiers en `{recouvrement[], exploitationLitiges[]}` et est
> **indépendante de l'affectation du juriste**. Structure vide (200) si aucun dossier.

## 3. Audiences (Épic 2)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 22 | Calendrier des audiences | `/audiences/calendrier` | JUR, DJ | `GET /audiences/calendrier?periode&dateDebut&format` | F8 | ❌ |
| 23 | Planifier une audience | modale (fiche 09) | JUR | `POST /dossiers/{id}/audiences[?forcer=true]` | F8 | ❌ |
| 24 | Saisie du compte rendu | modale | JUR | `PUT /audiences/{id}/compte-rendu` | F8 | ❌ |
| 25 | Créer / reprogrammer une alarme | modale (fiche 11) | JUR | `POST /dossiers/{id}/alarmes`, `PUT /alarmes/{id}/reprogrammer` | F8 | ❌ |

**Règles à porter dans l'UI** : étape au statut `EN_COURS` requise pour planifier · date future
obligatoire · doublon (même étape + même date) → 409 `ERR-005` confirmable · compte rendu refusé sur
une audience future, non vide obligatoire · vues `HEBDOMADAIRE`/`MENSUELLE`/`TRIMESTRIELLE`, export
`JSON`/`PDF`/`EXCEL`.

## 4. Délibérés (Épic 3)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 26 | Enregistrer / proroger / rabattre / expédition | modales (fiche 10) | JUR | `POST /dossiers/{id}/deliberes`, `POST /deliberes/{id}/prorogations`, `POST /deliberes/{id}/rabattement`, `PUT /deliberes/{id}/expedition` | F9 | ❌ |
| 27 | Suivi du délai de recours | panneau (fiche 10) | JUR | `GET /deliberes/{id}/recours` | F9 | ❌ |

**Règles** : étape `EN_DELIBERE` requise · `dateEcheanceRecours` **obligatoire et postérieure** si
`resultat ∈ {DEFAVORABLE, MIXTE}`, **absente sinon** (Q-42) · prorogation **toujours 201**, corps
`{..., alerte: boolean}` — `alerte:true` signale le franchissement du seuil, ce n'est pas une erreur
(Q-17) · rabattement réservé aux étapes `DELIBERE_VIDE`, **motif obligatoire** · `GET .../recours`
est strictement consultatif (Q-19) · `statutExpedition ∈ {A_LEVER, LEVEE}`.

## 5. Frais d'avocats (Épic 4)

| # | Écran | Route | Rôles | Endpoints | Jalon | Statut |
|---|---|---|---|---|---|---|
| 28 | File des demandes | `/frais` | AVO, AST, DJA, DJ | `GET /frais/demandes?statut&page&size` | F11 | ❌ |
| 29 | Détail et action de circuit | `/frais/[id]` | selon l'étape | `PUT .../conformite` (AST), `PUT .../opportunite` (DJA), `POST .../validation-conjointe` (DJ+DJA), `PATCH .../paiement` (AST) | F11 | ❌ |
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
| 31 | File des publications | `/publications` | AST, JUR, DJ, DJA | `GET /publications?dossierId&statut&page&size` | F12 | ❌ |
| 32 | Détail, commentaire, correspondance | `/publications/[id]` | CONS / JUR / DJ, DJA | `GET /publications/{id}`, `PUT /publications/{id}/validation` (AST), `POST /publications/{id}/commentaires` (JUR), `POST /publications/{id}/correspondance` (DJ, DJA) | F12 | ❌ |
| 33 | Dépôt de compte rendu / pièce | `/publications/nouvelle` | AVO | `POST /publications/cr-audience`, `POST /publications/autres` | **F16** | ❌ |
| 34 | Répertoire des avocats | `/repertoire/avocats` | JUR, AST | `GET /repertoire/avocats?nom=` | F12 | ❌ |
| 35 | Constitutions à signer | `/constitutions` | SH, JUR | `GET /constitutions/prestataires?statut=`, `POST /constitutions/prestataires` (JUR), `PUT /constitutions/prestataires/{id}/validation` (SH) | F12 | ❌ |

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
| 36 | Demandes de suppression | `/ged/demandes-suppression` | DJ, DJA | `GET /ged/demandes-suppression?statut=`, `PUT /ged/documents/{id}/approbation-suppression` | F10 | ❌ |
| 37 | Rapport journalier | `/ged/rapport-journalier` | JUR | `GET /ged/rapport-journalier?date=` | F10 | ❌ |

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
| 42 | Référentiel des intervenants | `/admin/intervenants` | DJ, DJA (écriture) / CONS (lecture) | `GET /intervenants?type=`, `POST /intervenants` | F5 | ❌ |

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
