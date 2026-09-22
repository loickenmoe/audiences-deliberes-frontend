"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { StatutChip } from "@/components/global/statut-chip";
import { DateHeureValeur, Pagination } from "@/components/metier";
import { useLibellePublication } from "@/components/modules/publications/libelle-publication";
import { usePublications } from "@/hooks/usePublications";
import { messageErreur } from "@/lib/api/errors";
import { TON_STATUT_PUBLICATION } from "@/lib/publications";
import { profilPrincipal } from "@/lib/rbac";

/**
 * Écran 13 — onglet « Publications » de la fiche. L'Assistante y voit tout ce que l'avocat a déposé
 * sur le dossier ; les autres profils, les seules publications validées, qu'ils peuvent ouvrir.
 */
export function OngletPublications({ dossierId, roles }: { dossierId: number; roles: readonly string[] }) {
  const t = useTranslations("publications");
  const td = useTranslations("domaine");
  const libelle = useLibellePublication();
  const [page, setPage] = useState(0);
  const assistante = profilPrincipal(roles) === "ROLE_ASSISTANTE";
  const requete = usePublications({ dossierId, statut: assistante ? null : "VALIDE", page });

  if (requete.isLoading) return <EtatChargement lignes={4} />;
  if (requete.error) return <EtatErreur message={messageErreur(requete.error)} />;

  const publications = requete.data?.content ?? [];
  if (publications.length === 0) {
    return (
      <div className="rounded border border-dashed border-bordure-forte px-6 py-10 text-center text-texte-secondaire">
        {t("ongletAucune")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-bordure rounded border border-bordure bg-surface">
        {publications.map((publication) => (
          <li key={publication.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[length:var(--taille-sm)]">
            <span className="flex flex-col gap-0.5">
              <Link href={`/publications/${publication.id}`} className="font-medium underline underline-offset-4">
                {libelle(publication)}
              </Link>
              <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
                {publication.avocatNom} · <DateHeureValeur valeur={publication.dateDepot} />
                {publication.restrictionAccesNom ? ` · ${t("reservee", { nom: publication.restrictionAccesNom })}` : ""}
              </span>
            </span>
            <StatutChip ton={TON_STATUT_PUBLICATION[publication.statutValidation]}>
              {td(`StatutPublication.${publication.statutValidation}` as never)}
            </StatutChip>
          </li>
        ))}
      </ul>
      {requete.data && requete.data.totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={requete.data.totalPages}
          totalElements={requete.data.totalElements}
          onChangement={setPage}
        />
      ) : null}
    </div>
  );
}
