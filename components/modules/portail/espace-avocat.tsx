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
import { MesDossiers } from "@/components/modules/portail/mes-dossiers";
import { estCompteAvocatNonRattache, messageErreur } from "@/lib/api/errors";
import { TON_STATUT_CONSTITUTION, TON_STATUT_PUBLICATION } from "@/lib/publications";
import type { DemandeConstitution, Publication } from "@/types/domaine";
import { cleStatutPublication } from "@/lib/publications";

/**
 * Lawyer space: their submissions and their appointment letters.
 *
 * Beyond the user stories (US 5.4 targets the legal officer): a lawyer notified of a rejection must
 * be able to reread what was rejected and the reason, which is what they have to correct. The
 * correspondence sent by the DJ or DJA on a publication (RG-INT-07) is shown for the same reason.
 *
 * Legal officers' comments are never shown: they write for the DJ/DJA, never directly to the lawyer
 * (US 5.5, RG-INT-07). The backend already excludes them from the portal payload.
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
        id: "correspondance",
        header: t("colonneCorrespondance"),
        cell: ({ row }) => <Correspondance publication={row.original} />,
      },
      {
        id: "statut",
        header: t("colonneStatut"),
        cell: ({ row }) => (
          <span className="flex flex-col items-start gap-1">
            <StatutChip ton={TON_STATUT_PUBLICATION[row.original.statutValidation]}>
              {td(cleStatutPublication(row.original.type, row.original.statutValidation) as never)}
            </StatutChip>
            {/* The reason is the only actionable part of a rejection: it is always shown. */}
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
   * If the account is not linked to the directory, no section of this screen can load: explain it
   * once rather than showing two "loading failed" blocks. The check comes after the hooks, since an
   * early return before them would change the hook order between renders.
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

      {/* Their case files, the hearings with the Legal Department's note, and shared documents. */}
      <MesDossiers />

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
 * The correspondence sent on a publication.
 *
 * Its absence is stated explicitly: most publications have none, and an empty cell would look like a
 * display glitch. The sender's name and date are shown so the lawyer knows whom they answer.
 * `whitespace-pre-wrap` keeps the message's line breaks as written.
 */
function Correspondance({ publication }: Readonly<{ publication: Publication }>) {
  const t = useTranslations("portail");

  if (!publication.correspondance) {
    return <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("sansCorrespondance")}</span>;
  }

  return (
    <span className="flex max-w-prose flex-col gap-1">
      <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
        {/* Without an author name, show the date only rather than an empty "by". */}
        {publication.correspondance.auteurNom
          ? `${t("correspondancePar", { nom: publication.correspondance.auteurNom })} · `
          : null}
        <DateHeureValeur valeur={publication.correspondance.createdAt} />
      </span>
      <span className="whitespace-pre-wrap text-[length:var(--taille-sm)]">
        {publication.correspondance.contenu}
      </span>
    </span>
  );
}

/**
 * Appointments are not paginated by the backend: the list is short by nature, since a lawyer is
 * appointed only on the case files entrusted to them.
 */
function Constitutions({
  demandes,
  chargement,
  erreur,
}: Readonly<{
  demandes: DemandeConstitution[] | undefined;
  chargement: boolean;
  erreur: unknown;
}>) {
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
