# Pistes d'amélioration

> Recensement établi le 2026-09-15, après clôture du développement.
>
> **État au 2026-09-15** : les pistes **1** et **2** ont été appliquées sur décision du porteur du
> projet (backend Q-99 / migration V14 ; frontend QF-43 / `garde-saisie.tsx`). Les autres restent
> des **propositions**, aucune n'est engagée. Chaque fiche porte le constat vérifié dans le code ou les sources, la
> **contradiction que je lui oppose**, la recommandation qui en sort, et ce qu'elle toucherait.
>
> Méthode : croisement des exigences non fonctionnelles (§7 des spécifications), des cas
> d'utilisation, et d'une revue du code des deux dépôts. Rien ici ne vient d'une impression d'usage :
> chaque constat est adossé à un fichier ou à une ligne de source.

---

## Vue d'ensemble

| # | Piste | Gain | Coût | Verdict |
|---|---|---|---|---|
| 1 | Index manquants derrière les tris ajoutés en Q-92/Q-93 | Mesuré : **62,5 ms → 0,094 ms** | Une migration, zéro code | ✅ **Appliquée** (Q-99) |
| 2 | Perte d'une saisie de dossier en cours | Évite de reperdre ~20 champs | Faible, frontend seul | ✅ **Appliquée** (QF-43) |
| 3 | Canaux e-mail et Teams décrits dans les sources, non livrés | Conformité aux spécifications | Décision DSI + développement | **À cadrer** |
| 4 | L'historique d'un dossier croît sans limite | Évite une fiche qui s'alourdit avec l'âge | Faible en palliatif, moyen en traitement de fond | **Palliatif** |
| 5 | N+1 dans deux tâches planifiées | Invisible aujourd'hui | Faible | **Plus tard** |
| 6 | Impression d'une fiche de dossier | Confort d'audience | Très faible | **Optionnel** |
| 7 | Recherche globale, action groupée sur les notifications, endpoint d'accueil agrégé, allègement du bundle | — | — | **À ne pas faire** (§8) |

---

## 1. Les tris ajoutés en Q-92/Q-93 ne sont adossés à aucun index

**Constat.** Le jalon backend M17 a corrigé trois listes qui paginaient sans ordre défini
(Q-92, Q-93) : `dossier` et `client` sont désormais triés par `created_at DESC, id DESC`, et
`alerte` par `date_declenchement DESC, id DESC`. Or les 13 migrations Flyway définissent **37 index**,
et **aucun ne porte sur `created_at`** — vérifié : `grep "CREATE INDEX" | grep -c created_at` → `0`.
Sur `alerte`, les index existants portent sur `destinataire_id` et `statut`, pas sur la colonne de
tri.

PostgreSQL doit donc trier l'ensemble du jeu filtré à **chaque page**. Une pagination par 20 sur
10 000 dossiers relit et trie 10 000 lignes pour en rendre 20, à chaque clic.

**Ce que je lui oppose.** Aux volumes actuels — quelques centaines de dossiers — le tri tient en
mémoire et ne se voit pas. La mesure de performance de F17 passe largement sous le budget
NF-PERF-01. On peut donc soutenir qu'il n'y a rien à corriger, et que c'est de l'optimisation
prématurée.

**Pourquoi je recommande quand même de le faire.** C'est exactement la classe de problème qui a
mordu en Q-94 : la vue consolidée d'un client tenait très bien jusqu'à ce qu'un client atteigne
310 dossiers, et elle est alors passée à **19 secondes**. Le défaut n'était pas visible avant de
l'être brutalement. Ici le remède est **une migration de trois lignes, sans une ligne de code
applicatif** — le rapport coût/risque n'a pas d'équivalent dans cette liste.

**Recommandation.** Une migration `V14` ajoutant des index composites alignés sur les tris réels.

**Appliquée le 2026-09-15 — et le recensement avait sous-estimé le périmètre.** En écrivant la
migration, l'inventaire des `Sort.by` des contrôleurs a révélé **six** listes triées, non trois :
s'ajoutent `demande_frais` et les deux formes de `publication` (file interne #59, portail avocat).
`V14__index_tris_pagination.sql` en compte donc neuf index. **Mesuré** sur 200 000 lignes :
**62,5 ms → 0,094 ms** sur la première page, 5,4 ms sur une page profonde. 358 tests au vert, et
migration appliquée puis vérifiée en base au démarrage du backend (`flyway_schema_history` en
version 14, neuf index présents dans `pg_indexes`).

⚠ **À ne pas mal lire** : sur la base de développement, qui compte quelques dizaines de lignes, le
planificateur **ignore** ces index — et il a raison, un balayage séquentiel y est plus rapide. Ce
n'est pas un échec de la migration : le gain n'existe qu'au volume, ce que la mesure sur
200 000 lignes établit.

**Ce que cela touche.** Backend uniquement : un fichier de migration. Aucun changement de contrat,
aucun impact frontend, aucun test à réécrire. La suite backend doit être rejouée (Flyway valide les
migrations au démarrage des tests d'intégration).

---

## 2. Une saisie de dossier en cours se perd sans avertissement

**Constat.** `formulaire-dossier.tsx` compte **615 lignes** et porte la vingtaine de champs listés
au §1189 des spécifications — référence, nature, catégorie, juridiction, parties, risque encouru,
sensibilité, seuil, type de client, champs conditionnels par catégorie, affectations, pièces. Aucune
protection n'existe contre la perte de cette saisie : ni garde `beforeunload`, ni brouillon —
vérifié, aucune occurrence de `beforeunload`, `isDirty` ou `brouillon` dans le fichier.

Un clic sur un lien du menu, une fermeture d'onglet, un retour arrière : tout est perdu, sans
confirmation. C'est le formulaire le plus long de l'application, et le **point d'entrée de tout le
système** — le document d'analyse le rappelle : « le point d'entrée réel dans le système est la
saisie du juriste (UC-DOS-01) ».

**Ce que je lui oppose.** UC-DOS-01 prévoit bien une annulation explicite (« 2-a Annulation : le
juriste clique sur *Annuler* »), et aucune exigence ne demande de protéger une saisie accidentelle.
On pourrait donc considérer que le comportement est conforme.

**Pourquoi la conformité ne suffit pas ici.** UC-DOS-01 décrit l'annulation **voulue** ; il ne dit
rien de l'annulation **subie**. C'est la même distinction qui a fait rouvrir QF-20 : le contrat était
respecté, l'usage ne l'était pas. Reperdre vingt champs parce qu'on a cliqué sur « Clients » est un
coût réel, répété, et invisible dans les tests.

**Recommandation.** Une garde de navigation sur les formulaires longs, déclenchée uniquement si le
formulaire est modifié : confirmation du navigateur sur une fermeture d'onglet, et interception des
navigations internes.

**Ce que je ne recommande pas, et pourquoi.** Un **brouillon persistant** dans le navigateur serait
plus confortable, mais il écrirait dans `localStorage` des données de dossiers potentiellement
**sensibles** — parties, montants, type de client sensible — sur un poste possiblement partagé. Cela
contredirait la revue de sécurité de F17, qui vérifie précisément qu'aucune donnée de session ne
traîne dans un stockage accessible aux scripts. La garde seule, sans persistance, donne l'essentiel
du bénéfice sans ouvrir cette question.

**Ce que cela touche.** `formulaire-dossier.tsx`, et par cohérence `formulaire-frais.tsx` et
`formulaire-publication.tsx`.

**Appliquée le 2026-09-15** (QF-43), avec une décision que le recensement n'avait pas anticipée :
l'« Annuler » de l'écran 06 est un **lien**, ceux des écrans 30 et 33 des **boutons**. La garde
n'interceptant que les liens, le même geste se serait comporté différemment d'un formulaire à
l'autre. L'exclusion est donc rendue **explicite** par `data-garde-saisie="ignorer"`, posé sur les
trois — le comportement ne dépend plus de l'implémentation du bouton.

---

## 3. Les canaux e-mail et Teams sont décrits dans vos sources, mais ne sont pas livrés

**Constat.** Le tableau des intégrations des spécifications (§1454-1458) décrit **trois** canaux de
notification, et pas seulement l'applicatif :

- **Outlook (SMTP)** — « Intégration technique standard : envoi d'emails via le serveur SMTP de la
  Banque. Les notifications (confirmations de dépôt, alertes, lettres de constitution) sont envoyées
  par email aux utilisateurs concernés. »
- **Teams** — « envoi de notifications via webhook entrant […] Les alertes critiques (prorogations
  > 10, échéances de recours, etc.) sont envoyées à un canal Teams dédié. **La configuration du
  webhook est à réaliser par la DSI.** »
- **Applicatif** — « le canal principal ».

Seul l'applicatif est implémenté. Le backend l'a consigné en Q-37 : `alerte.canal` reste
`APPLICATIF`, Outlook et Teams différés faute d'infrastructure SMTP ou de webhook fournie au projet.

**Ce que je lui oppose.** NF-ALR-02 qualifie explicitement l'applicatif d'**obligatoire** et les deux
autres d'**optionnels**. Au sens de l'exigence non fonctionnelle, la livraison est donc conforme, et
la décision Q-37 est fondée : on ne peut pas implémenter une intégration dont l'infrastructure n'a
jamais été mise à disposition.

**Pourquoi je le signale quand même.** Le tableau des intégrations n'est pas une exigence optionnelle
mais une **description d'architecture attendue**, et il nomme la DSI comme responsable de la
configuration. Un lecteur des spécifications — un jury, un exploitant — s'attendra à trouver ces
canaux. Le risque n'est pas technique, il est de **compréhension** : livrer sans le dire laisserait
croire à un oubli, alors que c'est une dépendance externe non fournie.

**Recommandation.** Ne rien développer à l'aveugle. Poser la question à la DSI en deux points — le
relais SMTP est-il disponible, le webhook Teams peut-il être créé — et n'ouvrir le développement
qu'une fois la réponse obtenue. D'ici là, inscrire ce point au rapport de recette comme une
**dépendance externe**, distincte des limites fonctionnelles.

**Ce que cela touche.** Rien aujourd'hui. Le jour où l'infrastructure existe : `AlerteService` côté
backend (le champ `canal` et la table `alerte` sont déjà prévus pour), aucune modification de
contrat, aucun impact frontend.

---

## 4. L'historique d'un dossier croît sans limite, et voyage entier

**Constat.** RG-DOS-06 impose d'historiser **toute** action sur un dossier. `onglet-historique.tsx`
rend la liste complète, sans pagination ni troncature — et, plus en amont, `GET /dossiers/{id}`
renvoie `historique[]` **en entier** dans la réponse de la fiche. Un dossier de recouvrement suivi
sur trois ans, avec ses audiences, ses délibérés, ses prorogations, ses documents et ses
affectations, accumulera plusieurs centaines d'entrées. Chaque ouverture de fiche les transporte
toutes, pour un onglet que l'utilisateur n'ouvre pas systématiquement.

**Ce que je lui oppose.** Quelques centaines d'entrées ne mettent en difficulté ni le navigateur ni
le réseau ; on est loin d'un problème mesurable aujourd'hui. Et surtout, `historique` fait partie du
schéma `Dossier` **du contrat d'API** : le retirer serait une rupture de contrat, pas une
optimisation — exactement l'erreur que j'ai commise en QF-41 en proposant d'alléger une réponse dont
l'écran se servait.

**Recommandation, en deux temps.** Court terme, **palliatif côté écran uniquement** : n'afficher que
les 20 entrées les plus récentes, avec un bouton « tout afficher ». Le coût est nul, le contrat
inchangé, et la fiche reste lisible quel que soit l'âge du dossier. Long terme, **si et seulement si
une mesure le justifie** : un endpoint paginé dédié, arbitré comme une évolution de contrat — c'est
une décision, pas un ajustement.

**Ce que cela touche.** Palliatif : `onglet-historique.tsx` seul. Traitement de fond : contrat d'API,
`DossierService`, `DossierResponse`, le service et l'écran côté frontend, plus les tests des deux
dépôts.

---

## 5. Deux tâches planifiées interrogent la base en boucle

**Constat.** `RappelAudienceScheduler` parcourt les audiences du jour puis appelle
`dossierJuristeRepository.findByDossierId(...)` **pour chacune** ; `DelaiRecoursScheduler` fait de
même par dossier. C'est le motif N+1 corrigé en Q-94 sur la vue consolidée d'un client.

**Ce que je lui oppose.** Ces tâches s'exécutent hors interaction utilisateur, sur les seules
audiences d'une journée et les seuls délibérés arrivant à échéance — quelques dizaines de lignes.
Personne n'attend leur résultat. Corriger maintenant, c'est toucher du code qui fonctionne pour un
gain que personne ne percevra.

**Recommandation.** Ne pas le traiter maintenant. Le consigner, et le reprendre si le volume croît
ou si les rappels commencent à déborder de leur fenêtre d'exécution — la même technique de
chargement par lots que Q-94 s'applique alors directement.

**Ce que cela touche.** Deux services backend et leurs tests unitaires. Aucun contrat, aucun écran.

---

## 6. Une fiche de dossier ne s'imprime pas correctement

**Constat.** Un juriste qui part en audience emporte son dossier. Rien n'est prévu pour l'impression :
pas de feuille de style `@media print`, donc la barre de navigation, la barre latérale et les boutons
d'action se retrouveraient sur le papier.

**Ce que je lui oppose.** Aucune source ne le demande. Les exports prévus sont ceux du **calendrier**
(RG-AUD-05) et des **rapports** (RG-REP-02), tous deux livrés. Ajouter une fonction non demandée,
c'est élargir le périmètre de son propre chef.

**Recommandation.** À proposer à la Direction Juridique plutôt qu'à décider seul. Si l'usage existe,
une feuille de style d'impression masquant la navigation et dépliant les onglets coûte très peu et
ne touche aucune logique.

**Ce que cela touche.** `globals.css` et la coquille protégée. Aucun test, aucune donnée.

---

## 7. Ce qui a été vérifié et ne demande rien

Ces points ont été examinés et **n'appellent aucune action** — les écarter explicitement vaut mieux
que de les passer sous silence.

| Point examiné | Constat |
|---|---|
| **Poids du code livré au navigateur** | Socle partagé **102 kB**, page la plus lourde **208 kB** (détail d'une publication). C'est sain pour une application React de cette surface ; découper davantage compliquerait le code sans gain perceptible |
| **Fraîcheur des données** | `staleTime` à 30 s en général, 30 min pour les référentiels — cohérent avec leur rythme de changement réel |
| **Filtres et recherche** | Référence, juridiction, catégorie, nature et « mes dossiers » sont filtrables ; l'état vit dans l'URL, donc partageable et conservé au retour arrière. La saisie texte écrit dans l'URL au `blur`, pas à chaque frappe |
| **Délai de notification (NF-ALR-03, < 1 min)** | Tenu : poussée temps réel immédiate, et repli par interrogation à 60 s canal ouvert, 30 s canal coupé |
| **Accessibilité, responsive, sécurité** | Audités au jalon F17 : AA vérifié par `axe-core`, mise en page contrôlée jusqu'à 375 px, en-têtes et session couverts par des tests dédiés |
| **Index de base de données** | 37 index présents et pertinents — à la seule exception des colonnes de tri, objet de la piste 1 |

---

## 8. Ce que je recommande de **ne pas** faire

Quatre idées plausibles, écartées après examen. Les inscrire évite qu'elles reviennent sans leur
contre-argument.

**Une recherche globale.** Une palette de commandes est séduisante, mais l'application compte
25 routes et une barre latérale entièrement visible ; la liste des dossiers offre déjà la recherche
par référence, partageable par URL. Le gain serait esthétique, le coût — dépendance, raccourcis
clavier, indexation multi-entités — réel et durable.

**Un « tout marquer comme traité » sur les notifications.** La liste se remplit vite, l'envie est
compréhensible. Mais « traiter » a un **sens métier** : l'utilisateur déclare avoir pris connaissance.
Un bouton qui en solde cinquante d'un coup ferait disparaître, sans être lue, l'alerte de prorogation
ou d'échéance de recours que le dispositif existe justement pour rendre visible. Si l'encombrement
devient gênant, il vaut mieux filtrer par dossier que tout solder.

**Un endpoint d'accueil agrégé.** L'accueil déclenche jusqu'à six comptages parallèles, un par file.
Un endpoint unique économiserait cinq allers-retours — mais ces requêtes sont légères, parallèles, et
le découpage actuel est délibéré : une file lente n'empêche pas les autres de s'afficher. Ce serait
troquer une propriété utile contre un gain non mesuré.

**Un compte à rebours de fin de session.** La rotation des jetons repousse la fenêtre à chaque appel :
un utilisateur actif n'expire jamais. Seul un utilisateur inactif est concerné, et la garde de
navigation de la piste 2 couvre le cas qui compte — le formulaire resté ouvert. Un compte à rebours
inquiéterait plus qu'il ne protégerait.

---

## 9. Si vous ne deviez en retenir que deux

**La piste 1** (index) parce qu'elle coûte une migration et neutralise une dégradation dont le projet
a déjà fait l'expérience une fois, brutalement, en Q-94.

**La piste 2** (perte de saisie) parce qu'elle touche le geste le plus fréquent et le plus long de
l'application, et que le coût de l'oubli est payé par l'utilisateur, jamais par le système — donc
jamais visible dans une suite de tests.

Les deux sont indépendantes l'une de l'autre, sans effet sur le contrat d'API, et vérifiables : la
première par un plan d'exécution, la seconde par un parcours de bout en bout.
