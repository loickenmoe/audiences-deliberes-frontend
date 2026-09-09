"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { messageErreur } from "@/lib/api/errors";
import { useCreerClient } from "@/hooks/useClients";

/**
 * Création d'un client.
 *
 * Le schéma **reprend les contraintes Bean Validation du backend** (`CreerClientRequest`) : la
 * référence et le nom sont obligatoires, avec les mêmes longueurs maximales. Valider en amont évite
 * un aller-retour pour une faute que le formulaire pouvait voir ; le backend reste l'arbitre.
 */
const CHAMPS = ["reference", "nom", "email", "telephone"] as const;

/** `POST /clients` n'a qu'un seul conflit possible : la référence (ClientService, RG-CLI-01). */
const CONFLIT_SUR_REFERENCE = { "ERR-CONFLICT": "reference" } as const;

export function FormulaireClient({ ouvert, onFermeture }: { ouvert: boolean; onFermeture: () => void }) {
  const t = useTranslations("clients");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const creer = useCreerClient();

  const schema = z.object({
    reference: z.string().trim().min(1, tm("champObligatoire")).max(50),
    nom: z.string().trim().min(1, tm("champObligatoire")).max(255),
    email: z.union([z.string().email(), z.literal("")]).optional(),
    telephone: z.string().max(20).optional(),
  });

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { reference: "", nom: "", email: "", telephone: "" },
  });

  function fermer() {
    reset();
    creer.reset();
    onFermeture();
  }

  const soumettre = handleSubmit(async (valeurs) => {
    try {
      await creer.mutateAsync({
        reference: valeurs.reference,
        nom: valeurs.nom,
        email: valeurs.email || undefined,
        telephone: valeurs.telephone || undefined,
      });
      fermer();
    } catch (erreur) {
      // Le doublon de référence client remonte en `ERR-CONFLICT` — code générique côté backend :
      // c'est ici, où l'endpoint est connu, qu'on sait qu'il vise `reference`.
      if (!appliquerErreurApi(erreur, setError, CHAMPS, CONFLIT_SUR_REFERENCE)) {
        setError("root", { message: messageErreur(erreur) });
      }
    }
  });

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={fermer}
      titre={t("creerTitre")}
      description={t("creerDescription")}
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

        <Champ id="reference" label={t("colonneReference")} obligatoire erreur={errors.reference?.message}>
          <Input id="reference" enErreur={!!errors.reference} {...register("reference")} />
        </Champ>

        <Champ id="nom" label={t("colonneNom")} obligatoire erreur={errors.nom?.message}>
          <Input id="nom" enErreur={!!errors.nom} {...register("nom")} />
        </Champ>

        <Champ id="email" label={t("colonneEmail")} erreur={errors.email?.message}>
          <Input id="email" type="email" enErreur={!!errors.email} {...register("email")} />
        </Champ>

        <Champ id="telephone" label={t("colonneTelephone")} erreur={errors.telephone?.message}>
          <Input id="telephone" type="tel" enErreur={!!errors.telephone} {...register("telephone")} />
        </Champ>
      </form>
    </Dialog>
  );
}
