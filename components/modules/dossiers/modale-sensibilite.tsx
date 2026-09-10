"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Champ, Input, Select, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useValiderSensibilite } from "@/hooks/useDossiers";
import { useTypesClientSensible } from "@/hooks/useReferentiels";
import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { messageErreur } from "@/lib/api/errors";
import type { Dossier } from "@/types/domaine";

const CHAMPS = ["motifRejet", "seuilMontantAjuste", "typeClientSensibleAjuste"] as const;

/**
 * Écran 18 — validation de la sensibilité par le DJ/DJA.
 *
 * Le rejet exige un motif (le backend le refuse sinon) ; la validation permet d'**ajuster** le seuil
 * et le type proposés. Laisser ces deux champs vides conserve la proposition du juriste.
 */
export function ModaleSensibilite({
  dossier,
  ouvert,
  onFermeture,
}: {
  dossier: Dossier;
  ouvert: boolean;
  onFermeture: () => void;
}) {
  const t = useTranslations("fiche");
  const td = useTranslations("dossiers");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const types = useTypesClientSensible();
  const valider = useValiderSensibilite(dossier.id);

  const schema = useMemo(
    () =>
      z
        .object({
          statut: z.enum(["VALIDEE", "REJETEE"]),
          motifRejet: z.string().max(255).optional(),
          seuilMontantAjuste: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
          typeClientSensibleAjuste: z.string().optional(),
        })
        .superRefine((valeurs, contexte) => {
          if (valeurs.statut === "REJETEE" && !valeurs.motifRejet?.trim()) {
            contexte.addIssue({ code: "custom", path: ["motifRejet"], message: tm("champObligatoire") });
          }
        }),
    [tm],
  );

  const {
    register,
    handleSubmit,
    watch,
    setError,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { statut: "VALIDEE", motifRejet: "", seuilMontantAjuste: "", typeClientSensibleAjuste: "" },
  });

  useEffect(() => {
    if (ouvert) {
      reset({ statut: "VALIDEE", motifRejet: "", seuilMontantAjuste: "", typeClientSensibleAjuste: "" });
    }
  }, [ouvert, reset]);

  const statut = watch("statut");
  const rejet = statut === "REJETEE";

  const soumettre = handleSubmit(async (valeurs) => {
    try {
      await valider.mutateAsync(
        valeurs.statut === "REJETEE"
          ? { statut: "REJETEE", motifRejet: valeurs.motifRejet?.trim() }
          : {
              statut: "VALIDEE",
              // Vide = conserver la proposition : ne rien envoyer plutôt qu'un zéro.
              seuilMontantAjuste:
                valeurs.seuilMontantAjuste === "" || valeurs.seuilMontantAjuste === undefined
                  ? undefined
                  : Number(valeurs.seuilMontantAjuste),
              typeClientSensibleAjuste: valeurs.typeClientSensibleAjuste || undefined,
            },
      );
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
      titre={t("sensibiliteTitre")}
      description={t("sensibiliteDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={valider.isPending}>
            {tc("annuler")}
          </Button>
          <Button
            variante={rejet ? "destructive" : "principale"}
            onClick={() => void soumettre()}
            disabled={valider.isPending}
          >
            {rejet ? t("rejeter") : t("valider")}
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

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[length:var(--taille-sm)] font-medium">{t("decision")}</legend>
          <label className="flex items-center gap-2 text-[length:var(--taille-sm)]">
            <input type="radio" value="VALIDEE" {...register("statut")} />
            {t("valider")}
          </label>
          <label className="flex items-center gap-2 text-[length:var(--taille-sm)]">
            <input type="radio" value="REJETEE" {...register("statut")} />
            {t("rejeter")}
          </label>
        </fieldset>

        {rejet ? (
          <Champ id="motifRejet" label={t("motifRejet")} obligatoire erreur={errors.motifRejet?.message}>
            <Textarea id="motifRejet" rows={3} enErreur={!!errors.motifRejet} {...register("motifRejet")} />
          </Champ>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ
              id="seuilMontantAjuste"
              label={t("champSeuilAjuste")}
              aide={td("champSeuilMontant")}
              erreur={errors.seuilMontantAjuste?.message}
            >
              <Input
                id="seuilMontantAjuste"
                type="number"
                min={0}
                step="1000"
                placeholder={dossier.seuilMontant !== null ? String(dossier.seuilMontant) : undefined}
                enErreur={!!errors.seuilMontantAjuste}
                {...register("seuilMontantAjuste")}
              />
            </Champ>

            <Champ
              id="typeClientSensibleAjuste"
              label={t("champTypeAjuste")}
              erreur={errors.typeClientSensibleAjuste?.message}
            >
              <Select id="typeClientSensibleAjuste" {...register("typeClientSensibleAjuste")}>
                <option value="">{t("conserverProposition")}</option>
                {(types.data ?? []).map((type) => (
                  // Un code, validé contre le référentiel côté backend (Q-73).
                  <option key={type.id} value={type.code}>
                    {type.libelle}
                  </option>
                ))}
              </Select>
            </Champ>
          </div>
        )}
      </form>
    </Dialog>
  );
}
