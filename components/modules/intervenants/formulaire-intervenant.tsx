"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Champ, Input, Select } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { messageErreur } from "@/lib/api/errors";
import { telephoneValide } from "@/lib/notifications";
import { useCreerIntervenant, useModifierIntervenant } from "@/hooks/useIntervenants";
import type { Intervenant } from "@/types/domaine";
import { TypeIntervenant } from "@/types/enums";

const CHAMPS = ["type", "nom", "email", "telephone", "compteKeycloak", "notification"] as const;

/** See `lib/api/erreurs-formulaire.ts`: `ERR-CONFLICT` is generic, the field is provided by the caller. */
const CONFLIT_SUR_COMPTE = { "ERR-CONFLICT": "compteKeycloak" } as const;

/**
 * Creates or edits a third party (intervenant).
 *
 * The form adapts to the type because the backend applies opposite rules (RG-INT-01/02):
 * - an `AVOCAT` requires an application account (400 if missing, 409 if already taken);
 * - an `AUTRE_PRESTATAIRE` refuses any account.
 *
 * Consent to external notifications (SMS, WhatsApp, personal email) applies to both: checked by
 * default for a lawyer, unchecked for another provider (RG-INT-02).
 *
 * When `intervenant` is provided, the form edits it. Type and login are shown but read-only, since
 * identity is managed in Keycloak; the saved type (not the disabled select) decides which fields show.
 */
export function FormulaireIntervenant({
  ouvert,
  onFermeture,
  intervenant,
}: Readonly<{
  ouvert: boolean;
  onFermeture: () => void;
  /** The third party to edit. When absent, the form creates a new one. */
  intervenant?: Intervenant;
}>) {
  const t = useTranslations("intervenants");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const td = useTranslations("domaine");
  const edition = intervenant !== undefined;
  // Per-instance ids: the create and edit modals coexist on screen 42 and a closed <dialog> stays
  // in the DOM, so shared ids would link one form's labels to the other's fields.
  const p = useId();
  const creer = useCreerIntervenant();
  const modifier = useModifierIntervenant(intervenant?.id ?? 0);
  const mutation = edition ? modifier : creer;

  const schema = z
    .object({
      type: edition ? z.enum(TypeIntervenant).optional() : z.enum(TypeIntervenant),
      nom: z.string().trim().min(1, tm("champObligatoire")).max(100),
      email: z.union([z.string().email(), z.literal("")]).optional(),
      // Same rule as the backend, which would reject the record: report it here.
      telephone: z
        .string()
        .max(20)
        .refine((valeur) => telephoneValide(valeur ?? ""), { message: t("telephoneFormat") })
        .optional(),
      compteKeycloak: z.string().max(255).optional(),
      notification: z.boolean().optional(),
    })
    // When editing, the login is read-only and not sent: requiring it would block submission.
    .refine((v) => edition || v.type !== "AVOCAT" || !!v.compteKeycloak?.trim(), {
      path: ["compteKeycloak"],
      message: tm("champObligatoire"),
    });

  const {
    register,
    handleSubmit,
    watch,
    setError,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: intervenant?.type ?? "AVOCAT",
      nom: intervenant?.nom ?? "",
      email: intervenant?.email ?? "",
      telephone: intervenant?.telephone ?? "",
      compteKeycloak: intervenant?.compteKeycloak ?? "",
      notification: intervenant?.notification ?? (intervenant?.type ?? "AVOCAT") === "AVOCAT",
    },
  });

  const type = watch("type");
  const estAvocat = (edition ? intervenant.type : type) === "AVOCAT";

  function fermer() {
    reset();
    mutation.reset();
    onFermeture();
  }

  const soumettre = handleSubmit(async (valeurs) => {
    try {
      if (edition) {
        // A cleared field is sent as `null`; consent is always sent.
        await modifier.mutateAsync({
          nom: valeurs.nom,
          email: valeurs.email || null,
          telephone: valeurs.telephone || null,
          notification: !!valeurs.notification,
        });
        fermer();
        return;
      }
      await creer.mutateAsync({
        // Required by the schema on creation: never absent here.
        type: valeurs.type ?? "AVOCAT",
        nom: valeurs.nom,
        email: valeurs.email || undefined,
        telephone: valeurs.telephone || undefined,
        // The backend refuses an account on another provider: send nothing rather than an empty string,
        // which it would treat as a value.
        compteKeycloak: estAvocat ? valeurs.compteKeycloak || undefined : undefined,
        notification: valeurs.notification,
      });
      fermer();
    } catch (error_) {
      // The only possible conflict on `POST /intervenants` is an account already linked to a lawyer
      // (IntervenantService, RG-INT-01): report it on the field, not in a banner.
      if (!appliquerErreurApi(error_, setError, CHAMPS, CONFLIT_SUR_COMPTE)) {
        setError("root", { message: messageErreur(error_) });
      }
    }
  });

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={fermer}
      titre={edition ? t("modifierTitre") : t("creerTitre")}
      description={edition ? t("modifierDescription") : undefined}
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

        <Champ id={`${p}type`} label={t("colonneType")} obligatoire={!edition} aide={edition ? t("typeFige") : undefined}>
          <Select id={`${p}type`} disabled={edition} {...register("type")}>
            {TypeIntervenant.map((valeur) => (
              <option key={valeur} value={valeur}>
                {td(`TypeIntervenant.${valeur}` as never)}
              </option>
            ))}
          </Select>
        </Champ>

        <Champ id={`${p}nom`} label={t("colonneNom")} obligatoire erreur={errors.nom?.message}>
          <Input id={`${p}nom`}
  placeholder={t("phNom")} enErreur={!!errors.nom} {...register("nom")} />
        </Champ>

        <Champ id={`${p}email`} label={t("colonneEmail")} erreur={errors.email?.message}>
          <Input id={`${p}email`}
  placeholder={t("phEmail")} type="email" enErreur={!!errors.email} {...register("email")} />
        </Champ>

        <Champ
          id={`${p}telephone`}
          label={t("colonneTelephone")}
          aide={t("telephoneAide")}
          erreur={errors.telephone?.message}
        >
          <Input id={`${p}telephone`} type="tel" {...register("telephone")} />
        </Champ>

        {estAvocat ? (
          <Champ
            id={`${p}compteKeycloak`}
            label={t("colonneCompte")}
            obligatoire={!edition}
            aide={edition ? t("compteFige") : t("compteObligatoire")}
            erreur={errors.compteKeycloak?.message}
          >
            <Input
              id={`${p}compteKeycloak`}
              autoCapitalize="none"
              spellCheck={false}
              enErreur={!!errors.compteKeycloak}
              disabled={edition}
              readOnly={edition}
              {...register("compteKeycloak")}
            />
          </Champ>
        ) : (
          <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("comptePrestataire")}</p>
        )}

        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-2 text-[length:var(--taille-sm)]">
            <input type="checkbox" {...register("notification")} />
            {t("notification")}
          </label>
          <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("notificationAide")}</p>
        </div>
      </form>
    </Dialog>
  );
}
