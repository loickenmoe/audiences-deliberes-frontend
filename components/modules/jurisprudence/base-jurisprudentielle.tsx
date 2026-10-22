"use client";

import { Archive } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { EtatChargement, EtatErreur } from "@/components/global";
import { BarreFiltres, ChampRecherche, Pagination } from "@/components/metier";
import { ListeJurisprudences } from "@/components/modules/jurisprudence/liste-jurisprudences";
import { ModaleArchivage } from "@/components/modules/jurisprudence/modale-archivage";
import { Button } from "@/components/ui/button";
import { useJurisprudences } from "@/hooks/useDecisions";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import type { Jurisprudence } from "@/types/domaine";

const DEFAUTS = { motCle: "", natureDecision: "", juridiction: "" };

/**
 * Screen 38 - case law database (UC-DEF-03). Search by keyword, nature and court, each filter
 * partial and case-insensitive; filters live in the URL. Legal officers can also archive a decision
 * not linked to any case file here.
 */
export function BaseJurisprudentielle({ roles }: Readonly<{ roles: readonly string[] }>) {
  const t = useTranslations("jurisprudence");
  const { filtres, page, definirFiltre, definirPage, effacer, nbFiltresActifs } =
    useFiltresUrl(DEFAUTS);
  const requete = useJurisprudences({ ...filtres, page });
  const [archivage, setArchivage] = useState(false);
  const jurisprudences = requete.data?.content ?? [];

  /**
   * A text filter applied as the user types (`ChampRecherche` debounces 300 ms, one request per
   * pause; Enter still applies it immediately).
   * The `trim` stays here: the caller decides what goes into the URL, and a whitespace-only filter
   * filters nothing.
   */
  function champ(cle: keyof typeof DEFAUTS, libelle: string) {
    return (
      <ChampRecherche
        id={`filtre-${cle}`}
        label={libelle}
        valeur={filtres[cle]}
        onChangement={(valeur) => definirFiltre(cle, valeur.trim() || undefined)}
        className="w-52"
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
            {t("titre")}
          </h1>
          <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
        </div>
        {peut(roles, "gererDecisions") ? (
          <Button onClick={() => setArchivage(true)}>
            <Archive size={15} aria-hidden />
            {t("archiver")}
          </Button>
        ) : null}
      </header>

      <BarreFiltres nbFiltresActifs={nbFiltresActifs} onEffacer={effacer}>
        {champ("motCle", t("rechercheMotCle"))}
        {champ("natureDecision", t("rechercheNature"))}
        {champ("juridiction", t("rechercheJuridiction"))}
      </BarreFiltres>

      <Resultats
        enChargement={requete.isLoading}
        erreur={requete.error}
        jurisprudences={jurisprudences}
        filtre={nbFiltresActifs > 0}
        page={page}
        totalPages={requete.data?.totalPages ?? 0}
        totalElements={requete.data?.totalElements ?? 0}
        onPage={definirPage}
        rafraichir={async () => (await requete.refetch()).data?.content ?? []}
      />

      <ModaleArchivage ouvert={archivage} onFermeture={() => setArchivage(false)} />
    </div>
  );
}

/** Search results: loading, error, empty (searched or not), or the decisions and their pages. */
function Resultats({
  enChargement,
  erreur,
  jurisprudences,
  filtre,
  page,
  totalPages,
  totalElements,
  onPage,
  rafraichir,
}: Readonly<{
  enChargement: boolean;
  erreur: unknown;
  jurisprudences: Jurisprudence[];
  filtre: boolean;
  page: number;
  totalPages: number;
  totalElements: number;
  onPage: (page: number) => void;
  rafraichir: () => Promise<Jurisprudence[]>;
}>) {
  const t = useTranslations("jurisprudence");

  if (enChargement) return <EtatChargement lignes={5} />;
  if (erreur) return <EtatErreur message={messageErreur(erreur)} />;
  if (jurisprudences.length === 0) {
    return (
      <div className="rounded border border-dashed border-bordure-forte px-6 py-10 text-center text-texte-secondaire">
        <p>{filtre ? t("videRecherche") : t("vide")}</p>
        <p className="text-[length:var(--taille-sm)]">{t("videTexte")}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <ListeJurisprudences jurisprudences={jurisprudences} avecDossier rafraichir={rafraichir} />
      {totalPages > 1 ? (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalElements={totalElements}
          onChangement={onPage}
        />
      ) : null}
    </div>
  );
}
