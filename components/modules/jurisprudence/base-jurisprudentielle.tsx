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

const DEFAUTS = { motCle: "", natureDecision: "", juridiction: "" };

/**
 * Screen 38 - case law database (UC-DEF-03). Search by keyword, nature and court, each filter
 * partial and case-insensitive; filters live in the URL. Legal officers can also archive a decision
 * not linked to any case file here.
 */
export function BaseJurisprudentielle({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("jurisprudence");
  const { filtres, page, definirFiltre, definirPage, effacer, nbFiltresActifs } = useFiltresUrl(DEFAUTS);
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
          <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("titre")}</h1>
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

      {requete.isLoading ? (
        <EtatChargement lignes={5} />
      ) : requete.error ? (
        <EtatErreur message={messageErreur(requete.error)} />
      ) : jurisprudences.length === 0 ? (
        <div className="rounded border border-dashed border-bordure-forte px-6 py-10 text-center text-texte-secondaire">
          <p>{nbFiltresActifs > 0 ? t("videRecherche") : t("vide")}</p>
          <p className="text-[length:var(--taille-sm)]">{t("videTexte")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ListeJurisprudences
            jurisprudences={jurisprudences}
            avecDossier
            rafraichir={async () => (await requete.refetch()).data?.content ?? []}
          />
          {requete.data && requete.data.totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={requete.data.totalPages}
              totalElements={requete.data.totalElements}
              onChangement={definirPage}
            />
          ) : null}
        </div>
      )}

      <ModaleArchivage ouvert={archivage} onFermeture={() => setArchivage(false)} />
    </div>
  );
}
