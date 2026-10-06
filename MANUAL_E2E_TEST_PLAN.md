# Recette fonctionnelle manuelle - parcours de bout en bout

> Document de campagne. Il s'exécute écran en main, du haut vers le bas.
> Établi le 2026-09-23 par analyse conjointe du frontend (`audiences-deliberes-frontend`) et du
> backend (`audiences-deliberes-backend`), de leurs documents de conception et de leurs tests.
> **Rien n'y est supposé** : chaque libellé, chaque règle et chaque statut cité a été relevé dans le
> code ou dans la documentation des deux dépôts.

---

# 1. Objectif de la recette

Vérifier que l'application **Audiences & délibérés** fonctionne de bout en bout, telle qu'un
utilisateur métier l'emploiera, avant sa remise à la Direction Juridique.

Ce que cette recette vérifie :

- qu'un processus métier complet aboutit, du premier geste au résultat final, **en traversant
  plusieurs rôles** quand le processus l'exige ;
- que les **changements d'état** annoncés se produisent réellement et se voient à l'écran ;
- que les **droits** sont tenus : ce qui est interdit à un profil l'est aussi par l'URL directe ;
- que les **contrôles métier** refusent ce qu'ils doivent refuser, avec un message compréhensible ;
- que les **écrans restent cohérents entre eux** : ce qu'un rôle produit, l'autre le voit.

Ce que cette recette ne fait pas : tester des endpoints isolément, remplacer les suites automatisées
(678 tests backend, 366 tests unitaires frontend, 173 parcours Playwright), ni juger la performance
autrement que par le ressenti d'usage.

**Comment s'en servir.** Chaque fiche est autonome et indique ses préconditions. Remplissez la
colonne *Résultat obtenu* et le *Statut* au fil de l'eau, puis reportez le total dans la synthèse
finale (§9). Un écart se note tel qu'il est observé, sans interprétation : c'est l'équipe technique
qui tranchera s'il s'agit d'un défaut ou d'un comportement voulu.

---

# 2. Environnement de test

| Élément | Valeur |
|---|---|
| Application (frontend) | **http://localhost:3000** |
| API (backend) | **http://localhost:8080/api/v1** |
| Authentification | Keycloak, realm `audiences-realm`, **http://localhost:8081** |
| Base de données | PostgreSQL (conteneur, port 5433) |
| Stockage des pièces | MinIO (conteneur, ports 9000 et 9001) |
| Langues | Français par défaut, bascule `FR` / `EN` en haut à droite |

**Les deux serveurs sont déjà démarrés.** Aucune procédure de démarrage n'est nécessaire pour cette
recette : ouvrez simplement http://localhost:3000 dans le navigateur.

### Prérequis matériels et données

- Un navigateur de bureau. Pour les parcours multi-rôles, prévoyez **deux fenêtres de navigation
  privée distinctes** (ou deux navigateurs) : deux rôles ne peuvent pas partager la même session.
- De quoi charger des fichiers : un **PDF de moins de 10 Mo**, une **image PNG ou JPG** et un
  **document Word `.docx`**. Formats admis en GED : `PDF, PNG, JPG, TXT, XLSX, DOCX, DOC` - le
  format est déduit de **l'extension**, pas du type déclaré. Poids maximal : 10 Mo.
- Au moins **un client** et **un avocat** doivent exister dans le référentiel. S'ils manquent, la
  fiche REC-E2E-002 les crée : exécutez-la en premier.

### Point important sur les notifications

L'interrupteur `NOTIFICATION_ENGINE_ACTIF` du backend est positionné à **`false`**. Pendant cette
recette :

- les **alertes applicatives** (cloche, écran *Notifications*) fonctionnent normalement : ce sont
  elles que les fiches vérifient ;
- **aucun courriel, SMS, message Teams ou WhatsApp ne part réellement.** Les notifications externes
  sont seulement journalisées. C'est voulu : ne notez pas l'absence de courriel comme un échec ;
- la supervision des notifications externes reste vérifiable (REC-E2E-023) : elle affiche alors un
  bandeau indiquant que le moteur est désactivé.

---

# 3. Comptes et rôles de test

Tous les comptes utilisent le mot de passe **`Password1!`**. Les comptes vivent dans Keycloak :
l'application n'en crée, n'en modifie et n'en supprime aucun.

| Identifiant | Profil | Rôles portés | Responsabilité dans les workflows |
|---|---|---|---|
| `juriste.test` | Juriste (JUR) | `ROLE_JURISTE`, `ROLE_SAISIE`, `ROLE_CONSULTATION` | Ouvre les dossiers, affecte, gère étapes, audiences, délibérés, décisions ; sollicite les constitutions ; commente les publications ; demande les suppressions de documents |
| `dj.test` | Directeur Juridique (DJ) | `ROLE_DJ` (+ `ROLE_JURISTE`, `ROLE_SAISIE`), `ROLE_CONSULTATION` | Arbitre la diligence particulière et dérogations ; valide conjointement les frais ; transmet les correspondances ; arbitre les suppressions ; règle les paramètres système et la grille de notifications ; tableau de bord et audit |
| `dja.test` | Directeur Juridique Adjoint (DJA) | `ROLE_DJA` (+ `ROLE_JURISTE`, `ROLE_SAISIE`), `ROLE_CONSULTATION` | Contrôle d'opportunité des frais ; validation conjointe ; mêmes arbitrages que le DJ sauf mention contraire |
| `assistante.test` | Assistante (AST) | `ROLE_ASSISTANTE`, `ROLE_SAISIE`, `ROLE_CONSULTATION` | Contrôle de conformité des frais, enregistrement des paiements, validation des publications |
| `sh.test` | Supérieur Hiérarchique (SH) | `ROLE_SH`, `ROLE_SAISIE`, `ROLE_CONSULTATION` | Signe les constitutions de prestataires |
| `avocat.test` | Avocat (AVO) | `ROLE_AVOCAT` | Utilisateur **externe** : dépose ses demandes de frais et ses publications, consulte son espace. Ne voit que les dossiers auxquels il est affecté |

**Rattachement de l'avocat.** Le compte `avocat.test` doit correspondre à une fiche du référentiel
des intervenants dont le champ *Identifiant de connexion* vaut exactement `avocat.test` (fiche
« Me Claire Avocat » dans le jeu de recette). Sans ce rattachement, le portail affiche « … pas encore
rattaché au répertoire » - comportement attendu, vérifié en REC-NEG-010.

**Deux règles de droits à garder en tête** (elles expliquent beaucoup de comportements) :

- `ROLE_CONSULTATION` et `ROLE_SAISIE` sont portés par les cinq profils internes. L'avocat n'a ni
  l'un ni l'autre : c'est ce qui le cloisonne.
- Le DJ et la DJA **portent aussi `ROLE_JURISTE`** : ils accèdent donc aux écrans réservés au
  juriste, par exemple le rapport d'activité. Ce n'est pas un défaut de droits.

**Une conséquence de l'architecture, à connaître avant de s'en étonner** : un utilisateur interne
qui ne s'est **jamais connecté** n'existe pas encore dans l'application et n'apparaît donc pas dans
les listes d'affectation. Les avocats, eux, sont affectables dès leur inscription au répertoire.

---

# 4. Matrice des recettes

Statuts : ☐ À tester · ☑ Validé · ✗ Échec · ⚠ Bloqué

| ID | Workflow | Rôle(s) | Priorité | Préconditions | Statut |
|---|---|---|---|---|---|
| REC-E2E-001 | Connexion, accueil contextualisé, langue, déconnexion | Tous | Haute | Aucune | ☐ |
| REC-E2E-002 | Référentiel : créer un client et un intervenant | DJ | Haute | Aucune | ☐ |
| REC-E2E-003 | Ouvrir un dossier de recouvrement, affecter, joindre les pièces | JUR | Haute | REC-E2E-002 | ☐ |
| REC-E2E-004 | Dossier à diligence particulière : arbitrage de la diligence | JUR → DJ | Haute | Un client existant | ☐ |
| REC-E2E-005 | Dérogation de seuil : demande et arbitrage | JUR → DJ | Moyenne | REC-E2E-004 | ☐ |
| REC-E2E-006 | Cycle d'audience : planifier, doublon, annuler, compte rendu | JUR | Haute | REC-E2E-003 | ☐ |
| REC-E2E-007 | Alarmes : créer, reprogrammer, marquer traitée | JUR | Moyenne | REC-E2E-003 | ☐ |
| REC-E2E-008 | Calendrier des audiences et exports PDF / Excel | JUR | Moyenne | REC-E2E-006 | ☐ |
| REC-E2E-009 | Délibéré : mise en délibéré, prorogation, décision, recours | JUR (+ DJ) | Haute | REC-E2E-006 | ☐ |
| REC-E2E-010 | Rabattement d'un délibéré et reprise des audiences | JUR | Moyenne | REC-E2E-009 | ☐ |
| REC-E2E-011 | Frais : circuit simple, du dépôt au paiement | AVO → AST → DJA → AST | Haute | REC-E2E-003 | ☐ |
| REC-E2E-012 | Frais : validation conjointe DJ + DJA au-delà du seuil | AVO → AST → DJA → DJ+DJA → AST | Haute | REC-E2E-003 | ☐ |
| REC-E2E-013 | Frais : rejet motivé et retour à l'avocat | AVO → AST | Haute | REC-E2E-011 | ☐ |
| REC-E2E-014 | Publication : compte rendu déposé, validé, puis lu | AVO → AST → JUR | Haute | REC-E2E-006 | ☐ |
| REC-E2E-015 | Commentaire du juriste puis correspondance unique | JUR → DJ | Moyenne | REC-E2E-014 | ☐ |
| REC-E2E-016 | Constitution d'un prestataire : sollicitation, lettre, signature | JUR → SH | Haute | REC-E2E-003 | ☐ |
| REC-E2E-017 | GED : dépôt, aperçu, demande de suppression, arbitrage | JUR → DJ | Haute | REC-E2E-003 | ☐ |
| REC-E2E-018 | Rapport journalier GED | AST ou JUR | Basse | REC-E2E-017 | ☐ |
| REC-E2E-019 | Décisions définitives : adjudication et condamnation | JUR | Moyenne | Une étape au statut `CLOTURE` | ☐ |
| REC-E2E-027 | Les deux pourvois : Cour Suprême et CCJA sur le même dossier | JUR | Moyenne | REC-E2E-003 | ☐ |
| REC-E2E-028 | Journal des audiences et comptes rendus attendus | JUR → DJ | Haute | REC-E2E-006 | ☐ |
| REC-E2E-029 | Filtrer et trier la liste des dossiers | JUR | Haute | REC-E2E-006 | ☐ |
| REC-E2E-030 | Relance de l'avocat dont le compte rendu manque | DJ, JUR, AVO | Haute | REC-E2E-003 | ☐ |
| REC-E2E-031 | Référentiel des agences : chercher, créer, corriger, fermer | DJ (+ JUR) | Haute | Aucune | ☐ |
| REC-E2E-032 | Diligence particulière révisée après l'ouverture : proposée, arbitrée, retirée | JUR → DJ → DJA | Haute | REC-E2E-003 | ☐ |
| REC-E2E-020 | Jurisprudence : archiver, rechercher, consulter | JUR | Moyenne | REC-E2E-019 | ☐ |
| REC-E2E-021 | Pilotage : tableau de bord, rapport, seuils | DJ | Haute | Données des fiches précédentes | ☐ |
| REC-E2E-022 | Notifications applicatives : temps réel et supervision | JUR + DJ | Haute | REC-E2E-011 | ☐ |
| REC-E2E-023 | Notifications externes : grille, supervision, relance | DJ | Moyenne | Aucune | ☐ |
| REC-E2E-024 | Audit : consultation, extraction scellée, vérification | DJ | Moyenne | Activité des fiches précédentes | ☐ |
| REC-E2E-025 | Portail avocat : périmètre et cloisonnement | AVO | Haute | REC-E2E-011 | ☐ |
| REC-E2E-026 | Vue consolidée d'un client | JUR ou DJ | Basse | REC-E2E-003 | ☐ |

**Ordre conseillé** : 001 → 002 → 003, puis la matrice dans l'ordre. Les fiches 004 à 026
s'appuient sur les données créées par les trois premières.

---

# 5. Recettes End-to-End détaillées

> **Convention.** Les libellés entre guillemets sont ceux de l'interface en français.
>
> **Les références sont attribuées par le système** depuis le 2026-09-29 : vous ne les saisissez
> plus. À chaque création, le message de confirmation la nomme - « Dossier DOS-2026-0007 créé. » -
> et c'est cette valeur qu'il faut **noter au passage** : les fiches suivantes en auront besoin.
>
> Les identifiants du type `DOS-REC-003` ou `CLI-REC-001` employés dans ce document **ne sont plus
> des références à saisir** : ce sont des noms de commodité désignant l'objet créé par la fiche de
> même numéro. Là où une fiche vous demande de rechercher `DOS-REC-003`, cherchez la référence que
> le système a attribuée au dossier de REC-E2E-003.

## REC-E2E-001 - Connexion, accueil, langue et déconnexion

### Objectif
Valider l'entrée dans l'application pour chaque profil, l'adaptation de l'accueil au rôle, la
bascule de langue et la fermeture complète de la session.

### Acteurs
Les six profils, l'un après l'autre.

### Préconditions
Aucune. L'application répond sur http://localhost:3000.

### Données de test
Les six comptes du §3, mot de passe `Password1!`.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | - | Ouvrir http://localhost:3000 sans être connecté | Redirection vers l'écran de connexion `/login` | | ☐ |
| 2 | - | Saisir l'identifiant `juriste.test`, un **mot de passe faux**, cliquer « Connexion » | Refus. Le message **ne dit pas** si le compte existe | | ☐ |
| 3 | JUR | Saisir `juriste.test` / `Password1!`, cliquer « Connexion » | Arrivée sur l'accueil `/` | | ☐ |
| 4 | JUR | Lire le bloc « Ce qui vous attend » | Cartes propres au juriste (ses dossiers, audiences proches, délibérés, alarmes) avec un compteur par file | | ☐ |
| 5 | JUR | Lire le bloc « Rôles de votre compte » en bas d'écran | `ROLE_JURISTE`, `ROLE_SAISIE`, `ROLE_CONSULTATION` | | ☐ |
| 6 | JUR | Cliquer le bouton `EN` en haut à droite | Toute l'interface passe en anglais (« Cases », « Dashboard »…) ; revenir en `FR` | | ☐ |
| 7 | JUR | Cliquer « Se déconnecter » | Retour à l'écran de connexion | | ☐ |
| 8 | JUR | Cliquer la **flèche Retour** du navigateur | On **ne revient pas** dans l'application : l'écran de connexion reste affiché | | ☐ |
| 9 | DJ | Se connecter avec `dj.test` | L'accueil montre les files du DJ (diligences particulières, dérogations, validations conjointes, suppressions) ; le menu contient « Tableau de bord », « Configuration », « Audit », « Intervenants » | | ☐ |
| 10 | AST | Se connecter avec `assistante.test` | Files « Frais à contrôler », publications à valider, frais à payer. **Pas** de « Tableau de bord » ni d'« Audit » dans le menu | | ☐ |
| 11 | SH | Se connecter avec `sh.test` | File « Constitutions à signer » ; menu réduit | | ☐ |
| 12 | AVO | Se connecter avec `avocat.test` | Menu **externe** : « Mon espace », « Déposer une demande », « Déposer une publication ». Aucun menu interne (Dossiers, Clients, Calendrier…) | | ☐ |

### Résultat final attendu
Chaque profil entre dans l'application, voit un accueil conforme à sa charge de travail, et sa
déconnexion ferme réellement la session.

### Points de contrôle
- Le message d'échec de connexion ne distingue jamais « compte inconnu » de « mot de passe faux ».
- La cloche de notifications est visible sur toutes les pages, pour tous les profils connectés.
- Le menu n'affiche que les entrées permises par le profil : c'est le premier contrôle de droits.

---

## REC-E2E-002 - Référentiel : créer un client et un intervenant

### Objectif
Créer les données sans lesquelles aucun dossier n'est possible, et valider les contrôles de
format sur les coordonnées d'un prestataire.

### Acteurs
DJ (`dj.test`). La lecture est ouverte à tous les profils internes ; l'écriture sur les intervenants
est réservée au DJ et à la DJA.

### Préconditions
Aucune.

### Données de test
- Client : nom `Société de recette`. **Sa référence est attribuée** ; notez-la, les fiches
  suivantes y renvoient sous le nom de commodité `CLI-REC-001`.
- Avocat : nom `Me Recette`, identifiant de connexion `avocat.test` **si aucune fiche ne le porte
  déjà** - sinon, créez `Me Recette 2` sans réutiliser un identifiant déjà pris.
- Autre prestataire : nom `Notaire Recette`, courriel `notaire.recette@example.cm`, téléphone
  `650 228 936`.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | DJ | Menu « Clients » → bouton « Nouveau client » | Une fenêtre de création s'ouvre | | ☐ |
| 2 | DJ | Renseigner « Nom du client » = `Société de recette` → « Enregistrer ». **Aucun champ Référence n'est proposé** | Le client apparaît dans la liste ; le message nomme la référence attribuée, de la forme `CLI-2026-0001`. **Notez-la** | | ☐ |
| 3 | DJ | Créer un second client, nom `Société de recette 2` | Sa référence **suit la précédente** : `CLI-2026-0002`. Deux clients ne peuvent pas porter le même numéro | | ☐ |
| 4 | DJ | Menu « Intervenants » → « Nouvel intervenant » | Le formulaire s'ouvre, champ « Type » en premier | | ☐ |
| 5 | DJ | Type = **Avocat**, Nom = `Me Recette`, Courriel = `me.recette@example.cm`, Téléphone = `650 228 936`, « Identifiant de connexion » = un identifiant Keycloak libre → « Enregistrer » | La fiche apparaît sous « Avocats » ; le téléphone est **réaffiché au format international** | | ☐ |
| 6 | DJ | Créer un second intervenant, Type = **Avocat**, **sans** identifiant de connexion → « Enregistrer » | Refus : l'identifiant est obligatoire pour un avocat | | ☐ |
| 7 | DJ | Type = **Autre prestataire**, Nom = `Notaire Recette`, Courriel et téléphone ci-dessus, cocher « Accepte les notifications hors de l'application » → « Enregistrer » | La fiche est créée ; **aucun** champ d'identifiant de connexion n'est proposé pour ce type | | ☐ |
| 8 | DJ | Créer un intervenant avec le téléphone `2 22 45 67 89` | Refus avec le message de format : « Cameroun : neuf chiffres commençant par 6 » | | ☐ |
| 9 | DJ | Créer un intervenant avec le téléphone `+33 6 12 34 56 78` | Accepté : hors Cameroun, l'indicatif suffit | | ☐ |
| 10 | DJ | Sur la ligne de `Notaire Recette`, cliquer « Modifier » | Nom, courriel, téléphone et consentement sont modifiables ; le **type est figé** | | ☐ |

### Résultat final attendu
Au moins un client et un avocat rattaché à un compte existent ; un autre prestataire consentant
existe, avec des coordonnées au format international.

### Points de contrôle
- Un numéro camerounais est accepté sous trois écritures (`650 228 936`, `237 650 228 936`,
  `+237 650 228 936`) et toujours **stocké et réaffiché au format international**.
- Un avocat exige un identifiant de connexion **unique** ; un autre prestataire ne peut pas en avoir.
- La case de consentement n'existe que pour un autre prestataire.

---

## REC-E2E-003 - Ouvrir un dossier de recouvrement, affecter, joindre les pièces

### Objectif
Valider le parcours d'ouverture (P1) : création avec champs conditionnels, affectations obligatoires,
ouverture de l'étape et dépôt des pièces.

### Acteurs
Juriste (`juriste.test`).

### Préconditions
REC-E2E-002 faite : au moins un client et un avocat existent.

### Données de test
Nature de catégorie **Recouvrement**, client créé en REC-E2E-002, risque encouru
`5 000 000`, **deux PDF** (un par pièce attendue). Les références `CRD-REC-003` et `PV-REC-003` sont
facultatives depuis le 2026-09-29 : cette fiche les laisse volontairement vides pour le vérifier.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Menu « Dossiers » → « Créer un dossier » | Le formulaire s'ouvre | | ☐ |
| 2 | JUR | Choisir une « Nature du dossier » de catégorie Recouvrement | Les champs conditionnels **« Dossier de crédit d'origine »** et **« PV de transfert »** apparaissent | | ☐ |
| 3 | JUR | Choisir une nature de catégorie Litiges d'exploitation | Les champs changent : « Référence de l'incident de compte » et « Éléments justificatifs ». Revenir à Recouvrement | | ☐ |
| 4 | JUR | Cliquer « Enregistrer » **sans rien renseigner d'autre** | Refus : chaque champ obligatoire porte son message, dont les affectations | | ☐ |
| 5 | JUR | Renseigner Client, Juridiction saisie, Risque encouru ; affecter **soi-même** comme juriste et un avocat. **Laisser les deux références de recouvrement vides**. **Aucun champ Référence de dossier n'est proposé** | Aucun message sur les deux champs laissés vides : ils sont facultatifs depuis le 2026-09-29 | | ☐ |
| 5 bis | JUR | Bloc « Parties » : saisir un demandeur, puis cliquer **« Ajouter un défendeur »** et saisir deux défendeurs | Une ligne s'ajoute à chaque clic. La croix retire une ligne, sauf la première : au moins une partie de chaque côté est exigée | | ☐ |
| 5 ter | JUR | Champ **« Agence d'origine »** : taper `bona` | La liste se réduit aux agences dont le code ou le nom contient « bona » - Bonanjo, Bonabéri, Bonamoussadi, Bonapriso. Chaque ligne porte **le code, le mot « Agence », le nom et la ville** : « 00002 · Agence BONANJO · Douala ». En anglais, le mot devient « Branch » | | ☐ |
| 5 quater | JUR | Choisir une agence, puis laisser **« Agence du contentieux »** vide | Le champ retient « code · nom · ville ». Aucun message sur l'agence du contentieux : elle est facultative | | ☐ |
| 6 | JUR | Cliquer « Enregistrer » **sans joindre de fichier** | Refus, avec un message **sous chaque pièce manquante** : « Cette pièce est obligatoire : joignez son fichier. » Rien n'est créé | | ☐ |
| 7 | JUR | Joindre un PDF sur **chacune** des deux pièces, relire l'un d'eux avec l'œil, puis « Enregistrer » | Le dossier est créé, on arrive sur sa fiche, le titre porte la nature | | ☐ |
| 8 | JUR | Onglet « Synthèse » | Client, juridiction, risque, affectations et diligence particulière sont affichés. **Les deux défendeurs y figurent, séparés par un point-virgule**. Les deux références laissées vides s'affichent « - » | | ☐ |
| 9 | JUR | Onglet « Documents » | **Les deux PDF** déposés sont listés avec leur nom | | ☐ |
| 10 | JUR | Onglet « Étapes » | Une étape **Instance** existe, au statut **Ouverture** | | ☐ |
| 11 | JUR | Dans « Faire passer à », choisir **En cours** → « Appliquer » | L'étape passe à `EN_COURS` ; l'historique enregistre le changement | | ☐ |
| 12 | JUR | Onglet « Historique » | La création et le changement de statut sont tracés, en français, avec l'auteur et l'heure | | ☐ |
| 13 | JUR | Bouton « Modifier l'affectation », retirer puis remettre un avocat → confirmer | La modification est enregistrée et tracée dans l'historique | | ☐ |
| 14 | JUR | Menu « Dossiers », rechercher la référence notée à l'étape 7 | Le dossier apparaît dans la liste avec sa référence et sa catégorie | | ☐ |
| 14 | JUR | Copier l'URL de la fiche avec l'onglet ouvert, la coller dans un nouvel onglet | La même vue se rouvre, **sur le même onglet** de la fiche | | ☐ |

### Résultat final attendu
Un dossier `DOS-REC-003` existe, affecté à un juriste et un avocat, avec une pièce en GED et son
étape Instance au statut `EN_COURS` - état requis pour planifier une audience.

### Points de contrôle
- La référence est **attribuée** et jamais servie deux fois : deux dossiers créés à la suite portent
  deux numéros qui se suivent (REC-NEG-002).
- Les champs conditionnels suivent la **catégorie déduite de la nature**, pas un choix séparé.
- `juristesAffectes` et `avocatsAffectes` sont obligatoires et non vides.
- L'étape Instance est créée automatiquement au statut `OUVERTURE`.

---

## REC-E2E-004 - Dossier à diligence particulière : arbitrage de la diligence

### Objectif
Valider le circuit de validation de la diligence particulière : un juriste déclare, la direction statue.

### Acteurs
Juriste (`juriste.test`), puis DJ (`dj.test`).

### Préconditions
Un client existe.

### Données de test
Référence `DOS-REC-004`, case « Dossier à diligence particulière » cochée, type de client au choix, seuil
proposé `80 000 000`.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Créer un dossier comme en REC-E2E-003, mais **cocher « Dossier à diligence particulière »** | Les champs « Type de client » et « Seuil proposé (FCFA) » apparaissent et deviennent obligatoires | | ☐ |
| 2 | JUR | Renseigner le type de client et le seuil proposé, enregistrer | Le dossier est créé ; la synthèse indique une diligence particulière **en attente de validation** | | ☐ |
| 3 | DJ | Dans une autre session, ouvrir la cloche puis l'écran « Notifications » | Une notification signale le dossier à arbitrer, avec un lien direct | | ☐ |
| 4 | DJ | Ouvrir la fiche du dossier → bouton « Statuer sur la diligence particulière » | Une fenêtre propose de valider ou de rejeter | | ☐ |
| 5 | DJ | Choisir **Rejeter** sans saisir de motif | Refus : le motif est obligatoire | | ☐ |
| 6 | DJ | Saisir un motif puis rejeter | La synthèse affiche la diligence particulière **rejetée** avec son motif | | ☐ |
| 7 | JUR | Rouvrir la fiche du dossier | Le juriste voit la décision et le motif, sans avoir à demander | | ☐ |
| 8 | DJ | Recommencer sur un second dossier à diligence particulière en choisissant **Valider** | La synthèse affiche la diligence particulière validée, avec le seuil appliqué et son origine | | ☐ |

### Résultat final attendu
Un dossier à diligence particulière validé porte un seuil applicable, visible en synthèse ; un dossier rejeté porte
le motif du refus.

### Points de contrôle
- Un juriste ne peut pas statuer lui-même : le bouton n'apparaît que pour DJ et DJA (REC-NEG-006).
- Le seuil validé sert ensuite au circuit des frais (REC-E2E-012).
- L'arbitrage est tracé dans l'historique du dossier.

---

## REC-E2E-005 - Dérogation de seuil : demande et arbitrage

### Objectif
Valider qu'un seuil propre au dossier se demande, s'arbitre et s'applique.

### Acteurs
Juriste (`juriste.test`), puis DJ (`dj.test`).

### Préconditions
Un dossier existe (REC-E2E-003 ou 004).

### Données de test
Nouveau seuil proposé `120 000 000`, motif `Dossier à enjeu exceptionnel`.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Sur la fiche du dossier, cliquer « Demander une dérogation » | La fenêtre « Demander une dérogation de seuil » s'ouvre | | ☐ |
| 2 | JUR | Laisser le motif vide → « Enregistrer » | Refus : le motif est obligatoire | | ☐ |
| 3 | JUR | Saisir « Nouveau seuil (FCFA) » = `120000000` et le motif → « Enregistrer » | La demande est enregistrée ; la synthèse indique une dérogation en attente | | ☐ |
| 4 | DJ | Ouvrir l'accueil | La file des dérogations à arbitrer porte la demande ; la notification pointe le dossier | | ☐ |
| 5 | DJ | Ouvrir le bloc « Dérogations de seuil en attente » → « Arbitrer » | La fenêtre « Arbitrer la dérogation de seuil » s'ouvre | | ☐ |
| 6 | DJ | Choisir « Valider » → confirmer | La synthèse du dossier affiche le **nouveau seuil**, avec l'origine « dérogation » | | ☐ |
| 7 | JUR | Rouvrir la fiche | Le juriste voit le seuil appliqué sans action supplémentaire | | ☐ |

### Résultat final attendu
Le dossier porte un seuil dérogatoire validé, qui remplace le seuil global pour le circuit des frais.

### Points de contrôle
- Le seuil global par défaut est `SEUIL_MONTANT_DEFAUT` (50 000 000 FCFA), réglable par le DJ
  (REC-E2E-021) ; un seuil dérogatoire validé le remplace **pour ce dossier seulement**.
- Un juriste ne peut pas arbitrer sa propre demande.

---

## REC-E2E-006 - Cycle d'audience : planifier, doublon, annuler, compte rendu

### Objectif
Valider le parcours P2 : planification, détection de doublon confirmable, annulation motivée et
saisie du compte rendu.

### Acteurs
Juriste (`juriste.test`).

### Préconditions
`DOS-REC-003` existe avec une étape au statut **En cours** (REC-E2E-003, étape 10).

### Données de test
Une date d'audience **dans le futur**, puis une date **du jour** pour le compte rendu.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Fiche du dossier → onglet « Audiences » → « Planifier une audience » | La fenêtre « Planifier une audience » s'ouvre et propose l'étape en cours | | ☐ |
| 2 | JUR | Choisir une **date passée** → « Enregistrer » | Refus : la date doit être future | | ☐ |
| 3 | JUR | Choisir une date future (par exemple dans 20 jours) → « Enregistrer » | L'audience est créée au statut **Planifiée** et apparaît dans le tableau | | ☐ |
| 3 bis | JUR | Rouvrir « Planifier une audience » et lire le champ **« Juridiction »** | Il propose la juridiction du dossier | | ☐ |
| 3 ter | JUR | La remplacer par « Cour d'appel du Littoral », choisir une date, enregistrer | La ligne de l'audience porte cette juridiction, sous l'étape. Le **calendrier** l'annonce au même endroit | | ☐ |
| 4 | JUR | Replanifier une audience **sur la même étape et la même date** | Une fenêtre « Confirmer l'audience » signale le doublon **avant** d'enregistrer | | ☐ |
| 5 | JUR | Confirmer le doublon | La seconde audience est créée : le doublon est possible, mais jamais silencieux | | ☐ |
| 6 | JUR | Sur cette seconde audience, cliquer « Annuler l'audience » | La fenêtre « Annuler l'audience » demande un motif | | ☐ |
| 7 | JUR | Valider sans motif | Refus : le motif est obligatoire | | ☐ |
| 8 | JUR | Saisir `Doublon de saisie` → confirmer | L'audience passe à **Annulée** et le motif s'affiche sur sa ligne | | ☐ |
| 9 | JUR | Replanifier une audience **à la même date** que celle qui vient d'être annulée | Acceptée **sans alerte de doublon** : une audience annulée ne compte plus | | ☐ |
| 10 | JUR | Sur une audience dont la date est **future**, chercher « Saisir le compte rendu » | L'action n'est pas proposée : elle ne l'est qu'à partir du jour de l'audience | | ☐ |
| 11 | JUR | Planifier une audience **datée d'aujourd'hui** | Acceptée (RG-AUD-08, 2026-09-23) : l'audience apparaît, au statut **Planifiée** | | ☐ |
| 11 bis | JUR | Planifier une audience datée **avant l'ouverture du dossier** | Refus : « Cette date précède l'ouverture du dossier. » C'est la seule borne | | ☐ |
| 12 | JUR | Sur l'audience du jour, cliquer « Saisir le compte rendu » | La fenêtre s'ouvre immédiatement : le compte rendu est recevable dès le jour de l'audience | | ☐ |
| 13 | JUR | Enregistrer un compte rendu **vide** | Refus : le compte rendu ne peut pas être vide | | ☐ |
| 14 | JUR | Saisir un texte → « Enregistrer » | L'audience passe à **Tenue** ; le compte rendu est consultable sur sa ligne, daté du jour de l'audience | | ☐ |

> **Régularisation.** Depuis le 2026-09-23, une audience tenue sans avoir été saisie s'enregistre
> après coup, à sa vraie date : planifiez-en une datée de la semaine dernière et saisissez son
> compte rendu. Elle comptera dans le rapport du mois où elle s'est tenue (QF-32), pas dans celui de
> la saisie. Aucun rappel n'est émis pour une audience du jour ou passée - c'est attendu.

### Résultat final attendu
Le dossier porte au moins une audience tenue avec son compte rendu, une audience annulée motivée et
une audience planifiée à venir.

### Points de contrôle
- Planifier exige une étape au statut **En cours** : sinon le bouton est absent et l'écran l'explique.
- La date doit seulement être **postérieure à l'ouverture du dossier** : le jour même et le passé
  sont acceptés depuis RG-AUD-08 (2026-09-23).
- Trois rappels sont programmés automatiquement à J-7, J-3 et J-1 (vérifiables en REC-E2E-022).
- Depuis la correction du 2026-09-23 (QF-32), une audience est « tenue » **à sa date planifiée**,
  quelle que soit la date de saisie du compte rendu : c'est cette date que comptent les rapports.

---

## REC-E2E-007 - Alarmes : créer, reprogrammer, marquer traitée

### Objectif
Valider le suivi des échéances libres attachées à un dossier.

### Acteurs
Juriste (`juriste.test`).

### Préconditions
`DOS-REC-003` existe.

### Données de test
Objet `Relancer le greffe`, échéance dans 2 jours ; puis objet `Appeler l'huissier`.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Fiche → onglet « Alarmes » → « Créer une alarme » | La fenêtre « Créer une alarme » s'ouvre | | ☐ |
| 2 | JUR | Saisir « Objet » = `Relancer le greffe` et une « Échéance » future → « Enregistrer » | L'alarme apparaît, active, avec son échéance et son créateur | | ☐ |
| 3 | JUR | Cliquer « Reprogrammer » sur cette alarme, choisir une nouvelle échéance → enregistrer | L'échéance est mise à jour ; l'alarme d'origine est close et remplacée | | ☐ |
| 4 | JUR | Cliquer « Marquer traitée » | Une confirmation s'affiche ; l'alarme quitte les alarmes actives | | ☐ |
| 5 | JUR | Créer une alarme avec une **échéance passée** | Refus : l'échéance doit être future. Depuis le 2026-09-23, la règle est tenue par l'écran **et** par le serveur | | ☐ |
| 6 | JUR | Ouvrir *Dossiers* → *Nouveau dossier* et chercher un champ « alarme » | Il n'y en a plus : à sa place, une phrase renvoie à l'onglet « Alarmes » de la fiche. Ce champ n'a jamais rien déclenché (retiré le 2026-09-28) | | ☐ |

### Résultat final attendu
Le dossier porte au moins une alarme traitée et une alarme active à échéance future.

### Points de contrôle
- Marquer traitée **clôt** l'alarme sans en créer une nouvelle ; reprogrammer **remplace**.
- **L'onglet « Alarmes » de la fiche est le seul mécanisme de rappel.** Aucun champ du formulaire de
  création n'en produit - celui qui en portait le nom a été retiré le 2026-09-28.
- Les alarmes échues remontent dans les files de l'accueil du juriste.

---

## REC-E2E-008 - Calendrier des audiences et exports

### Objectif
Valider la vue calendaire, ses périodes et ses exports.

### Acteurs
Juriste (`juriste.test`) ; le DJ y a aussi accès.

### Préconditions
REC-E2E-006 faite : au moins une audience planifiée.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Menu « Calendrier » | L'agenda s'ouvre sur la période en cours, audiences groupées par jour | | ☐ |
| 2 | JUR | Repérer l'audience créée en REC-E2E-006 | Elle figure au bon jour, avec sa référence de dossier | | ☐ |
| 3 | JUR | Basculer sur « Trimestre », puis « Période suivante » | La vue change de période sans erreur, et l'en-tête indique la période affichée | | ☐ |
| 3 bis | JUR | Revenir en vue « Semaine », noter le dernier jour affiché, puis cliquer « Période suivante » | La période suivante **commence le lendemain** : aucun jour n'est affiché dans les deux (QF-31, corrigé le 2026-09-23) | | ☐ |
| 4 | JUR | Cliquer « Exporter en PDF » | Un fichier PDF est téléchargé et s'ouvre | | ☐ |
| 5 | JUR | Cliquer « Exporter en Excel » | Un classeur est téléchargé et s'ouvre | | ☐ |
| 6 | AST | Se connecter en `assistante.test` et ouvrir http://localhost:3000/audiences/calendrier | Écran « Vous n'avez pas les droits nécessaires » : le calendrier est réservé au juriste et au DJ | | ☐ |

### Résultat final attendu
Le calendrier reflète les audiences planifiées et s'exporte dans les deux formats.

### Points de contrôle
- **QF-31 a été corrigé le 2026-09-23** : deux périodes consécutives ne doivent plus partager de
  jour, ni à l'écran, ni dans les exports. L'étape 3 bis le vérifie ; un recouvrement observé est
  désormais une anomalie à signaler.

---

## REC-E2E-009 - Délibéré : mise en délibéré, prorogation, décision, recours

### Objectif
Valider le parcours P3 et l'entrée du parcours P4 : le cycle complet du délibéré, l'alerte de
franchissement de seuil, l'enregistrement de la décision et l'ouverture du délai de recours.

### Acteurs
Juriste (`juriste.test`) ; DJ (`dj.test`) pour l'alerte de prorogation.

### Préconditions
Une étape du dossier est au statut **En cours** avec une audience tenue (REC-E2E-006).

### Données de test
Date annoncée du délibéré dans 15 jours ; résultat **Défavorable** ; échéance de recours postérieure
à la date de décision.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Onglet « Étapes » → « Faire passer à » **En délibéré** → « Appliquer » | L'étape passe à `EN_DELIBERE` | | ☐ |
| 2 | JUR | Onglet « Délibérés » → « Mettre en délibéré » | La fenêtre s'ouvre et propose l'étape en délibéré | | ☐ |
| 3 | JUR | Saisir la « Date annoncée du délibéré » → « Enregistrer » | Le délibéré apparaît, annoncé à cette date | | ☐ |
| 4 | JUR | Cliquer « Proroger » sur ce délibéré, saisir une « Nouvelle date du délibéré » et un motif facultatif → enregistrer | La prorogation est enregistrée, le compteur affiche « prorogé 1 fois », l'étape **reste** `EN_DELIBERE` | | ☐ |
| 5 | JUR | Cliquer « Historique des prorogations » | Toutes les prorogations sont listées, numérotées, avec leur date et leur motif | | ☐ |
| 6 | JUR | Répéter la prorogation jusqu'à **dépasser le seuil** (`SEUIL_PROROGATIONS`, 10 par défaut - abaissez-le à 2 en REC-E2E-021 pour aller plus vite) | Au franchissement, un avertissement s'affiche ; la prorogation est **quand même enregistrée** | | ☐ |
| 7 | DJ | Ouvrir la cloche | Une alerte de type prorogation est arrivée, **une seule fois**, pas à chaque prorogation suivante | | ☐ |
| 8 | JUR | Cliquer « Enregistrer la décision » sur le délibéré, choisir « Résultat » = **Défavorable**, sans échéance de recours | Refus : l'échéance du délai de recours est obligatoire pour un résultat défavorable ou mixte | | ☐ |
| 9 | JUR | Saisir la date de décision et une échéance de recours postérieure → « Enregistrer » | Le délibéré est rendu ; l'étape passe à **`DELIBERE_VIDE`** | | ☐ |
| 10 | JUR | Ouvrir le panneau « Délai de recours » | L'échéance et l'état du délai s'affichent, en consultation seule | | ☐ |
| 11 | JUR | Enregistrer un second délibéré avec un résultat **Favorable** en renseignant une échéance de recours | Refus : l'échéance doit être **absente** pour un résultat favorable | | ☐ |
| 12 | JUR | Sur un délibéré rendu, cliquer « Marquer la grosse levée » puis « Remettre "à lever" » | Le statut d'expédition bascule dans les deux sens | | ☐ |

### Résultat final attendu
L'étape est au statut `DELIBERE_VIDE`, le délibéré porte sa décision, son historique de prorogations
et son délai de recours ; le DJ a été alerté une fois au franchissement du seuil.

### Points de contrôle
- Une prorogation n'est **jamais** un échec : au-delà du seuil, c'est un avertissement, pas un refus.
- L'alerte de seuil part **une seule fois**, vers le DJ et la DJA.
- Le nombre de prorogations n'est pas plafonné.

---

## REC-E2E-010 - Rabattement d'un délibéré et reprise des audiences

### Objectif
Valider qu'un délibéré rabattu rouvre l'étape et redonne accès à la planification.

### Acteurs
Juriste (`juriste.test`).

### Préconditions
Un délibéré existe sur une étape au statut `DELIBERE_VIDE` (REC-E2E-009).

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Onglet « Délibérés » → « Rabattre » sur le délibéré | La fenêtre « Rabattre le délibéré » s'ouvre | | ☐ |
| 2 | JUR | Valider sans motif | Refus : le motif est obligatoire | | ☐ |
| 3 | JUR | Saisir une date de rabattement et le motif `Réouverture des débats` → enregistrer | Le délibéré est marqué rabattu ; l'étape repasse à **`EN_COURS`** | | ☐ |
| 4 | JUR | Onglet « Audiences » → « Planifier une audience » | L'action est de nouveau disponible : l'étape est en cours | | ☐ |
| 5 | JUR | Onglet « Historique » | Le rabattement est tracé avec son motif et son auteur | | ☐ |

### Résultat final attendu
L'étape est revenue à `EN_COURS`, de nouvelles audiences sont planifiables, et l'historique du
parcours est conservé intégralement.

### Points de contrôle
- Le rabattement n'est proposé que sur une étape `DELIBERE_VIDE`.
- Le cycle peut se répéter : `DELIBERE_VIDE` → `EN_COURS` → `EN_DELIBERE` → nouveau délibéré.

---

## REC-E2E-011 - Frais : circuit simple, du dépôt au paiement

### Objectif
Valider le parcours P6 dans sa forme courte : dépôt par l'avocat, conformité par l'Assistante,
opportunité par la DJA, paiement par l'Assistante.

### Acteurs
Avocat (`avocat.test`) → Assistante (`assistante.test`) → DJA (`dja.test`) → Assistante.

### Préconditions
L'avocat `avocat.test` est **affecté** au dossier utilisé. Le montant doit rester **sous le seuil**
applicable et le dossier ne doit **pas** être à diligence particulière, sinon le circuit bascule en validation
conjointe (REC-E2E-012).

### Données de test
Référence de facture `FAC-REC-011`, montant `1 200 000`, un PDF en pièce justificative.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | AVO | Menu « Déposer une demande » | L'écran « Déposer une demande de frais » s'ouvre | | ☐ |
| 2 | AVO | Cliquer le champ « Dossier » et **taper une partie de la référence** | La liste se réduit à ce que le serveur renvoie. **Seuls** les dossiers où l'avocat est affecté apparaissent, avec leur référence, nature et juridiction - ni client, ni montant en jeu | | ☐ |
| 2 bis | AVO | Chercher un dossier **ancien**, créé avant beaucoup d'autres | Il est trouvé, casse indifférente. Le champ cherche sur le serveur et ne se limite plus aux dossiers récents (corrigé le 2026-09-28) | | ☐ |
| 3 | AVO | Choisir le dossier, saisir « Référence de la facture » = `FAC-REC-011` et « Montant (FCFA) » = `1200000` | Les champs sont acceptés | | ☐ |
| 4 | AVO | Charger le PDF dans « Pièces justificatives » | Le nom du fichier s'affiche ; il peut être retiré avant l'envoi | | ☐ |
| 5 | AVO | Cliquer « Déposer » | Message « Demande de frais déposée. » ; la demande figure dans « Mon espace » | | ☐ |
| 6 | AST | Se connecter, ouvrir l'accueil | La carte « Frais à contrôler » porte la demande | | ☐ |
| 7 | AST | Menu « Frais d'avocats » → file « À contrôler » → ouvrir `FAC-REC-011` | Le détail affiche le circuit, l'action attendue et la pièce jointe | | ☐ |
| 8 | AST | Sur la ligne de la pièce, cliquer **« Consulter »** (œil) | Le document s'ouvre à l'écran, sans quitter la page. Le nom affiché est celui du fichier - jamais un chemin de stockage | | ☐ |
| 8 bis | AST | Cliquer **« Télécharger »** sur la même ligne | Le fichier est enregistré sous son nom d'origine | | ☐ |
| 9 | AST | Cliquer « Valider » → confirmer | La demande passe au contrôle d'opportunité ; l'Assistante n'a plus d'action | | ☐ |
| 10 | DJA | Se connecter, ouvrir « Frais d'avocats » → la demande | Le bloc « Action attendue » propose la décision d'opportunité | | ☐ |
| 11 | DJA | Cliquer « Valider » → confirmer | La demande passe à **Validée** ; l'écran indique que la DJA valide seule (sous le seuil) | | ☐ |
| 12 | AST | Ouvrir la file « À payer » → la demande | L'action « Marquer comme payée » est proposée | | ☐ |
| 13 | AST | Cliquer « Marquer comme payée » | La demande est **Payée** ; elle quitte la file à payer | | ☐ |
| 14 | AVO | Rouvrir « Mon espace » | La demande y figure avec son statut final | | ☐ |

### Résultat final attendu
La demande `FAC-REC-011` est au statut **Payée** après avoir traversé conformité et opportunité,
chaque rôle n'ayant vu que l'action qui lui revenait.

### Points de contrôle
- Un profil qui n'a pas d'action à l'étape courante lit « Aucune action ne vous revient à cette
  étape. » - et n'a aucun bouton.
- L'avocat ne voit que **ses** demandes : la file est filtrée d'office.
- Les statuts successifs sont `DEPOSEE → CONFORMITE → OPPORTUNITE → VALIDEE`, puis paiement.

---

## REC-E2E-012 - Frais : validation conjointe DJ + DJA

### Objectif
Valider le déclenchement de la double validation et sa règle : deux accords de profils différents.

### Acteurs
Avocat → Assistante → DJA → DJ **et** DJA → Assistante.

### Préconditions
Un dossier **à diligence particulière validé** (REC-E2E-004) ou un montant **supérieur au seuil** applicable.

### Données de test
Référence de facture `FAC-REC-012`, montant `60 000 000` (au-dessus du seuil par défaut de
50 000 000 FCFA).

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | AVO | Déposer `FAC-REC-012` pour `60000000` sur le dossier | Demande déposée | | ☐ |
| 2 | AST | File « À contrôler » → ouvrir → « Valider » | Passage au contrôle d'opportunité | | ☐ |
| 3 | DJA | Ouvrir la demande → lire le bloc « Circuit de validation » | L'écran annonce « Validation conjointe du DJ et de la DJA requise » et en donne la raison (montant au-dessus du seuil, ou dossier à diligence particulière) | | ☐ |
| 4 | DJA | Cliquer « Valider » | Message indiquant que la validation conjointe est déclenchée et que le DJ et la DJA sont notifiés | | ☐ |
| 5 | DJA | Cliquer « Donner mon accord » | L'accord de la DJA est enregistré ; l'écran montre l'accord manquant | | ☐ |
| 6 | DJA | Cliquer de nouveau « Donner mon accord » | Refus : un même profil ne vote pas deux fois | | ☐ |
| 7 | DJ | Se connecter, ouvrir la demande → « Donner mon accord » | Les deux accords sont réunis ; la demande passe à **Validée** | | ☐ |
| 8 | AST | File « À payer » → « Marquer comme payée » | La demande est **Payée** | | ☐ |

### Résultat final attendu
La demande n'a été validée qu'après **deux accords de profils différents**, et l'écran a indiqué à
chaque instant ce qui manquait.

### Points de contrôle
- Le seuil appliqué est celui du dossier s'il porte une dérogation validée, sinon
  `SEUIL_MONTANT_DEFAUT`.
- Un **seul refus** suffit à rejeter, même si l'autre accord est déjà donné.
- Un juriste ou l'Assistante n'ont aucun bouton d'accord à cette étape.

---

## REC-E2E-013 - Frais : rejet motivé et retour à l'avocat

### Objectif
Valider qu'un rejet exige un motif, est terminal, et que l'avocat en est informé avec le motif.

### Acteurs
Avocat (`avocat.test`) → Assistante (`assistante.test`).

### Préconditions
REC-E2E-011 exécutée au moins une fois.

### Données de test
Référence de facture `FAC-REC-013`, motif de rejet `Relevé de diligences non signé`.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | AVO | Déposer une demande `FAC-REC-013` | Demande déposée | | ☐ |
| 2 | AVO | Déposer une **seconde** demande avec la **même** référence `FAC-REC-013` | Refus explicite : la référence de facture est unique, **tous statuts confondus** | | ☐ |
| 3 | AST | Ouvrir `FAC-REC-013` → « Rejeter » | La fenêtre « Rejeter la demande » s'ouvre | | ☐ |
| 4 | AST | Confirmer sans motif | Refus : le motif est obligatoire | | ☐ |
| 5 | AST | Saisir `Relevé de diligences non signé` → confirmer | Message confirmant le rejet et l'information de l'avocat ; la demande quitte la file | | ☐ |
| 6 | AST | Rouvrir la demande rejetée | Aucune action n'est proposée : le rejet est terminal | | ☐ |
| 7 | AVO | Ouvrir « Mon espace » | La demande est marquée rejetée, **avec le motif** | | ☐ |
| 8 | AVO | Déposer une nouvelle demande avec une **autre** référence de facture | Acceptée : le rejet n'interdit pas une nouvelle demande corrigée | | ☐ |

### Résultat final attendu
La demande rejetée est terminale et son motif est lisible par l'avocat, qui peut redéposer sous une
autre référence.

### Points de contrôle
- L'unicité de la référence de facture vaut **aussi pour les demandes rejetées**.
- Le rejet est possible à chaque étape du circuit, toujours motivé.

---

## REC-E2E-014 - Publication : compte rendu déposé, validé, puis lu

### Objectif
Valider le circuit de publication : dépôt par l'avocat, validation par l'Assistante, visibilité
pour le juriste.

### Acteurs
Avocat (`avocat.test`) → Assistante (`assistante.test`) → Juriste (`juriste.test`).

### Préconditions
Le dossier de l'avocat porte **au moins une audience planifiée** (REC-E2E-006).

### Données de test
Un récit d'audience de quelques lignes ; un PDF facultatif ; pour le second dépôt, un type de
document `Conclusions`.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | AVO | Menu « Déposer une publication » | L'écran pose la question « Que souhaitez-vous déposer ? » avec deux choix décrits | | ☐ |
| 2 | AVO | Choisir « Compte rendu d'audience », puis choisir le dossier | La liste « Audience » se remplit avec les audiences **de ce dossier** | | ☐ |
| 3 | AVO | Choisir un dossier **sans audience** | Message « Aucune audience n'est encore planifiée sur ce dossier. » | | ☐ |
| 4 | AVO | Revenir au dossier avec audience, choisir l'audience, laisser le compte rendu **vide** → « Déposer le compte rendu » | Refus : le récit est obligatoire | | ☐ |
| 5 | AVO | Joindre le PDF, puis cliquer **« Consulter »** (œil) à côté du fichier | Le document s'ouvre sans quitter le formulaire : la pièce se relit **avant** l'envoi | | ☐ |
| 5 bis | AVO | Saisir le récit → « Déposer le compte rendu » | Message « Compte rendu déposé. Les juristes du dossier en sont informés ; l'Assistante doit encore le valider pour qu'il soit visible de tous. » | | ☐ |
| 6 | AVO | Choisir cette fois « Document du dossier », sans joindre de fichier → « Déposer » | Refus : pour un document, le fichier est obligatoire | | ☐ |
| 7 | AVO | Renseigner « Type de document » = `Conclusions`, joindre le PDF → « Déposer » | Message « Publication déposée. Elle sera visible après validation. » - un document, lui, attend bien la validation | | ☐ |
| 8 | JUR | Fiche du dossier → onglet « Publications » | Le **compte rendu** apparaît déjà, marqué **Déposé** : il se lit sans attendre l'Assistante (RG-INT-06 amendée). Le **document du dossier**, lui, n'apparaît pas | | ☐ |
| 8 bis | JUR | Ouvrir le compte rendu déposé | Le récit et sa pièce sont consultables | | ☐ |
| 8 ter | JUR | Cloche des notifications | Une alerte signale le compte rendu, reçue **au dépôt** et non à la validation | | ☐ |
| 8 quater | SH | Ouvrir l'adresse de ce compte rendu | Il le lit aussi : le SH n'a **aucun rôle propre** ici, il consulte comme les juristes | | ☐ |
| 9 | AST | Menu « Publications » → file « À valider » → ouvrir le **compte rendu** | Le récit et la pièce jointe sont consultables. Le panneau ne propose que **« Accuser réception »** : aucun bouton « Rejeter » | | ☐ |
| 9 bis | AST | Cliquer « Accuser réception » → confirmer | Message « Réception du compte rendu accusée. » ; le statut devient **Réception accusée** | | ☐ |
| 9 ter | DJ | *Configuration* → supervision des notifications externes | Un envoi **« Compte rendu reçu »** vise l'avocat - et non « Publication examinée », qui annoncerait une décision | | ☐ |
| 10 | AST | Ouvrir le **document du dossier** déposé → « Valider » → confirmer | Celui-là se valide, et se rejette : il passe à **Validée** et quitte la file | | ☐ |
| 11 | JUR | Menu « Publications » (ou onglet « Publications » du dossier) | La publication validée est désormais visible, avec sa pièce | | ☐ |
| 11 bis | JUR | Fiche du dossier → onglet **« Audiences »**, ligne de l'audience relatée | Un lien **« Compte rendu de l'avocat »** y figure, à côté du compte rendu du juriste | | ☐ |
| 11 ter | JUR | Cliquer ce lien | La publication s'ouvre : le récit de l'avocat et sa pièce | | ☐ |
| 12 | AST | Ouvrir une autre publication → « Rejeter », saisir un motif → confirmer | La publication est rejetée ; l'avocat voit le motif dans « Mon espace » | | ☐ |

### Résultat final attendu
Le compte rendu d'un avocat est lisible de **tous les habilités** dès son dépôt ; l'Assistante
en accuse réception sans pouvoir le rejeter. Un document du dossier, lui, reste invisible jusqu'à
sa validation, et se rejette avec son motif.

### Points de contrôle
- Un compte rendu **sans** pièce n'affiche simplement pas le bloc de pièce jointe : ce n'est pas une
  anomalie.
- Le dépôt d'une publication déclenche une alerte applicative vers l'Assistante.
- Le dépôt d'un **compte rendu** en déclenche une seconde, vers les juristes du dossier. L'accès, lui,
  est ouvert à tous : l'alerte est ciblée, la lecture ne l'est pas.
- L'ouverture immédiate ne concerne que le **compte rendu d'audience**. Un document du dossier suit
  l'ancien régime, sa conformité n'étant pas contrôlée.
- Un compte rendu **ne se réserve pas** à un destinataire : l'API refuse la réserve à son dépôt. Elle
  reste disponible sur les autres publications.
- L'avocat est prévenu de l'accusé de réception par ses canaux externes, avec un événement qui lui
  est propre. Moteur coupé en recette : l'envoi se lit dans la supervision, il ne part pas.

---

## REC-E2E-015 - Commentaire du juriste puis correspondance unique

### Objectif
Valider la règle RG-INT-07 : un juriste ne s'adresse jamais directement à l'avocat ; le DJ ou la DJA
consolide et transmet, **une seule fois**.

### Acteurs
Juriste (`juriste.test`) → DJ (`dj.test`).

### Préconditions
Une publication **validée** existe (REC-E2E-014).

### Données de test
Commentaire `Pièce manquante au dossier` ; objet et corps de la correspondance.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Ouvrir la publication validée → bloc « Échanges » | Un champ « Votre commentaire » est proposé | | ☐ |
| 2 | JUR | Saisir le commentaire → « Envoyer au DJ/DJA » | Le commentaire est enregistré et **adressé à la direction**, pas à l'avocat | | ☐ |
| 3 | JUR | Chercher une action « transmettre à l'avocat » | Elle n'existe pas pour ce profil | | ☐ |
| 4 | DJ | Ouvrir la même publication | Les commentaires des juristes sont visibles, regroupés | | ☐ |
| 5 | DJ | Cliquer « Transmettre à l'avocat », renseigner « Objet » et « Correspondance » → confirmer | La correspondance est transmise ; l'écran l'indique | | ☐ |
| 6 | DJ | Cliquer de nouveau « Transmettre à l'avocat » | Refus : la correspondance est **unique** pour une publication | | ☐ |

### Résultat final attendu
Une correspondance unique, consolidée par la direction, est attachée à la publication.

### Points de contrôle
- Le juriste n'a aucun moyen d'écrire directement à l'avocat depuis l'application.
- Une seconde transmission est refusée, pas silencieusement ignorée.

---

## REC-E2E-016 - Constitution d'un prestataire : sollicitation, lettre, signature

### Objectif
Valider le parcours P7 : un juriste sollicite, le SH signe, la lettre est générée et rangée dans la
GED du dossier.

### Acteurs
Juriste (`juriste.test`) → Supérieur Hiérarchique (`sh.test`).

### Préconditions
Un dossier existe ; au moins un prestataire est au référentiel (REC-E2E-002).

### Données de test
Motif de la demande `Constitution pour l'audience du mois prochain` ; corps de lettre libre.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Fiche du dossier → « Solliciter un prestataire » | La fenêtre « Solliciter la constitution d'un prestataire » s'ouvre | | ☐ |
| 2 | JUR | Choisir le « Prestataire », saisir le « Motif de la demande » → « Soumettre » | La demande est créée ; elle figure dans « Constitutions » au statut en attente | | ☐ |
| 3 | SH | Se connecter, accueil | La carte « Constitutions à signer » porte la demande | | ☐ |
| 4 | SH | Menu « Constitutions » → file « À signer » → « Rédiger la lettre » | Un éditeur propose le corps de la lettre | | ☐ |
| 5 | SH | Saisir le « Corps de la lettre » → « Enregistrer la lettre » | La lettre est enregistrée et consultable | | ☐ |
| 6 | SH | Cliquer « Consulter la lettre » | La lettre s'affiche, nommée d'après le dossier | | ☐ |
| 7 | SH | Cliquer « Signer », confirmer dans « Signer la constitution ? » | La constitution passe à **Validée** ; la lettre est générée en PDF | | ☐ |
| 8 | JUR | Fiche du dossier → onglet « Documents » | La lettre de constitution figure parmi les pièces du dossier | | ☐ |
| 8 bis | JUR | Sur la ligne de la lettre, cliquer **« Sans en-tête »** | Un second PDF est téléchargé, nommé `…-sans-entete.pdf` | | ☐ |
| 8 ter | JUR | Ouvrir les **deux** PDF côte à côte | Même texte, aux mêmes emplacements ; le second n'a ni logo, ni bande latérale grise, ni mentions légales | | ☐ |
| 8 quater | JUR | **Imprimer le second sur une feuille à en-tête de la banque** | Le texte tombe dans les zones libres : rien ne chevauche le logo ni la colonne | | ☐ |
| 8 quinquies | JUR | Cliquer « Télécharger » sur la même ligne | L'exemplaire archivé est inchangé, **avec** son en-tête : c'est lui qui fait foi | | ☐ |
| 9 | AVO | Si le prestataire constitué est `avocat.test` : ouvrir « Mon espace » | La lettre apparaît sous « Mes lettres de constitution » | | ☐ |

### Résultat final attendu
La constitution est signée, la lettre est archivée dans la GED du dossier et visible du prestataire
lorsqu'il dispose d'un compte.

### Points de contrôle
- Un juriste ne peut pas signer : l'action est réservée au SH.
- Le bouton « Sans en-tête » n'apparaît **que** sur les lettres de constitution, pas sur les autres
  pièces du dossier : le tirage se régénère depuis la lettre enregistrée, ce qu'aucune autre pièce
  ne permet.
- Un autre prestataire (sans compte) n'a pas d'espace applicatif : il est notifié hors application -
  ce qui, moteur coupé, reste journalisé sans envoi.

---

## REC-E2E-017 - GED : dépôt, aperçu, demande de suppression, arbitrage

### Objectif
Valider le parcours P8, y compris la **double nature** de la suppression : demande pour le juriste,
suppression immédiate pour la direction.

### Acteurs
Juriste (`juriste.test`) → DJ (`dj.test`).

### Préconditions
`DOS-REC-003` existe.

### Données de test
Un PDF `pv-transfert.pdf`, une image `scan.png`, un document Word `conclusions.docx`, un fichier
**non autorisé** (par exemple `.odt`), motif de suppression `Pièce erronée`.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Fiche → onglet « Documents » → « Déposer », choisir le PDF, renseigner « Type de pièce » → valider | Message « Pièce déposée. » ; le document apparaît dans la liste | | ☐ |
| 2 | JUR | Déposer l'image `scan.png` | Déposée également | | ☐ |
| 3 | JUR | Déposer le document Word `conclusions.docx` | Déposé ; la colonne « Format » affiche `DOCX` | | ☐ |
| 4 | JUR | Tenter de déposer le fichier `.odt` | Refus explicite : le format n'est pas admis (`PDF, PNG, JPG, TXT, XLSX, DOCX, DOC`) | | ☐ |
| 5 | JUR | Cliquer « Consulter » sur le PDF, sur l'image, puis sur le `.docx` | Les trois s'affichent dans la fenêtre d'aperçu, sans quitter la page. Le Word montre sa mise en page - titres, gras, tableaux | | ☐ |
| 6 | JUR | Cliquer « Télécharger » sur le PDF | Le fichier est téléchargé et s'ouvre | | ☐ |
| 7 | JUR | Cliquer « Demander la suppression » sur le PDF, saisir le motif → confirmer | Message « Demande de suppression envoyée au DJ et au DJA. » ; **le document reste visible** | | ☐ |
| 8 | JUR | Redemander la suppression du **même** document | Refus : une demande est déjà en attente | | ☐ |
| 9 | DJ | Menu « Demandes de suppression » → file « En attente » | La demande figure, avec le nom du fichier, le dossier et le motif | | ☐ |
| 10 | DJ | Cliquer « Rejeter », saisir un motif → confirmer | La demande est rejetée ; le document reste en place ; le motif est consultable | | ☐ |
| 11 | JUR | Redemander la suppression du même document | Acceptée : la demande précédente est close | | ☐ |
| 12 | DJ | « Approuver » la nouvelle demande → confirmer | Le document est supprimé ; il disparaît de l'onglet Documents du dossier | | ☐ |
| 13 | DJ | Sur la fiche du dossier, onglet « Documents », cliquer « Supprimer » sur `scan.png` → confirmer | Suppression **immédiate**, sans passer par une demande | | ☐ |

### Résultat final attendu
Un document a suivi le circuit complet (demande, rejet, nouvelle demande, approbation, suppression)
et un autre a été supprimé directement par la direction.

### Points de contrôle
- Le même bouton produit deux comportements selon le profil : demande pour le juriste **auteur**,
  suppression immédiate pour DJ et DJA.
- Une demande en attente bloque toute nouvelle demande sur le même document.
- Une demande non arbitrée est relancée automatiquement au bout de 72 heures (non observable en
  séance).

---

## REC-E2E-018 - Rapport journalier GED

### Objectif
Valider la restitution de l'activité documentaire du jour, et son état vide.

### Acteurs
Assistante (`assistante.test`), juriste, DJ ou DJA.

### Préconditions
REC-E2E-017 exécutée le jour même.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | AST | Menu « Rapport journalier GED » | L'écran s'ouvre sur la date du jour | | ☐ |
| 2 | AST | Lire les indicateurs | L'activité du jour est reflétée : dossiers manipulés, pièces ajoutées, affaires nouvelles | | ☐ |
| 3 | AST | Choisir une « Date du rapport » très ancienne (par exemple il y a un an) | État vide **explicite** et lisible, pas une erreur | | ☐ |
| 4 | AVO | Ouvrir http://localhost:3000/ged/rapport-journalier avec le compte avocat | Écran « Vous n'avez pas les droits nécessaires » | | ☐ |

### Résultat final attendu
Le rapport reflète l'activité du jour et sait afficher un jour sans activité.

### Points de contrôle
- Quatre profils y ont accès : juriste, DJ, DJA et Assistante. L'avocat, non.

---

## REC-E2E-019 - Décisions définitives : adjudication et condamnation

### Objectif
Valider l'enregistrement des décisions définitives et leur précondition d'étape.

### Acteurs
Juriste (`juriste.test`).

### Préconditions
Une étape du dossier est au statut **`CLOTURE`** (faites-la passer par l'onglet « Étapes »).

### Données de test
Bénéficiaire `Afriland First Bank`, reliquat `0`, date de décision du jour ; condamnation de sens
`Banque redevable`, nature du paiement `Frais de procédure`.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Sur un dossier dont **aucune** étape n'est clôturée, onglet « Décisions » | L'action d'adjudication n'est **pas** proposée | | ☐ |
| 2 | JUR | Onglet « Étapes » → faire passer l'étape à **Clôture** → « Appliquer » | L'étape est au statut `CLOTURE` | | ☐ |
| 3 | JUR | Onglet « Décisions » → « Enregistrer une adjudication » | La fenêtre s'ouvre | | ☐ |
| 4 | JUR | Saisir un **reliquat négatif** → « Enregistrer » | Refus : le reliquat ne peut pas être négatif | | ☐ |
| 5 | JUR | Corriger et renseigner bénéficiaire, statut de comptabilisation, reprise de provision, reliquat, date → « Enregistrer » | Message « Adjudication enregistrée. » | | ☐ |
| 6 | JUR | Cliquer « Suivre une condamnation », renseigner le sens et la nature du paiement → « Enregistrer » | La condamnation est enregistrée, au statut de paiement **En attente** | | ☐ |
| 7 | JUR | Sur la ligne de la condamnation, changer le « Statut de paiement » → « Mettre à jour » | Le statut est mis à jour sur la ligne | | ☐ |
| 8 | JUR | **Recharger la page**, revenir à l'onglet « Décisions » | L'adjudication **et** la condamnation sont toujours listées, avec leur statut : la lecture existe (Q-88) | | ☐ |
| 9 | JUR | Sur la condamnation relue après rechargement, changer de nouveau le statut de paiement | La mise à jour fonctionne aussi hors de la continuité de la création | | ☐ |

### Résultat final attendu
Le dossier porte une adjudication et une condamnation, avec un statut de paiement modifiable
immédiatement après la création.

### Points de contrôle
- **Attention à une documentation périmée** : `SCREEN_MAP.md` §8 annonce encore QF-03 comme
  « bloquant fonctionnel » et l'onglet comme étant en écriture seule. **C'est faux depuis Q-88** :
  `GET /dossiers/{id}/decisions` existe, renvoie les deux listes avec leurs identifiants, et le
  frontend s'en sert. Les étapes 8 et 9 le vérifient - si elles échouent, il s'agit alors d'une
  vraie anomalie à signaler.
- **Limite connue (QF-40)** : une condamnation se crée toujours « En attente » ; le statut de
  paiement n'est pas accepté à la création.
- Une adjudication exige une étape `CLOTURE` ; une condamnation n'a **aucune** précondition d'étape.

---

## REC-E2E-030 - Relance de l'avocat dont le compte rendu manque

### Objectif
Valider RG-INT-11 : une audience passée sans compte rendu d'avocat produit une relance vers
l'avocat affecté, répétée à la cadence réglée, et qui cesse au dépôt.

### Acteurs
DJ (`dj.test`) pour le réglage et la supervision, juriste (`juriste.test`) pour l'audience, avocat
(`avocat.test`) pour le dépôt.

### Préconditions
Un dossier avec une étape **En cours** et un avocat affecté (REC-E2E-003).
`NOTIFICATION_ENGINE_ACTIF` vaut `false` : rien ne part réellement, les envois sont mis en file et
c'est la file que l'on observe.

### Comment déclencher le traitement
Le contrôle tourne **une fois par jour, à 6 h 30**. Deux façons de ne pas attendre :

- **sans la DSI** : jouer les étapes la veille au soir, et relever le résultat le lendemain matin ;
- **avec la DSI** : surcharger `publication.relance-compte-rendu.cron` au démarrage du backend
  (par exemple toutes les minutes) le temps de la recette.

Dire laquelle a été employée dans la colonne *Résultat obtenu* : un résultat obtenu par surcharge
ne dit rien de l'heure réelle d'exécution.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | DJ | *Configuration* → paramètre « Délai de relance du compte rendu de l'avocat » → saisir `1` → enregistrer | Accepté. Un délai de 1 jour rend la recette jouable en une nuit | | ☐ |
| 2 | DJ | Saisir `0` dans ce même champ | Refus expliqué : le délai vaut au moins un jour | | ☐ |
| 3 | JUR | Planifier une audience **datée d'hier** sur l'étape en cours | L'audience est créée (RG-AUD-08 admet le passé) | | ☐ |
| 4 | - | Déclencher le traitement (voir ci-dessus) | - | | ☐ |
| 5 | DJ | *Configuration* → bloc « Notifications externes » → « Notifications par canal » | Les compteurs ont progressé ; un envoi « Compte rendu attendu » vise l'avocat du dossier | | ☐ |
| 6 | - | Déclencher le traitement **une seconde fois le même jour** | - | | ☐ |
| 7 | DJ | Relire la supervision | **Aucun envoi supplémentaire** : deux exécutions du même jour ne relancent pas deux fois | | ☐ |
| 8 | AVO | Déposer le compte rendu de cette audience | Déposé, en attente de validation | | ☐ |
| 9 | - | Déclencher le traitement de nouveau | - | | ☐ |
| 10 | DJ | Relire la supervision | **Aucune nouvelle relance** : le dépôt l'a arrêtée, sans attendre la validation de l'Assistante | | ☐ |
| 11 | JUR | Sur un second dossier, planifier une audience d'hier puis l'**annuler** | Annulée | | ☐ |
| 12 | - | Déclencher le traitement, puis relire la supervision | **Aucune relance** sur cette audience : une audience annulée n'a pas de compte rendu à rendre | | ☐ |

### Résultat final attendu
L'avocat est relancé tant que le compte rendu manque, une fois par échéance et pas davantage ; le
dépôt arrête la relance ; une audience annulée n'en produit aucune.

### Points de contrôle
- La relance vise **l'avocat**, pas le juriste : c'est un rappel au prestataire.
- Elle s'arrête au bout de **cinq rappels** - au-delà, le problème n'est plus un oubli et se traite
  autrement que par un message automatique.
- Elle ne vise pas une étape **close ou archivée** : la procédure a tourné la page.
- Un compte rendu **rejeté** par l'Assistante ne compte pas comme déposé : la relance reprend.

---

## REC-E2E-032 - Diligence particulière révisée après l'ouverture

### Objectif
Valider que la diligence particulière se **pose et se lève après l'ouverture** du dossier (métier,
2026-10-03, observation 5 ; les deux sens arrêtés le 2026-10-06). Jusqu'ici elle ne se posait qu'à la
création : un dossier ouvert comme ordinaire le restait définitivement.

### Acteurs
Juriste (`juriste.test`) qui propose, DJ (`dj.test`) qui arbitre et qui pose directement, DJA
(`dja.test`) qui retire.

### Préconditions
Un dossier **ordinaire** - créé sans cocher la diligence particulière. Celui de REC-E2E-003 convient.

### Données de test
Seuil proposé `60 000 000`, type de client au choix du référentiel, motif
`La contrepartie est devenue une personne exposée`. Motif de retrait
`L'affaire s'est révélée ordinaire`.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Ouvrir la fiche d'un dossier ordinaire | Le bouton **« Proposer la diligence particulière »** est proposé. « Mettre en diligence particulière » ne l'est **pas** : le juriste propose, il ne décide pas | | ☐ |
| 2 | JUR | « Proposer la diligence particulière » → enregistrer **sans motif** | Refus : le champ « Ce qui a changé depuis l'ouverture » est obligatoire. Le dossier vivait sans diligence : ce qui a changé doit être dit | | ☐ |
| 3 | JUR | Renseigner seuil, type et motif → « Enregistrer » | « Proposition de diligence particulière enregistrée. » Le bandeau de la fiche porte **« En attente »** | | ☐ |
| 4 | JUR | Onglet « Synthèse » | Statut **En attente**, et l'origine du seuil reste **« Seuil global »**. Rien ne change pour les frais avant l'arbitrage | | ☐ |
| 5 | JUR | Chercher à proposer une seconde fois | Le bouton a disparu : une proposition est déjà en attente | | ☐ |
| 6 | DJ | Ouvrir la même fiche → « Statuer sur la diligence particulière » → **Valider** | « Décision enregistrée. » C'est la **modale qui existait déjà** : elle ne distingue pas une proposition venue de la création d'une proposition faite en cours de route | | ☐ |
| 7 | DJ | Onglet « Synthèse » | Statut **Validée**, origine du seuil **« Dérogation validée »**, seuil à 60 000 000. La diligence produit désormais ses effets | | ☐ |
| 8 | DJA | Ouvrir la fiche → « Retirer la diligence particulière » → « Retirer » **sans motif** | Refus : le motif est obligatoire. Lever la diligence fait sortir le dossier du circuit de double validation des frais | | ☐ |
| 9 | DJA | Renseigner le motif de retrait → « Retirer » | « Diligence particulière mise à jour. » Le dossier redevient ordinaire | | ☐ |
| 10 | DJA | Onglet « Synthèse » | Le **motif du retrait** est affiché, et l'origine du seuil est repassée à **« Seuil global »** | | ☐ |
| 11 | DJA | Onglet « Historique » | La **proposition** et le **retrait** y figurent, nommés et datés, avec leur auteur | | ☐ |
| 12 | JUR | Reproposer la diligence sur ce même dossier | Accepté : un retrait ne condamne pas le dossier. Le motif du retrait disparaît de la synthèse - il ne porte plus sur la situation en cours | | ☐ |
| 13 | DJ | Sur un **autre** dossier ordinaire, « Mettre en diligence particulière » → seuil et type → enregistrer | Posée **directement** au statut Validée, sans arbitrage : le DJ est la décision. Le bouton devient « Retirer la diligence particulière » | | ☐ |

### Résultat final attendu
Un dossier ordinaire a été rendu sensible par proposition puis arbitrage, puis rendu ordinaire par
retrait motivé, et un second l'a été directement par le DJ. L'historique porte les trois gestes.

### Points de contrôle
- La proposition **ne produit aucun effet** avant l'arbitrage : le seuil reste global (Q-10).
- Le juriste **propose**, le DJ et la DJA **décident** - même partage que la dérogation de seuil.
- Le retrait exige un **motif**, et remet le seuil à **global** : un seuil dérogatoire n'existe que
  pour un dossier à diligence particulière.
- Le motif de retrait reste **lisible après** le retrait, bien que le dossier ne soit plus sensible.
- Les boutons sont **exclusifs** : un dossier en attente d'arbitrage n'offre que l'arbitrage.

---

## REC-E2E-031 - Référentiel des agences : chercher, créer, corriger, fermer

### Objectif
Valider le référentiel qui ferme la saisie des codes d'agence (métier, 2026-10-03, observation 2) :
recherche au fil de la frappe, tenue réservée au DJ et à la DJA, code non modifiable, fermeture
sans suppression.

### Acteurs
DJ (`dj.test`) pour la tenue, juriste (`juriste.test`) pour vérifier que la lecture est ouverte et
l'écriture fermée.

### Préconditions
Aucune. Les 82 agences sont chargées par la migration `V42`.

### Données de test
- Agence à créer : code `00900`, nom `AGENCE DE RECETTE`, ville `Douala`, adresse
  `Rue de la recette`, téléphone `650 228 936`.
- Agence existante à corriger puis fermer : celle que vous venez de créer, **jamais une vraie
  agence** : une fermeture se voit ensuite dans tous les formulaires.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | DJ | Menu « Agences » | La liste s'ouvre, triée par code. Les colonnes Code, Nom, Ville, Adresse, Téléphone et État sont présentes | | ☐ |
| 2 | DJ | Dans « Rechercher une agence », taper `bona` | Seules les agences dont le code ou le nom contient « bona » restent : Bonanjo, Bonabéri, Bonamoussadi, Bonapriso. La recherche **ne distingue pas les majuscules** | | ☐ |
| 3 | DJ | Taper `00002` | La recherche porte aussi sur le **code** : Bonanjo apparaît | | ☐ |
| 4 | DJ | Taper `MBALLA` | **Deux** agences homonymes apparaissent, de codes différents (`00108` et `108`), même ville : leurs **adresses** les séparent | | ☐ |
| 5 | DJ | Effacer la recherche, bouton « Nouvelle agence » | Le formulaire s'ouvre : Code, Nom, Ville obligatoires ; Adresse et Téléphone facultatifs | | ☐ |
| 6 | DJ | Enregistrer **sans ville** | Refus : la ville est obligatoire. Deux agences peuvent porter le même nom, et c'est elle qui les distingue | | ☐ |
| 7 | DJ | Renseigner les données de test → « Enregistrer » | L'agence apparaît dans la liste, état **Ouverte** | | ☐ |
| 8 | DJ | Créer une seconde agence avec le **même code** `00900` | Refus : « Une agence porte déjà le code 00900 ». Le message se pose **sur le champ Code** | | ☐ |
| 9 | DJ | Sur la ligne de `AGENCE DE RECETTE`, « Modifier » | Le formulaire s'ouvre. Le champ **Code est inactif**, avec l'explication : les dossiers le portent en clair | | ☐ |
| 10 | DJ | Changer le nom en `AGENCE DE RECETTE 2`, vider le téléphone → « Enregistrer » | Le nouveau nom apparaît ; le téléphone s'affiche « - », non une case vide | | ☐ |
| 11 | JUR | Se connecter en juriste, menu « Agences » | La liste **s'affiche** : la lecture est ouverte à tous les profils internes. **Aucun bouton** « Nouvelle agence », « Modifier » ni « Désactiver » | | ☐ |
| 12 | JUR | Créer un dossier, champ « Agence d'origine », taper `00900` | `00900 · AGENCE DE RECETTE 2 · Douala` est proposée. L'enregistrer sur ce dossier et **noter sa référence** | | ☐ |
| 13 | DJ | Revenir à « Agences », sur `AGENCE DE RECETTE 2` → « Désactiver » → confirmer | La confirmation explique qu'elle est **fermée, pas supprimée**. Après validation, son état passe à **Fermée** et elle **reste dans la liste** | | ☐ |
| 14 | JUR | Créer un nouveau dossier, champ « Agence d'origine », taper `00900` | Elle **n'est plus proposée** : la saisie ne retient que les agences ouvertes | | ☐ |
| 15 | JUR | Ouvrir la fiche du dossier créé à l'étape 12 | Elle s'ouvre normalement et porte toujours le code `00900`. Une agence fermée **ne casse aucun dossier** | | ☐ |
| 16 | DJ | Sur la ligne fermée de `AGENCE DE RECETTE 2`, cliquer « Réactiver » | Pas de confirmation demandée - le geste est bénin. L'état repasse à **Ouverte**, et le code est **toujours `00900`** : c'est la même agence | | ☐ |
| 17 | JUR | Créer un dossier, champ « Agence d'origine », taper `00900` | Elle est **de nouveau proposée** | | ☐ |
| 18 | DJ | Cliquer « Réactiver » sur une agence **déjà ouverte** (par l'API, `PATCH /referentiels/agences/{id}/reactivation`) | Aucun refus : l'état demandé est atteint, l'agence est rendue telle quelle | | ☐ |

### Résultat final attendu
Une agence a été créée, corrigée puis fermée ; le dossier ouvert sous elle reste lisible, et elle
ne se propose plus à la saisie.

### Points de contrôle
- La recherche porte sur **le code et le nom**, par fragment, sans distinction de casse.
- Le **code ne se modifie pas** : une agence qui change de code se recrée.
- `DELETE` **désactive** : rien ne disparaît de la base, et les dossiers gardent leur sens.
- La fermeture est **réversible** : « Réactiver » rouvre l'agence **avec son code**. Une fermeture par erreur ne force pas à inventer un nouveau code.
- Le juriste **lit** le référentiel mais ne l'écrit pas ; par l'API, son `POST` est refusé (403).
- La ville est **obligatoire** : c'est elle qui sépare deux agences de même nom.

---

## REC-E2E-020 - Jurisprudence : archiver, rechercher, consulter

### Objectif
Valider l'archivage d'une décision et la recherche dans la base jurisprudentielle.

### Acteurs
Juriste (`juriste.test`) ; la consultation est ouverte à tous les profils internes.

### Préconditions
Un PDF de décision, de moins de 10 Mo.

### Données de test
Mots-clés `saisie immobilière, recouvrement`, nature de la décision `Arrêt`, juridiction
`Cour d'appel du Littoral`, date du jour.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Menu « Jurisprudence » → « Archiver une décision » | La fenêtre s'ouvre et demande le PDF | | ☐ |
| 2 | JUR | Valider sans mots-clés ni nature | Refus : l'indexation est obligatoire | | ☐ |
| 3 | JUR | Renseigner mots-clés, nature, juridiction, date, charger le PDF → « Enregistrer » | La décision apparaît dans la base | | ☐ |
| 4 | JUR | Rechercher `saisie` | La décision `Saisie immobilière` est retrouvée : la recherche accepte les **fragments** et ignore la casse | | ☐ |
| 5 | JUR | Rechercher `SAISIE` puis `Saisie` | Mêmes résultats | | ☐ |
| 6 | JUR | Rechercher un mot inexistant | Message « Aucune décision ne correspond à cette recherche. » | | ☐ |
| 7 | JUR | Filtrer par juridiction, puis **recharger la page** | Les filtres sont conservés : ils figurent dans l'adresse | | ☐ |
| 8 | JUR | Cliquer « Consulter » sur une décision, puis « Télécharger » | Le PDF s'ouvre, puis se télécharge | | ☐ |

### Résultat final attendu
Une décision indexée est retrouvable par fragment de mot-clé, consultable et téléchargeable ; les
filtres sont partageables par l'URL.

### Points de contrôle
- Les **accents comptent** dans la recherche ; la casse, non.
- Le PDF est obligatoire et plafonné à 10 Mo.

---

## REC-E2E-021 - Pilotage : tableau de bord, rapport et seuils

### Objectif
Valider le parcours P9 : lecture des indicateurs, génération d'un rapport, réglage d'un paramètre
système et prise d'effet immédiate.

### Acteurs
DJ (`dj.test`).

### Préconditions
Les fiches précédentes ont produit des données.

### Données de test
Période du rapport : le mois en cours. Paramètre à modifier : `SEUIL_PROROGATIONS`.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | DJ | Menu « Tableau de bord » | Les **neuf** indicateurs s'affichent, chacun avec la phrase qui dit ce qu'il compte. **Aucun « Succès du recouvrement »** : le taux a quitté cet écran le 2026-10-06, la Direction voulant des nombres | | ☐ |
| 1 bis | DJ | Lire « Litiges gagnés », « Litiges perdus » et « Décisions mixtes » | Les trois s'additionnent pour faire les délibérés rendus. **« Perdus » n'est pas le complément des gagnés** : une décision mixte n'est ni l'un ni l'autre, et la phrase d'aide le dit. Le taux correspondant se lit sur l'écran **Rapports**, borné à une période | | ☐ |
| 1 ter | DJ | Lire « Affaires vidées » et « Dossiers actifs » | Les deux s'additionnent pour faire le nombre de dossiers ouverts. Une affaire est vidée quand **plus aucune de ses étapes n'est en cours** (métier, 2026-10-06) : un dossier dont l'Instance est clôturée mais dont l'Appel est ouvert reste actif | | ☐ |
| 2 | DJ | Comparer « Dossiers ouverts » avec la liste des dossiers | Les chiffres sont cohérents avec les données créées | | ☐ |
| 3 | DJ | Menu « Rapports » → choisir une période **inversée** (fin avant début) → « Afficher le rapport » | Message « La date de fin doit suivre la date de début. » | | ☐ |
| 4 | DJ | Choisir le mois en cours → « Afficher le rapport » | Le rapport s'affiche avec ses rubriques (dossiers ouverts, délibérés rendus…). Il porte **« Litiges gagnés », « Litiges perdus » et « Décisions mixtes »**, et **aucun « Succès du recouvrement »** : le taux a quitté le rapport le 2026-10-06, comme le tableau de bord | | ☐ |
| 5 | DJ | Choisir une période ancienne sans activité | « Aucune activité sur cette période » - état vide, pas une erreur | | ☐ |
| 6 | DJ | Cliquer « Exporter » et choisir PDF, puis Excel, puis CSV | Un fichier est téléchargé dans chaque format. **Ouvrez-les** : chacun porte les trois décomptes et **aucun pourcentage** - c'est le fichier que le métier lit vraiment | | ☐ |
| 7 | DJ | Menu « Configuration » → repérer `SEUIL_PROROGATIONS` | La valeur courante est affichée, avec l'auteur de la dernière modification | | ☐ |
| 8 | DJ | Saisir une valeur **invalide** (texte, ou valeur hors bornes) → « Enregistrer » | Refus expliqué ; la valeur en base ne change pas | | ☐ |
| 9 | DJ | Saisir `2` → « Enregistrer » | Message de succès nommant la clé modifiée | | ☐ |
| 10 | JUR | Reprendre REC-E2E-009 et proroger un délibéré 3 fois | L'alerte de seuil part dès le franchissement du **nouveau** seuil : le changement a pris effet immédiatement | | ☐ |
| 11 | DJ | Remettre `SEUIL_PROROGATIONS` à sa valeur initiale | Valeur rétablie pour la suite de la campagne | | ☐ |
| 12 | JUR | Ouvrir http://localhost:3000/tableau-de-bord avec le compte juriste | Écran « Vous n'avez pas les droits nécessaires » | | ☐ |

### Résultat final attendu
Les indicateurs reflètent les données, les rapports s'exportent dans les quatre formats, et un
paramètre modifié agit immédiatement sur le comportement métier.

### Points de contrôle
- Le tableau de bord est réservé au DJ et à la DJA.
- Le rapport d'activité est accessible au juriste **et** à la direction (rôle composite).
- Une valeur invalide n'est jamais enregistrée à moitié.

---

## REC-E2E-022 - Notifications applicatives : temps réel et supervision

### Objectif
Valider que les alertes arrivent sans rechargement, qu'elles ne se perdent pas si le temps réel est
coupé, et que la direction peut mesurer le canal.

### Acteurs
Assistante (`assistante.test`) ou juriste, et DJ (`dj.test`).

### Préconditions
Deux sessions ouvertes : l'une pour recevoir, l'autre pour déclencher.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | AST | Ouvrir l'écran « Notifications » et **ne plus y toucher** | La liste s'affiche ; un indicateur signale que le temps réel est actif | | ☐ |
| 2 | AVO | Dans l'autre session, déposer une demande de frais (REC-E2E-011) | - | | ☐ |
| 3 | AST | Regarder l'écran **sans le recharger** | La nouvelle notification apparaît d'elle-même, et la cloche s'incrémente | | ☐ |
| 4 | AST | Cliquer « Marquer traitée » sur cette notification | Message de confirmation ; le compteur de la cloche diminue | | ☐ |
| 5 | AST | Couper le réseau du poste quelques secondes, puis déclencher une nouvelle alerte depuis l'autre session, réseau rétabli | La notification finit par apparaître : rien n'est perdu, seul l'affichage immédiat peut manquer | | ☐ |
| 6 | JUR | Ouvrir l'écran « Notifications » du juriste | Il ne voit **que ses** notifications ; il ne peut pas traiter celles d'un autre | | ☐ |
| 7 | DJ | Menu « Configuration » → bloc « Supervision des alertes » | Le taux de délivrance du canal applicatif s'affiche sur la période choisie | | ☐ |
| 8 | DJ | Choisir une fenêtre **inversée** (début après la fin) | Message explicite à l'écran, pas une erreur technique | | ☐ |
| 9 | DJ | Choisir une période sans alerte | Message indiquant qu'il n'y a rien à mesurer - « ni conforme ni fautif » | | ☐ |
| 10 | JUR | Ouvrir la même page avec le compte juriste | Le bloc de supervision **n'apparaît pas** : il est réservé à DJ et DJA | | ☐ |

### Résultat final attendu
Les alertes arrivent en temps réel, survivent à une coupure, ne sont traitables que par leur
destinataire, et leur délivrance est mesurable par la direction.

### Points de contrôle
- Le canal applicatif est le canal **obligatoire** : il fonctionne même quand les canaux externes
  sont coupés.
- Marquer traitée est réservé au destinataire.

---

## REC-E2E-023 - Notifications externes : grille, supervision et relance

### Objectif
Valider que le DJ commande les notifications externes, que la supervision les reflète et que la
relance est réservée à la direction - **moteur coupé**, donc sans aucun envoi réel.

### Acteurs
DJ (`dj.test`), avec une action métier produite par un autre rôle.

### Préconditions
Aucune. `NOTIFICATION_ENGINE_ACTIF` vaut `false`.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | DJ | Menu « Configuration » → bloc « Grille des notifications externes » | Une grille à cases : une ligne par événement, une colonne par canal, en deux sections (Utilisateurs internes / Prestataires) | | ☐ |
| 2 | DJ | Décocher « Nouvelle demande de frais par Outlook » → « Enregistrer la grille "Utilisateurs internes" » | Message « Grille des notifications enregistrée. » | | ☐ |
| 3 | DJ | **Recharger la page** | La case est toujours décochée : le réglage a bien été enregistré | | ☐ |
| 4 | DJ | Décocher **toute** la colonne SMS puis enregistrer | Accepté : « rien par SMS » est un réglage, pas une erreur | | ☐ |
| 5 | DJ | Recocher la case et la colonne, enregistrer | La grille revient à son état initial | | ☐ |
| 6 | AVO | Déposer une demande de frais (autre session) | - | | ☐ |
| 7 | DJ | Bloc « Notifications externes » → tableau « Notifications par canal » | Les compteurs du canal Courriel ont progressé ; une ligne par canal (Courriel, SMS, WhatsApp, Teams) | | ☐ |
| 8 | DJ | Lire le bandeau au-dessus du tableau | Un message indique que le Notification Engine est **désactivé** : rien ne part réellement | | ☐ |
| 9 | DJ | Lire le tableau « Envois à examiner », s'il n'est pas vide | Chaque ligne porte l'événement, le statut, le destinataire et la cause ; un bouton « Relancer » est proposé | | ☐ |
| 10 | DJ | Si une ligne relançable existe : cliquer « Relancer » | Message « Notification remise en file. » ; la ligne quitte les envois en défaut | | ☐ |
| 11 | JUR | Ouvrir la page « Configuration » avec le compte juriste | Les **paramètres système** sont visibles en lecture, mais ni la grille ni la supervision des notifications externes | | ☐ |

### Résultat final attendu
La grille est modifiable et persistante, la supervision reflète l'activité et dit clairement que le
moteur est coupé, et la relance reste réservée à la direction.

### Points de contrôle
- La colonne « Confirmées » reste vide : les accusés du moteur ne sont pas publiés aujourd'hui
  (point ouvert §8). Ce n'est pas un défaut de l'application.
- Une ligne sans destinataire n'est pas relançable : la fiche de l'intervenant doit d'abord être
  corrigée.
- **WhatsApp** ne délivre pas actuellement : les frais d'envoi du canal ne sont pas réglés par
  l'entreprise. Le canal est éteint dans la grille par défaut.

---

## REC-E2E-024 - Audit : consultation, extraction scellée, vérification

### Objectif
Valider la traçabilité : consulter le journal filtré, en extraire une archive scellée et vérifier un
fichier reçu.

### Acteurs
DJ (`dj.test`).

### Préconditions
Les fiches précédentes ont produit de l'activité.

**Les étapes 8 et 9 exigent un contexte sécurisé.** Le calcul d'empreinte se fait dans le navigateur,
qui ne l'autorise qu'en HTTPS ou sur `localhost`. Depuis un autre poste, par `http://<IP>:3000`,
l'application le signale et la vérification est indisponible : jouez ces deux étapes sur le poste
hôte. Ce n'est pas une anomalie.

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | DJ | Menu « Audit » | Trois blocs : filtres, extraction, vérification d'un fichier | | ☐ |
| 2 | DJ | Bloc « Filtres de l'audit », cliquer « Aujourd'hui » | Le journal du jour s'affiche, action la plus récente en tête | | ☐ |
| 3 | DJ | Filtrer par « Portée » = un dossier, saisir le « N° de dossier » de `DOS-REC-003` | Seules les actions de ce dossier s'affichent (création, changement de statut, affectation…) | | ☐ |
| 4 | DJ | Choisir la portée « un dossier » **sans** numéro | Message explicatif à l'écran, pas une erreur technique | | ☐ |
| 5 | DJ | Filtrer par « Auteur » = `juriste.test` | Seules ses actions s'affichent | | ☐ |
| 6 | DJ | Bloc « Extraire l'audit » → « Extraire en PDF » | Une archive est produite, avec une référence lisible du type `AUD-2026-0042` | | ☐ |
| 7 | DJ | Cliquer « Récupérer » sur l'archive produite | Le fichier est téléchargé | | ☐ |
| 8 | DJ | Bloc « Vérifier un fichier » → déposer le fichier téléchargé | Le fichier est **reconnu** comme authentique | | ☐ |
| 9 | DJ | Déposer un autre fichier quelconque | Réponse claire indiquant qu'il n'est pas reconnu - pas une erreur technique | | ☐ |
| 10 | DJ | Recharger la page « Audit » | La **consultation de l'audit** figure elle-même dans le journal | | ☐ |
| 11 | JUR | Ouvrir http://localhost:3000/admin/audit avec le compte juriste | Écran « Vous n'avez pas les droits nécessaires » | | ☐ |

### Résultat final attendu
Le journal est consultable et filtrable, une archive scellée est produite, récupérée et vérifiée ;
la consultation elle-même laisse une trace.

### Points de contrôle
- L'audit est réservé au DJ et à la DJA - l'Assistante, le SH et le juriste n'y accèdent pas.
- L'empreinte du fichier déposé est calculée par le navigateur : le fichier lui-même ne part pas.

---

## REC-E2E-025 - Portail avocat : périmètre et cloisonnement

### Objectif
Valider qu'un utilisateur externe ne voit que ce qui le concerne, et rien du portefeuille de la
banque.

### Acteurs
Avocat (`avocat.test`).

### Préconditions
L'avocat est affecté à au moins un dossier et a déposé au moins une demande (REC-E2E-011).

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | AVO | Se connecter, observer le menu | Trois entrées seulement : « Mon espace », « Déposer une demande », « Déposer une publication » | | ☐ |
| 2 | AVO | Ouvrir « Mon espace » | Deux blocs : « Mes dépôts » et « Mes lettres de constitution » | | ☐ |
| 3 | AVO | Lire la liste des dépôts | Type, dossier, date de dépôt et statut ; le motif s'affiche pour un dépôt rejeté | | ☐ |
| 4 | AVO | Ouvrir le sélecteur de dossier d'un dépôt | Uniquement ses dossiers : référence, nature, juridiction. **Ni client, ni risque encouru, ni diligence particulière** | | ☐ |
| 5 | AVO | Saisir directement http://localhost:3000/dossiers dans la barre d'adresse | Écran « Vous n'avez pas les droits nécessaires » | | ☐ |
| 6 | AVO | Saisir http://localhost:3000/clients | Même refus | | ☐ |
| 7 | AVO | Saisir l'URL d'une **fiche dossier** relevée dans la session du juriste (`/dossiers/<id>`) | Même refus : l'URL directe ne contourne rien | | ☐ |
| 8 | AVO | Ouvrir « Frais d'avocats » si l'entrée est accessible, ou l'URL `/frais` | Seules **ses** demandes sont listées | | ☐ |
| 9 | AVO | Basculer en anglais, revenir en français | Le portail est traduit dans les deux langues | | ☐ |

### Résultat final attendu
L'avocat travaille dans un espace clos, sans aucune fuite d'information sur les autres dossiers ou
les données sensibles de la banque.

### Points de contrôle
- Le cloisonnement tient par l'URL directe, pas seulement par le menu.
- Un compte avocat **non rattaché** au référentiel est traité en REC-NEG-010.

---

## REC-E2E-026 - Vue consolidée d'un client

### Objectif
Valider la lecture transverse de toutes les procédures d'un client.

### Acteurs
Juriste (`juriste.test`) ou DJ.

### Préconditions
Le client `CLI-REC-001` porte au moins un dossier (REC-E2E-003).

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Menu « Clients » → rechercher `CLI-REC-001` → ouvrir la fiche | La vue consolidée s'ouvre | | ☐ |
| 2 | JUR | Lire le regroupement des dossiers | Les dossiers sont groupés en **« Recouvrement »** et **« Litiges d'exploitation »** | | ☐ |
| 3 | JUR | Vérifier qu'un dossier **non affecté** au juriste connecté y figure | La vue est indépendante de l'affectation : elle montre tout le client | | ☐ |
| 4 | JUR | Ouvrir un client **sans dossier** | Structure vide et lisible, pas une erreur | | ☐ |
| 5 | JUR | Cliquer « Modifier » sur le client, changer le nom → enregistrer | La modification est enregistrée et visible dans la liste | | ☐ |

### Résultat final attendu
La fiche client donne une vue complète des procédures du client, quelle que soit l'affectation.

### Points de contrôle
- La vue consolidée ignore volontairement l'affectation du juriste connecté.

---

## REC-E2E-027 - Les deux pourvois : Cour Suprême et CCJA

### Objectif
Valider qu'un dossier peut être porté devant les deux juridictions de cassation en même temps, que
chacune suit sa propre vie, et qu'ouvrir l'une ne fait pas naître l'autre.

### Acteurs
Juriste (`juriste.test`).

### Préconditions
Un dossier existe (REC-E2E-003).

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Fiche du dossier → onglet « Étapes » → liste « Choisissez une étape » | Quatre valeurs : Instance, Appel, Pourvoi en cassation, Pourvoi CCJA | | ☐ |
| 2 | JUR | Choisir **Pourvoi CCJA** → « Positionner » | La confirmation annonce la création de l'**Appel**, et **ne mentionne pas** le Pourvoi en cassation | | ☐ |
| 3 | JUR | Confirmer | Le dossier porte Instance, Appel et **Pourvoi CCJA**. Aucune étape Cour Suprême n'a été créée | | ☐ |
| 4 | JUR | Choisir **Pourvoi en cassation** → « Positionner » → confirmer | Les deux cassations coexistent désormais sur le dossier | | ☐ |
| 5 | JUR | Lire le message sous la liste des étapes | « Toutes les étapes existent déjà. » | | ☐ |
| 6 | JUR | Passer le **Pourvoi en cassation** à « En cours », et laisser le Pourvoi CCJA en « Ouverture » | Les deux statuts sont indépendants : l'un avance sans l'autre | | ☐ |
| 7 | JUR | Onglet « Audiences » → « Planifier une audience » | La liste des étapes distingue clairement les deux pourvois par leur libellé | | ☐ |
| 8 | JUR | Menu « Dossiers », rechercher le dossier | La colonne « Étape » montre **les deux** pastilles, avec leurs statuts respectifs | | ☐ |

### Résultat final attendu
Le dossier porte quatre étapes, dont deux cassations concurrentes aux statuts indépendants, visibles
l'une et l'autre depuis la liste des dossiers.

### Points de contrôle
- Le pourvoi CCJA **ne s'ouvre jamais tout seul** : exercer un recours depuis l'appel ouvre la
  cassation nationale, jamais la CCJA - celle-ci se décide et se positionne à la main.
- Les libellés sont ceux du métier : Instance, Appel, Pourvoi en cassation, Pourvoi CCJA.
- Aucune étape Cour Suprême fantôme n'apparaît quand on positionne directement en CCJA.

---

## REC-E2E-028 - Journal des audiences et comptes rendus attendus

### Objectif
Valider que la direction voit, pour une journée donnée, ce qui a été rapporté de chaque audience -
par le juriste comme par l'avocat - et retrouve les comptes rendus qui manquent encore.

### Acteurs
Juriste (`juriste.test`), avocat (`avocat.test`), puis DJ (`dj.test`).

### Préconditions
Un dossier avec un avocat affecté (REC-E2E-003).

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Planifier une audience **datée d'aujourd'hui** sur le dossier | L'audience apparaît, au statut Planifiée | | ☐ |
| 2 | DJ | Menu « Journal des audiences » → date du jour | L'audience figure, colonne « Compte rendu du juriste » marquée **Manquant** en rouge, colonne avocat **Non déposé** | | ☐ |
| 3 | JUR | Saisir le compte rendu de l'audience | Message de confirmation | | ☐ |
| 4 | DJ | Recharger le journal | Le texte du compte rendu s'affiche à la place de « Manquant » | | ☐ |
| 5 | AVO | Déposer un **compte rendu d'audience** sur cette même audience | Dépôt confirmé | | ☐ |
| 6 | DJ | Recharger le journal | La colonne avocat affiche toujours **Non déposé** : le dépôt n'est pas encore validé | | ☐ |
| 7 | AST | Valider la publication | Publication validée | | ☐ |
| 8 | DJ | Recharger le journal | Les **deux** comptes rendus s'affichent côte à côte | | ☐ |
| 9 | DJ | Bloc « Comptes rendus attendus », fenêtre du dernier mois | Les audiences passées sans compte rendu y figurent, avec leur ancienneté en jours | | ☐ |
| 10 | DJ | Vérifier qu'une audience **du jour** sans compte rendu n'y figure pas | Absente : la journée n'est pas finie, elle n'est pas en retard | | ☐ |
| 11 | DJ | Saisir une date de début **postérieure** à la date de fin | Message explicite à l'écran, pas d'erreur technique | | ☐ |
| 12 | JUR | Ouvrir `http://172.21.10.151:3000/audiences/journal` avec le compte juriste | L'écran s'affiche : il a été ouvert aux juristes le 2026-09-28 | | ☐ |
| 13 | AVO | Ouvrir la même adresse avec le compte avocat | Écran « Vous n'avez pas les droits nécessaires » | | ☐ |

### Résultat final attendu
La direction dispose d'une vue quotidienne des audiences et de leurs comptes rendus, et d'une liste
des comptes rendus qui manquent, avec leur ancienneté.

### Points de contrôle
- Un compte rendu **manquant** (rouge) et un dépôt d'avocat **non fait** (gris) ne se confondent pas.
- Un dépôt d'avocat **non validé** ne compte pas comme rapporté.
- L'écran nomme les juristes **affectés au dossier**, pas un responsable de l'audience : un dossier
  suivi à deux affiche deux noms. C'est une limite connue, pas un défaut.
- L'écran est ouvert à **tous les profils internes**, juristes compris, sur décision du porteur du
  projet du 2026-09-28 - et fermé aux prestataires externes. La réserve NF-CONF-01
  (confidentialité, « à définir avec la DRH ») demeure et porte désormais sur un écran largement
  visible.

---

## REC-E2E-029 - Filtrer et trier la liste des dossiers

### Objectif
Valider que la liste des dossiers se filtre par étape et par période d'audience, se trie, et que
chaque recherche reste partageable par son adresse.

### Acteurs
Juriste (`juriste.test`).

### Préconditions
Au moins deux dossiers à des étapes différentes, dont un portant une audience passée (REC-E2E-006),
et si possible un dossier porté devant les **deux** cassations (REC-E2E-027).

### Parcours

| Étape | Rôle | Action à effectuer dans l'interface | Résultat attendu | Résultat obtenu | Statut |
|---|---|---|---|---|---|
| 1 | JUR | Menu « Dossiers » | La barre de filtres porte Étape, Statut de l'étape, Audience du, Audience au, Trier par | | ☐ |
| 2 | JUR | Filtre **Étape** = Appel | Seuls les dossiers ayant une étape d'appel restent ; l'adresse contient `typeEtape=RECOURS_1` | | ☐ |
| 3 | JUR | Ajouter **Statut de l'étape** = En cours | Seuls les dossiers dont **l'appel** est en cours restent - pas ceux dont l'appel est clôturé et qui ont autre chose en cours | | ☐ |
| 4 | JUR | Copier l'adresse, la rouvrir dans un nouvel onglet | La même liste s'affiche, filtres pré-remplis | | ☐ |
| 5 | JUR | Effacer les filtres, puis **Audience du** = premier jour du mois d'une audience connue, **Audience au** = dernier jour | Seuls les dossiers ayant eu une audience dans cette fenêtre restent | | ☐ |
| 6 | JUR | Vérifier qu'un dossier dont l'audience de la période a été **annulée** n'y figure pas | Absent : une audience annulée ne s'est pas tenue | | ☐ |
| 7 | JUR | Ne renseigner que **Audience du** | La borne haute reste ouverte : toutes les audiences à partir de cette date | | ☐ |
| 8 | JUR | **Trier par** = Référence (A → Z) | Les lignes se réordonnent ; l'adresse contient `tri=REFERENCE` | | ☐ |
| 9 | JUR | **Trier par** = Risque encouru, du plus élevé | Le montant le plus fort en tête | | ☐ |
| 10 | JUR | Revenir à **Ouverture, plus récente d'abord** | L'ordre initial revient et `tri=` **disparaît** de l'adresse : c'est déjà le défaut | | ☐ |
| 11 | JUR | Sur un dossier aux deux cassations : filtrer **Étape** = Pourvoi en cassation, puis = Pourvoi CCJA | Le dossier remonte **dans les deux cas** : les deux procédures existent | | ☐ |
| 12 | JUR | Saisir aussi **Référence** et **Juridiction**, puis « Effacer » | Tous les critères sont remis à zéro et **les champs se vident à l'écran** - aucun mot ne reste affiché sous un filtre qui n'agit plus | | ☐ |
| 13 | JUR | Parcourir plusieurs pages avec un filtre actif | Aucune ligne répétée d'une page à l'autre, aucune manquante ; le total annoncé reste constant | | ☐ |

### Résultat final attendu
Le juriste retrouve « les dossiers en appel, en cours, passés devant un juge en mars », par une
adresse qu'il peut transmettre.

### Points de contrôle
- **Le type et le statut portent sur une même étape.** C'est le point du parcours 3, et le seul qui
  distingue un filtre juste d'un filtre qui ratisse.
- **Le total paginé reste juste** (parcours 13) quand un dossier a plusieurs étapes ou plusieurs
  audiences dans la fenêtre.
- **Le tri n'est pas un filtre** : il ne retire aucune ligne.
- Le tri par étape n'existe pas, volontairement : une fois filtrée, la liste ne contient plus qu'une
  étape. Si le métier y tient, il devra dire quel ordre il attend sur un dossier aux deux cassations.

---

# 6. Cas négatifs et contrôles métier

Ces fiches courtes se jouent après les parcours correspondants. Elles vérifient les refus, qui sont
autant de garanties métier.

| ID | Cas | Rôle | Mode opératoire | Résultat attendu | Statut |
|---|---|---|---|---|---|
| REC-NEG-001 | Champs obligatoires manquants | JUR | Créer un dossier en cliquant « Enregistrer » sur un formulaire vide | Chaque champ obligatoire porte son propre message ; rien n'est créé | ☐ |
| REC-NEG-037 | Partie au procès manquante | JUR | Remplir tout le formulaire mais laisser le **demandeur** vide, ou n'y mettre que des espaces | Refus, le message se montrant sous la ligne fautive. Un dossier contentieux dit qui s'oppose à qui, ou n'est pas créé | ☐ |
| REC-NEG-027 | Pièce obligatoire manquante | JUR | Remplir tout le formulaire de création **sauf un des deux fichiers**, puis « Enregistrer » | Refus, message sous la pièce sans fichier ; rien n'est créé. Les références, elles, peuvent rester vides | ☐ |
| REC-NEG-038 | Dossier sans agence d'origine | JUR | Remplir le formulaire de création **sans choisir d'agence d'origine**, puis « Enregistrer » | Refus : le champ porte son message. L'agence d'origine est obligatoire depuis le 2026-10-05 | ☐ |
| REC-NEG-039 | Code d'agence inventé | JUR | Par l'API, créer un dossier avec `codeAgenceOrigine` = `5466546546` | Refus : « Aucune agence ouverte ne porte le code « 5466546546 » », et le refus **nomme le champ**. C'est le code trouvé sur l'unique dossier de recette qui en portait un | ☐ |
| REC-NEG-040 | Code d'agence modifié | DJ | Par l'API, envoyer un `PUT` sur une agence avec un code différent du sien | Refus : « Le code d'une agence ne se modifie pas ». À l'écran, le champ est inactif - les deux doivent concorder | ☐ |
| REC-NEG-041 | Diligence proposée deux fois | JUR | Par l'API, proposer la diligence sur un dossier dont une proposition est déjà en attente | Refus : « Une proposition de diligence particulière est déjà en attente d'arbitrage sur ce dossier ». À l'écran, le bouton a disparu - les deux doivent concorder | ☐ |
| REC-NEG-042 | Diligence posée par un juriste | JUR | Par l'API, envoyer un `PUT` sur `/dossiers/{id}/sensibilite` | Refus 403 : poser ou lever la diligence engage la double validation des frais, ce n'est pas un geste de saisie | ☐ |
| REC-NEG-043 | Retrait sur un dossier ordinaire | DJ | Retirer la diligence d'un dossier qui n'en a pas | Refus : « il n'y a rien à retirer » | ☐ |
| REC-NEG-002 | Deux dossiers ne portent jamais le même numéro | JUR | Créer deux dossiers à la suite et comparer leurs références | Elles diffèrent et **se suivent** (…0007 puis …0008). Le doublon de saisie n'existe plus : le système attribue | ☐ |
| REC-NEG-003 | Référence de facture en doublon | AVO | Déposer deux demandes avec la même référence | Refus, y compris si la première a été **rejetée** | ☐ |
| REC-NEG-004 | Deux clients ne portent jamais le même numéro | DJ | Créer deux clients à la suite et comparer leurs références | Elles diffèrent et se suivent. Aucun champ Référence n'est proposé à la création | ☐ |
| REC-NEG-005 | Audience sur une étape non ouverte | JUR | Tenter de planifier sur une étape au statut `OUVERTURE` | L'action n'est pas proposée ; l'écran explique qu'il faut ouvrir l'étape | ☐ |
| REC-NEG-006 | Arbitrage par un rôle non autorisé | JUR | Chercher « Statuer sur la diligence particulière » sur un dossier à diligence particulière | Le bouton n'existe pas pour ce profil | ☐ |
| REC-NEG-007 | Accès direct par URL à un écran interdit | AVO | Saisir `/dossiers`, `/clients`, `/admin/audit` | Écran « Vous n'avez pas les droits nécessaires » à chaque fois | ☐ |
| REC-NEG-008 | Opération impossible selon le statut | JUR | Rabattre un délibéré dont l'étape n'est pas `DELIBERE_VIDE` | L'action n'est pas proposée | ☐ |
| REC-NEG-009 | Transition d'étape interdite | JUR | Choisir une transition non permise dans « Faire passer à » | Seules les transitions permises sont proposées ; une transition refusée affiche les états permis | ☐ |
| REC-NEG-010 | Compte avocat non rattaché | AVO | Se connecter avec un compte `ROLE_AVOCAT` **sans** fiche au référentiel | Message expliquant que le compte n'est « pas encore rattaché au répertoire » - pas une erreur technique | ☐ |
| REC-NEG-011 | Motif obligatoire à chaque refus | AST, DJ, SH | Rejeter une demande de frais, une publication, une diligence particulière, une suppression, sans motif | Refus dans les quatre cas | ☐ |
| REC-NEG-012 | Fichier au format interdit | JUR | Déposer un `.odt` en GED | Refus explicite citant les formats admis, Word compris | ☐ |
| REC-NEG-035 | Word à l'ancien format, sans aperçu | JUR | Déposer un `.doc` (Word 97-2003), puis cliquer « Consulter » | Le dépôt est **accepté**. L'aperçu ne montre pas le document mais **explique pourquoi** - ancien format, non affichable par le navigateur - et propose le téléchargement. Ce n'est pas une anomalie | ☐ |
| REC-NEG-013 | Fichier trop lourd | JUR | Déposer un fichier de plus de 10 Mo | Refus explicite sur le poids | ☐ |
| REC-NEG-014 | Double demande de suppression | JUR | Demander deux fois la suppression du même document | La seconde est refusée : une demande est déjà en attente | ☐ |
| REC-NEG-015 | Double correspondance | DJ | Transmettre deux fois la correspondance d'une même publication | La seconde est refusée | ☐ |
| REC-NEG-016 | Double vote du même profil | DJA | Donner deux fois son accord sur une validation conjointe | Le second est refusé | ☐ |
| REC-NEG-017 | Document du dossier non validé invisible | JUR | Chercher un **document du dossier** (type Pièce, Décision ou Conclusions) au statut déposé | Il n'apparaît nulle part côté juriste. Le **compte rendu d'audience**, lui, est lisible de tous dès son dépôt | ☐ |
| REC-NEG-036 | Un compte rendu ne se rejette pas | AST | Ouvrir un compte rendu déposé et chercher à le rejeter | Aucun bouton « Rejeter » n'est proposé. Par l'API, le rejet est refusé avec son motif : le récit se conteste par une correspondance | ☐ |
| REC-NEG-018 | Notification d'autrui | JUR | Tenter de marquer traitée une notification qui ne lui est pas destinée | Refus | ☐ |
| REC-NEG-019 | Fenêtre de dates inversée | DJ | Saisir une date de début postérieure à la date de fin (rapports, supervision) | Message métier à l'écran, jamais une erreur technique | ☐ |
| REC-NEG-020 | Paramètre système incohérent | DJ | Saisir une valeur invalide dans « Configuration » | Refus expliqué ; la valeur en base ne bouge pas | ☐ |
| REC-NEG-021 | Numéro de téléphone hors format | DJ | Saisir `2 22 45 67 89`, puis un numéro étranger sans indicatif | Refus dans les deux cas, avec la règle rappelée | ☐ |
| REC-NEG-022 | Avocat sans identifiant de connexion | DJ | Créer un avocat sans « Identifiant de connexion » | Refus : le champ est obligatoire pour ce type | ☐ |
| REC-NEG-023 | Abandon d'une saisie en cours | JUR | Commencer la création d'un dossier puis cliquer une entrée de menu | Une confirmation « Quitter sans enregistrer ? » protège la saisie ; « Annuler » du formulaire n'est pas intercepté | ☐ |
| REC-NEG-024 | Retour arrière après déconnexion | Tous | Se déconnecter puis utiliser la flèche Retour | La session ne revient pas ; l'écran de connexion reste | ☐ |
| REC-NEG-025 | Données inexistantes | JUR | Ouvrir `/dossiers/999999` et une URL inconnue | Page « introuvable » lisible, pas une trace technique | ☐ |
| REC-NEG-026 | Identifiants erronés | - | Se connecter avec un compte inexistant, puis avec un mot de passe faux | **Le même** message dans les deux cas | ☐ |
| REC-NEG-028 | Mise en délibéré sans audience tenue | JUR | Sur une étape **En cours** dont aucune audience n'a de compte rendu, « Faire passer à » → **En délibéré** | Refus : « Aucune audience tenue sur cette étape : le compte rendu d'au moins une audience doit être saisi avant la mise en délibéré. » | ☐ |
| REC-NEG-029 | Mise en délibéré, une audience encore planifiée | JUR | Tenir une audience (compte rendu saisi), en planifier une seconde, puis passer l'étape **En délibéré** | Refus : « Une audience reste planifiée sur cette étape : tenez-la ou annulez-la avant la mise en délibéré. » Au-delà d'une, le refus **dit le nombre** | ☐ |
| REC-NEG-030 | Recours contre un délibéré favorable | JUR | Enregistrer un résultat **Favorable**, puis tenter d'exercer un recours | Refus : « Le délibéré de cette étape est favorable : un recours ne s'exerce que contre une décision défavorable ou mixte. » | ☐ |
| REC-NEG-031 | Archivage d'étape sans décision définitive | JUR | Sur une étape clôturée, « Faire passer à » → **Archivé**, sans avoir saisi d'adjudication ni de condamnation | Refus : « Aucune décision définitive n'est enregistrée sur cette étape : l'adjudication ou la condamnation doit être saisie avant l'archivage. » | ☐ |
| REC-NEG-032 | Archivage de la **dernière** étape, frais non soldés | JUR (+ AVO) | Déposer une demande de frais et la laisser en cours, puis archiver la dernière étape non archivée du dossier | Refus citant le message : « Une demande de frais de ce dossier n'est ni payée ni rejetée (…) : soldez-la avant d'archiver la dernière étape du dossier. » Le refus **nomme les demandes en cause** - référence de facture, ou l'avocat à défaut - et en cite trois au plus. Une étape qui **n'est pas** la dernière s'archive sans ce contrôle : vérifiez les deux | ☐ |
| REC-NEG-033 | Ouvrir un degré supérieur, l'étape antérieure en délibéré | JUR | Mettre **Instance** en délibéré, puis ouvrir les débats de l'**Appel** | Refus : « L'étape « Instance » est en délibéré : son jugement doit être rendu avant d'ouvrir les débats à ce degré. » | ☐ |
| REC-NEG-034 | Archivage à la jurisprudence, dossier encore en cours | JUR | Fiche d'un dossier dont une étape n'est ni clôturée ni archivée, onglet **Décisions** → « Archiver à la jurisprudence » | Refus : « Ce dossier porte encore une étape en cours : une décision ne rejoint la base jurisprudentielle qu'une fois définitive, tous recours épuisés. » Depuis le menu *Jurisprudence*, **sans dossier rattaché**, l'archivage reste libre : c'est voulu, cette voie sert à verser une décision trouvée ailleurs | ☐ |

---

# 7. Parcours critiques multi-rôles

Ces quatre enchaînements sont les plus structurants : ils ne peuvent pas être joués par une seule
personne, et c'est là que se voient les vrais défauts de circulation entre rôles. Prévoyez deux
sessions ouvertes en parallèle.

## MR-01 - Demande de frais avec validation conjointe (REC-E2E-012)

**Avocat (`avocat.test`)**
→ *Déposer une demande* : dossier, facture `FAC-MR-01`, montant supérieur au seuil, pièce jointe → « Déposer »
→ **Attendu** : la demande est déposée et visible dans « Mon espace » au statut déposé.

**Assistante (`assistante.test`)**
→ File « À contrôler » → ouvrir la demande → consulter la pièce → « Valider »
→ **Attendu** : la demande quitte sa file et part au contrôle d'opportunité.

**DJA (`dja.test`)**
→ Ouvrir la demande → l'écran annonce la validation conjointe → « Valider », puis « Donner mon accord »
→ **Attendu** : l'accord de la DJA est enregistré, celui du DJ est annoncé comme manquant.

**DJ (`dj.test`)**
→ Ouvrir la demande → « Donner mon accord »
→ **Attendu** : les deux accords réunis, la demande passe à **Validée**.

**Assistante**
→ File « À payer » → « Marquer comme payée »
→ **Résultat final** : demande **Payée**, avocat informé, aucune étape franchie sans son responsable.

## MR-02 - Publication : de l'avocat au juriste, puis retour officiel (REC-E2E-014 + 015)

**Avocat**
→ *Déposer une publication* → « Compte rendu d'audience » → dossier, audience, récit, pièce → « Déposer le compte rendu »
→ **Attendu** : dépôt confirmé, publication **invisible** des juristes.

**Assistante**
→ « Publications » → « À valider » → ouvrir → lire le récit et la pièce → « Valider »
→ **Attendu** : publication **Validée**, visible des juristes.

**Juriste (`juriste.test`)**
→ Ouvrir la publication → « Votre commentaire » → « Envoyer au DJ/DJA »
→ **Attendu** : commentaire adressé à la direction ; aucune voie directe vers l'avocat.

**DJ**
→ Ouvrir la publication → « Transmettre à l'avocat » → objet + corps → confirmer
→ **Résultat final** : une correspondance **unique** est transmise ; une seconde tentative est refusée.

## MR-03 - Constitution d'un prestataire (REC-E2E-016)

**Juriste**
→ Fiche du dossier → « Solliciter un prestataire » → prestataire + motif → « Soumettre »
→ **Attendu** : demande créée, visible dans « Constitutions » au statut en attente.

**Supérieur hiérarchique (`sh.test`)**
→ Accueil : carte « Constitutions à signer » → « Rédiger la lettre » → corps → « Enregistrer la lettre » → « Signer »
→ **Attendu** : constitution **Validée**, lettre PDF générée.

**Juriste**
→ Onglet « Documents » du dossier
→ **Résultat final** : la lettre est rangée dans la GED du dossier ; l'avocat constitué la voit dans « Mon espace ».

## MR-04 - Suppression d'un document (REC-E2E-017)

**Juriste**
→ Onglet « Documents » → « Demander la suppression » → motif → confirmer
→ **Attendu** : demande envoyée au DJ et à la DJA ; **le document reste en place**.

**DJ**
→ « Demandes de suppression » → « En attente » → « Rejeter » avec motif
→ **Attendu** : le document reste, le motif est consultable.

**Juriste**
→ Redemander la suppression
→ **Attendu** : acceptée, la demande précédente étant close.

**DJ**
→ « Approuver » → confirmer
→ **Résultat final** : le document disparaît de l'onglet Documents, l'action est tracée à l'audit.

---

# 8. GAPS / ANOMALIES / POINTS À CLARIFIER

Points relevés **pendant l'analyse des deux dépôts**, à confirmer ou à arbitrer. Rien n'a été
corrigé ; aucun comportement n'a été déduit silencieusement.

### Documentation contradictoire

1. **QF-03 est présenté comme bloquant alors qu'il est résolu.** `SCREEN_MAP.md` §8 affirme qu'« il
   n'existe aucun `GET` sur les adjudications ni les condamnations » et que l'onglet 14 « restera en
   écriture seule ». **Vérification faite dans le code : c'est faux depuis Q-88 / M16.**
   `DecisionDefinitiveController` expose `GET /dossiers/{id}/decisions`, qui renvoie les
   adjudications et les condamnations avec leurs identifiants ; `decisionService.ts` et
   `onglet-decisions.tsx` l'appellent. Le même document se contredit d'ailleurs lui-même : sa ligne
   14 cite l'endpoint. **Le paragraphe d'alerte de `SCREEN_MAP.md` §8 est à retirer** - laissé tel
   quel, il fera conclure à tort à une régression pendant la recette.

### Fonctionnalités incomplètes, documentées comme telles

2. **Statut de paiement d'une condamnation (QF-40).** Une condamnation se crée toujours « En
   attente » ; le statut n'est pas accepté à la création. Documenté dans `RAPPORT_DE_RECETTE.md` §5.2.
3. **Aucune liste de rattrapage pour la diligence particulière et les dérogations (QF-08).** Le mécanisme prévu
   est la notification. Un DJ qui manque ou traite trop vite une notification n'a pas d'écran
   listant les dossiers restant à arbitrer, là où les trois autres circuits ont une file.
   Réserve consignée par le projet, candidate V2.

### Points liés aux notifications externes (chantier en cours)

4. **Le canal WhatsApp ne délivre pas.** Cause identifiée par l'administrateur du Notification
   Engine : **les frais d'envoi du canal ne sont pas payés** par l'entreprise. Le canal est éteint
   par défaut dans la grille. À rallumer et à re-tester après régularisation.
5. **Les accusés de délivrance ne sont pas publiés.** Les topics de suivi du moteur sont vides pour
   tous les services ; la colonne « Confirmées » de la supervision reste donc vide, et un envoi
   réussi reste à l'état « remis ». Question ouverte chez l'administrateur.
6. **Le rappel `callbackUrl` n'est pas spécifié.** Ni son corps ni son authentification ne sont
   documentés par le guide du moteur ; notre implémentation signe l'URL, à confirmer.
7. **Aucun envoi réel pendant cette recette.** `NOTIFICATION_ENGINE_ACTIF` vaut `false` : les
   notifications externes sont journalisées, pas envoyées. Une campagne de recette portant sur les
   envois réels devra être conduite séparément, avec la redirection hors production active.

### Limites d'architecture, assumées et documentées

8. **Un utilisateur interne jamais connecté n'est pas affectable (QF-16).** Les comptes vivent dans
   Keycloak ; l'application ne connaît une personne qu'à sa première connexion. Contournement
   documenté : s'affecter soi-même puis réaffecter. Les avocats ne sont pas concernés.
9. **Le profil applicatif est figé à la première connexion.** Changer le rôle d'une personne dans
   Keycloak change ses droits, mais pas le profil enregistré dans l'application (utilisé pour les
   listes et les destinataires d'alertes). Aucun écran ne permet de le corriger. Constat tiré du
   code (`UtilisateurProvisioningService`), non consigné comme décision.
10. **Aucune gestion de compte dans l'application** : ni création, ni réinitialisation de mot de
    passe, ni authentification multifacteur, ni connexion unique (QF-18). C'est une décision du
    projet, à rappeler au métier pour éviter une attente déçue.

### Comportements à confirmer avec le métier

11. ~~Le calendrier compte le premier jour de la période suivante (QF-31).~~ **Corrigé le
    2026-09-23** : la période s'arrête la veille de la suivante, côté serveur comme à l'écran.
12. ~~Une audience est dite « tenue » le jour où l'on saisit son compte rendu (QF-32).~~ **Corrigé
    le 2026-09-23**, sur arbitrage du métier : la date de tenue est la date planifiée. Le rapport
    d'activité ne dépend donc plus de la date de saisie.
13. ~~L'historique d'un dossier n'est pas traduit (QF-24).~~ **Faux - vérifié dans le code.** La
    traduction existe depuis Q-111/Q-112 : le backend renvoie un code typé et des détails
    structurés, `useLibellesHistorique` les traduit sur l'onglet Historique comme sur l'audit. Seuls
    deux codes récents (`AUDIT_EXPORTE`, `ARCHIVE_TELECHARGEE`) et quatre clés de détails
    manquaient : **ajoutés le 2026-09-23**. La ligne QF-24 de `RAPPORT_DE_RECETTE.md` §5.2 était
    périmée, comme l'était celle de QF-03. À vérifier en séance : basculer en `EN` sur l'onglet
    Historique d'un dossier et sur l'écran Audit - plus aucun libellé français ne doit subsister.
14. ~~Alarme à échéance passée : la règle n'est portée que par l'interface.~~ **Corrigé le
    2026-09-23** : `CreerAlarmeRequest` et `ReprogrammerAlarmeRequest` portent désormais la
    contrainte côté serveur. La règle ne vit plus seulement dans le navigateur. L'étape 5 de
    REC-E2E-007 vérifie le refus à l'écran ; par l'API, la demande est rejetée en 400.

### Réserves de mise en production (hors périmètre de cette recette)

15. **MinIO** : l'URL publique et la politique CORS pointent aujourd'hui `localhost` ; à
    reconfigurer pour l'origine réelle.
16. **Documentation d'API ouverte** : `/v3/api-docs` et `/swagger-ui` sont accessibles sans
    authentification côté backend ; à fermer avant la production.
17. **Durées de jetons** : mesurées sur le realm de développement (accès 60 min, rafraîchissement
    30 min) ; à revérifier si le realm de production diffère.

---

# 9. Synthèse de la recette

| Domaine | Nombre de workflows | Validés | Échecs | Bloqués | Non testés |
|---|---:|---:|---:|---:|---:|
| Transverse (connexion, accueil, droits) | 1 | | | | |
| Référentiels (clients, intervenants) | 2 | | | | |
| Dossiers (ouverture, diligence particulière, dérogation, filtres, pourvois) | 5 | | | | |
| Audiences et alarmes | 5 | | | | |
| Délibérés | 2 | | | | |
| Frais d'avocats | 3 | | | | |
| Publications et constitutions | 3 | | | | |
| Gestion documentaire | 2 | | | | |
| Décisions et jurisprudence | 2 | | | | |
| Pilotage et administration | 3 | | | | |
| Notifications (applicatives et externes) | 2 | | | | |
| Audit | 1 | | | | |
| **Total parcours de bout en bout** | **32** | | | | |
| Cas négatifs (REC-NEG) | 43 | | | | |
| Parcours multi-rôles (MR) | 4 | | | | |

### Critères de préparation à la remise au métier

À vérifier avant de considérer la campagne comme terminée. Ce sont des critères d'achèvement de la
recette, non un jugement sur l'application :

1. **Couverture** : les 32 parcours, les 43 cas négatifs et les 4 enchaînements multi-rôles portent
   un statut autre que « À tester ».
2. **Priorité haute** : aucun parcours marqué *Haute* dans la matrice n'est en échec ou bloqué sans
   analyse écrite.
3. **Multi-rôles** : les quatre enchaînements MR-01 à MR-04 ont été joués avec deux personnes
   réelles, ou deux sessions distinctes, et non simulés par un seul compte.
4. **Changements d'état** : chaque transition annoncée a été observée à l'écran par le rôle suivant
   du circuit, pas seulement par celui qui l'a provoquée.
5. **Droits** : pour chaque écran réservé, le refus a été vérifié **par l'URL directe**, pas
   seulement par l'absence d'entrée de menu.
6. **Écarts** : chaque ligne *Résultat obtenu* divergente est reportée dans §8 avec sa fiche, son
   étape, l'heure et le compte utilisé.
7. **Points ouverts** : les éléments du §8 ont été présentés au métier et arbitrés - en particulier
   QF-03 (décisions en écriture seule), l'absence de file de rattrapage pour les arbitrages du DJ,
   et l'absence de gestion de comptes dans l'application.
8. **Notifications externes** : si le métier attend des envois réels (courriel, SMS, Teams), une
   campagne distincte reste à conduire, moteur activé, sur des destinataires de test, après
   régularisation du canal WhatsApp.
9. **Jeu de données** : les données créées pendant la recette sont identifiées (préfixe `REC-`) et
   leur sort est décidé - conservation pour la formation, ou purge avant la bascule.

---

# 10. Procès-verbal de recette

Cette page est **à compléter et à signer par le métier** à l'issue de la campagne. Elle n'est pas
remplie à la livraison : c'est le métier qui prononce la recette, personne d'autre.

### Identification de la campagne

| | |
|---|---|
| Application | Audiences et Délibérés - Direction Juridique |
| Version recettée | |
| Environnement | |
| Période de la campagne | du ............ au ............ |
| Pilote de la recette | |

### Résultat de la campagne

Report des totaux de la synthèse (§9).

| | Nombre | Validés | Échecs | Bloqués | Non testés |
|---|---:|---:|---:|---:|---:|
| Parcours de bout en bout | 30 | | | | |
| Cas négatifs | 37 | | | | |
| Parcours multi-rôles | 4 | | | | |

### Décision du métier

Cocher une seule case.

| | Décision | Portée |
|---|---|---|
| ☐ | **Recette prononcée sans réserve** | L'application est acceptée en l'état |
| ☐ | **Recette prononcée avec réserves** | Acceptée, les réserves listées ci-dessous étant traitées selon l'échéance convenue |
| ☐ | **Recette refusée** | Une nouvelle campagne est nécessaire après correction |

### Réserves et écarts retenus

Chaque ligne renvoie à une fiche et à son étape. Les écarts non repris ici sont réputés abandonnés.

| N° | Fiche et étape | Écart constaté | Gravité | Échéance convenue |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |

### Points ouverts présentés au métier

À confirmer comme présentés et arbitrés, ou à reporter en réserve :

| | Point | Arbitrage |
|---|---|---|
| ☐ | Statut de paiement d'une condamnation à la création du dossier | |
| ☐ | Absence de file de rattrapage pour les arbitrages du DJ et de la DJA | |
| ☐ | Confidentialité des dossiers impliquant un agent de la banque | |
| ☐ | Notifications externes : aucune émission réelle n'a été recettée | |
| ☐ | Sort du jeu de données de recette : conservation ou purge | |

### Signatures

| Rôle | Nom | Date | Signature |
|---|---|---|---|
| Directeur Juridique | | | |
| Directeur Juridique Adjoint | | | |
| Juriste référent | | | |
| Assistante | | | |
| Supérieur hiérarchique | | | |
| Maîtrise d'œuvre (DSI) | | | |

> La recette prononcée engage sur le périmètre réellement joué, consigné aux §4, §6 et §7. Un
> parcours resté « À tester » n'est pas un parcours validé : il reste hors du périmètre accepté.
