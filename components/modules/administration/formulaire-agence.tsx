"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useEcritureAgence } from "@/hooks/useReferentiels";
import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { messageErreur } from "@/lib/api/errors";
import type { Agence } from "@/types/domaine";

const CHAMPS = ["code", "nom", "ville", "adresse", "telephone"] as const;

/** `ERR-CONFLICT` is generic: here only an already used code can cause it. */
const CONFLIT_SUR_CODE = { "ERR-CONFLICT": "code" } as const;

/**
 * Branch creation and correction.
 * The code is read-only when editing: cases store it in clear text without a foreign key, so
 * changing it would silently detach them. A branch that changes code is a new branch.
 * The city is required: two branches can share the same name.
 */
export function FormulaireAgence({
  ouvert,
  onFermeture,
  agence,
}: {
  ouvert: boolean;
  onFermeture: () => void;
  /** The branch to edit. When absent, the form creates a new one. */
  agence?: Agence;
}) {
  const t = useTranslations("agences");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const edition = agence !== undefined;
  // Per-instance ids: creation and edit forms coexist on the screen, and a closed <dialog> stays in
  // the DOM.
  const p = useId();
  const { creer, modifier } = useEcritureAgence();
  const mutation = edition ? modifier : creer;

  const schema = z.object({
    code: z.string().trim().min(1, tm("champObligatoire")).max(20),
    nom: z.string().trim().min(1, tm("champObligatoire")).max(150),
    ville: z.string().trim().min(1, tm("champObligatoire")).max(100),
    adresse: z.string().max(255).optional(),
    telephone: z.string().max(50).optional(),
  });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: agence?.code ?? "",
      nom: agence?.nom ?? "",
      ville: agence?.ville ?? "",
      adresse: agence?.adresse ?? "",
      telephone: agence?.telephone ?? "",
    },
  });

  function fermer() {
    reset();
    creer.reset();
    modifier.reset();
    onFermeture();
  }

  const soumettre = handleSubmit(async (valeurs) => {
    // An emptied field is sent as `null`: the backend reads it as "unknown", not as an empty
    // string.
    const corps = {
      code: valeurs.code,
      nom: valeurs.nom,
      ville: valeurs.ville,
      adresse: valeurs.adresse || null,
      telephone: valeurs.telephone || null,
    };
    try {
      if (edition) {
        // The code cannot be changed: send the stored one, which the backend compares.
        await modifier.mutateAsync({ id: agence.id, corps: { ...corps, code: agence.code } });
      } else {
        await creer.mutateAsync(corps);
      }
      fermer();
    } catch (erreur) {
      if (!appliquerErreurApi(erreur, setError, CHAMPS, CONFLIT_SUR_CODE)) {
        setError("root", { message: messageErreur(erreur) });
      }
    }
  });

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={fermer}
      titre={edition ? t("modifierTitre") : t("creerTitre")}
      description={edition ? t("codeFige") : undefined}
      pied={
        <>
          <Button variante="secondaire" onClick={fermer} disabled={mutation.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void soumettre()} disabled={mutation.isPending}>
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

        <Champ
          id={`${p}code`}
          label={t("colonneCode")}
          obligatoire={!edition}
          aide={edition ? t("codeFige") : t("codeAide")}
          erreur={errors.code?.message}
        >
          <Input
            id={`${p}code`}
            disabled={edition}
            enErreur={!!errors.code}
            {...register("code")}
          />
        </Champ>

        <Champ id={`${p}nom`} label={t("colonneNom")} obligatoire erreur={errors.nom?.message}>
          <Input id={`${p}nom`} enErreur={!!errors.nom} {...register("nom")} />
        </Champ>

        <Champ
          id={`${p}ville`}
          label={t("colonneVille")}
          obligatoire
          aide={t("villeAide")}
          erreur={errors.ville?.message}
        >
          <Input id={`${p}ville`} enErreur={!!errors.ville} {...register("ville")} />
        </Champ>

        <Champ
          id={`${p}adresse`}
          label={t("colonneAdresse")}
          aide={t("adresseAide")}
          erreur={errors.adresse?.message}
        >
          <Input id={`${p}adresse`} {...register("adresse")} />
        </Champ>

        <Champ
          id={`${p}telephone`}
          label={t("colonneTelephone")}
          erreur={errors.telephone?.message}
        >
          <Input id={`${p}telephone`} type="tel" {...register("telephone")} />
        </Champ>
      </form>
    </Dialog>
  );
}
