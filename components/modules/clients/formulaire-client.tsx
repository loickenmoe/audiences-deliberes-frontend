"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { messageErreur } from "@/lib/api/errors";
import { useCreerClient, useModifierClient } from "@/hooks/useClients";
import type { Client } from "@/types/domaine";

/**
 * Creates a client, or edits an existing one when `client` is provided.
 * The schema mirrors the backend Bean Validation constraints (`CreerClientRequest`,
 * `ModifierClientRequest`); the backend remains the authority. A single form for both uses so the
 * validation rules cannot diverge.
 */
const CHAMPS = ["nom", "email", "telephone"] as const;

export function FormulaireClient({
  ouvert,
  onFermeture,
  client,
}: {
  ouvert: boolean;
  onFermeture: () => void;
  /** The client to edit. When absent, the form creates a new client. */
  client?: Client;
}) {
  const t = useTranslations("clients");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const edition = client !== undefined;
  const creer = useCreerClient();
  const modifier = useModifierClient(client?.id ?? 0);
  const mutation = edition ? modifier : creer;

  const schema = z.object({
    nom: z.string().trim().min(1, tm("champObligatoire")).max(255),
    email: z.union([z.string().email(), z.literal("")]).optional(),
    telephone: z.string().max(20).optional(),
  });

  const valeursInitiales = {
    nom: client?.nom ?? "",
    email: client?.email ?? "",
    telephone: client?.telephone ?? "",
  };

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    // `values` rather than `defaultValues`: the client may arrive after the first render, and the
    // form must then fill with its current values.
    values: valeursInitiales,
  });

  function fermer() {
    reset(valeursInitiales);
    mutation.reset();
    onFermeture();
  }

  const soumettre = handleSubmit(async (valeurs) => {
    try {
      if (edition) {
        // An emptied field is sent as `null`: the backend stores it as absent.
        await modifier.mutateAsync({
          nom: valeurs.nom,
          email: valeurs.email || null,
          telephone: valeurs.telephone || null,
        });
      } else {
        const cree = await creer.mutateAsync({
          nom: valeurs.nom,
          email: valeurs.email || undefined,
          telephone: valeurs.telephone || undefined,
        });
        // The reference is assigned by the server: announcing it is the only way to know it.
        toast.success(t("clientCree", { reference: cree.reference }));
      }
      fermer();
    } catch (erreur) {
      if (!appliquerErreurApi(erreur, setError, CHAMPS)) {
        setError("root", { message: messageErreur(erreur) });
      }
    }
  });

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={fermer}
      titre={edition ? t("modifierTitre") : t("creerTitre")}
      description={edition ? t("modifierDescription") : t("creerDescription")}
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

        {/*
          The reference is the client identifier: assigned at creation and fixed afterwards. It is
          still shown when editing but is not an input field and is never sent.
        */}
        {edition ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[length:var(--taille-sm)] font-medium">{t("colonneReference")}</span>
            <p className="font-mono text-[length:var(--taille-sm)]">{client.reference}</p>
            <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("referenceFigee")}</p>
          </div>
        ) : null}

        <Champ id="nom" label={t("colonneNom")} obligatoire erreur={errors.nom?.message}>
          <Input id="nom"
  placeholder={t("phNom")} enErreur={!!errors.nom} {...register("nom")} />
        </Champ>

        <Champ id="email" label={t("colonneEmail")} erreur={errors.email?.message}>
          <Input id="email"
  placeholder={t("phEmail")} type="email" enErreur={!!errors.email} {...register("email")} />
        </Champ>

        <Champ id="telephone" label={t("colonneTelephone")} erreur={errors.telephone?.message}>
          <Input id="telephone"
  placeholder={t("phTelephone")} type="tel" enErreur={!!errors.telephone} {...register("telephone")} />
        </Champ>
      </form>
    </Dialog>
  );
}
