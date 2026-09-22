# DECISIONS_AND_OPEN_QUESTIONS

> Arbitrages rendus, questions ouvertes, risques. Mis à jour en continu.
> Dernière mise à jour : 2026-09-15 (pistes 1 et 2 du recensement appliquées — QF-43 et backend Q-99).
> Précédente : 2026-09-14 (revue de clôture — QF-42 corrigé ; RF-01, RF-02 et RF-04 closes,
> elles étaient traitées depuis longtemps mais restées étiquetées comme ouvertes).
>
> **État à la clôture** : **aucune question bloquante**. QF-16 et QF-08 ont été tranchées le
> 2026-09-15 après relecture des sources — la première comme limite assumée, la seconde comme
> non-lacune. Sept points `🟡` sont documentés et assumés.

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
| 2026-09-14 | **QF-26 / Q-97** | **Les pièces justificatives sont de vrais fichiers.** Correction du porteur du projet : j'avais conclu à tort à une conformité assumée. Les sources sont sans ambiguïté — UC-INT-01 « l'avocat **charge** les pièces », UC-INT-02 l'instructeur les **affiche**, et le dictionnaire parle de « chemins ou références ». Téléversement en deux temps, URL pré-signées sur le détail. | F16 |
| 2026-09-14 | **QF-01 / Q-96** | **Le portail Avocat est livré**, avec quatre lectures cadrées sur le prestataire connecté. Les deux premières — ses dossiers, les audiences d'un de ses dossiers — répondent à une exigence écrite : US 4.1 fait soumettre un `dossierId`, US 5.1 demande de déposer « en choisissant le dossier et l'audience ». Les deux autres — ses publications, ses constitutions — sont du **périmètre ajouté**, **à confirmer avec la Direction Juridique**. Un dossier ne lui montre que son identification : ni client, ni risque, ni sensibilité. | F16 |
| 2026-09-14 | **QF-04 / Q-95** | **Le tableau de bord s'ouvre à la DJA** et QF-04 est close. Sa prémisse était caduque : depuis Q-81 (F12) le DJ porte `ROLE_JURISTE` et atteint les rapports, ce qui rend le parcours P9 jouable. Restait la DJA, privée du tableau de bord — `hasAnyRole('DJ','DJA')` désormais. US 8.5 ne nommait que le DJ, les spécifications fonctionnelles parlent du tableau consolidé « à travers le DJ/DJA » (STK-06). | F15 |
| 2026-09-14 | **Q-94** (backend) | **La vue consolidée d'un client interrogeait la base dossier par dossier** — 930 requêtes et 11 à 19 s pour 310 dossiers (QF-41). Trois requêtes pour la liste entière, contrat inchangé : **0,12 s** mesuré sur 355 dossiers. Ma première recommandation — alléger la réponse — était fausse : le contrat inclut `etapes` et l'écran 13 s'en sert. | F14 |
| 2026-09-14 | **Q-91 bis** (backend) | **Les plafonds des compteurs sont ramenés à ce que les sources permettent.** Le tableau CONF01-07 (US §11.2) fixe des valeurs par défaut, jamais des maxima, et la story 7.1 n'exige qu'un « entier positif ». Mes plafonds de 1 000 et 365 n'avaient pas d'assise ; restent les deux bornes justifiées — 10 Mo pour la GED (CONF06) et douze chiffres pour le seuil de montant. | F14 |
| 2026-09-12 | **Q-92 / Q-93** (backend) | **Trois listes paginaient sans ordre défini** — notifications, clients, dossiers. Trouvé en construisant l'écran 03, puis démontré en usage : passé vingt clients, celui qu'un juriste venait de créer basculait en page 2, **invisible pour son auteur**. Tri du plus récent au plus ancien, départagé par `id`. Les trois autres listes paginées (frais, publications, jurisprudences) l'étaient déjà. | F14 |
| 2026-09-12 | **Q-91** (backend) | **Les paramètres système sont validés par clé** et publient leur règle de saisie. Évolution backend décidée en ouverture de F14 : sans elle, une saisie erronée du DJ (« 50 000 000 ») ressortait en **erreur 500** dans les frais, les délibérés ou la GED — loin de l'écran fautif. L'écran 41 construit son champ à partir du contrat au lieu d'en redéclarer une copie. | F14 |
| 2026-09-22 | **QF-51 / Q-116** ✅ | **Un client se corrige depuis sa fiche.** Un client créé ne pouvait plus être modifié : le backend n'avait pas de `PUT /clients/{id}` (reporté en Q-23, faute de besoin). **Référence figée** — décision du porteur du projet : elle est l'identifiant du client ; le champ est affiché, désactivé, avec son explication. **Modification tracée** : `CLIENT_MODIFIE`, traduit, avec six clés de détails (ancien et nouveau nom, courriel, téléphone). **Une seule modale** pour créer et corriger, pour que leurs règles de validation ne puissent pas diverger. **La fiche affiche désormais courriel et téléphone** : sans eux, on aurait corrigé des coordonnées invisibles à l'endroit même où on les corrige. | Écran 20 |
| 2026-09-18 | **QF-50** ✅ | **Deux files de travail tronquaient en silence.** Les demandes de suppression (écran 36) et les constitutions à signer interrogent une API **paginée à dix lignes**, mais n’affichaient **aucun contrôle de pagination** : au-delà de la dixième, les demandes étaient **inatteignables**. Et comme ces files sont FIFO — la plus ancienne d’abord, ce qui est le bon ordre de traitement — ce sont **les plus récentes** qui disparaissaient : un juriste déposant une demande pouvait n’apparaître nulle part sur l’écran de qui devait l’arbitrer. Mesuré le 18/09 : 12 demandes en attente, 2 hors de portée. Le composant `Pagination` existait déjà et sert six autres écrans ; il est posé sous les deux tableaux, rendu seulement s’il y a plus d’une page. **Trouvé par la suite e2e**, qui a commencé à échouer sans qu’aucune ligne de code n’ait changé — le jour où les files ont franchi dix. Les parcours cherchaient leur ligne « dans la file » alors qu’ils la cherchaient en première page ; ils parcourent désormais les pages (`tests/e2e/files-de-travail.ts`). **Une assertion qui suppose l’état de son environnement mesure l’environnement, pas le produit.** | QF-50 |
| 2026-09-17 | **Q-114** (backend) | **L’empreinte devient utilisable.** Signalé en recette : `empreinte 59bde5c17…` d’un seul tenant, que personne ne compare ni ne dicte — une empreinte que nul ne vérifie n’est pas une preuve, c’est une décoration. Trois réponses. **1. Un vérificateur dans l’écran** : on dépose le fichier reçu, le **navigateur calcule l’empreinte** (`crypto.subtle`) et seule celle-ci part — un document d’audit n’a pas à traverser le réseau pour être comparé à lui-même. Un fichier inconnu reçoit une **réponse, pas une erreur**. **2. Une référence lisible**, `AUD-2026-0042`, qui s’écrit, se prononce et se retrouve : **l’empreinte prouve, la référence désigne**. Elle vient d’une **séquence dédiée** car elle doit figurer dans le PDF, donc exister avant le fichier — pour la même raison qu’elle ne peut pas dériver de l’empreinte. Le nom du fichier la porte. **3. L’empreinte est affichée groupée par blocs de huit et copiable** : recopier soixante-quatre caractères à la main est la meilleure façon d’introduire l’erreur qu’on voulait écarter. **Défaut trouvé en chemin** : `Content-Disposition` et `X-Empreinte-SHA256` n’étaient pas exposés en CORS — le bandeau affichait « empreinte … » vide depuis Q-113, et le nom de fichier était reconstruit au lieu d’être lu. L’assertion e2e d’alors regardait la phrase sans regarder la valeur. **L’écran énonce sa portée** : « reconnue » prouve la non-altération, pas l’antériorité face à un tiers. | Q-114 |
| 2026-09-17 | **Q-113** (backend) | **L’export de l’audit, scellé** — jalon 3 et dernier du chantier. Un inspecteur emporte une pièce ; une pièce qu’on peut rééditer ne prouve rien. Chaque extraction est donc produite, **empreinte SHA-256 calculée**, déposée côté serveur et consignée avec sa période, son auteur et son instant — l’empreinte voyageant aussi dans un en-tête, pour se comparer sans interroger l’application. **PDF et Excel**, jamais l’un ou l’autre : l’un fige une pièce, l’autre fournit une matière. **Six raccourcis de période côté écran**, jamais dans l’API — les y mettre aurait figé six calendriers et interdit la période libre ; chacun couvre l’unité écoulée et s’arrête aujourd’hui. **Période obligatoire à l’export** alors qu’elle est facultative à la consultation, et **plafond qui refuse plutôt que de tronquer** : une archive tronquée mentirait sur ce qu’elle couvre, et son empreinte scellerait ce mensonge. Télécharger une archive est **tracé** ; la clé de stockage n’est jamais exposée. | Q-113 |
| 2026-09-17 | **QF-24** ✅ | **Les libellés d’historique sont traduits — QF-24 close.** Sign alé en recette : en anglais, les colonnes *Action* et *Détails* restaient en français. Le défaut était connu et **jusque-là insoluble** — `historique_action.action` est une phrase libre rédigée par le backend, et les clés de `details` des identifiants techniques. **Q-111 l’a rendu soluble** en posant un code typé sur chaque ligne : la traduction devient une correspondance, entièrement côté client. 44 natures d’action et 52 clés de détails traduites, sur **les deux écrans** — l’audit et l’onglet Historique d’un dossier — ainsi que dans le filtre par action. **Le repli n’est pas décoratif** : un code non encore traduit affiche la phrase du backend, jamais le code brut. **La base ne change pas** : `action` reste la phrase enregistrée au moment du fait, une trace ne se retraduisant pas rétroactivement. L’avertissement affiché aux anglophones est **supprimé** : il s’excusait d’un défaut qu’on sait désormais corriger. | QF-24 |
| 2026-09-17 | **Q-112** (backend) | **Écran d'audit (écran 42), réservé au DJ et à la DJA.** `GET /historique` remplace `GET /historique/systeme` : le périmètre — tout / hors dossier / un dossier — devient un **critère**, et le journal de Q-110 y déménage plutôt que de coexister, deux endroits où chercher la même trace étant la fragmentation qu'on voulait supprimer. **Le filtre par personne est autorisé** (NF-CONF-01), et c'est ce qui rend nécessaire que **toute consultation soit elle-même historisée**, avec ses critères — protection de qui consulte autant que de qui est consulté. L'écran l'annonce explicitement, et énonce aussi ce qu'il ne couvre pas : seules les modifications sont tracées. Capacité dédiée `consulterAudit`, **distincte** d'`administrerConfigurations` et de `superviserAlertes`. **Ce qui reste sur l'écran des paramètres** : « modifié le … par … » sur chaque ligne — la question qui naît en regardant un réglage mérite une réponse sur place, celle qui naît d'un soupçon appartient à l'audit. | Q-112 |
| 2026-09-17 | **Q-111** (backend) | **La nature des actions historisées est typée** — jalon 1 du chantier d'audit. `action` était une phrase libre, parfois concaténée ; filtrer dessus supposait un `LIKE` qui ment par omission dès qu'un libellé change d'un mot. 42 points d'écriture convertis, dont 6 dont la partie variable — nom d'étape, sens d'une décision, clé de configuration — **descend dans `details`**, où elle devient interrogeable. Le libellé est désormais porté par l'énumération et non transmis à l'appel : un écart entre le code et le texte affiché est devenu impossible. Reprise des 193 lignes existantes **sans aucune non classée**. Côté frontend, le filtre du journal bascule du libellé vers le code, et une clé de configuration ne produit plus une entrée par paramètre. **Conséquence assumée** : le libellé affiché est générique (« Modification de la configuration »), la clé se lit dans les détails. | Q-111 |
| 2026-09-17 | **NF-CONF-01** | **Conservation de l'historique : illimitée, sans purge — décision du porteur du projet, revue le 2029-09-17.** Trois motifs : la trace doit survivre au litige (un contentieux se rouvre en recours, une purge par date effacerait l'histoire d'un dossier encore plaidé) ; une purge est du code qui échoue en silence ; et le volume ne l'impose pas (748 octets par ligne mesurés). Ce qui est construit malgré tout : export daté avec empreinte, et un **rapport d'éligibilité** qui n'efface rien. La question à reposer en 2029 est celle du **pseudonymat de l'auteur**, `utilisateur_id` étant à la fois ce qui rend l'audit probant et ce qui le rend sensible. | audit |
| 2026-09-17 | **Q-110** (backend) | **Les actions historisées hors dossier deviennent lisibles.** RG-DOS-06 historise chaque modification (42 points d'écriture, 11 services), mais l'unique point de lecture partait d'un dossier : les actions qui n'en ont pas — paramètres système, indexations de jurisprudence — étaient **écrites et jamais relues** (26 lignes sur 657 mesurées en recette). Q-108 avait aggravé la lacune en doublant les détenteurs du pouvoir de modifier les paramètres. Livré : un bloc « Journal des actions système » sur l'écran 41, sous les paramètres, filtrable par auteur, libellé et période. **Quatre décisions.** Le périmètre est **figé côté serveur** par une énumération exclusive, pour qu'ouvrir un jour la vue transversale soit une décision et non un paramètre oublié. Le filtre par libellé est une **liste fermée** construite depuis la base et indépendante des filtres actifs — `action` étant une phrase libre (QF-24), un « contient » aurait menti par omission. Garde **DJ/DJA** et non `ROLE_CONSULTATION` : sur une fiche on regarde un dossier, ici la lecture est agrégée et filtrable par auteur — autre nature, et NF-CONF-01 (RGPD) reste « à définir avec la DRH ». Nommé **journal**, jamais « audit » : seules les modifications sont tracées, aucune consultation ne l'est, et l'écran le dit. **Reste ouvert** : la vue transversale de l'historique des dossiers, qui suppose un code d'action typé et NF-CONF-01 tranché. | Q-110 |
| 2026-09-16 | **Q-109** (backend) | **Le taux de délivrance des alertes devient mesurable.** NF-ALR-02 fait du canal applicatif le canal obligatoire, avec une délivrance > 99 % ; ce taux n'était mesuré nulle part — un échec ne produisait qu'une ligne de journal. **Le piège évité** : `convertAndSendToUser` ne lève aucune exception quand le destinataire est déconnecté, donc « pas d'exception = délivré » aurait affiché 100 % en permanence, panne comprise. Le backend interroge `SimpUserRegistry` avant de pousser et enregistre trois issues — `DIFFUSEE`, `DIFFEREE` (repli garanti, **compte comme délivrée**), `ECHEC`. L'écran 41 affiche **deux taux séparés** : la délivrance (opposable au seuil de 99 %) et la diffusion temps réel (indicateur d'usage, sans seuil) — les réunir en un chiffre unique aurait vidé la mesure de son sens. Gardé par une capacité dédiée `superviserAlertes`, distincte d'`administrerConfigurations` : lire un taux global n'est pas écrire un seuil. | Q-109 |
| 2026-09-16 | **Q-108** (backend) | **L'administration des paramètres système est ouverte à la DJA.** Relevé demandé par le porteur du projet, qui supposait que « la DJA peut tout ce que fait le DJ ». Mesuré sur les jetons réels : `ROLE_DJ` et `ROLE_DJA` sont **tous deux** composites de `ROLE_JURISTE` + `ROLE_SAISIE`, d'où **65 des 80 `@PreAuthorize` en commun** et seulement **deux écarts symétriques** — l'écriture des paramètres (DJ) et le contrôle d'opportunité des frais (DJA). Sa décision : ouvrir le premier, pour la **continuité de service** (DJ absent, plus personne ne pouvait relever un seuil ; la traçabilité est préservée, chaque écriture étant déjà historisée avec son auteur). **L'ouverture reste à sens unique** : le contrôle d'opportunité demeure réservé à la DJA, sinon RG-INT-03 perdrait la séparation de ses deux étapes. Écart restant : **1 sur 38 capacités**, verrouillé par un test. Deux commentaires de `lib/rbac.ts` affirmaient à tort que la DJA n'avait ni le calendrier ni le répertoire — faux, et corrigés : elle y accède par son `ROLE_JURISTE`. | Q-108 |
| 2026-09-16 | **QF-49** | **Le logo de l'en-tête ramène à l'accueil.** Demandé par le porteur du projet. Convention universelle, devenue nécessaire depuis QF-47 : l'en-tête ne défilant plus, le logo est un point d'ancrage **en permanence à l'écran**, là où l'on a l'habitude de cliquer — inerte, il faisait une zone morte au meilleur emplacement de l'interface. Cible `/` sans condition : QF-19 a tranché une racine unique pour tous les profils, avocat compris. **Deux points non évidents.** Le logo n'apparaît qu'à partir de `lg` — en dessous, le retour à l'accueil passe par l'entrée de navigation, et un parcours le garde pour qu'on n'y voie pas un oubli. Le lien porte son propre libellé (`navigation.logoAccueil`) et le logo y devient décoratif : un lien doit annoncer sa destination, pas le propriétaire de l'image qu'il contient. Pas d'`aria-current` — l'entrée « Accueil » le porte déjà. | QF-49 |
| 2026-09-16 | **QF-48** | **Le tiret cadratin « — » disparaît du texte visible au profit du trait d'union « - ».** Demandé par le porteur du projet, appliqué aux 34 libellés de `messages/{fr,en}.json` et aux 11 séparateurs de libellés et `aria-label` du code. **Deux exceptions assumées.** (1) Les 32 placeholders « valeur absente » gardent `—` (`SANS_VALEUR`, `aucuneValeur`) : dans une colonne Montant ou Téléphone, un `-` isolé se lit comme un signe moins ou une valeur tronquée, là où le cadratin dit sans ambiguïté « rien à afficher ». (2) Commentaires de code, titres de tests et fichiers `.md` sont **hors périmètre** : ils ne sont pas l'interface, et les balayer noierait le diff qui compte. **Garde-fou ajouté le 2026-09-17** : la prédiction s'est vérifiée dès le lendemain — un cadratin réintroduit dans un libellé d'archive d'audit, repéré en recette par le porteur du projet. `tests/unit/typographie.test.ts` échoue désormais sur tout cadratin des fichiers de messages (hors le placeholder documenté) et sur tout séparateur ` — ` dans une ligne de code non commentée. Vérifié en le faisant échouer volontairement : une décision de style que rien ne fait respecter n'est pas une décision, c'est un souhait. | QF-48 |
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

### ✅ QF-20 — Le compte rendu d'audience ne pouvait pas porter sa pièce — rouverte puis tranchée (Q-98)

**Constat initial.** `POST /publications/cr-audience` n'accepte qu'un `contenu` textuel, là où un
avocat aurait pu vouloir joindre un document.

**Ce que disent les sources, relues en F16.** La story 5.1 décrit exactement ce contrat :
« je soumets `dossierId`, `audienceId`, `contenu` (non vide) ». Et la story 5.3 prévoit l'autre
voie — « déposer une autre publication (**pièce, décision, conclusion**) » par
`POST /publications/autres`, en fichier. Le backend était donc **conforme à la lettre**, et la
question avait été close sur ce seul constat.

**Rouverte le 2026-09-14 par le porteur du projet**, après F17 : la conformité au contrat ne dit
rien de l'usage. L'avocat qui relate une audience dispose du **plumitif** ; l'envoyer par l'autre
voie lui faisait perdre son rattachement à l'audience, et laissait l'instructeur rapprocher à la
main deux dépôts du même moment. Ce n'était pas une lacune de contrat mais un **arbitrage métier**,
qui n'appartenait ni au contrat ni à moi.

**Tranché** (« Applique ta recommandation ») → **Q-98 côté backend**. La pièce devient **facultative**
sur le compte rendu ; le récit reste obligatoire. Ce qui sépare les deux voies n'est donc plus le
format mais l'**objet** du dépôt : **relater** une audience contre **transmettre** un document du
dossier.

**Côté écran (33).** Les deux onglets deviennent un **formulaire continu** à deux choix décrits. Les
onglets suggéraient un changement de contexte alors que le dossier restait le même en dessous, et
leurs libellés reprenaient le défaut de l'écran 02 en miniature — « Pièce, décision, conclusion »
énumérait les valeurs du champ `typeDocument` affiché juste dessous. Renommé **« Document du
dossier »**, chaque choix porte la phrase qui le distingue, et l'intitulé du bouton dit ce qu'il
fait (« Déposer le compte rendu » / « Déposer le document »).

**Pourquoi pas un formulaire unique sans choix.** Deviner la nature à partir des champs remplis —
une audience choisie vaudrait compte rendu — remplacerait un choix explicite par une règle cachée,
et laisserait sans réponse trois des six combinaisons que le modèle refuse (fichier seul rattaché à
une audience, texte seul sans audience, audience avec un type de document).

**Défaut trouvé en chemin, sur l'écran 32.** Le bloc « Fichier » n'était rendu que pour une *autre*
publication. Le backend renvoyait désormais `nomFichier` et `urlTelechargement` pour le compte rendu,
mais l'Assistante n'aurait jamais pu **ouvrir** la pièce — soit exactement l'usage qui motivait
Q-98. Le bloc est désormais rendu dès qu'il y a un fichier, titré « Pièce jointe » pour un compte
rendu ; il disparaît quand le récit se suffit, plutôt que d'afficher un « — » et deux boutons qui
échoueraient.

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
l'avocat — ainsi que QF-20 (compte rendu déposé en fichier ; rouverte ensuite, cf. Q-98).

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

### ✅ QF-26 — Les pièces justificatives des frais ne sont pas des fichiers — corrigée en F16 (backend Q-97)

**Constat initial.** `POST /frais/demandes` attend `piecesJustificatives: List<String>` et rien
n'était téléversé. J'avais d'abord conclu à une conformité assumée, au motif que la story 4.1
n'exige que « ≥ 1 » entrée — **c'était une lecture trop étroite**, corrigée par le porteur du projet
le 2026-09-14 : ce sont bien des fichiers, PDF ou images.

**Ce que disent les sources, relues à cette occasion :**

| Source | Ce qu'elle dit |
|---|---|
| UC-INT-01, étape 4 | « L'avocat **charge** les pièces justificatives. » |
| UC-INT-02, étape 3 | « Le système affiche la demande, **ses pièces justificatives** et le résultat du contrôle de conformité. » |
| Dictionnaire des données | `pieces_justificatives TEXT[]` — « **Chemins ou références** des pièces (tableau). » |

Le tableau de chaînes n'a jamais été prévu pour des libellés : il doit porter des **chemins** vers
des fichiers stockés. Contrôler la conformité d'une liste de noms n'aurait d'ailleurs aucun sens.

**Corrigé** (backend **Q-97**) en deux temps : `POST /avocat/pieces-justificatives` range le fichier
et renvoie sa clé ; l'avocat reporte ces clés dans `piecesJustificatives`. Le contrat de #23 reste
celui du document d'API (JSON, tableau de chaînes), et un envoi qui échoue ne fait pas reperdre les
pièces déjà transmises. Le **détail** d'une demande expose des URL pré-signées, pour que l'Assistante
et le DJA ouvrent réellement les pièces (UC-INT-02).

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

### ✅ QF-04 — Qui produit les rapports d'activité ? — close en F15

**Constat initial (2026-09-08).** `GET /rapports` était réservé à `ROLE_JURISTE` et
`GET /tableau-de-bord` à `ROLE_DJ`. Le DJ ne portant pas `ROLE_JURISTE`, il ne pouvait pas générer
de rapport — ce qui rendait le parcours de pilotage P9 (« tableau de bord → rapports → vue client →
seuils ») injouable par un seul utilisateur.

**Ce qui a changé entre-temps.** Q-81, au jalon F12, a rendu `ROLE_DJ` et `ROLE_DJA` composites :
ils portent désormais `ROLE_JURISTE`. Relevé sur le Keycloak en service le 2026-09-14 —
`dj.test → ROLE_CONSULTATION, ROLE_DJ, ROLE_JURISTE, ROLE_SAISIE`. **La moitié de la question
s'était donc résolue d'elle-même**, sans que personne le note : le DJ et la DJA atteignent les
rapports, le calendrier et le répertoire des avocats depuis ce jalon.

**Tranché (2026-09-14).** Restait le revers : la DJA n'avait pas le tableau de bord. Décision du
porteur du projet — `GET /tableau-de-bord` passe à `hasAnyRole('DJ','DJA')` (backend **Q-95**). Les
sources sont en tension et l'arbitrage suit la seconde : US 8.5 énonce « *Given que je suis le DJ
(ROLE_DJ)* », mais les spécifications fonctionnelles décrivent le tableau consolidé comme obtenu
« **à travers le DJ/DJA** » (partie prenante STK-06). La DJA instruit les mêmes dossiers et valide
conjointement les frais sensibles ; lui refuser les indicateurs l'aurait privée du contexte de ses
propres décisions.

Que le juriste n'ait pas le tableau de bord reste voulu par US 8.5 : ce n'est pas une contradiction.

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

### ✅ QF-08 — Files d'attente pour le DJ/DJA — close : ce n'est pas une lacune

**Constat d'origine.** Aucun endpoint ne liste les dossiers en attente de validation de sensibilité,
ni les dérogations de seuil en attente d'arbitrage. `GET /dossiers` expose bien `sensibiliteStatut`,
mais sans filtre serveur. J'en avais conclu que le DJ et la DJA devraient parcourir les dossiers page
par page.

**Ma justification était fausse.** J'avais écrit « même raisonnement que les trois files ajoutées en
M15 ». Relecture des sources (2026-09-15) : ces trois files-là sont **nommément décrites** dans le
document d'analyse, et elles seules —

- « Le système affiche la **liste des demandes validées en attente de paiement** » (frais) ;
- « Aucune demande **en attente de validation** » (constitutions) ;
- « Aucun compte rendu **en attente de validation** » (publications).

Pour la sensibilité et la dérogation de seuil, **aucun pas de cas d'utilisation ne décrit de liste**.
Le mécanisme prévu est ailleurs, et il est explicite : story 1.8 — « le système crée une demande […],
**notifie le DJ et le DJA** » — et §1458 des spécifications fait de la notification applicative *« le
canal principal, avec une persistance des alertes en base »*, consultable au menu « Mes
notifications ».

**Ce mécanisme est implémenté et actionnable** : chaque ligne de l'écran 03 porte un lien direct vers
le dossier concerné. Il n'y a donc rien à corriger.

**Réserve d'exploitation, consignée comme candidate V2.** Une notification est un **événement**, pas
un état : un DJ qui la marque traitée, ou qui l'a manquée pendant une absence, n'a aucun moyen de
retrouver ce qui l'attend encore — là où les trois autres circuits ont leur file. Le risque est réel
mais faible à l'échelle de la Direction Juridique, et **il n'est pas ce que les sources demandent**.
S'il devenait gênant à l'usage, un paramètre `?sensibiliteStatut=EN_ATTENTE` sur #2 et une file des
dérogations suffiraient.

### 🟡 QF-16 — Provisionnement paresseux : un juriste jamais connecté est inaffectable — limite acceptée pour la V1

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

**Ce que disent les sources, relues le 2026-09-15.** UC-DOS-01 étape 6 : « Le juriste **sélectionne**
un ou plusieurs juristes et avocats à affecter au dossier » — une liste du personnel, sans réserve.
Et §157 des spécifications confie la gestion des profils à Keycloak, par la DSI et la DRH : aucune
fonction de création d'utilisateur n'existe dans l'application, la recherche dans les quatre
documents ne rend rien. **Au sens des sources, l'application est censée lire un annuaire que Keycloak
détient déjà** : le provisionnement paresseux est une commodité d'implémentation, écrite nulle part,
et il contredit UC-DOS-01 étape 6 dans le cas limite.

**Trois faits réduisent pourtant la portée réelle du défaut.**

1. **Il est unilatéral.** Les **avocats** ne sont pas concernés : ils sont créés au répertoire par un
   juriste (UC-INT-01) avec `compteKeycloak` obligatoire (RG-INT-01), donc affectables avant toute
   connexion. Seuls les utilisateurs **internes** sont provisionnés paresseusement.
2. **Les points 2 et 3 ci-dessus sont résolus.** Le juriste qui crée un dossier est, par construction,
   connecté — l'amorçage de session le provisionne. Il figure dans sa propre liste et peut s'affecter :
   ni la base neuve, ni le premier dossier ne sont bloqués.
3. **Il reste donc un seul cas**, contournable en trente secondes : s'affecter soi-même, puis
   réaffecter au collègue par UC-DOS-02 dès sa première connexion — geste tracé dans l'historique.

**Tranché (2026-09-15) : limite acceptée pour la V1, documentée.** Le pré-provisionnement supposerait
l'API d'administration de Keycloak, un compte de service avec droits `realm-admin` et une politique de
synchronisation (fréquence, comptes désactivés, départs). Ce n'est pas une tâche de développement mais
**une décision de sécurité appartenant à la DSI**, sur un périmètre que le document de conception place
explicitement hors projet (§98 « hors Keycloak », §100 « entièrement déléguées à Keycloak »). Ouvrir
cette intégration pour un cas contournable, dans une direction de quelques dizaines d'utilisateurs,
serait disproportionné.

**Écrit dans le guide utilisateur** (§1) et au §5.1 du rapport de recette. **Reclassé 🔴 → 🟡** : la
limite n'est plus une question en suspens, c'est un choix assumé. Si elle devenait gênante, la V2
consiste à cadrer avec la DSI un pré-provisionnement depuis Keycloak.

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

### ✅ QF-41 — `GET /clients/{id}/dossiers` s'effondrait en volume — corrigé (backend Q-94)

**Mesuré le 2026-09-12** : le client de socle portait 310 dossiers, la vue consolidée mettait **11 à
19 secondes**, jusqu'à 70 s sous charge. L'écran 13 restait en chargement, et l'appel occupait assez
longtemps une connexion pour faire expirer des requêtes voisines dans la suite de bout en bout.

**Ma première recommandation était fausse** : je proposais d'alléger la réponse, en supposant que
l'écran n'affichait ni les étapes ni les parties. Le contrat d'API inclut bien `etapes` dans le
schéma `Dossier`, et `vue-client.tsx` s'en sert (`dossier.etapes.at(-1)`) pour afficher l'étape
courante. Paginer ne convenait pas davantage : le contrat décrit « toutes les procédures d'un client,
par catégorie », sans pagination.

**Cause réelle** : un N+1 côté backend — trois requêtes par dossier, soit 930 pour 310 dossiers.
**Corrigé** (Q-94, arbitrage du 2026-09-14) : trois requêtes pour la liste entière, contrat inchangé.
**Mesuré après correction**, client entre-temps passé à 355 dossiers : **0,12 s** pour 306 Ko.

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

### ✅ QF-42 — Une déconnexion immédiate ne fermait pas la session — corrigé

**Constaté le 2026-09-14**, en vérifiant Q-98 contre le backend réel : les deux tests de déconnexion
(`authentification.spec.ts:150` et `securite.spec.ts:100`) échouent. **Mesuré : 4 échecs sur 5** en
rejeu isolé — ce n'est pas de l'instabilité, c'est un défaut reproductible.

**Le symptôme.** L'utilisateur clique « Se déconnecter », arrive bien sur `/login`… et une URL
protégée saisie ensuite **s'ouvre normalement**. Les cookies `authjs.session-token.0/.1` sont
toujours là après la redirection.

**La cause, isolée par expérience.** Le même parcours avec **3 secondes d'attente** avant le clic
réussit, cookies effacés et `/dossiers` renvoyé vers `/login` ; sans attente, il échoue :

```
ATTENTE=0    | cookies restants=authjs.session-token.0,.1 | url=/dossiers
ATTENTE=3000 | cookies restants=aucun                     | url=/login
```

**Ce qui réécrit le cookie, lu dans les en-têtes** : *toute* réponse de `/api/auth/session` repose
`authjs.session-token.0/.1`. C'est le comportement de NextAuth, qui réémet le jeton à chaque lecture
de session. Une réponse partie **avant** la déconnexion revient **après** elle et réécrit donc le
cookie qu'elle venait d'effacer — une seule suffit, les suivantes le maintiennent.

**Trois sources de lectures, découvertes l'une après l'autre.** (1) `providers/session.provider.tsx`
branchait le client HTTP sur `getSession()` : **chaque appel API** interrogeait la session, et
l'accueil en lance huit. (2) `SessionProvider`, monté sans session initiale, interroge lui-même
`/api/auth/session` au montage de **chaque page** — y compris `/login`, où quatre lectures ont été
observées **après** la déconnexion. (3) `getSession()` **fait écho chez NextAuth**, qui relance une
lecture de son propre chef : une réponse est arrivée **1 ms après** la déconnexion, hors de portée de
tout aménagement côté navigateur. Aucune de ces trois n'a été trouvée par le raisonnement : chacune
est apparue dans la trace des en-têtes, après une mesure qui démentait l'étape précédente.

**Pourquoi c'est sérieux.** Sur un poste partagé, le geste qui protège — se déconnecter puis laisser
la place — ne protège pas quand il est fait vite. C'est précisément le cas d'usage que §1 du guide
utilisateur promet.

**Indépendant de Q-98** : le diff de la branche `feat/cr-piece-jointe` ne touche ni
`lib/auth.ts`, ni `providers/`, ni le middleware, ni l'accueil.

**Corrigé (2026-09-14)**, sur demande du porteur du projet, en tarissant les deux sources :

1. **`lib/cache-jeton.ts`** — le jeton d'accès vit en mémoire jusqu'à la fenêtre de rotation, que la
   session publie désormais (`rafraichirApres`, calculé par `prochainRafraichissement` : la règle
   RF-02 n'est pas dupliquée côté client). Une rafale de vingt requêtes ne produit **qu'une** lecture
   de session, partagée. Un verrou, posé au clic de déconnexion, interdit toute lecture ultérieure et
   jette le résultat d'une lecture revenue après lui.
2. **Session fournie par le rendu serveur** — `app/layout.tsx` lit la session et la passe à
   `SessionProvider`, qui n'a donc plus rien à aller chercher au montage ; `refetchOnWindowFocus` est
   coupé pour la même raison. L'interface ne déclenche plus aucune lecture de session.

3. **La déconnexion attend la lecture en vol.** `BoutonDeconnexion` retient l'envoi du formulaire le
   temps que la lecture déjà partie soit retombée. Nécessaire, mais **pas suffisant** : `getSession()`
   fait écho chez NextAuth, qui relance de lui-même une lecture — observée **1 ms après** la
   déconnexion, donc hors de portée de tout aménagement côté navigateur.
4. **Un marqueur de déconnexion, lu par le serveur** (`lib/marqueur-deconnexion.ts`,
   `middleware.ts`). C'est le geste qui ferme réellement la fenêtre, et le seul qui le pouvait : le
   client ne décide pas de l'ordre d'arrivée des réponses. Tant que le marqueur est là (30 s), toute
   requête de page portant encore un cookie de session est renvoyée vers `/login`, **cookie effacé**.
   Une session ressuscitée ne survit donc pas à la requête suivante — et la requête suivante, c'est
   le chargement de `/login`. La connexion lève le marqueur, sans quoi se reconnecter aussitôt
   deviendrait impossible.

Le POST vers `/api/deconnexion` est inchangé pour le reste : c'est toujours lui qui révoque le jeton
chez Keycloak puis efface le cookie.

**Pourquoi un middleware alors que les gardes sont dans les composants serveur.** Il ne les remplace
pas : `exigerSession`/`exigerCapacite` restent en place, et le backend reste l'arbitre. Le middleware
traite le seul cas qu'un composant serveur ne **peut pas** traiter — effacer un cookie. C'est aussi
pourquoi les routes d'API sont hors de son champ : rediriger un `fetch` vers `/login` masquerait
l'erreur au lieu de la dire.

**Ce que la mesure a corrigé dans mon raisonnement.** Chaque étape a été mesurée sur 10 déconnexions,
et j'ai eu tort trois fois avant d'avoir raison : **8 échecs sur 10** à l'origine, **6 sur 10** après
le cache seul, **3 sur 10** après la session fournie par le serveur, **4 sur 10** après l'attente de
la lecture en vol — soit aucun progrès —, puis **0 sur 20** (deux passages) avec le marqueur. C'est
l'instrumentation des en-têtes `Set-Cookie`, relancée à chaque étape, qui a désigné la source
restante à chaque fois ; le raisonnement seul a désigné trois fois la mauvaise.

---

### ✅ QF-43 — Une saisie en cours se perdait sans avertissement — corrigé

**Constat du recensement du 2026-09-15.** `formulaire-dossier.tsx` porte la vingtaine de champs du
§1189 des spécifications sur 615 lignes, et rien ne protégeait cette saisie : ni garde
`beforeunload`, ni brouillon. Un clic sur « Clients » dans la barre latérale effaçait tout, sans un
mot — sur le formulaire le plus long de l'application, décrit par le document d'analyse comme « le
point d'entrée réel dans le système ».

**Ce que les sources disent, et ce qu'elles ne disent pas.** UC-DOS-01 prévoit une annulation
explicite (« 2-a Annulation : le juriste clique sur *Annuler* »). Il décrit donc l'annulation
**voulue**, et reste muet sur l'annulation **subie** — la seule qui coûte. Même distinction qu'en
QF-20 : le contrat était respecté, l'usage ne l'était pas.

**Corrigé** : `components/metier/garde-saisie.tsx`, posé sur les trois formulaires longs — création
de dossier (écran 06), demande de frais (30), dépôt d'une publication (33).

- **Quitter le site** (fermer l'onglet, recharger) : `beforeunload`, seul mécanisme que le navigateur
  accepte, avec son dialogue natif qu'aucune application ne peut styler.
- **Naviguer dans l'application** : le clic sur un lien est intercepté **en phase de capture** — le
  gestionnaire du routeur étant posé sur le lien, intercepter en bouillonnement arriverait trop tard
  — et le dialogue de l'application prend le relais, traduit et cohérent.

**Deux choix explicites.** L'« Annuler » du formulaire **n'est pas gardé** : il exprime une intention,
et le doubler d'une confirmation transformerait un geste clair en friction. Il porte
`data-garde-saisie="ignorer"`, faute de quoi le comportement aurait dépendu de son implémentation —
un lien sur l'écran 06, un bouton sur les écrans 30 et 33 — et deux formulaires se seraient comportés
différemment pour un même geste. Et **aucun brouillon n'est persisté** : conserver la saisie dans le
navigateur y écrirait des données sensibles — parties, montants, type de client — sur un poste
possiblement partagé, à rebours de la revue de sécurité de F17.

**Vérifié** par quatre parcours de bout en bout, contre le backend réel : la saisie **survit** au
renoncement (le test relit la valeur du champ, il ne s'arrête pas à l'apparition du dialogue), la
navigation aboutit après confirmation, l'« Annuler » n'est pas intercepté, et un formulaire vierge se
quitte sans rien demander.

**Un trou possible, cherché puis écarté.** Le sélecteur de langue n'est ni un lien ni un déchargement
de page : c'est une action serveur qui pose un cookie et revalide la coquille. Ni la garde ni
`beforeunload` ne l'interceptent — la saisie ne survit que parce que le rafraîchissement
**réconcilie** l'arbre React au lieu de le remonter. Mesuré : elle survit. Mais rien ne garantit que
cela reste vrai — un `redirect()` ajouté un jour à `changerLangue` viderait le formulaire en silence.
Un quatrième test garde donc cette propriété.

### ✅ QF-44 — Dix lignes par tableau, filtres manquants et sélecteurs qui tronquent — traité

**Demande du porteur du projet (2026-09-15)** : « des tableaux de dix lignes maximum ; à partir de la
onzième, on clique sur *suivant* ». Et, pour les filtres, un objectif énoncé : « l'application doit
être optimale, évolutive et maintenable, car elle est amenée à recevoir beaucoup de données ».

**Son raisonnement sur les filtres, discuté puis retenu.** Il craignait qu'un filtrage dans le
navigateur ne le ralentisse. **Cet argument-là est le plus faible** : un navigateur filtre dix mille
lignes en quelques millisecondes. Deux autres le fondent en revanche solidement. Le **transfert** :
filtrer côté navigateur suppose d'y faire descendre toute la table — une ligne `dossier` pèse
**1 554 octets** (relevé dans un plan d'exécution), soit **15 Mo** à dix mille dossiers, à chaque
ouverture d'écran. Et surtout l'**exactitude** : sur une liste paginée par le serveur, un filtre
appliqué dans le navigateur ne filtre que la page affichée. L'écran annoncerait « 2 résultats » quand
il y en a quarante. **Un filtre lent se remarque ; un filtre qui ment ne se remarque pas.**

**La règle qui en découle**, et qui a guidé chaque arbitrage du jalon : *la liste peut-elle dépasser
une page ?* Si oui, le filtre appartient au serveur. Si non — trois étapes au maximum par dossier —
l'y mettre serait du contrat à maintenir pour toujours en échange de rien.

**Sur les dix lignes, un revers assumé.** L'objectif « ne pas trop défiler » est atteint. L'objectif
« ne pas perdre l'information » ne l'est **pas par la pagination** : chercher un dossier parmi
soixante demande six pages là où un défilement suffisait. Ce sont les **filtres** qui protègent de la
perte, et c'est pourquoi les deux demandes se tiennent l'une l'autre. Un **sélecteur 10/25/50** a été
ajouté sur décision du porteur du projet : dix pour lire, cinquante pour balayer.

**Livré côté interface** : `TAILLE_PAGE` centralisée (le `20` était recopié dans quatre services, et
l'écran Clients n'envoyait **aucune** taille — il prenait donc le défaut du backend) ; taille portée
par l'URL comme les filtres ; huit écrans et trois onglets branchés sur les réponses paginées ;
filtres de **sensibilité** (rappel explicite du porteur du projet), de **type d'alerte**, et
**sélecteur à recherche au fil de la frappe** pour l'affectation.

**Trois pièges de « taille unique », dont deux signalés par le compilateur.** La règle des dix lignes
vaut pour les **tableaux**, pas pour les requêtes techniques. `GET /intervenants` sert **trois**
usages : le tableau de l'écran 42, les sélecteurs d'affectation, et la **table de correspondance**
identifiant → nom de `useLibelles`. Le borner à dix aurait tronqué les deux autres en silence — un
nom d'avocat se serait soudain affiché `#42`, sans message. De même, `mesDossiers` du portail garde
`size=100` : c'est le sélecteur du formulaire de frais. Et les **compteurs** de l'accueil ne demandent
plus qu'**une** ligne : quatre cartes en rapatriaient jusqu'à vingt complètes pour afficher un nombre.

**Le sélecteur de recherche a dû gérer le choix multiple.** L'affectation retient plusieurs juristes
et plusieurs avocats — c'est-à-dire exactement l'écran qui porte le plus d'options, donc celui où la
recherche sert le plus. Ne le traiter qu'en choix unique aurait vidé la correction de sa substance.

**Vérifié en réel** (2026-09-15), sur la pile complète démarrée :

| Contrôle | Mesure |
|---|---|
| Pagination des dossiers | 5 pages de **10 lignes**, **50 reçues sur 50 annoncées**, **0 doublon** |
| `estSensible=true` / `=false` | **2** et **48**, total **50** — le `false` n'est pas confondu avec « non renseigné » |
| `sensibiliteStatut=EN_ATTENTE` | 49 dossiers, la file du DJ/DJA existe enfin |
| Recherche `?nom=Me` / `?nom=IntrouvableXYZ` | 3 et **0** — le fragment cherche au milieu du nom |
| Historique | fiche plafonnée à **10** entrées, endpoint dédié pour la suite |
| Suite de bout en bout | **138 sur 138** |
| `npm run smoke` | **17 sur 17** |

**Deux tests de bout en bout gardent l'exigence**, et ils ne se contentent pas de compter dix lignes :
le premier relève une référence en page 1, passe en page 2 et vérifie qu'elle en montre une **autre**
— un tableau qui perdrait tout au-delà de la dixième ligne passerait un test qui compterait seulement.
Le second vérifie que le choix « 50 lignes » survit à un rechargement, donc qu'un lien partagé rouvre
la liste telle que son auteur la voyait.

### ✅ QF-45 — Un avocat non inscrit au répertoire lisait « Le chargement a échoué » — corrigé

**Signalé par le porteur du projet le 2026-09-15**, connecté en avocat sur une base de développement
réinitialisée : *Mon espace* et *Frais d'avocats* affichaient deux blocs d'échec portant le message
brut du serveur.

**Ce n'était pas une panne, et c'est tout le problème.** Deux choses distinctes portent le mot
« avocat » : le **compte de connexion**, qui vit dans Keycloak et provisionne la ligne `utilisateur`
à la volée, et l'**avocat du référentiel**, fiche métier créée par le DJ ou la DJA avec l'identifiant
de connexion (RG-INT-01, UC-INT-01). Le portail ne travaille que sur la seconde. Tant qu'elle n'existe
pas, il n'y a rien à montrer — **et l'avocat n'y peut rien lui-même**.

L'interface présentait donc un **état d'inscription** comme un **échec technique** : message sans
action possible, sans interlocuteur. Le cas n'est pas rare : il se produit à chaque mise en service,
et pour chaque nouvel avocat tant que la Direction Juridique ne l'a pas inscrit.

**Corrigé** : le backend lève désormais un code dédié (`ERR-AVOCAT-NON-RATTACHE`, Q-107) sur les
quatre points concernés, et `CompteAvocatNonRattache` l'affiche comme un état — ce qui manque, que ce
n'est pas de son fait, et à qui s'adresser. Posé sur les quatre écrans que l'avocat peut atteindre :
*Mon espace*, la file des frais, et le sélecteur de dossier des deux formulaires de dépôt.

**Le code dédié n'est pas un détail de mise en œuvre.** `ERR-FORBIDDEN` couvre aussi les **vrais**
refus de droits : s'en contenter aurait fait dire « votre compte n'est pas rattaché » à un avocat qui
force une URL interdite. Et reconnaître le cas à son message se briserait à la première reformulation
ou traduction. Même parti que `ERR-009`, déjà traité comme un état et non comme une erreur.

**Symétrique de QF-16**, vu depuis l'autre bout : là un juriste jamais connecté reste inaffectable,
ici un avocat jamais inscrit ne voit rien. Dans les deux cas le système a raison ; c'est son
explication qui manquait.

**Une fragilité du socle de tests, révélée par la même base vierge.** `tests/e2e/preparation.ts`
garantissait « au moins un avocat », créé sous le compte `avocat.socle.e2e`. Or les parcours du
portail se connectent en **`avocat.test`** : sur une base neuve, ce compte n'était rattaché à aucune
fiche, et cinq parcours échouaient — sans qu'aucune ligne de l'application soit en cause. C'est
précisément le défaut que ce fichier avait été écrit pour prévenir, et son en-tête le dit :
« une suite qui dépend de l'état laissé par l'exécution précédente ne teste pas l'application, elle
teste l'historique de la base ». Le socle rattache désormais explicitement `avocat.test`.

**Vérifié en réel** : sur la base vierge, les quatre endpoints du portail et des frais renvoient
`ERR-AVOCAT-NON-RATTACHE`, tandis qu'un vrai refus (`GET /dossiers` pour un avocat) reste
`ERR-FORBIDDEN` — la distinction tient. Et les quatre écrans concernés affichent l'explication, aucun
n'affiche plus « Le chargement a échoué ».

### ✅ QF-46 — « Votre session a expiré » s'affichait sans qu'aucune session n'ait expiré — corrigé

**Signalé par le porteur du projet le 2026-09-16** : en démarrant l'application et en ouvrant son
navigateur, il lisait ce message directement sur la page de connexion.

**J'ai d'abord contesté l'observation, et la mesure m'a donné à moitié raison.** Le message ne peut
**pas** apparaître dans un navigateur vierge : vérifié, la racine sans cookie redirige vers `/login`
**sans motif**, et `/login` seul n'affiche rien. Il ne s'affiche que si l'adresse porte
`?motif=session-expiree`. L'explication la plus probable était donc la **restauration d'onglets** du
navigateur, qui rouvrait l'URL de la veille.

**Mais l'observation désignait deux défauts réels**, que je n'aurais pas vus autrement.

**1. Le message était un état d'URL, pas un événement.** Un tel message dit « ce qui vient de se
passer » ; le loger dans l'adresse le rend **permanent**. Il survivait au rechargement, au retour
arrière, au signet et à la restauration d'onglets — et pouvait donc annoncer une expiration à
quelqu'un qui n'avait pas eu de session. Corrigé : `MotifConsomme` retire `motif` de l'adresse une
fois le message affiché, par `replaceState` — corriger l'historique, pas naviguer, sans quoi un
`router.replace` relancerait le rendu et effacerait le message qu'on vient de montrer.

**2. Toute panne du rafraîchissement se présentait comme une expiration.** Le `catch` de la rotation
attrapait **n'importe quelle** erreur — Keycloak arrêté, réseau coupé, 500 — et posait le même
marqueur. L'utilisateur lisait « Votre session a expiré, reconnectez-vous » : un diagnostic faux, et
une consigne **inapplicable**, puisque se reconnecter passe par le service précisément à terre. Il
cherchait une faute de sa part là où rien ne dépendait de lui.

Corrigé par un second marqueur, `ERREUR_AUTH_INDISPONIBLE`, et une qualification à la source :
`rafraichir` distingue une **réponse 4xx** — Keycloak a examiné le jeton et l'a rejeté, la session est
bien finie — d'une **absence de réponse ou d'un 5xx**, où la session n'est pas en cause. Les deux
mènent au formulaire, car la session est inexploitable dans les deux cas ; ce qui change, c'est ce
qu'on **dit** : se reconnecter, ou patienter.

**Vérifié en réel** contre le Keycloak du poste : un jeton révoqué renvoie **401** (refus), un port
fermé ne renvoie **rien** (indisponible). Et le scénario signalé est rejoué : le message s'affiche une
fois, l'adresse est nettoyée, rouvrir l'onglet ne le rejoue plus. Trois parcours de bout en bout
gardent les trois cas — motif consommé, cause distinguée, et aucune annonce sur une arrivée ordinaire.

### ✅ QF-47 — L'en-tête défilait avec le contenu, emportant la cloche et la déconnexion — corrigé

**Signalé par le porteur du projet le 2026-09-16** : « je pense que le header doit être fixe donc ne
doit pas scroller ».

**Je n'ai pas traité cela comme une préférence d'affichage, parce que ce n'en était pas une.** Ce qui
partait vers le haut emportait la **cloche de notifications** — canal obligatoire des alertes
(NF-ALR-02), donc le seul dispositif qui signale une échéance d'audience — et le bouton de
**déconnexion**, que le guide §1 réclame explicitement en poste partagé. Sur une fiche de dossier,
qui est longue, les deux disparaissaient au bout de quelques centimètres de défilement.

**L'intention était déjà dans le code ; il lui manquait sa contrainte.** La barre latérale portait
`lg:h-svh`, le contenu `overflow-y-auto` — tout le dessin d'une coquille d'application. Mais le
conteneur extérieur portait `min-h-svh` : une hauteur **minimale** ne borne rien, donc l'ensemble
grandissait avec son contenu et c'est la **fenêtre** qui défilait. Ce n'est donc pas une
fonctionnalité nouvelle, c'est une coquille inachevée. Corrigé par `lg:h-svh lg:overflow-hidden` sur
le conteneur, et `lg:min-h-0` sur la colonne : `min-h-0` n'est pas décoratif — sans lui, un enfant
flex refuse de rétrécir sous la hauteur de son contenu et l'`overflow-y-auto` ne s'active jamais.

**Le mobile garde délibérément son défilement de page.** En-tête et bande de navigation pèsent 117 px
sur 667 — **18 % de la hauteur** — et F17 avait justement transformé la navigation en bande
défilante pour récupérer cette place. Les figer rendrait au téléphone le problème qu'on règle sur le
bureau.

**Une conséquence à traiter, pas à subir.** Le contenu étant devenu le conteneur de défilement, Next
ne le remet plus à zéro en changeant d'écran — il ne connaît que la fenêtre : un écran se serait
ouvert « au milieu », à la hauteur où l'on avait laissé le précédent. `RetourEnHaut` s'en charge, et
n'écoute que le **chemin** : changer de page, de filtre ou de taille dans un tableau laisse la
position intacte, ce que la pagination attend (`scroll: false`, Q-99).

**Mesuré, pas supposé**, sur la pile réelle : en-tête et navigation immobiles à 1280 et 1024,
défilants à 375, contenu remis à zéro au changement d'écran (384 → 0), et un tableau dense qui défile
toujours dans son conteneur et non dans la page. Trois parcours de bout en bout gardent ces
comportements, y compris celui du mobile — pour qu'on ne « corrige » pas plus tard le téléphone par
symétrie.

---

## RISQUES

### ✅ RF-02 — Le refresh token expire AVANT l'access token — traité en F2

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
401.

**Appliqué (F2)** : `lib/rotation-jeton.ts` retient `min(expiresAt, refreshExpiresAt) - 5 min`, et un
échec définitif marque la session (`ERREUR_RAFRAICHISSEMENT`) plutôt que de boucler sur des 401. La
règle est couverte par des tests unitaires et n'est **pas** dupliquée côté navigateur : depuis
QF-42, la session publie la fenêtre calculée ici (`rafraichirApres`).

> Ces durées sont celles du realm de développement. À revérifier si le realm de production diffère.

### ✅ RF-01 — CORS et affichage des documents MinIO — vérifié en F7

Tranché et **mesuré en réel** : MinIO répond `Access-Control-Allow-Origin: http://localhost:3000`,
préflight compris ; le contenu est lu par `fetch` puis affiché depuis une URL `blob:` locale (QF-06).
Couvert par les parcours de bout en bout — aperçu d'une image stockée, téléchargement d'un PDF.

⚠ **Réserve de mise en production** : l'URL publique de MinIO et sa politique CORS devront être
reconfigurées pour l'origine réelle de l'application. `MINIO_API_URL` vaut aujourd'hui `localhost`.

### 🟡 RF-03 — Documentation d'API exposée côté backend

`/v3/api-docs` et `/swagger-ui` sont accessibles sans authentification (R-08 backend, à fermer avant
production). Le frontend est conçu pour ne pas en dépendre (QF-12). **Aucune action frontend.**

### ✅ RF-04 — `.gitignore` absent sur un dépôt déjà publié — clos en F1

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

**Fait le 2026-09-08, avant le premier `npm install`.** Le fichier couvre les entrées ci-dessus ;
aucun `.env.local` n'a jamais été versionné. **Clos.**

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
