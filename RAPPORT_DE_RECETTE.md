# Rapport de recette

Plateforme de digitalisation des **audiences et délibérés** — Direction Juridique, Afriland First
Bank Cameroun.

> Établi le 2026-09-14, à la clôture du développement. **Tous les chiffres de ce rapport ont été
> mesurés le jour de sa rédaction**, sur la pile complète démarrée (PostgreSQL, Keycloak, MinIO,
> backend Spring Boot, frontend Next.js en build de production) — aucun n'est recopié d'un rapport
> antérieur.

Mémoire de fin d'études KFOKAM-48 — KENMOE MBEUKEM Loïc Luc. Encadreur DSI : DEUMO DEUMO Léonce.

---

## 1. Ce qui est livré

| | |
|---|---|
| Écrans | **42 sur 42** — vérifié en relevant les numéros distincts de `SCREEN_MAP.md` : aucun manquant de 01 à 42 (43 entrées, la 43ᵉ étant la page « introuvable », non numérotée) |
| Endpoints du contrat consommés | **74 sur 74** — les 74 lignes du tableau `API_INTEGRATION_STATUS.md` portent toutes la marque « consommé et validé » |
| Surface supplémentaire | les **5 endpoints du portail Avocat** (ajouts backend Q-96/Q-97) et le canal temps réel `/ws` |
| Jalons | **F0 → F17** côté frontend, **M0 → M20** côté backend |
| Langues | français et anglais, sans préfixe d'URL |
| Profils | 6, dont un externe (avocat) |

Le backend a connu **cinq jalons hors feuille de route initiale** (M16 à M20), ouverts sur
autorisation explicite du porteur du projet. Ils recueillent les défauts que seule la consommation
réelle de l'API par un client révèle : Q-70 à Q-98.

---

## 2. Vérifications automatiques

| Suite | Résultat mesuré | Étendue |
|---|---|---|
| Backend — `./mvnw test` | **358 / 358**, `BUILD SUCCESS` | 41 classes de test, dont les parcours de bout en bout sur PostgreSQL réel (Testcontainers) |
| Frontend — tests unitaires et d'intégration | **280 / 280** | 27 fichiers, Vitest + Testing Library + MSW |
| Frontend — parcours de bout en bout | **132 / 132** en 11 min 30 | 22 fichiers Playwright, un seul travailleur, contre le **build de production** et le backend réel |
| Contrôle d'hypothèses — `npm run smoke` | **17 / 17** | interroge Keycloak et l'API réels : forme des jetons, rôles, pagination, référentiels, périmètre de l'avocat |
| Qualité | `lint`, `typecheck`, `build` | verts |

**Ce que ces suites vérifient réellement.** Les parcours de bout en bout ne simulent pas le backend :
ils se connectent à Keycloak, créent de vrais dossiers, téléversent de vrais fichiers dans MinIO et
relisent ce que le backend a écrit. Neuf parcours métier (P1 à P9) traversent chacun un circuit
complet — de l'ouverture d'un dossier au paiement d'une demande de frais, de la planification d'une
audience à la validation du compte rendu de l'avocat.

S'y ajoutent, depuis le jalon de durcissement F17 : un audit d'accessibilité **AA** exécuté par
`axe-core` sur les écrans principaux, des contrôles de mise en page jusqu'à 375 px de large, des
seuils de temps de réponse, et une revue de sécurité (en-têtes, emplacement du jeton, refus des
routes protégées sans session, fermeture effective de la session).

---

## 3. Fondations techniques

**Backend** — Spring Boot 3.3 / Java 21, PostgreSQL avec **13 migrations Flyway**, **20
contrôleurs** REST, MinIO pour le stockage, Keycloak 24 pour l'authentification, STOMP/SockJS pour
le temps réel. L'autorisation est portée par `@PreAuthorize` et fait autorité.

**Frontend** — Next.js 15 (App Router), React 19, TypeScript strict, TanStack Query, next-intl,
Tailwind v4. Les capacités d'interface (`lib/rbac.ts`) sont **dérivées** des `@PreAuthorize` du
backend, jamais réinventées : masquer un écran n'est pas le protéger, et le backend reste l'arbitre.

**Identité visuelle** — structure anthracite `#231F20`, identité rouge `#ED1C24`, palette vérifiée
par 24 assertions de contraste calculées sur les jetons réels. L'action principale est anthracite,
jamais rouge.

---

## 4. Défauts trouvés et corrigés en fin de parcours

Deux corrections postérieures au dernier jalon méritent d'être signalées, parce qu'elles disent
comment les défauts ont été trouvés.

**Q-98 — le compte rendu d'audience ne pouvait pas porter sa pièce.** La question avait été close
comme « conforme » : la story 5.1 décrit bien un compte rendu textuel. La conformité au contrat ne
disait pourtant rien de l'usage — l'avocat qui rentre d'audience dispose du plumitif, et le déposer
séparément lui faisait perdre le rattachement à l'audience. La pièce est désormais **facultative**
sur le compte rendu, le récit restant obligatoire, et l'écran de dépôt a été refondu en un formulaire
continu à deux choix décrits.

**QF-42 — la déconnexion ne fermait pas la session.** Trouvé en vérifiant Q-98. Se déconnecter
aussitôt après l'ouverture d'un écran laissait la session ouverte : une URL protégée saisie ensuite
s'ouvrait normalement. Sur un poste partagé, le geste qui protège ne protégeait pas.

> Le diagnostic a demandé quatre tentatives, et la mesure a démenti trois raisonnements successifs :
> **8 échecs sur 10** déconnexions à l'origine, 6 sur 10, 3 sur 10, puis **4 sur 10** — soit aucun
> progrès — avant d'atteindre **0 sur 20**. La cause réelle n'est apparue que dans la trace des
> en-têtes `Set-Cookie` : toute lecture de session repose le cookie, et la bibliothèque
> d'authentification en relance une d'elle-même **1 ms après** la déconnexion.

---

## 5. Limites connues et assumées

Aucune n'est un défaut caché : toutes sont consignées, avec leur raison, dans
`DECISIONS_AND_OPEN_QUESTIONS.md`.

### 5.1 Une question reste ouverte et appelle un arbitrage métier

**QF-16 — un utilisateur jamais connecté n'est pas affectable.** Le backend crée la ligne
`utilisateur` au premier appel qui résout l'utilisateur courant. Un juriste qui ne s'est jamais
connecté **n'apparaît pas** dans le sélecteur d'affectation : un dossier urgent ne peut donc pas lui
être confié en son absence.

Le frontend traite déjà l'amorçage — il appelle `GET /alertes/mes-notifications` juste après la
connexion, ce qui provisionne le compte et alimente le compteur de notifications en un seul appel.
Reste la question de fond : **accepter que chaque utilisateur doive se connecter une fois**, et
l'écrire dans le guide, ou demander au backend un pré-provisionnement depuis Keycloak — évolution non
triviale, à décider en connaissance de cause.

### 5.2 Points documentés, non bloquants

| Réf. | Limite |
|---|---|
| QF-08 | Aucun filtre serveur pour les dossiers en attente de validation de sensibilité ni pour les dérogations de seuil : le DJ et la DJA parcourent les pages |
| QF-40 | Une condamnation se crée toujours « En attente » — le statut de paiement n'est pas accepté à la création |
| QF-31 | Le calendrier compte le premier jour de la période suivante |
| QF-32 | Une audience est dite « tenue » le jour où l'on saisit son compte rendu, non le jour où elle s'est tenue |
| QF-27 / QF-02 | Aucun endpoint ne donne l'identifiant numérique de l'utilisateur connecté |
| QF-24 | L'historique d'un dossier est rédigé en français par le serveur : il n'est pas traduit |
| RF-05 | Les annuaires (`utilisateurs`, `intervenants`) ne sont pas paginés — acceptable à l'échelle de la Direction Juridique |

### 5.3 Réserves de mise en production

- **MinIO** : l'URL publique et la politique CORS devront être reconfigurées pour l'origine réelle de
  l'application ; `MINIO_API_URL` vaut aujourd'hui `localhost` (RF-01).
- **Documentation d'API** : `/v3/api-docs` et `/swagger-ui` sont accessibles sans authentification
  côté backend, à fermer avant production (RF-03). Le frontend ne s'appuie pas dessus.
- **Durées de jetons** : mesurées sur le realm de développement — access token 60 min, refresh token
  30 min. La rotation est pilotée sur le **premier des deux qui expire** (RF-02) ; à revérifier si le
  realm de production diffère.
- **Authentification** : le formulaire d'identification vit dans l'application (QF-18, décision du
  porteur du projet). Ni authentification multifacteur, ni réinitialisation de mot de passe, ni
  connexion unique — ce sont les limites acceptées de ce choix.

---

## 6. Méthode de travail

Le projet a suivi une règle constante, et elle explique la forme de ce rapport : **ne jamais inventer
une règle métier silencieusement**. Chaque écart entre la documentation, le contrat d'API et le code
a été signalé, argumenté depuis les sources, et tranché par le porteur du projet — 42 questions côté
frontend (QF), 98 côté backend (Q), toutes consignées avec leur raison.

Trois principes en découlent, visibles dans les documents :

1. **Les chiffres sont mesurés, jamais recopiés.** Un décompte annoncé en fin de jalon est relevé sur
   le tableau qui fait foi. Un décompte faux a été corrigé en cours de route pour cette raison.
2. **Les tests verts ne valent pas recette.** Chaque jalon s'est terminé par un arrêt et une
   validation manuelle du porteur du projet.
3. **Une erreur de ma part est consignée comme telle.** Plusieurs entrées de
   `DECISIONS_AND_OPEN_QUESTIONS.md` disent explicitement où mon analyse était fausse et ce qui l'a
   démentie — c'est ce qui distingue un correctif vérifié d'un correctif supposé.

---

## 7. Conclusion

Le périmètre fonctionnel est **couvert intégralement** : 42 écrans, 74 endpoints du contrat, six
profils, deux langues. Les vérifications automatiques passent en totalité contre la pile réelle. Une
seule question reste ouverte, **QF-16**, et elle relève d'une décision de la Direction Juridique, non
du code.

Les réserves de mise en production listées au §5.3 sont des tâches d'exploitation, à traiter avec la
DSI avant tout déploiement hors poste de développement.
