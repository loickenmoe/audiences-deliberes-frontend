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
 * Écran 38 — base jurisprudentielle (UC-DEF-03). Recherche par mot-clé, nature et juridiction, chaque
 * filtre partiel et insensible à la casse (Q-89) ; les filtres vivent dans l'URL. Le juriste y
 * archive aussi une décision sans dossier.
 */
export function BaseJurisprudentielle({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("jurisprudence");
  const { filtres, page, definirFiltre, definirPage, effacer, nbFiltresActifs } = useFiltresUrl(DEFAUTS);
  const requete = useJurisprudences({ ...filtres, page });
  const [archivage, setArchivage] = useState(false);
  const jurisprudences = requete.data?.content ?? [];

  /**
   * Un filtre texte, au fil de la frappe (QF-57).
   *
   * Les trois se validaient au `blur` ou sur Entrée : il fallait quitter le champ ou valider pour
   * voir le résultat. `ChampRecherche` cherche après une pause de 300 ms - une requête par pause, pas
   * par caractère, qui était la seule objection valable - et garde le raccourci Entrée pour qui en
   * avait pris l'habitude.
   *
   * Le `trim` reste ici : c'est l'appelant qui décide de ce qu'il met dans l'URL, et un filtre fait
   * d'espaces ne filtre rien.
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
