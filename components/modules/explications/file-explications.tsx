"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MessageSquare, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { StatutChip } from "@/components/global";
import { DateHeureValeur, TableDonnees } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Champ, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useDemandesExplication, useEcritureExplication } from "@/hooks/useDemandesExplication";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import type { DemandeExplication } from "@/types/domaine";

/**
 * Les demandes d'explication (N7 temps 2, observation 8).
 *
 * **Un seul écran pour deux publics.** La direction y voit les demandes qu'elle a écrites, l'avocat
 * celles qui lui sont adressées - et c'est le **serveur** qui décide lesquelles, sur l'identité de
 * qui appelle. L'écran n'envoie aucun paramètre de périmètre : il suffirait à un avocat pour
 * demander la liste entière.
 *
 * **Ce que l'écran montre avant tout, c'est l'attente.** Une demande sans réponse est ce sur quoi
 * quelqu'un doit agir - l'avocat pour répondre, la direction pour insister. Le reste est de
 * l'historique.
 */
export function FileExplications({ roles }: { roles: string[] }) {
  const t = useTranslations("explications");
  const tc = useTranslations("commun");
  const { page, definirPage } = useFiltresUrl({});
  const [enAttenteSeulement, setEnAttenteSeulement] = useState(false);
  const requete = useDemandesExplication(enAttenteSeulement, page);
  const { repondre } = useEcritureExplication();

  const peutRepondre = peut(roles, "repondreExplication");
  const [aRepondre, setARepondre] = useState<DemandeExplication | null>(null);
  const [reponse, setReponse] = useState("");
  const [erreur, setErreur] = useState("");

  async function envoyerLaReponse() {
    if (!aRepondre) return;
    setErreur("");
    try {
      await repondre.mutateAsync({ id: aRepondre.id, reponse });
      toast.success(t("reponseEnvoyee"));
      setARepondre(null);
      setReponse("");
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  const colonnes = useMemo<ColumnDef<DemandeExplication, unknown>[]>(
    () => [
      { accessorKey: "avocatNom", header: t("colonneAvocat") },
      {
        id: "demande",
        header: t("colonneDemande"),
        cell: ({ row }) => (
          <span className="flex flex-col gap-1">
            <span className="max-w-prose">{row.original.contenu}</span>
            <span className="text-[length:var(--taille-xs)] text-texte-tertiaire">
              {row.original.auteurNom ?? "-"} · <DateHeureValeur valeur={row.original.dateDemande} />
              {row.original.referenceDossier ? ` · ${row.original.referenceDossier}` : ""}
            </span>
          </span>
        ),
      },
      {
        id: "statut",
        header: t("colonneStatut"),
        cell: ({ row }) => (
          <span className="flex flex-col items-start gap-1">
            <StatutChip ton={row.original.enAttente ? "attention" : "succes"}>
              {row.original.enAttente ? t("enAttente") : t("repondue")}
            </StatutChip>
            {/*
              La réponse est ce que la direction attendait : elle s'affiche en entier, sous le
              statut. La cacher derrière un clic obligerait à ouvrir chaque ligne pour savoir ce
              qui a été dit.
            */}
            {row.original.reponse ? (
              <span className="max-w-prose text-[length:var(--taille-xs)] text-texte-secondaire">
                {row.original.reponse}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          peutRepondre && row.original.enAttente ? (
            <div className="flex justify-end">
              <Button
                taille="sm"
                onClick={() => {
                  setARepondre(row.original);
                  setReponse("");
                  setErreur("");
                }}
              >
                <MessageSquare size={14} aria-hidden />
                {t("repondre")}
              </Button>
            </div>
          ) : null,
      },
    ],
    [t, peutRepondre],
  );

  return (
    <div className="flex flex-col gap-4">
      {/*
        Le filtre ne sert qu'à la direction : l'avocat voit les siennes, répondues ou non, et
        c'est l'historique de ce qu'on lui a demandé.
      */}
      {peut(roles, "demanderExplication") ? (
        <div className="flex gap-2">
          <Button
            variante={enAttenteSeulement ? "principale" : "secondaire"}
            taille="sm"
            onClick={() => setEnAttenteSeulement(true)}
          >
            {t("filtreEnAttente")}
          </Button>
          <Button
            variante={enAttenteSeulement ? "secondaire" : "principale"}
            taille="sm"
            onClick={() => setEnAttenteSeulement(false)}
          >
            {t("filtreToutes")}
          </Button>
        </div>
      ) : null}

      <TableDonnees
        colonnes={colonnes}
        donnees={requete.data}
        chargement={requete.isLoading}
        erreur={requete.error}
        page={page}
        onChangementPage={definirPage}
        onReessayer={() => void requete.refetch()}
        titreVide={t("videTitre")}
        descriptionVide={t("videTexte")}
        cleLigne={(demande) => String(demande.id)}
      />

      <Dialog
        ouvert={aRepondre !== null}
        onFermeture={() => setARepondre(null)}
        titre={t("repondreTitre")}
        description={t("repondreDescription")}
        pied={
          <>
            <Button variante="secondaire" onClick={() => setARepondre(null)} disabled={repondre.isPending}>
              {tc("annuler")}
            </Button>
            <Button onClick={() => void envoyerLaReponse()} disabled={repondre.isPending}>
              <Send size={14} aria-hidden />
              {t("envoyer")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          {/* Ce qu'on lui reproche, sous les yeux : on ne répond pas de mémoire. */}
          <p className="max-w-prose rounded border border-bordure bg-surface-attenuee p-3 text-[length:var(--taille-sm)]">
            {aRepondre?.contenu}
          </p>
          <Champ id="explication-reponse" label={t("champReponse")} obligatoire erreur={erreur || undefined}>
            <Textarea
              id="explication-reponse"
              rows={6}
              placeholder={t("placeholderReponse")}
              value={reponse}
              onChange={(evenement) => setReponse(evenement.target.value)}
            />
          </Champ>
          <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("reponseUnique")}</p>
        </div>
      </Dialog>
    </div>
  );
}
