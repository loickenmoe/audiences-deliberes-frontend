"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Champ, Input, Select, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useModifierDiligence, useProposerDiligence } from "@/hooks/useDossiers";
import { useTypesClientSensible } from "@/hooks/useReferentiels";
import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { messageErreur } from "@/lib/api/errors";
import type { Dossier } from "@/types/domaine";

const CHAMPS = ["seuilMontant", "typeClientSensible", "motif"] as const;

/**
 * Three possible actions on the special due diligence of an already opened case:
 * - `proposer`: the lawyer requests it, the DJ or DJA will arbitrate;
 * - `poser`: the DJ or DJA decides without a proposal;
 * - `retirer`: the DJ or DJA removes a validated due diligence.
 */
export type IntentionDiligence = "proposer" | "poser" | "retirer";

/**
 * Special due diligence review after opening, since a case can turn out sensitive along the way.
 * One modal for three actions, because the fields are the same and only the intent changes what is
 * required: threshold and type to set it, reason to propose or remove it.
 * The reason matters: proposing must explain what changed since opening; removing takes the case
 * out of the double validation of fees, which the audit will question.
 */
export function ModaleDiligence({
  dossier,
  intention,
  ouvert,
  onFermeture,
}: {
  dossier: Dossier;
  intention: IntentionDiligence;
  ouvert: boolean;
  onFermeture: () => void;
}) {
  /*
   * Per-instance ids: a closed `<dialog>` stays in the DOM, and the derogation modal already has a
   * `motif` field; without a prefix the label would point to that hidden field.
   */
  const p = useId();
  const t = useTranslations("fiche");
  const td = useTranslations("dossiers");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const types = useTypesClientSensible();
  const proposer = useProposerDiligence(dossier.id);
  const modifier = useModifierDiligence(dossier.id);

  const retrait = intention === "retirer";
  const mutation = intention === "proposer" ? proposer : modifier;

  const schema = useMemo(
    () =>
      z
        .object({
          seuilMontant: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
          typeClientSensible: z.string().optional(),
          motif: z.string().max(255).optional(),
        })
        .superRefine((valeurs, contexte) => {
          // Removal needs no threshold or type: it clears them.
          if (!retrait) {
            if (valeurs.seuilMontant === "" || valeurs.seuilMontant === undefined) {
              contexte.addIssue({ code: "custom", path: ["seuilMontant"], message: tm("champObligatoire") });
            }
            if (!valeurs.typeClientSensible) {
              contexte.addIssue({
                code: "custom",
                path: ["typeClientSensible"],
                message: tm("champObligatoire"),
              });
            }
          }
          /*
           * A reason is required to propose and to remove, not to set: the DJ setting due diligence
           * is the decision itself. The backend applies the same rule and has the final say.
           */
          if (intention !== "poser" && !valeurs.motif?.trim()) {
            contexte.addIssue({ code: "custom", path: ["motif"], message: tm("champObligatoire") });
          }
        }),
    [intention, retrait, tm],
  );

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { seuilMontant: "", typeClientSensible: "", motif: "" },
  });

  // Each opening starts empty: the modal serves three intents, and leftover input would read as a
  // suggestion from the application.
  useEffect(() => {
    if (ouvert) reset({ seuilMontant: "", typeClientSensible: "", motif: "" });
  }, [ouvert, reset]);

  const soumettre = handleSubmit(async (valeurs) => {
    try {
      if (intention === "proposer") {
        await proposer.mutateAsync({
          seuilMontant: Number(valeurs.seuilMontant),
          typeClientSensible: valeurs.typeClientSensible ?? "",
          motif: valeurs.motif?.trim() ?? "",
        });
      } else if (intention === "poser") {
        await modifier.mutateAsync({
          estSensible: true,
          seuilMontant: Number(valeurs.seuilMontant),
          typeClientSensible: valeurs.typeClientSensible ?? "",
          motif: valeurs.motif?.trim() || undefined,
        });
      } else {
        await modifier.mutateAsync({ estSensible: false, motif: valeurs.motif?.trim() });
      }
      onFermeture();
    } catch (erreur) {
      if (!appliquerErreurApi(erreur, setError, CHAMPS)) {
        setError("root", { message: messageErreur(erreur) });
      }
    }
  });

  const titre = t(`diligence${intention === "proposer" ? "Proposer" : intention === "poser" ? "Poser" : "Retirer"}Titre`);
  const description = t(
    `diligence${intention === "proposer" ? "Proposer" : intention === "poser" ? "Poser" : "Retirer"}Description`,
  );

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={onFermeture}
      titre={titre}
      description={description}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={mutation.isPending}>
            {tc("annuler")}
          </Button>
          <Button
            variante={retrait ? "destructive" : "principale"}
            onClick={() => void soumettre()}
            disabled={mutation.isPending}
          >
            {retrait ? t("diligenceRetirer") : tc("enregistrer")}
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

        {retrait ? null : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Champ
              id={`${p}seuilMontant`}
              label={td("champSeuilMontant")}
              obligatoire
              erreur={errors.seuilMontant?.message}
            >
              <Input
                id={`${p}seuilMontant`}
                placeholder={t("phSeuilDiligence")}
                type="number"
                min={0}
                step="1000"
                enErreur={!!errors.seuilMontant}
                {...register("seuilMontant")}
              />
            </Champ>

            <Champ
              id={`${p}typeClientSensible`}
              label={td("champTypeClientSensible")}
              obligatoire
              erreur={errors.typeClientSensible?.message}
            >
              <Select
                id={`${p}typeClientSensible`}
                enErreur={!!errors.typeClientSensible}
                {...register("typeClientSensible")}
              >
                <option value="">{td("choisirType")}</option>
                {(types.data ?? []).map((type) => (
                  // A code, validated against the reference list on the backend.
                  <option key={type.id} value={type.code}>
                    {type.libelle}
                  </option>
                ))}
              </Select>
            </Champ>
          </div>
        )}

        <Champ
          id={`${p}motif`}
          label={retrait ? t("diligenceMotifRetrait") : t("diligenceMotif")}
          obligatoire={intention !== "poser"}
          aide={intention === "poser" ? t("diligenceMotifFacultatif") : undefined}
          erreur={errors.motif?.message}
        >
          <Textarea id={`${p}motif`}
  placeholder={t("phMotifDiligence")} rows={3} enErreur={!!errors.motif} {...register("motif")} />
        </Champ>
      </form>
    </Dialog>
  );
}
