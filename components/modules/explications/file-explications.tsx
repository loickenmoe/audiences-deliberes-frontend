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
 * Explanation requests, for two audiences: management sees the requests it wrote, a lawyer those
 * addressed to them. The server decides which, from the caller's identity; the screen sends no scope
 * parameter, otherwise a lawyer could request the whole list.
 * Pending (unanswered) requests come first: they are what someone has to act on.
 */

function colonnesExplications(
  t: ReturnType<typeof useTranslations<"explications">>,
  peutRepondre: boolean,
  onRepondre: (demande: DemandeExplication) => void,
): ColumnDef<DemandeExplication, unknown>[] {
  return [
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
          {/* The answer is shown in full under the status, so no row has to be opened to read it. */}
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
            <Button taille="sm" onClick={() => onRepondre(row.original)}>
              <MessageSquare size={14} aria-hidden />
              {t("repondre")}
            </Button>
          </div>
        ) : null,
    },
  ];
}

export function FileExplications({ roles }: Readonly<{ roles: string[] }>) {
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

  function ouvrirReponse(demande: DemandeExplication) {
    setARepondre(demande);
    setReponse("");
    setErreur("");
  }

  const colonnes = useMemo(
    () => colonnesExplications(t, peutRepondre, ouvrirReponse),
    [t, peutRepondre],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Management only: a lawyer sees all of their requests, answered or not, as their history. */}
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
            <Button
              variante="secondaire"
              onClick={() => setARepondre(null)}
              disabled={repondre.isPending}
            >
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
          {/* The request is shown above the answer, so the lawyer does not answer from memory. */}
          <p className="max-w-prose rounded border border-bordure bg-surface-attenuee p-3 text-[length:var(--taille-sm)]">
            {aRepondre?.contenu}
          </p>
          <Champ
            id="explication-reponse"
            label={t("champReponse")}
            obligatoire
            erreur={erreur || undefined}
          >
            <Textarea
              id="explication-reponse"
              rows={6}
              placeholder={t("placeholderReponse")}
              value={reponse}
              onChange={(evenement) => setReponse(evenement.target.value)}
            />
          </Champ>
          <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">
            {t("reponseUnique")}
          </p>
        </div>
      </Dialog>
    </div>
  );
}
