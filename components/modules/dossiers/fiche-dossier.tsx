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
import { ModaleDerogation } from "@/components/modules/dossiers/modale-derogation";
import { ModaleSensibilite } from "@/components/modules/dossiers/modale-sensibilite";
import { OngletAlarmes } from "@/components/modules/dossiers/onglet-alarmes";
import { OngletAudiences } from "@/components/modules/dossiers/onglet-audiences";
import { OngletDocuments } from "@/components/modules/dossiers/onglet-documents";
import { OngletEtapes } from "@/components/modules/dossiers/onglet-etapes";
import { OngletHistorique } from "@/components/modules/dossiers/onglet-historique";
import { OngletSynthese } from "@/components/modules/dossiers/onglet-synthese";
import { Button } from "@/components/ui/button";
import { useDossier } from "@/hooks/useDossiers";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { StatutValidation } from "@/types/enums";

const ONGLETS = ["synthese", "etapes", "audiences", "alarmes", "historique", "documents"] as const;
type Onglet = (typeof ONGLETS)[number];

const LIBELLES_ONGLETS: Record<Onglet, string> = {
  synthese: "ongletSynthese",
  etapes: "ongletEtapes",
  audiences: "ongletAudiences",
  alarmes: "ongletAlarmes",
  historique: "ongletHistorique",
  documents: "ongletDocuments",
};

const TON_SENSIBILITE: Record<StatutValidation, TonStatut> = {
  EN_ATTENTE: "attention",
  VALIDEE: "info",
  REJETEE: "neutre",
};

/**
 * Écran 07 — fiche dossier.
 *
 * Les actions de l'en-tête dépendent **à la fois** du profil et de l'état du dossier, parce que le
 * backend applique les deux conditions :
 * · la dérogation de seuil n'est recevable que sur un dossier sensible **déjà validé** ;
 * · la validation de sensibilité n'a de sens que tant qu'une proposition est **en attente**.
 * Proposer ces boutons hors de ces états conduirait l'utilisateur à un refus.
 */
export function FicheDossier({
  dossierId,
  roles,
  ongletInitial,
}: {
  dossierId: number;
  roles: readonly string[];
  ongletInitial?: string;
}) {
  const t = useTranslations("fiche");
  const td = useTranslations("dossiers");
  const tdom = useTranslations("domaine");
  const requete = useDossier(dossierId);
  const [onglet, setOnglet] = useState<Onglet>(
    (ONGLETS as readonly string[]).includes(ongletInitial ?? "") ? (ongletInitial as Onglet) : "synthese",
  );
  const [modale, setModale] = useState<"affectation" | "derogation" | "sensibilite" | null>(null);
  const refsOnglets = useRef<Record<Onglet, HTMLButtonElement | null>>({
    synthese: null,
    etapes: null,
    audiences: null,
    alarmes: null,
    historique: null,
    documents: null,
  });

  if (requete.isLoading) return <EtatChargement lignes={10} />;
  if (requete.error || !requete.data) {
    return <EtatErreur message={messageErreur(requete.error)} />;
  }

  const dossier = requete.data;
  const statutSensibilite = dossier.estSensible ? dossier.sensibiliteStatut : null;

  const peutAffecter = peut(roles, "modifierAffectation");
  const peutDemanderDerogation =
    peut(roles, "demanderDerogationSeuil") && !!dossier.estSensible && statutSensibilite === "VALIDEE";
  const peutStatuer =
    peut(roles, "arbitrerDossier") && !!dossier.estSensible && statutSensibilite === "EN_ATTENTE";
  // L'arbitrage d'une dérogation n'est recevable que sur une sensibilité déjà validée (Q-74).
  const peutArbitrerDerogation =
    peut(roles, "arbitrerDossier") && !!dossier.estSensible && statutSensibilite === "VALIDEE";

  // Navigation clavier du motif « onglets » (WAI-ARIA) : flèches, début, fin.
  function surToucheOnglet(evenement: KeyboardEvent<HTMLButtonElement>) {
    const index = ONGLETS.indexOf(onglet);
    const cibles: Record<string, number> = {
      ArrowRight: (index + 1) % ONGLETS.length,
      ArrowLeft: (index - 1 + ONGLETS.length) % ONGLETS.length,
      Home: 0,
      End: ONGLETS.length - 1,
    };
    const cible = cibles[evenement.key];
    if (cible === undefined) return;
    evenement.preventDefault();
    const suivant = ONGLETS[cible]!;
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

        <div className="flex flex-wrap gap-2">
          {peutAffecter ? (
            <Button variante="secondaire" onClick={() => setModale("affectation")}>
              {t("actionAffectation")}
            </Button>
          ) : null}
          {peutDemanderDerogation ? (
            <Button variante="secondaire" onClick={() => setModale("derogation")}>
              {t("actionDerogation")}
            </Button>
          ) : null}
          {peutStatuer ? (
            <Button onClick={() => setModale("sensibilite")}>{t("actionSensibilite")}</Button>
          ) : null}
        </div>
      </header>

      {peutArbitrerDerogation ? <DerogationsEnAttente dossierId={dossier.id} /> : null}

      <div className="flex flex-col gap-5">
        <div role="tablist" aria-label={t("ongletsLibelle")} className="flex gap-1 border-b border-bordure">
          {ONGLETS.map((cle) => {
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
                // Un seul onglet dans l'ordre de tabulation : les autres se rejoignent aux flèches.
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
          {onglet === "synthese" ? <OngletSynthese dossier={dossier} /> : null}
          {onglet === "etapes" ? <OngletEtapes dossier={dossier} roles={roles} /> : null}
          {onglet === "audiences" ? <OngletAudiences dossier={dossier} roles={roles} /> : null}
          {onglet === "alarmes" ? <OngletAlarmes dossier={dossier} roles={roles} /> : null}
          {onglet === "historique" ? <OngletHistorique historique={dossier.historique ?? []} /> : null}
          {onglet === "documents" ? <OngletDocuments dossierId={dossier.id} roles={roles} /> : null}
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
    </div>
  );
}
