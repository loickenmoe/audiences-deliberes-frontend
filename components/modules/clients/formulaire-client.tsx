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
import { useCreerClient, useModifierClient } from "@/hooks/useClients";
import type { Client } from "@/types/domaine";

/**
 * Création d'un client, ou correction d'un client existant quand `client` est fourni.
 *
 * Le schéma **reprend les contraintes Bean Validation du backend** (`CreerClientRequest`,
 * `ModifierClientRequest`) : le nom est obligatoire, avec les mêmes longueurs maximales. Valider en
 * amont évite un aller-retour pour une faute que le formulaire pouvait voir ; le backend reste
 * l'arbitre.
 *
 * Un seul formulaire pour les deux usages, et non deux : ses règles de validation ne doivent pas
 * pouvoir diverger entre la création et la correction d'un même client.
 */
const CHAMPS = ["reference", "nom", "email", "telephone"] as const;

/** `POST /clients` n'a qu'un seul conflit possible : la référence (ClientService, RG-CLI-01). */
const CONFLIT_SUR_REFERENCE = { "ERR-CONFLICT": "reference" } as const;

export function FormulaireClient({
  ouvert,
  onFermeture,
  client,
}: {
  ouvert: boolean;
  onFermeture: () => void;
  /** Le client à corriger. Absent : le formulaire crée un nouveau client. */
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
    // En édition la référence est figée et n’est pas envoyée : un champ désactivé pouvant revenir
    // vide de react-hook-form, l’exiger bloquerait la soumission pour une valeur qu’on ne transmet pas.
    reference: edition ? z.string().optional() : z.string().trim().min(1, tm("champObligatoire")).max(50),
    nom: z.string().trim().min(1, tm("champObligatoire")).max(255),
    email: z.union([z.string().email(), z.literal("")]).optional(),
    telephone: z.string().max(20).optional(),
  });

  const valeursInitiales = {
    reference: client?.reference ?? "",
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
    // `values` et non `defaultValues` : le client peut arriver après le premier rendu, et le
    // formulaire doit alors se remplir de ses valeurs courantes.
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
        // Un champ vidé part en `null` : le backend l'enregistre comme absent.
        await modifier.mutateAsync({
          nom: valeurs.nom,
          email: valeurs.email || null,
          telephone: valeurs.telephone || null,
        });
      } else {
        await creer.mutateAsync({
          // Exigée par le schéma en création : jamais vide ici.
          reference: valeurs.reference ?? "",
          nom: valeurs.nom,
          email: valeurs.email || undefined,
          telephone: valeurs.telephone || undefined,
        });
      }
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

        {/* La référence est l'identifiant du client : saisie à la création, figée ensuite. */}
        <Champ
          id="reference"
          label={t("colonneReference")}
          obligatoire={!edition}
          aide={edition ? t("referenceFigee") : undefined}
          erreur={errors.reference?.message}
        >
          <Input
            id="reference"
            enErreur={!!errors.reference}
            disabled={edition}
            readOnly={edition}
            {...register("reference")}
          />
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
