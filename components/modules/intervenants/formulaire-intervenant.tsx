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
import { useCreerIntervenant, useModifierIntervenant } from "@/hooks/useIntervenants";
import type { Intervenant } from "@/types/domaine";
import { TypeIntervenant } from "@/types/enums";

const CHAMPS = ["type", "nom", "email", "telephone", "compteKeycloak", "notification"] as const;

/** Cf. `lib/api/erreurs-formulaire.ts` : `ERR-CONFLICT` est générique, le champ vient de l'appelant. */
const CONFLIT_SUR_COMPTE = { "ERR-CONFLICT": "compteKeycloak" } as const;

/**
 * Création d'un intervenant.
 *
 * Le formulaire **s'adapte au type**, parce que le backend applique deux règles opposées
 * (#61, RG-INT-01/02) :
 * · un `AVOCAT` **exige** un compte applicatif — 400 s'il manque, 409 s'il est déjà pris — et
 *   **refuse** le champ `notification` ;
 * · un `AUTRE_PRESTATAIRE` **refuse** tout compte : il n'est joignable que par courriel.
 *
 * Afficher les deux champs en permanence conduirait l'utilisateur à des refus incompréhensibles.
 *
 * Quand `intervenant` est fourni, le formulaire le **corrige** (Q-117). Le type et l'identifiant de
 * connexion sont alors affichés mais figés — l'identité se gère dans Keycloak, qui crée et authentifie
 * les comptes. C'est le type enregistré, non la liste désactivée qu'un champ inactif peut rendre vide,
 * qui décide des champs proposés.
 */
export function FormulaireIntervenant({
  ouvert,
  onFermeture,
  intervenant,
}: {
  ouvert: boolean;
  onFermeture: () => void;
  /** L'intervenant à corriger. Absent : le formulaire en crée un nouveau. */
  intervenant?: Intervenant;
}) {
  const t = useTranslations("intervenants");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const td = useTranslations("domaine");
  const edition = intervenant !== undefined;
  // Identifiants propres à l’instance : la modale de création et celle de correction coexistent
  // sur l’écran 42, et un <dialog> fermé reste dans le DOM. Des « id » partagés reliaient les
  // libellés de l’une aux champs de l’autre (même cause que le titre des modales, F7).
  const p = useId();
  const creer = useCreerIntervenant();
  const modifier = useModifierIntervenant(intervenant?.id ?? 0);
  const mutation = edition ? modifier : creer;

  const schema = z
    .object({
      type: edition ? z.enum(TypeIntervenant).optional() : z.enum(TypeIntervenant),
      nom: z.string().trim().min(1, tm("champObligatoire")).max(100),
      email: z.union([z.string().email(), z.literal("")]).optional(),
      telephone: z.string().max(20).optional(),
      compteKeycloak: z.string().max(255).optional(),
      notification: z.boolean().optional(),
    })
    // En édition l'identifiant est figé et n'est pas envoyé : l'exiger bloquerait la soumission.
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
      notification: intervenant?.notification ?? false,
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
        // Un champ vidé part en `null` ; la notification aussi pour un avocat, qui la refuse.
        await modifier.mutateAsync({
          nom: valeurs.nom,
          email: valeurs.email || null,
          telephone: valeurs.telephone || null,
          notification: estAvocat ? null : !!valeurs.notification,
        });
        fermer();
        return;
      }
      await creer.mutateAsync({
        // Exigé par le schéma en création : jamais absent ici.
        type: valeurs.type ?? "AVOCAT",
        nom: valeurs.nom,
        email: valeurs.email || undefined,
        telephone: valeurs.telephone || undefined,
        // Le backend refuse un compte sur un autre prestataire : ne rien envoyer plutôt qu'une
        // chaîne vide, qu'il traiterait comme une valeur.
        compteKeycloak: estAvocat ? valeurs.compteKeycloak || undefined : undefined,
        notification: estAvocat ? undefined : valeurs.notification,
      });
      fermer();
    } catch (erreur) {
      // Le seul conflit possible sur `POST /intervenants` est un compte déjà rattaché à un avocat
      // (IntervenantService, RG-INT-01) : le signaler sur le champ, pas dans un bandeau.
      if (!appliquerErreurApi(erreur, setError, CHAMPS, CONFLIT_SUR_COMPTE)) {
        setError("root", { message: messageErreur(erreur) });
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
          <Input id={`${p}nom`} enErreur={!!errors.nom} {...register("nom")} />
        </Champ>

        <Champ id={`${p}email`} label={t("colonneEmail")} erreur={errors.email?.message}>
          <Input id={`${p}email`} type="email" enErreur={!!errors.email} {...register("email")} />
        </Champ>

        <Champ id={`${p}telephone`} label={t("colonneTelephone")} erreur={errors.telephone?.message}>
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
          <div className="flex flex-col gap-2">
            <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">
              {t("comptePrestataire")}
            </p>
            <label className="flex items-center gap-2 text-[length:var(--taille-sm)]">
              <input type="checkbox" {...register("notification")} />
              {t("notification")}
            </label>
          </div>
        )}
      </form>
    </Dialog>
  );
}
