"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo } from "react";

import { EtatChargement, EtatErreur, EtatVide, StatutChip } from "@/components/global";
import { DateHeureValeur, TableDonnees } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { useMesConstitutions, useMesPublications } from "@/hooks/usePortailAvocat";
import { CompteAvocatNonRattache } from "@/components/modules/portail/compte-non-rattache";
import { estCompteAvocatNonRattache, messageErreur } from "@/lib/api/errors";
import { TON_STATUT_CONSTITUTION, TON_STATUT_PUBLICATION } from "@/lib/publications";
import type { DemandeConstitution, Publication } from "@/types/domaine";
import { cleStatutPublication } from "@/lib/publications";

/**
 * Espace de l'avocat — ses dépôts et ses lettres de constitution (backend Q-96).
 *
 * **Périmètre ajouté, pas exigé.** Aucune user story ne demande à l'avocat de relire ses
 * publications : US 5.4 vise le juriste. L'écran existe sur arbitrage du porteur du projet, au motif
 * qu'un avocat notifié d'un rejet ne pouvait pas relire ce qui avait été rejeté — ni en lire le
 * motif, qui est précisément ce qu'il doit corriger.
 */
export function EspaceAvocat() {
  const t = useTranslations("portail");
  const td = useTranslations("domaine");
  const { page, definirPage } = useFiltresUrl({});
  const publications = useMesPublications(page);
  const constitutions = useMesConstitutions();


  const colonnes = useMemo<ColumnDef<Publication, unknown>[]>(
    () => [
      {
        id: "type",
        header: t("colonneType"),
        cell: ({ row }) => td(`TypePublication.${row.original.type}` as never),
      },
      { accessorKey: "referenceDossier", header: t("colonneDossier") },
      {
        id: "depot",
        header: t("colonneDepot"),
        cell: ({ row }) => <DateHeureValeur valeur={row.original.dateDepot} />,
      },
      {
        id: "statut",
        header: t("colonneStatut"),
        cell: ({ row }) => (
          <span className="flex flex-col items-start gap-1">
            <StatutChip ton={TON_STATUT_PUBLICATION[row.original.statutValidation]}>
              {td(cleStatutPublication(row.original.type, row.original.statutValidation) as never)}
            </StatutChip>
            {/* Le motif est la seule chose actionnable d'un rejet : il s'affiche, il ne se cache pas. */}
            {row.original.motifRejet ? (
              <span className="max-w-prose text-[length:var(--taille-xs)] text-danger">
                {row.original.motifRejet}
              </span>
            ) : null}
          </span>
        ),
      },
    ],
    [t, td],
  );

  /*
   * Q-107 : si le compte n'est pas rattaché au référentiel, **aucune** section de cet écran ne peut
   * aboutir. On l'explique une fois plutôt que d'afficher deux blocs « le chargement a échoué » pour
   * une cause unique sur laquelle l'avocat n'a aucune prise. Le test vient **après** les hooks : un
   * retour anticipé placé avant en changerait l'ordre d'un rendu à l'autre.
   */
  if (estCompteAvocatNonRattache(publications.error) || estCompteAvocatNonRattache(constitutions.error)) {
    return <CompteAvocatNonRattache />;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("espaceTitre")}</h1>
          <p className="max-w-prose text-texte-secondaire">{t("espaceDescription")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/publications/nouvelle">
            <Button variante="secondaire" taille="sm">
              {t("publicationTitre")}
            </Button>
          </Link>
          <Link href="/frais/nouvelle">
            <Button taille="sm">{t("fraisTitre")}</Button>
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-[length:var(--taille-lg)] font-semibold">{t("mesPublications")}</h2>
        <TableDonnees
          colonnes={colonnes}
          donnees={publications.data}
          chargement={publications.isLoading}
          erreur={publications.error}
          page={page}
          onChangementPage={definirPage}
          onReessayer={() => void publications.refetch()}
          titreVide={t("videPublications")}
          descriptionVide={t("videPublicationsTexte")}
          cleLigne={(publication) => String(publication.id)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[length:var(--taille-lg)] font-semibold">{t("mesConstitutions")}</h2>
        <Constitutions
          demandes={constitutions.data}
          chargement={constitutions.isLoading}
          erreur={constitutions.error}
        />
      </section>
    </div>
  );
}

/**
 * Les constitutions ne sont pas paginées côté backend : la liste est courte par nature, un avocat
 * n'est constitué que sur les dossiers qu'on lui confie. Une table paginée serait de la mécanique
 * pour rien.
 */
function Constitutions({
  demandes,
  chargement,
  erreur,
}: {
  demandes: DemandeConstitution[] | undefined;
  chargement: boolean;
  erreur: unknown;
}) {
  const t = useTranslations("portail");
  const td = useTranslations("domaine");

  if (chargement) return <EtatChargement lignes={3} />;
  if (erreur) return <EtatErreur message={messageErreur(erreur)} />;
  if (!demandes || demandes.length === 0) {
    return <EtatVide titre={t("videConstitutions")} description={t("videConstitutionsTexte")} />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {demandes.map((demande) => (
        <li
          key={demande.id}
          className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-bordure bg-surface p-4"
        >
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[length:var(--taille-sm)] font-semibold">
              {demande.referenceDossier}
            </span>
            <span className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
              {demande.motif}
            </span>
            {demande.motifRejet ? (
              <span className="max-w-prose text-[length:var(--taille-xs)] text-danger">
                {demande.motifRejet}
              </span>
            ) : null}
          </div>
          <StatutChip ton={TON_STATUT_CONSTITUTION[demande.statut]}>
            {td(`StatutConstitution.${demande.statut}` as never)}
          </StatutChip>
        </li>
      ))}
    </ul>
  );
}
