"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Champ, Input, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useDemanderDerogation } from "@/hooks/useDossiers";
import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { messageErreur } from "@/lib/api/errors";

const CHAMPS = ["nouveauSeuil", "motif"] as const;

/**
 * Écran 17 — demande de dérogation de seuil.
 *
 * Recevable uniquement sur un dossier sensible **déjà validé** : la fiche ne propose l'action que
 * dans cet état. La demande part ensuite à l'arbitrage du DJ/DJA, qui la voit apparaître en tête
 * de fiche (`DerogationsEnAttente`).
 */
export function ModaleDerogation({
  dossierId,
  ouvert,
  onFermeture,
}: {
  dossierId: number;
  ouvert: boolean;
  onFermeture: () => void;
}) {
  const t = useTranslations("fiche");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const demander = useDemanderDerogation(dossierId);

  const schema = useMemo(
    () =>
      z.object({
        nouveauSeuil: z.coerce.number({ message: tm("champObligatoire") }).min(0),
        motif: z.string().trim().min(1, tm("champObligatoire")).max(255),
      }),
    [tm],
  );

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { motif: "" },
  });

  useEffect(() => {
    if (ouvert) reset({ motif: "" });
  }, [ouvert, reset]);

  const soumettre = handleSubmit(async (valeurs) => {
    try {
      await demander.mutateAsync({ nouveauSeuil: Number(valeurs.nouveauSeuil), motif: valeurs.motif });
      onFermeture();
    } catch (erreur) {
      if (!appliquerErreurApi(erreur, setError, CHAMPS)) {
        setError("root", { message: messageErreur(erreur) });
      }
    }
  });

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={onFermeture}
      titre={t("derogationTitre")}
      description={t("derogationDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={demander.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void soumettre()} disabled={demander.isPending}>
            {tc("enregistrer")}
          </Button>
        </>
      }
    >
      <form onSubmit={soumettre} className="flex flex-col gap-4">
        {errors.root ? (
          <p
            role="alert"
            className="rounded border border-danger/40 bg-danger-fond px-4 py-3 text-[length:var(--taille-sm)] text-danger"
          >
            {errors.root.message}
          </p>
        ) : null}

        <Champ id="nouveauSeuil" label={t("champNouveauSeuil")} obligatoire erreur={errors.nouveauSeuil?.message}>
          <Input
            id="nouveauSeuil"
            type="number"
            min={0}
            step="1000"
            enErreur={!!errors.nouveauSeuil}
            {...register("nouveauSeuil")}
          />
        </Champ>

        <Champ id="motif" label={t("champMotif")} obligatoire erreur={errors.motif?.message}>
          <Textarea id="motif" rows={3} enErreur={!!errors.motif} {...register("motif")} />
        </Champ>
      </form>
    </Dialog>
  );
}
