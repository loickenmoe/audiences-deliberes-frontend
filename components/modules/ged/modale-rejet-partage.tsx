"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Champ, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useArbitrerPartage } from "@/hooks/useGed";
import { messageErreur } from "@/lib/api/errors";

/** The rejection reason fits in the history detail, so it stays readable at a glance. */
const MOTIF_MAX = 1000;

/**
 * Rejection of a proposed document share, used by the case file Documents tab and by the
 * approval queue.
 * The reason is required by the screen and by the server (400 without it): the legal officer who
 * proposed the share must know why it was refused.
 */
export function ModaleRejetPartage({
  piece,
  onFermeture,
}: Readonly<{
  piece: { documentId: number; nomFichier: string } | null;
  onFermeture: () => void;
}>) {
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
