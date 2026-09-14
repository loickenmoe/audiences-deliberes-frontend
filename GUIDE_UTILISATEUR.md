# Guide utilisateur

Plateforme de digitalisation des **audiences et délibérés** — Direction Juridique, Afriland First
Bank Cameroun.

Ce guide s'adresse aux utilisateurs de l'application, pas aux développeurs. Il suit l'ordre dans
lequel on rencontre les écrans : se connecter, comprendre son accueil, puis chaque métier.

---

## 1. Se connecter

L'application s'ouvre sur un formulaire d'identification. Saisissez l'**identifiant** et le **mot de
passe** fournis par la DSI — ce sont ceux de votre compte Keycloak, non un compte propre à cette
application.

En cas de refus, le message ne précise jamais si le compte existe : c'est volontaire, et cela
protège vos comptes. Si vous avez oublié votre mot de passe, adressez-vous à la DSI ; cette
application ne le réinitialise pas.

**Changer de langue.** Les deux boutons `FR` / `EN` en haut à droite basculent toute l'interface. Le
choix est propre au navigateur, pas au compte : sur un autre poste, il faudra le refaire.

**Se déconnecter.** Le bouton *Se déconnecter* ferme aussi votre session Keycloak, pas seulement
l'application. Sur un poste partagé, c'est le seul geste qui empêche la personne suivante de
reprendre votre session.

---

## 2. Votre accueil

L'accueil affiche **ce qui vous attend** : une carte par file dont vous avez la charge, avec le
nombre en attente et un lien direct. Un compteur qui passe à l'orange signale du travail à traiter.

Les cartes dépendent de votre profil — l'Assistante voit les frais à contrôler, le SH les
constitutions à signer, le DJ les suppressions à arbitrer. Tout le monde voit ses **notifications
non lues**.

Les rôles qui vous sont attribués figurent en bas de l'écran. Si une fonction vous semble manquante,
c'est là qu'il faut regarder avant d'appeler la DSI.

---

## 3. Notifications

La **cloche** en haut de l'écran porte le nombre de notifications non lues, quelle que soit la page
affichée. L'écran *Notifications* les liste, de la plus récente à la plus ancienne.

Un indicateur précise si le **temps réel** est actif. Actif, une alerte apparaît sans que vous ayez à
recharger. Interrompu — réseau coupé, poste en veille — la liste se met à jour toute seule au plus
tard dans la minute : **aucune notification n'est perdue**, seul l'affichage immédiat peut manquer.

*Marquer traitée* retire la notification des non lues. Vous ne pouvez traiter que les vôtres.

---

## 4. Dossiers

**Créer un dossier** (juriste) : *Dossiers* → *Nouveau dossier*. La référence doit être unique ; si
elle existe déjà, le message s'affiche sous le champ concerné. Les pièces exigées dépendent de la
catégorie — recouvrement ou litiges d'exploitation — et se joignent dès la création.

**Un dossier sensible** exige un seuil de montant et un type de client. Une dérogation au seuil
global se demande depuis la fiche et doit être validée par le DJ.

**La fiche** rassemble tout : identification, parties, pièces, affectations, sensibilité, étapes,
audiences, délibérés, décisions et publications. Les onglets se partagent par lien : l'adresse porte
l'onglet ouvert, un collègue retrouvera exactement la même vue.

**Étapes.** Un dossier suit un cycle — instance, recours, exécution. Une audience ne se planifie que
sur une étape **en cours** : si le bouton n'apparaît pas, commencez par ouvrir l'étape.

---

## 5. Audiences et délibérés

**Planifier une audience** depuis l'onglet *Audiences*. Le système programme les rappels à J-7, J-3
et J-1. Une audience en double sur la même étape et la même date est signalée avant l'enregistrement
— vous pouvez confirmer si le doublon est voulu.

**Le calendrier** (*Calendrier*) présente les audiences par semaine, mois ou trimestre, et s'exporte
en PDF ou Excel.

**Un délibéré** s'enregistre à l'issue de l'audience. Il peut être **prorogé** — au-delà du seuil
configuré, une alerte part au DJ et à la DJA — ou **rabattu**, ce qui rouvre l'étape et permet de
planifier de nouvelles audiences. Le résultat rendu clôt le délibéré.

**Voie de recours.** Un délibéré défavorable ou mixte ouvre un délai de recours, suivi par une
alarme. Passé le délai sans recours, l'étape est close.

---

## 6. Frais d'avocats

**Pour l'avocat.** *Déposer une demande* : choisissez le dossier, saisissez la référence de facture
— elle doit être unique — le montant, puis **chargez vos pièces justificatives** (PDF ou images).
Chaque pièce part dès qu'elle est choisie ; son nom s'affiche, et vous pouvez la retirer avant
d'envoyer la demande.

**Le circuit**, dans l'ordre : dépôt par l'avocat → contrôle de **conformité** par l'Assistante →
contrôle d'**opportunité** par la DJA → **validation conjointe** DJ + DJA si le dossier est sensible
ou si le montant dépasse le seuil → enregistrement du **paiement** par l'Assistante.

Chaque profil ouvre l'application sur la file dont il a la charge. Un rejet exige toujours un motif,
et l'avocat en est notifié.

**Les pièces justificatives s'ouvrent** depuis le détail de la demande : le contrôle de conformité
porte sur les documents, pas sur leurs noms.

---

## 7. Publications et constitutions

**Pour l'avocat.** *Déposer une publication* propose deux voies :

- un **compte rendu d'audience**, qui est un texte rattaché à une audience de votre dossier ;
- une **pièce, décision ou conclusion**, qui se dépose en fichier.

Toute publication passe par la validation de l'Assistante avant d'être visible des juristes. En cas
de rejet, le motif s'affiche dans *Mon espace*, avec le dépôt concerné.

**Correspondance.** Un juriste commente une publication ; le DJ ou la DJA consolide ces commentaires
en une correspondance unique adressée à l'avocat. C'est la seule voie officielle d'échange.

**Constitutions.** Un juriste sollicite la constitution d'un prestataire ; le SH signe ; la lettre
est générée et rangée dans la GED du dossier. L'avocat constitué en est notifié.

---

## 8. Documents (GED)

Les pièces se joignent à la création d'un dossier ou depuis l'onglet *Documents*. Les formats admis
et le poids maximal sont fixés par le DJ dans les paramètres système.

**Supprimer un document.** Un juriste en fait la demande, motivée ; le DJ ou la DJA arbitre. Le DJ et
la DJA peuvent supprimer directement. Une demande en attente est relancée au bout de 72 heures.

Le **rapport journalier** récapitule l'activité documentaire du jour : dossiers manipulés, pièces
ajoutées, affaires nouvelles.

---

## 9. Décisions définitives et jurisprudence

Quand les recours sont épuisés, la décision devient définitive : enregistrez une **adjudication**
(bénéficiaire, provision reprise, soulte, reliquat) ou une **condamnation pécuniaire**, depuis
l'onglet *Décisions* de la fiche.

La décision peut ensuite être **archivée** dans la base jurisprudentielle, avec ses mots-clés, sa
nature, sa juridiction et sa date. La recherche (*Jurisprudence*) accepte des fragments de mots et
ignore la casse — « saisie » retrouve « Saisie immobilière ». Les accents, eux, comptent.

---

## 10. Pilotage (DJ et DJA)

**Tableau de bord** : six indicateurs en temps réel — dossiers actifs, audiences planifiées, frais en
attente, alertes de prorogation, taux de succès du recouvrement, provisions reprises. Chacun porte
une phrase disant ce qu'il compte.

**Rapports** : choisissez une période, affichez, puis exportez en PDF, Excel ou CSV. Une période sans
activité affiche un état vide — ce n'est pas une erreur, il n'y a rien à rapporter.

**Vue consolidée d'un client** : toutes ses procédures, groupées par catégorie, depuis la fiche du
client.

**Paramètres système** (DJ) : les sept réglages qui pilotent les seuils, les délais et les contrôles.
Une valeur incohérente est refusée à la saisie, avec la raison. Un changement prend effet
immédiatement, pour tout le monde.

---

## 11. Portail avocat

L'avocat est un utilisateur **externe** : il ne voit que ce qui le concerne. Trois entrées :

- **Mon espace** — ses dépôts, avec leur statut et le motif d'un éventuel rejet, et les lettres de
  constitution qui le désignent ;
- **Déposer une demande** — une demande de frais ;
- **Déposer une publication** — un compte rendu ou un document.

Il ne voit que les dossiers auxquels il est affecté, et seulement leur référence, leur nature et leur
juridiction. Ni client, ni montant en jeu, ni sensibilité.

---

## 12. Questions fréquentes

**Une fonction a disparu de mon menu.** Le menu n'affiche que ce à quoi vous avez droit. Vos rôles
sont listés sur l'accueil.

**« Vous n'avez pas les droits nécessaires ».** L'écran est réservé à d'autres profils. Si vous
pensez que c'est une erreur, contactez la Direction Juridique — vos droits viennent de Keycloak.

**Ma référence est refusée en doublon.** Les références de dossier, de client et de facture sont
uniques. Le message désigne le champ à corriger.

**L'application est lente.** Les vues courantes répondent en moins de deux secondes sur un jeu de
données de recette. Une lenteur durable se signale à la DSI avec l'écran concerné et l'heure.

**Sur téléphone.** L'interface s'adapte : la navigation devient une bande horizontale défilante en
haut de l'écran, et les tableaux larges défilent dans leur propre cadre.
