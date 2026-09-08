# FRONTEND_ARCHITECTURE

> Architecture cible du frontend. Mise à jour quand l'architecture change, pas à chaque écran.
> Dernière mise à jour : 2026-09-08 (jalon F3 — design system implémenté).

---

## 1. Pile technique

| Rôle | Choix | Motif |
|---|---|---|
| Framework | **Next.js 15**, App Router | Retenu en conception (REF-05 §3), pile du template |
| UI | **React 19**, TypeScript strict | idem |
| Styles | **Tailwind v4** (`@theme inline`, tokens OKLCH) | Mécanique du template conservée, valeurs remplacées |
| Composants | **shadcn/ui** (style `new-york`) | 28 primitives déjà éprouvées dans le template |
| Données | **TanStack Query v5** + **TanStack Table v8** | Cache, invalidation, tables paginées serveur |
| HTTP | **axios** | Intercepteurs, cohérence avec le template |
| Formulaires | **react-hook-form** + **Zod** | Schémas miroir des contraintes Bean Validation |
| Auth | **NextAuth v5** + provider **Keycloak** (OIDC) | QF-05 |
| Notifications UI | **sonner** | |
| Thème | **clair uniquement** (QF-10) — `next-themes` retiré | Aligné sur les applications internes de la banque |
| Dates | **date-fns** (locale `fr`) | |
| Icônes | **lucide-react** | |
| Graphiques | **recharts** | Tableau de bord (F15) |
| Tests | **Vitest + Testing Library + MSW**, **Playwright** | QF-15 |
| Temps réel | **@stomp/stompjs + sockjs-client** (F14, cf. QF-11) | Repli HTTP garanti |

## 2. Arborescence

```
app/
  layout.tsx                      racine : polices, providers, métadonnées
  (auth)/login/page.tsx           déclenchement du flux Keycloak
  (protected)/
    layout.tsx                    session + sidebar + navbar + garde globale
    page.tsx                      accueil contextualisé par profil
    dossiers/
      page.tsx                    liste + filtres
      nouveau/page.tsx            formulaire adaptatif par catégorie
      [id]/page.tsx               fiche à onglets
    clients/  audiences/  frais/  publications/  constitutions/
    repertoire/  ged/  jurisprudences/  rapports/  tableau-de-bord/
    notifications/  admin/
  unauthorized/page.tsx
  not-found.tsx
  api/auth/[...nextauth]/route.ts

lib/
  auth.ts            configuration NextAuth (Keycloak, callbacks, rotation du jeton)
  serverAuth.ts      helpers RSC : authenticate() / authorize()
  api/client.ts      instance axios + intercepteurs (jeton, erreurs)
  api/errors.ts      normalisation {code,message,details} → message utilisateur français
  rbac.ts            table unique rôle → route/action, miroir des @PreAuthorize
  navigation.ts      configuration de la barre latérale, filtrée par rôles
  env.ts             validation Zod de l'environnement au démarrage
  utils.ts           cn(), formatage FCFA, dates, libellés d'énumération

types/
  api.generated.ts   généré depuis /v3/api-docs (openapi-typescript), figé
  enums.ts           énumérations du domaine + libellés français d'affichage
  session.ts         augmentation des types NextAuth (roles: string[])

services/            un fichier par module backend, miroir 1:1 des endpoints
  dossierService · clientService · audienceService · delibereService
  fraisService · publicationService · intervenantService · gedService
  decisionService · alerteService · configurationService · referentielService
  utilisateurService · reportingService

hooks/
  const.ts           clés de cache centralisées
  use<Module>.ts     un fichier par module

components/
  ui/                shadcn (repris du template)
  global/            EmptyState · LoadingState · ErrorState · SubmitButton · Logo
  layout/            AppSidebar · Navbar · UserNav · NotificationBell
  metier/            CycleEtape · StatutChip · MontantFcfa · DataTable · FiltersBar
                     FileUpload · ExportMenu · ConfirmDialog
  modules/<module>/  écrans et formulaires métier

tests/
  unit/ · integration/ (MSW) · e2e/ (Playwright)
```

## 3. Authentification

**Flux** : Authorization Code sur le client Keycloak existant `audiences-api` (confidentiel, secret
côté serveur Next.js uniquement). Realm `audiences-realm`, issuer
`http://localhost:8081/realms/audiences-realm`.

**Session NextAuth (JWT)** — le callback `jwt` conserve :

| Champ | Source | Usage |
|---|---|---|
| `accessToken` | Keycloak | En-tête `Authorization` de chaque appel API |
| `refreshToken` | Keycloak | Rotation avant expiration |
| `expiresAt` | Keycloak | Déclenche la rotation |
| `roles: string[]` | claim `roles` du jeton | RBAC — **jamais un rôle unique** |
| `keycloakId` | claim `sub` | Rapprochement avec `utilisateur.keycloakId` |
| `nom`, `prenom`, `email` | `family_name`, `given_name`, `email` | Affichage |

**RF-02 — rotation pilotée par le refresh token.** Durées **mesurées** sur le realm réel :
`access_token` 3600 s, `refresh_token` **1800 s**. Le refresh expirant le premier, la politique se
cale sur `min(expiresAt, refreshExpiresAt) − 5 min`, soit ~25 minutes — et non sur l'expiration de
l'access token, ce qui déconnecterait tout le monde au bout d'une demi-heure.

La politique vit dans **`lib/rotation-jeton.ts`**, séparée de `lib/auth.ts` : ce dernier est un
module serveur qu'un test ne peut pas importer, et c'est la pièce la plus facile à se tromper.
Six tests la couvrent, dont un garde-fou qui atteste que la stratégie répandue échouerait ici.

Keycloak **fait tourner le refresh token** à chaque rotation : conserver l'ancien condamnerait la
session au bout d'un cycle. En cas d'échec définitif, la session porte `ERREUR_RAFRAICHISSEMENT` et
le provider client déclenche une déconnexion nette — préférable à une avalanche de 401.

**Pièges de typage.** L'augmentation d'interface vise **`@auth/core/jwt`** et non `next-auth/jwt` :
ce dernier n'est qu'un `export *`, et l'augmenter laisse silencieusement tous les champs du jeton en
`unknown`. Pour `Session`, augmenter `next-auth` fonctionne normalement.

**Deux chemins d'accès au jeton** :
- Composants serveur (RSC) et route handlers → `auth()`.
- Composants client → `getSession()` via l'intercepteur axios.

## 4. Autorisation (RBAC)

Le backend porte **deux niveaux** : RBAC par `@PreAuthorize`, puis contrôle métier en service
(affectation au dossier, auteur du document, destinataire de l'alerte, statut du circuit). **Le
frontend ne reproduit que le premier**, à des fins d'ergonomie ; le second reste au backend et se
manifeste par des 403 que l'interface doit savoir présenter.

**Rôles** — un utilisateur en porte plusieurs simultanément :

| Rôle | Porté par |
|---|---|
| `ROLE_JURISTE`, `ROLE_DJ`, `ROLE_DJA`, `ROLE_ASSISTANTE`, `ROLE_SH`, `ROLE_AVOCAT` | profil métier, un seul par utilisateur |
| `ROLE_CONSULTATION` | les 5 profils internes — **pas l'avocat** |
| `ROLE_SAISIE` | composite : JURISTE, DJ, DJA, ASSISTANTE, SH |

**Mise en œuvre** :
- `lib/rbac.ts` — table unique `{ route | action → rôles requis }`, dérivée mécaniquement des
  `@PreAuthorize` relevés dans `API_INTEGRATION_STATUS.md`.
- Garde de route : `(protected)/layout.tsx` vérifie la session ; chaque page sensible appelle
  `authorize(session, [...])`.
- Navigation : `navigation.ts` filtre les entrées par `roles`.
- Composants : un helper `<Autorise roles={[...]}>` masque les actions non permises.

**Principe** : masquer n'est pas sécuriser. Toute action masquée reste refusée par le backend.

## 5. Couche API

**Client axios** (`lib/api/client.ts`) :
- `baseURL` = `NEXT_PUBLIC_API_URL` (`http://localhost:8080/api/v1`).
- Intercepteur de requête : injection du `Bearer`.
- Intercepteur de réponse : normalisation vers une `ApiError` typée.

**Normalisation des erreurs** (`lib/api/errors.ts`) — le backend renvoie systématiquement
`{code, message, details}` :

| Code | Sens | Traitement UI |
|---|---|---|
| `ERR-001` | Métadonnées manquantes | Erreurs de champ sur le formulaire |
| `ERR-002` | Référence de dossier déjà utilisée | Erreur sur le champ `reference` |
| `ERR-003` | Doublon d'affectation | Dialogue de confirmation → rejeu avec `?forcer=true` |
| `ERR-004` | Transition d'étape non autorisée | Message explicite + états permis |
| `ERR-005` | Doublon d'audience | Dialogue de confirmation → `?forcer=true` |
| `ERR-006` | Facture en double | Erreur sur `referenceFacture` |
| `ERR-008` | Format ou poids de document non conforme | Message avec formats et plafond admis |
| `ERR-009` | Accès restreint à la publication | Écran « accès restreint », pas une erreur technique |
| `ERR-VALIDATION` | Validation générique | Erreurs de champ |
| `ERR-UNAUTHENTICATED` | 401 | Reconnexion |
| `ERR-FORBIDDEN` | 403 | Écran non autorisé |
| `ERR-NOT-FOUND` | 404 | Écran introuvable |
| `ERR-CONFLICT`, `ERR-BUSINESS-RULE` | 409 / 422 | Message métier tel quel |
| `ERR-INTERNAL` | 500 | Message générique + trace console |

Les `ERR-003` et `ERR-005` ne sont **pas** des échecs : ce sont des demandes de confirmation. Le
client les transforme en dialogue, jamais en toast d'erreur.

**Pagination** — le backend renvoie `{content, totalPages, totalElements}` sans écho de `page`/
`size` : l'état de pagination est tenu côté client et passé en paramètres de requête.

**Résolution des libellés** — les réponses ne portent que des identifiants numériques. Deux caches
longs (`staleTime` élevé, chargés à l'ouverture de session) : `GET /utilisateurs` et
`GET /intervenants`. Un hook `useLibelles()` expose `nomUtilisateur(id)` et `nomIntervenant(id)`.

**Types** — `types/api.generated.ts` produit par `openapi-typescript` depuis `/v3/api-docs`, avec
la spec figée dans `contracts/openapi.json`. Régénération manuelle et versionnée, jamais à
l'exécution (RF-03).

## 6. Design system

Implémenté au jalon F3. Source unique : `app/globals.css`. **Les ratios annoncés sont recalculés par
`tests/unit/contraste.test.ts` depuis les jetons réels** — éclaircir une couleur de texte fait
échouer la suite.

### Sources

| Source | Nature |
|---|---|
| Fichiers vectoriels officiels (`images/Park_Logo_Afriland_First_Bank/`) | **Vérifiée** — quatre couleurs, deux lockups |
| Signature « The Pact with Success », symbole en poignée de main | **Vérifiée** (site du groupe) |
| Capture de **GFA**, application Afriland en production (`images/login_page_template.png`) | **Vérifiée** — conventions d'interface réelles |
| Tout le reste | **Recommandation**, documentée et mesurée |

Aucune charte graphique officielle n'est publiée par la banque.

### Palette

| Jeton | Valeur | Contraste sur blanc | Emploi |
|---|---|---|---|
| `--afb-rouge` | `#ED1C24` | **4,38:1** | Identité **seulement** : logo, filet, état actif, anneau de focus. **Jamais** de texte ni de fond d'action |
| `--afb-anthracite` | `#231F20` | 16,30:1 | Texte, structure, **action principale** |
| `--afb-rouge-texte` | `#B3141B` | 6,92:1 | Liens et texte accentués |
| `--texte-secondaire` | `#5F5A5B` | 6,78:1 | Texte secondaire |
| `--texte-tertiaire` | `#6B6567` | 5,06:1 | Mentions — assombri pour tenir AA sur *toutes* les surfaces |
| `--succes` · `--attention` · `--danger` · `--info` | teal · ocre · rouge sombre · bleu | ≥ 4,5:1 | Statuts — **famille distincte du rouge de marque** |

**Le principe qui tient tout** : l'action principale est anthracite. Un bouton rouge deviendrait
indiscernable du rouge d'erreur dans une interface pleine de rejets et de suppressions — et le rouge
de marque n'atteint de toute façon pas le seuil de lisibilité du texte.

### Typographie

**IBM Plex Sans** pour l'interface, **IBM Plex Mono** pour les données alignées (références,
montants, codes d'erreur). Sans empattement, conformément à l'usage des applications internes de la
banque. Échelle de rapport 1,2 ancrée sur **15 px**, densité adaptée au travail bureautique.

### Composants du socle

`Button` (4 variantes, plus `classesBouton()` pour les liens — imbriquer un `<a>` dans un `<button>`
produit du HTML invalide) · `Card` · `Skeleton` · `Logo` · `StatutChip` · `EtatVide` · `EtatErreur` ·
`EtatChargement`.

### Accessibilité

Contraste AA vérifié par calcul · anneau de focus systématique (rouge de marque, 4,38:1 > seuil de
3:1 des indicateurs) · `prefers-reduced-motion` respecté · la couleur **double** toujours un libellé,
elle ne le remplace jamais · ossatures de chargement annoncées en `role=status` et masquées aux
technologies d'assistance.

## 7. États d'interface

Quatre états obligatoires pour toute vue de données : **chargement** (squelette, pas de spinner
plein écran), **vide** (message métier + action de sortie), **erreur** (message issu du code
backend + moyen de réessayer), **succès** (toast sonner, jamais de blocage).

## 8. Configuration

`lib/env.ts` valide au démarrage, avec échec explicite (le template se contentait d'un avertissement) :

| Variable | Exemple |
|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8080/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `http://localhost:8080/ws` |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | secret local, jamais versionné |
| `KEYCLOAK_ISSUER` | `http://localhost:8081/realms/audiences-realm` |
| `KEYCLOAK_CLIENT_ID` | `audiences-api` |
| `KEYCLOAK_CLIENT_SECRET` | secret du client, jamais versionné |

Un `env.template` versionné ne contient que des valeurs locales sans secret réel — le backend a
connu une fuite d'identifiants sur ce point (R-01), ne pas la reproduire.

## 9. Tests

| Niveau | Outil | Portée |
|---|---|---|
| Unitaire | Vitest | `lib/` — rbac, normalisation d'erreurs, formatage, schémas Zod |
| Composant | Vitest + Testing Library | Composants métier, états, accessibilité |
| Intégration | + MSW | Écrans complets contre des réponses backend simulées, y compris les codes `ERR-*` |
| Bout en bout | Playwright | Les 9 parcours du backend, contre un environnement local réel |

Les parcours P1 à P9 de `FUNCTIONAL_MAP.md` (backend) servent de référence aux tests e2e.

## 10. Environnement de développement

```bash
# Socle backend (dans audiences-deliberes-backend, lecture seule)
docker-compose up postgres keycloak minio -d
./mvnw spring-boot:run        # :8080

# Frontend (ici)
npm run dev                   # :3000
```

Comptes de test (realm `audiences-realm`, mot de passe `Password1!`) : `juriste.test`, `dj.test`,
`dja.test`, `assistante.test`, `sh.test`, `avocat.test`.
