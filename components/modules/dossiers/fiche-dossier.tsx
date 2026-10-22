"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { StatutChip, type TonStatut } from "@/components/global/statut-chip";
import { DateValeur } from "@/components/metier";
import { DerogationsEnAttente } from "@/components/modules/dossiers/derogations-en-attente";
import { ModaleAffectation } from "@/components/modules/dossiers/modale-affectation";
import { ModaleConstitution } from "@/components/modules/dossiers/modale-constitution";
import { ModaleDerogation } from "@/components/modules/dossiers/modale-derogation";
import {
  ModaleDiligence,
  type IntentionDiligence,
} from "@/components/modules/dossiers/modale-diligence";
import { ModaleSensibilite } from "@/components/modules/dossiers/modale-sensibilite";
import { OngletAlarmes } from "@/components/modules/dossiers/onglet-alarmes";
import { OngletAudiences } from "@/components/modules/dossiers/onglet-audiences";
import { OngletDecisions } from "@/components/modules/dossiers/onglet-decisions";
import { OngletDeliberes } from "@/components/modules/dossiers/onglet-deliberes";
import { OngletDocuments } from "@/components/modules/dossiers/onglet-documents";
import { OngletEtapes } from "@/components/modules/dossiers/onglet-etapes";
import { OngletHistorique } from "@/components/modules/dossiers/onglet-historique";
import { OngletPublications } from "@/components/modules/dossiers/onglet-publications";
import { OngletSynthese } from "@/components/modules/dossiers/onglet-synthese";
import { ModaleLettre } from "@/components/modules/constitutions/modale-lettre";
import { Button } from "@/components/ui/button";
import { useDossier } from "@/hooks/useDossiers";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { Dossier } from "@/types/domaine";
import type { StatutValidation } from "@/types/enums";

const ONGLETS = [
  "synthese",
  "etapes",
  "audiences",
  "deliberes",
  "alarmes",
  "decisions",
  "historique",
  "documents",
  "publications",
] as const;
type Onglet = (typeof ONGLETS)[number];

const LIBELLES_ONGLETS: Record<Onglet, string> = {
  synthese: "ongletSynthese",
  etapes: "ongletEtapes",
  audiences: "ongletAudiences",
  deliberes: "ongletDeliberes",
  alarmes: "ongletAlarmes",
  decisions: "ongletDecisions",
  historique: "ongletHistorique",
  documents: "ongletDocuments",
  publications: "ongletPublications",
};

const TON_SENSIBILITE: Record<StatutValidation, TonStatut> = {
  EN_ATTENTE: "attention",
  VALIDEE: "info",
  REJETEE: "neutre",
};

/**
 * Header actions offered on this case to this profile. The backend enforces both the role and the
 * case state; the screen only offers what it would accept.
 */
function actionsPermises(roles: readonly string[], dossier: Dossier) {
  const sensible = !!dossier.estSensible;
  const statut = sensible ? dossier.sensibiliteStatut : null;
  const arbitre = peut(roles, "arbitrerDossier");
  return {
    peutAffecter: peut(roles, "modifierAffectation"),
    peutDemanderDerogation: peut(roles, "demanderDerogationSeuil") && statut === "VALIDEE",
    peutStatuer: arbitre && statut === "EN_ATTENTE",
    // Arbitrating a derogation is only accepted on an already validated sensitivity.
    peutArbitrerDerogation: arbitre && statut === "VALIDEE",
    /*
     * Due diligence can be revised after opening: the lawyer proposes it on a case not already
     * under due diligence; the DJ and DJA set it directly in that case, and remove a validated one.
     * The three conditions are exclusive: a case pending arbitration only offers arbitration.
     */
    peutProposerDiligence: peut(roles, "proposerDiligence") && !sensible,
    peutPoserDiligence: arbitre && !sensible,
    peutRetirerDiligence: arbitre && statut === "VALIDEE",
    // UC-INT-05: the lawyer requests a service provider's representation from the case.
    peutSolliciter: peut(roles, "solliciterConstitution"),
  };
}

type Modale = "affectation" | "derogation" | "sensibilite" | "constitution";

/** The header actions this profile may take on this case. */
function ActionsEntete({
  permissions,
  onModale,
  onDiligence,
}: Readonly<{
  permissions: ReturnType<typeof actionsPermises>;
  onModale: (modale: Modale) => void;
  onDiligence: (intention: IntentionDiligence) => void;
}>) {
  const t = useTranslations("fiche");
  return (
    <div className="flex flex-wrap gap-2">
      {permissions.peutAffecter ? (
        <Button variante="secondaire" onClick={() => onModale("affectation")}>
          {t("actionAffectation")}
        </Button>
      ) : null}
      {permissions.peutDemanderDerogation ? (
        <Button variante="secondaire" onClick={() => onModale("derogation")}>
          {t("actionDerogation")}
        </Button>
      ) : null}
      {permissions.peutSolliciter ? (
        <Button variante="secondaire" onClick={() => onModale("constitution")}>
          {t("actionConstitution")}
        </Button>
      ) : null}
      {permissions.peutProposerDiligence ? (
        <Button variante="secondaire" onClick={() => onDiligence("proposer")}>
          {t("actionDiligenceProposer")}
        </Button>
      ) : null}
      {permissions.peutPoserDiligence ? (
        <Button variante="secondaire" onClick={() => onDiligence("poser")}>
          {t("actionDiligencePoser")}
        </Button>
      ) : null}
      {permissions.peutRetirerDiligence ? (
        <Button variante="secondaire" onClick={() => onDiligence("retirer")}>
          {t("actionDiligenceRetirer")}
        </Button>
      ) : null}
      {permissions.peutStatuer ? (
        <Button onClick={() => onModale("sensibilite")}>{t("actionSensibilite")}</Button>
      ) : null}
    </div>
  );
}

/** The content of the selected tab. */
function ContenuOnglet({
  onglet,
  dossier,
  roles,
}: Readonly<{ onglet: Onglet; dossier: Dossier; roles: readonly string[] }>) {
  switch (onglet) {
    case "synthese":
      return <OngletSynthese dossier={dossier} />;
    case "etapes":
      return <OngletEtapes dossier={dossier} roles={roles} />;
    case "audiences":
      return <OngletAudiences dossier={dossier} roles={roles} />;
    case "deliberes":
      return <OngletDeliberes dossier={dossier} roles={roles} />;
    case "alarmes":
      return <OngletAlarmes dossier={dossier} roles={roles} />;
    case "decisions":
      return <OngletDecisions dossier={dossier} roles={roles} />;
    case "historique":
      return <OngletHistorique dossierId={dossier.id} />;
    case "documents":
      return (
        <OngletDocuments dossierId={dossier.id} roles={roles} sensible={!!dossier.estSensible} />
      );
    case "publications":
      return peut(roles, "consulterPublications") ? (
        <OngletPublications dossierId={dossier.id} />
      ) : null;
  }
}

/**
 * Screen 07 - case page.
 * Header actions depend on both the profile and the case state, because the backend enforces both:
 * a threshold derogation is only accepted on an already validated sensitive case, and sensitivity
 * validation only makes sense while a proposal is pending. Showing these buttons otherwise would
 * lead the user to a rejection.
 */
export function FicheDossier({
  dossierId,
  roles,
  ongletInitial,
}: Readonly<{
  dossierId: number;
  roles: readonly string[];
  ongletInitial?: string;
}>) {
  const t = useTranslations("fiche");
  const td = useTranslations("dossiers");
  const tdom = useTranslations("domaine");
  const requete = useDossier(dossierId);
  const [onglet, setOnglet] = useState<Onglet>(
    (ONGLETS as readonly string[]).includes(ongletInitial ?? "")
      ? (ongletInitial as Onglet)
      : "synthese",
  );
  const [modale, setModale] = useState<Modale | null>(null);
  /*
   * Due diligence review carries its intent rather than a boolean: three actions share the same
   * modal and the intent decides what is required.
   */
  const [diligence, setDiligence] = useState<IntentionDiligence | null>(null);
  /**
   * The letter to draft right after a representation request. It lives here rather than in the
   * request modal, which closes and can no longer display anything.
   */
  const [lettreARediger, setLettreARediger] = useState<number | null>(null);
  const refsOnglets = useRef<Record<Onglet, HTMLButtonElement | null>>({
    synthese: null,
    etapes: null,
    audiences: null,
    deliberes: null,
    alarmes: null,
    decisions: null,
    historique: null,
    documents: null,
    publications: null,
  });

  if (requete.isLoading) return <EtatChargement lignes={10} />;
  if (requete.error || !requete.data) {
    return <EtatErreur message={messageErreur(requete.error)} />;
  }

  const dossier = requete.data;
  const statutSensibilite = dossier.estSensible ? dossier.sensibiliteStatut : null;
  const permissions = actionsPermises(roles, dossier);
  const {
    peutAffecter,
    peutDemanderDerogation,
    peutStatuer,
    peutArbitrerDerogation,
    peutSolliciter,
  } = permissions;
  // The SH cannot read publications (`GET /publications` refuses): no tab for them.
  const onglets = ONGLETS.filter(
    (cle) => cle !== "publications" || peut(roles, "consulterPublications"),
  );

  // Keyboard navigation for the WAI-ARIA tabs pattern: arrows, Home, End.
  function surToucheOnglet(evenement: KeyboardEvent<HTMLButtonElement>) {
    const index = onglets.indexOf(onglet);
    const cibles: Record<string, number> = {
      ArrowRight: (index + 1) % onglets.length,
      ArrowLeft: (index - 1 + onglets.length) % onglets.length,
      Home: 0,
      End: onglets.length - 1,
    };
    const cible = cibles[evenement.key];
    if (cible === undefined) return;
    evenement.preventDefault();
    const suivant = onglets[cible]!;
    setOnglet(suivant);
    refsOnglets.current[suivant]?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dossiers"
          className="inline-flex items-center gap-1.5 text-[length:var(--taille-sm)] text-texte-secondaire underline underline-offset-4"
        >
          <ArrowLeft size={14} aria-hidden />
          {t("retour")}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="font-mono text-[length:var(--taille-xs)] uppercase tracking-[0.13em] text-texte-tertiaire">
            {dossier.reference}
          </p>
          <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
            {dossier.nature}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-[length:var(--taille-sm)] text-texte-secondaire">
            <StatutChip>{tdom(`CategorieDossier.${dossier.categorie}` as never)}</StatutChip>
            {statutSensibilite ? (
              <StatutChip ton={TON_SENSIBILITE[statutSensibilite]}>
                {td("champEstSensible")} · {tdom(`StatutValidation.${statutSensibilite}` as never)}
              </StatutChip>
            ) : null}
            <span>
              <Link href={`/clients/${dossier.clientId}`} className="underline underline-offset-4">
                {dossier.clientNom ?? `#${dossier.clientId}`}
              </Link>
            </span>
            <span aria-hidden>·</span>
            <span>
              {t("ouvertLe")} <DateValeur valeur={dossier.createdAt} />
            </span>
          </div>
        </div>

        <ActionsEntete permissions={permissions} onModale={setModale} onDiligence={setDiligence} />
      </header>

      {peutArbitrerDerogation ? <DerogationsEnAttente dossierId={dossier.id} /> : null}

      <div className="flex flex-col gap-5">
        <div
          role="tablist"
          aria-label={t("ongletsLibelle")}
          className="flex gap-1 border-b border-bordure"
        >
          {onglets.map((cle) => {
            const actif = cle === onglet;
            return (
              <button
                key={cle}
                ref={(element) => {
                  refsOnglets.current[cle] = element;
                }}
                type="button"
                role="tab"
                id={`onglet-${cle}`}
                aria-selected={actif}
                aria-controls={`panneau-${cle}`}
                // A single tab in the tab order: the others are reached with the arrow keys.
                tabIndex={actif ? 0 : -1}
                onClick={() => setOnglet(cle)}
                onKeyDown={surToucheOnglet}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-[length:var(--taille-sm)] transition-colors",
                  actif
                    ? "border-[var(--afb-rouge)] font-medium text-texte"
                    : "border-transparent text-texte-secondaire hover:text-texte",
                )}
              >
                {t(LIBELLES_ONGLETS[cle] as never)}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" id={`panneau-${onglet}`} aria-labelledby={`onglet-${onglet}`}>
          <ContenuOnglet onglet={onglet} dossier={dossier} roles={roles} />
        </div>
      </div>

      {peutAffecter ? (
        <ModaleAffectation
          dossier={dossier}
          ouvert={modale === "affectation"}
          onFermeture={() => setModale(null)}
        />
      ) : null}
      {peutDemanderDerogation ? (
        <ModaleDerogation
          dossierId={dossier.id}
          ouvert={modale === "derogation"}
          onFermeture={() => setModale(null)}
        />
      ) : null}
      {peutStatuer ? (
        <ModaleSensibilite
          dossier={dossier}
          ouvert={modale === "sensibilite"}
          onFermeture={() => setModale(null)}
        />
      ) : null}
      {/* The key remounts the modal for each intent so its form starts clean. */}
      {diligence ? (
        <ModaleDiligence
          key={diligence}
          dossier={dossier}
          intention={diligence}
          ouvert
          onFermeture={() => setDiligence(null)}
        />
      ) : null}
      {peutSolliciter ? (
        <ModaleConstitution
          dossierId={dossier.id}
          ouvert={modale === "constitution"}
          onFermeture={() => setModale(null)}
          onSollicitee={setLettreARediger}
        />
      ) : null}
      {/*
        The letter editor opens on the request just saved, without leaving the case. The letter
        already exists (the backend creates it with the request, without a number); it can also be
        drafted later from the representation queue.
      */}
      {peutSolliciter ? (
        <ModaleLettre
          demandeId={lettreARediger}
          ouvert={lettreARediger !== null}
          onFermeture={() => setLettreARediger(null)}
        />
      ) : null}
    </div>
  );
}
