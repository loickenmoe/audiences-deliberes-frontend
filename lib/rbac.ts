import type { Role } from "@/types/enums";

/**
 * Contrôle d'accès du frontend.
 *
 * **Cette table est dérivée des `@PreAuthorize` du backend, jamais inventée.** Le backend reste
 * l'arbitre : chaque appel non autorisé est refusé côté serveur et remonte en `ERR-FORBIDDEN`.
 * Ce que l'on fait ici relève de l'ergonomie — ne pas proposer une action qui sera refusée — et non
 * de la sécurité. **Masquer n'est pas sécuriser.**
 *
 * Toute divergence entre cette table et un `@PreAuthorize` est un défaut : la référence est
 * `API_INTEGRATION_STATUS.md`, lui-même relevé endpoint par endpoint dans le code du backend.
 */

/**
 * Les cinq profils internes. Tous portent `ROLE_CONSULTATION` et `ROLE_SAISIE` (composite).
 *
 * Depuis Q-81, `ROLE_DJ` et `ROLE_DJA` incluent aussi `ROLE_JURISTE` (composite) : leur jeton porte
 * les deux, si bien que toute capacité « juriste » ci-dessous leur est ouverte **sans** qu'ils y
 * soient listés. `profilPrincipal` garde le DJ et la DJA en tête, pour l'affichage.
 */
export const ROLES_INTERNES = [
  "ROLE_JURISTE",
  "ROLE_DJ",
  "ROLE_DJA",
  "ROLE_ASSISTANTE",
  "ROLE_SH",
] as const satisfies readonly Role[];

/** Un utilisateur porte plusieurs rôles simultanément : toujours raisonner en ensemble. */
export function aRole(roles: readonly string[] | undefined, ...attendus: readonly Role[]): boolean {
  if (!roles?.length) return false;
  return attendus.some((role) => roles.includes(role));
}

/** Profil métier principal, à l'exclusion des rôles transverses. Sert à l'affichage. */
export function profilPrincipal(roles: readonly string[] | undefined): Role | null {
  const ordre: readonly Role[] = [
    "ROLE_DJ",
    "ROLE_DJA",
    "ROLE_SH",
    "ROLE_ASSISTANTE",
    "ROLE_JURISTE",
    "ROLE_AVOCAT",
  ];
  return ordre.find((role) => roles?.includes(role)) ?? null;
}

/**
 * Capacités de l'interface. Chaque entrée cite le ou les endpoints dont elle reflète le
 * `@PreAuthorize`, pour que la correspondance reste vérifiable.
 */
export const CAPACITES = {
  // ── Dossiers ──────────────────────────────────────────────────────────────
  /** `GET /dossiers`, `GET /dossiers/{id}` — ROLE_CONSULTATION */
  consulterDossiers: ["ROLE_CONSULTATION"],
  /** `POST /dossiers` — ROLE_SAISIE */
  creerDossier: ["ROLE_SAISIE"],
  /** `PUT /dossiers/{id}/affectation` — JURISTE, DJ */
  modifierAffectation: ["ROLE_JURISTE", "ROLE_DJ"],
  /** `PATCH .../etapes/{etapeId}/statut`, `POST /dossiers/{id}/etapes` — JURISTE */
  gererEtapes: ["ROLE_JURISTE"],
  /** `POST /dossiers/{id}/seuil-derogation` — ROLE_SAISIE */
  demanderDerogationSeuil: ["ROLE_SAISIE"],
  /**
   * `POST /dossiers/{id}/sensibilite/proposition` - SAISIE (N4, observation 5).
   *
   * Même rôle que la demande de dérogation, et pour la même raison : le juriste **propose**,
   * il ne décide pas. La pose et le retrait directs relèvent d'`arbitrerDossier`.
   */
  proposerDiligence: ["ROLE_SAISIE"],
  /** `PUT .../seuil-derogation/{auditId}`, `POST .../sensibilite/validation` — DJ, DJA */
  arbitrerDossier: ["ROLE_DJ", "ROLE_DJA"],

  // ── Clients et référentiels ───────────────────────────────────────────────
  /** `GET /clients`, `GET /referentiels/*`, `GET /utilisateurs`, `GET /intervenants` — CONSULTATION */
  consulterReferentiels: ["ROLE_CONSULTATION"],
  /** `POST /clients` — ROLE_SAISIE */
  creerClient: ["ROLE_SAISIE"],
  /** `PUT /clients/{id}` — ROLE_SAISIE : qui peut créer un client peut en corriger une coquille. */
  modifierClient: ["ROLE_SAISIE"],
  /** `POST /intervenants` — DJ, DJA */
  administrerIntervenants: ["ROLE_DJ", "ROLE_DJA"],

  // ── Audiences et délibérés ────────────────────────────────────────────────
  /** `POST .../audiences`, `PUT /audiences/{id}/compte-rendu`, alarmes — JURISTE */
  gererAudiences: ["ROLE_JURISTE"],
  /**
   * `GET /audiences/calendrier` — JURISTE, DJ. **L'Assistante n'y a pas accès ; la DJA, si** — par
   * son `ROLE_JURISTE` composite, comme le DJ. Le commentaire disait auparavant « ni DJA ni
   * Assistante » : c'était faux, et vérifié faux en exécution. La liste ci-dessous n'a jamais changé.
   */
  consulterCalendrier: ["ROLE_JURISTE", "ROLE_DJ"],

  /**
   * Écran 44 — journal des audiences et comptes rendus attendus.
   *
   * Ouvert aux **juristes** comme à la direction (arbitrage du porteur du projet, 2026-09-28).
   * D'abord réservé au DJ et à la DJA par prudence — l'écran nomme des personnes et mesure ce
   * qu'elles ont rapporté, et NF-CONF-01 reste « à définir avec la DRH » —, il s'est avéré que les
   * juristes en ont l'usage quotidien : savoir ce qui s'est dit aux audiences du jour fait partie
   * de leur métier, et le compte rendu attendu est le leur.
   */
  consulterJournalAudiences: ["ROLE_JURISTE", "ROLE_DJ", "ROLE_DJA"],
  /** `POST .../deliberes`, prorogations, rabattement, expédition, recours — JURISTE */
  gererDeliberes: ["ROLE_JURISTE"],

  // ── Frais ─────────────────────────────────────────────────────────────────
  /** `GET /frais/demandes`, `GET /frais/demandes/{id}` (Q-82) — AVOCAT, ASSISTANTE, DJA, DJ */
  consulterFrais: ["ROLE_AVOCAT", "ROLE_ASSISTANTE", "ROLE_DJA", "ROLE_DJ"],
  /** `POST /frais/demandes` — AVOCAT */
  deposerFrais: ["ROLE_AVOCAT"],
  /** `PUT .../conformite` — ASSISTANTE */
  controlerConformiteFrais: ["ROLE_ASSISTANTE"],
  /** `PATCH .../paiement` — ASSISTANTE */
  enregistrerPaiementFrais: ["ROLE_ASSISTANTE"],
  /** `PUT .../opportunite` — DJA */
  controlerOpportuniteFrais: ["ROLE_DJA"],
  /** `POST .../validation-conjointe` — DJ et DJA */
  validerConjointementFrais: ["ROLE_DJ", "ROLE_DJA"],

  // ── Publications et intervenants ──────────────────────────────────────────
  /** `GET /publications` — ASSISTANTE, JURISTE, DJ, DJA */
  consulterPublications: ["ROLE_ASSISTANTE", "ROLE_JURISTE", "ROLE_DJ", "ROLE_DJA"],
  /** `PUT /publications/{id}/validation` — ASSISTANTE */
  validerPublication: ["ROLE_ASSISTANTE"],
  /** `POST /publications/{id}/commentaires` — JURISTE */
  commenterPublication: ["ROLE_JURISTE"],
  /** `POST /publications/{id}/correspondance` — DJ, DJA */
  transmettreCorrespondance: ["ROLE_DJ", "ROLE_DJA"],
  /** `POST /publications/cr-audience`, `POST /publications/autres` — AVOCAT */
  deposerPublication: ["ROLE_AVOCAT"],
  /**
   * `GET /repertoire/avocats` — JURISTE, ASSISTANTE. **Le DJ et la DJA y accèdent aussi**, par leur
   * `ROLE_JURISTE` composite : mesuré, l'endpoint leur répond 200. Le commentaire disait « ni DJ ni
   * DJA » ; seuls le SH et l'avocat en sont écartés.
   */
  consulterRepertoire: ["ROLE_JURISTE", "ROLE_ASSISTANTE"],
  /** `GET /constitutions/prestataires` — SH, JURISTE, **ASSISTANTE** (2026-10-07) */
  consulterConstitutions: ["ROLE_SH", "ROLE_JURISTE", "ROLE_ASSISTANTE"],
  /** `POST /constitutions/prestataires` — JURISTE, **ASSISTANTE** (métier, 2026-10-07) */
  solliciterConstitution: ["ROLE_JURISTE", "ROLE_ASSISTANTE"],
  /** `PUT /constitutions/prestataires/{id}/validation` — SH */
  signerConstitution: ["ROLE_SH"],
  /**
   * `PUT /constitutions/prestataires/{id}/lettre` — JURISTE, SH, ASSISTANTE.
   *
   * **Ce rôle ne suffit pas, et c'est voulu.** Depuis Q-126 (2026-10-07) la lettre appartient au
   * demandeur de la constitution : lui seul y écrit, et le SH la corrige avant de la signer. Un
   * rôle ne peut pas dire cela - il ne connaît pas qui a demandé quoi, et `ROLE_JURISTE` étant
   * composite (Q-81), il vaudrait aussi pour le DJ et la DJA. C'est le **serveur** qui tranche,
   * ligne par ligne, par `redactionPossible`. Cette capacité ne sert donc qu'à ouvrir l'écran.
   */
  redigerLettre: ["ROLE_JURISTE", "ROLE_SH", "ROLE_ASSISTANTE"],

  /**
   * `GET /demandes-explication` — DJ, DJA et AVOCAT (N7 temps 2).
   *
   * Le même écran sert deux publics, et c'est le **serveur** qui décide lesquelles chacun voit :
   * la direction les siennes toutes, l'avocat celles qui lui sont adressées. L'écran n'envoie
   * aucun paramètre de périmètre - il suffirait à un avocat pour demander la liste entière.
   */
  consulterExplications: ["ROLE_DJ", "ROLE_DJA", "ROLE_AVOCAT"],
  /** `POST /demandes-explication` — DJ et DJA seuls : c'est la direction qui écrit. */
  demanderExplication: ["ROLE_DJ", "ROLE_DJA"],
  /** `PUT /demandes-explication/{id}/reponse` — l'avocat, et seulement pour la sienne (403). */
  repondreExplication: ["ROLE_AVOCAT"],

  /**
   * `GET /rapports/nominatif` — DJ et DJA seuls (observation 14, N6).
   *
   * Ce rapport **nomme des personnes**. Il est lu sur leurs rôles propres, jamais par
   * `ROLE_JURISTE` qui est composite (Q-81) : chaque juriste y lirait l'activité de ses collègues.
   */
  consulterRapportNominatif: ["ROLE_DJ", "ROLE_DJA"],

  /**
   * `GET /rapports/activite` — **sa propre activité**, pour chacun (Q-133).
   *
   * **L'avocat y est, et j'avais écrit l'inverse.** J'ai soutenu qu'« aucune des natures comptées
   * n'est celle d'un avocat - sa fiche serait vide par construction ». C'était **faux** : il dépose
   * ses demandes de frais, ses comptes rendus d'audience, ses autres publications, et répond aux
   * demandes d'explication. Les quatre sont tracées sous son propre compte. Corrigé le 2026-10-13
   * (backend Q-135), sur demande du métier.
   *
   * `ROLE_CONSULTATION` couvre les cinq profils internes, `ROLE_AVOCAT` l'avocat qui ne le porte
   * pas (QF-01). Deux rôles plutôt que sept profils : ce qui est énuméré ici doit rester court.
   *
   * C'est le **serveur** qui décide de quelle personne il s'agit : lire l'activité d'un collègue ou
   * d'un avocat demande d'être DJ ou DJA, et se tient sur [[consulterRapportNominatif]].
   */
  consulterMonActivite: ["ROLE_CONSULTATION", "ROLE_AVOCAT"],

  // ── Écrans ouverts à tout compte ──────────────────────────────────────────
  /**
   * L'**accueil**, `/` — ouvert à tout compte authentifié, avocat compris.
   *
   * Aucun endpoint ne la gouverne : c'est un écran, et depuis QF-19 une **racine unique pour tous
   * les profils**, dont le contenu s'adapte plutôt que de rediriger. La capacité existe donc pour
   * que l'entrée de navigation en ait une, et non pour refléter un `@PreAuthorize`.
   *
   * **Elle était adossée à [[consulterReferentiels]], et c'était un défaut** (QF-59) : l'avocat ne
   * porte pas `ROLE_CONSULTATION`, si bien que l'entrée disparaissait de son menu alors que la page
   * s'ouvrait parfaitement pour lui. Sa seule porte était le logo de la banque - une porte sans
   * étiquette, qui ne dit pas où elle mène et ne marque pas l'onglet de la page où l'on est.
   *
   * `ROLE_CONSULTATION` couvre les cinq profils internes, `ROLE_AVOCAT` l'avocat qui ne le porte
   * pas (QF-01) : les deux réunis sont la population entière, et deux rôles valent mieux que sept
   * profils énumérés.
   */
  consulterAccueil: ["ROLE_CONSULTATION", "ROLE_AVOCAT"],
  /**
   * Ses **notifications**, `GET /alertes/mes-notifications` — `@PreAuthorize("isAuthenticated()")`.
   *
   * <b>Distincte de [[consulterAccueil]]</b>, bien qu'elle porte aujourd'hui les mêmes rôles :
   * celle-ci reflète un endpoint, l'autre un écran sans endpoint. Les confondre ferait suivre à
   * l'une tout resserrement futur de l'autre.
   *
   * C'est le **serveur** qui décide desquelles il s'agit : le destinataire est résolu sur le jeton,
   * il n'est pas un paramètre. Chacun n'y voit donc que les alertes qui lui sont adressées, et
   * l'écran n'a aucun périmètre à demander.
   */
  consulterSesNotifications: ["ROLE_CONSULTATION", "ROLE_AVOCAT"],

  // ── Gestion documentaire ──────────────────────────────────────────────────
  /** `POST /ged/documents` — ROLE_SAISIE */
  deposerDocument: ["ROLE_SAISIE"],
  /** `GET /ged/documents/{id}`, `GET /dossiers/{id}/documents` — CONSULTATION */
  consulterDocuments: ["ROLE_CONSULTATION"],
  /** `DELETE /ged/documents/{id}` — JURISTE (202) / DJ, DJA (200) */
  supprimerDocument: ["ROLE_JURISTE", "ROLE_DJ", "ROLE_DJA"],
  /** `GET /ged/demandes-suppression`, `PUT .../approbation-suppression` — DJ, DJA */
  arbitrerSuppressions: ["ROLE_DJ", "ROLE_DJA"],
  /**
   * `PUT`, `DELETE /ged/documents/{id}/partage-avocat` — JURISTE (QF-64, backend Q-139). Le DJ et la
   * DJA l'atteignent par leur `ROLE_JURISTE` composite (Q-81). « Tout juriste partage, sans
   * validation du DJ » : arbitré par le porteur du projet le 2026-10-15. Sur un dossier sensible,
   * c'est le **serveur** qui fait du geste une proposition.
   */
  partagerDocument: ["ROLE_JURISTE"],
  /**
   * `PUT .../partage-avocat/arbitrage`, `GET /ged/partages-avocat` — DJ, DJA (QF-64).
   *
   * **Distincte d'`arbitrerSuppressions`**, bien qu'elle porte aujourd'hui les mêmes rôles : l'une
   * décide qu'une pièce disparaît, l'autre qu'elle sort de la banque. Les confondre ferait suivre à
   * l'une tout assouplissement futur de l'autre.
   */
  arbitrerPartages: ["ROLE_DJ", "ROLE_DJA"],
  /** `PUT /audiences/{id}/note-avocat` — JURISTE (QF-64) : la note destinée à l'avocat constitué. */
  ecrireNoteAvocat: ["ROLE_JURISTE"],
  /** `GET /ged/rapport-journalier` — JURISTE, DJ, DJA, ASSISTANTE (Q-80 backend) */
  consulterRapportJournalier: ["ROLE_JURISTE", "ROLE_DJ", "ROLE_DJA", "ROLE_ASSISTANTE"],

  // ── Décisions définitives ─────────────────────────────────────────────────
  /** adjudications, condamnations, jurisprudences (écriture) — JURISTE */
  gererDecisions: ["ROLE_JURISTE"],
  /** `GET /jurisprudences` — CONSULTATION */
  consulterJurisprudence: ["ROLE_CONSULTATION"],

  // ── Pilotage et administration ────────────────────────────────────────────
  /** `GET /tableau-de-bord` — DJ et **DJA** (backend Q-95 ; US 8.5 ne nommait que le DJ) */
  consulterTableauDeBord: ["ROLE_DJ", "ROLE_DJA"],
  /** `GET /rapports` — JURISTE ; le DJ l'atteint par son `ROLE_JURISTE` composite (Q-81, QF-04) */
  genererRapport: ["ROLE_JURISTE"],
  /** `GET /configurations` — CONSULTATION */
  consulterConfigurations: ["ROLE_CONSULTATION"],
  /**
   * `PUT /configurations/{cle}`, `PUT /alertes/seuils` — DJ **et DJA** (backend Q-108).
   *
   * Ouvert à la DJA sur décision du porteur du projet, pour la **continuité de service** : le DJ
   * absent, plus personne ne pouvait relever un seuil. L'ouverture est **à sens unique** — le
   * contrôle d'opportunité reste réservé à la DJA, sans quoi RG-INT-03 perdrait la séparation de ses
   * deux étapes.
   */
  administrerConfigurations: ["ROLE_DJ", "ROLE_DJA"],
  /**
   * `POST`, `PUT`, `DELETE /referentiels/agences` - DJ, DJA (backend, observation 2).
   *
   * **Distincte d'`administrerConfigurations`**, bien qu'elle porte aujourd'hui les mêmes
   * rôles : un seuil se règle, une agence engage les dossiers qui portent son code. Les
   * confondre ferait suivre à l'une tout assouplissement futur de l'autre.
   *
   * La **lecture** du référentiel relève de `consulterReferentiels` : elle explique ce que
   * propose le formulaire de création, la cacher n'aiderait personne.
   */
  administrerAgences: ["ROLE_DJ", "ROLE_DJA"],
  /**
   * `GET /alertes/statistiques-diffusion` — DJ, DJA (backend Q-109).
   *
   * Distincte d'`administrerConfigurations` bien qu'elle porte aujourd'hui les mêmes rôles : c'est
   * une **lecture** de supervision, pas une écriture d'administration. Les confondre ferait qu'un
   * assouplissement futur de l'une déplacerait l'autre sans qu'on l'ait voulu.
   */
  superviserAlertes: ["ROLE_DJ", "ROLE_DJA"],
  /**
   * `GET /historique` — DJ, DJA (backend Q-112).
   *
   * **Distincte d'`administrerConfigurations` et de `superviserAlertes`**, bien qu'elle porte
   * aujourd'hui les mêmes rôles : lire l'activité nommée d'un collègue n'est ni écrire un seuil ni
   * lire un taux global. Les confondre ferait qu'un assouplissement futur de l'une déplacerait
   * l'autre sans qu'on l'ait voulu — et ici, ce serait un assouplissement sur des données
   * personnelles (NF-CONF-01).
   */
  consulterAudit: ["ROLE_DJ", "ROLE_DJA"],
} as const satisfies Record<string, readonly Role[]>;

export type Capacite = keyof typeof CAPACITES;

/** Vrai si les rôles de l'utilisateur autorisent cette capacité. */
export function peut(roles: readonly string[] | undefined, capacite: Capacite): boolean {
  return aRole(roles, ...CAPACITES[capacite]);
}
