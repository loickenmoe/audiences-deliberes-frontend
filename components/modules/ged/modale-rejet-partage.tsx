"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Champ, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useArbitrerPartage } from "@/hooks/useGed";
import { messageErreur } from "@/lib/api/errors";

/** Le motif d'un rejet tient dans le détail de l'historique : il reste lisible d'un coup d'œil. */
const MOTIF_MAX = 1000;

/**
 * Le rejet motivé d'un partage proposé (QF-64). Partagé par l'onglet Documents du dossier et par
 * la file des partages à valider : le même geste, au même endroit de la règle.
 *
 * Le motif est exigé - par l'écran **et** par le serveur, qui répond 400 sans lui : le juriste qui a
 * proposé doit savoir pourquoi la pièce ne part pas.
 */
export function ModaleRejetPartage({
  piece,
  onFermeture,
}: {
  piece: { documentId: number; nomFichier: string } | null;
  onFermeture: () => void;
}) {
  const t = useTranslations("documents");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const arbitrer = useArbitrerPartage();
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  const documentId = piece?.documentId;
  useEffect(() => {
    if (documentId !== undefined) {
      setMotif("");
      setErreur(null);
    }
  }, [documentId]);

  async function rejeter() {
    if (!piece) return;
    if (!motif.trim()) {
      setErreur(tm("champObligatoire"));
      return;
    }
    try {
      await arbitrer.mutateAsync({ documentId: piece.documentId, motif: motif.trim() });
      toast.success(t("partageRejete"));
      onFermeture();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  return (
    <Dialog
      ouvert={piece !== null}
      onFermeture={onFermeture}
      titre={t("rejetPartageTitre")}
      description={t("rejetPartageDescription", { nom: piece?.nomFichier ?? "" })}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={arbitrer.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void rejeter()} disabled={arbitrer.isPending}>
            {t("rejeterPartage")}
          </Button>
        </>
      }
    >
      <Champ id="motif-rejet-partage" label={t("champMotifRejetPartage")} obligatoire erreur={erreur ?? undefined}>
        <Textarea
          id="motif-rejet-partage"
          placeholder={t("phMotifRejetPartage")}
          rows={4}
          maxLength={MOTIF_MAX}
          enErreur={!!erreur}
          value={motif}
          onChange={(evenement) => setMotif(evenement.target.value)}
        />
      </Champ>
    </Dialog>
  );
}
