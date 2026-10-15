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
 * Trois gestes possibles sur la diligence particulière d'un dossier **déjà ouvert**.
 *
 * - `proposer` : le juriste demande, le DJ ou la DJA arbitrera ;
 * - `poser` : le DJ ou la DJA décide sans passer par une proposition ;
 * - `retirer` : le DJ ou la DJA lève une diligence validée.
 */
export type IntentionDiligence = "proposer" | "poser" | "retirer";

/**
 * Révision de la diligence particulière après l'ouverture (métier, 2026-10-03, observation 5 ;
 * les deux sens arrêtés le 2026-10-06).
 *
 * **Ce que cette modale débloque.** La diligence ne se posait qu'à la création : un dossier ouvert
 * comme ordinaire le restait définitivement, alors qu'une affaire se révèle sensible en cours de
 * route - une contrepartie change de nature, un montant se découvre.
 *
 * **Une seule modale pour trois gestes**, parce que les champs sont les mêmes et que l'intention
 * seule change ce qui est exigé : seuil et type pour poser, motif pour proposer et pour retirer. En
 * faire trois composants aurait triplé le même formulaire.
 *
 * **Le motif n'est pas une formalité.** Proposer demande d'expliquer ce qui a changé depuis
 * l'ouverture ; retirer fait sortir le dossier du circuit de double validation des frais, et
 * l'audit demandera pourquoi.
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
   * Identifiants propres à l'instance : un `<dialog>` fermé reste dans le DOM, et la modale de
   * dérogation porte déjà un champ `motif`. Sans préfixe, le libellé désignait **son** champ -
   * invisible, donc impossible à remplir, et le défaut ne se voyait qu'à l'usage.
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
          // Le retrait n'a pas besoin de seuil ni de type : il les efface.
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
           * Le motif est exigé pour proposer et pour retirer, mais pas pour poser : le DJ qui pose
           * la diligence est lui-même la décision, il n'a personne à convaincre. Le backend applique
           * la même règle, et c'est lui qui tranche.
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

  // Chaque ouverture repart à vide : la modale sert trois intentions, et un reste de saisie
  // précédente serait lu comme une proposition de l'application.
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
                  // Un code, validé contre le référentiel côté backend (Q-73).
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
