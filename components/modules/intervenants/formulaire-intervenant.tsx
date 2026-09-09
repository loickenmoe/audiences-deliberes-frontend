"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Champ, Input, Select } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { messageErreur } from "@/lib/api/errors";
import { useCreerIntervenant } from "@/hooks/useIntervenants";
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
 */
export function FormulaireIntervenant({
  ouvert,
  onFermeture,
}: {
  ouvert: boolean;
  onFermeture: () => void;
}) {
  const t = useTranslations("intervenants");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const td = useTranslations("domaine");
  const creer = useCreerIntervenant();

  const schema = z
    .object({
      type: z.enum(TypeIntervenant),
      nom: z.string().trim().min(1, tm("champObligatoire")).max(100),
      email: z.union([z.string().email(), z.literal("")]).optional(),
      telephone: z.string().max(20).optional(),
      compteKeycloak: z.string().max(255).optional(),
      notification: z.boolean().optional(),
    })
    .refine((v) => v.type !== "AVOCAT" || !!v.compteKeycloak?.trim(), {
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
    defaultValues: { type: "AVOCAT", nom: "", email: "", telephone: "", compteKeycloak: "" },
  });

  const type = watch("type");
  const estAvocat = type === "AVOCAT";

  function fermer() {
    reset();
    creer.reset();
    onFermeture();
  }

  const soumettre = handleSubmit(async (valeurs) => {
    try {
      await creer.mutateAsync({
        type: valeurs.type,
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
      titre={t("creerTitre")}
      pied={
        <>
          <Button variante="secondaire" onClick={fermer} disabled={creer.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void soumettre()} disabled={creer.isPending}>
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

        <Champ id="type" label={t("colonneType")} obligatoire>
          <Select id="type" {...register("type")}>
            {TypeIntervenant.map((valeur) => (
              <option key={valeur} value={valeur}>
                {td(`TypeIntervenant.${valeur}` as never)}
              </option>
            ))}
          </Select>
        </Champ>

        <Champ id="nom" label={t("colonneNom")} obligatoire erreur={errors.nom?.message}>
          <Input id="nom" enErreur={!!errors.nom} {...register("nom")} />
        </Champ>

        <Champ id="email" label={t("colonneEmail")} erreur={errors.email?.message}>
          <Input id="email" type="email" enErreur={!!errors.email} {...register("email")} />
        </Champ>

        <Champ id="telephone" label={t("colonneTelephone")} erreur={errors.telephone?.message}>
          <Input id="telephone" type="tel" {...register("telephone")} />
        </Champ>

        {estAvocat ? (
          <Champ
            id="compteKeycloak"
            label={t("colonneCompte")}
            obligatoire
            aide={t("compteObligatoire")}
            erreur={errors.compteKeycloak?.message}
          >
            <Input
              id="compteKeycloak"
              autoCapitalize="none"
              spellCheck={false}
              enErreur={!!errors.compteKeycloak}
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
