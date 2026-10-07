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
const CHAMPS = ["nom", "email", "telephone"] as const;

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
        const cree = await creer.mutateAsync({
          nom: valeurs.nom,
          email: valeurs.email || undefined,
          telephone: valeurs.telephone || undefined,
        });
        // La référence est attribuée par le serveur : l'annoncer est la seule façon de la connaître.
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
          La référence est l'identifiant du client : attribuée à la création (2026-09-29), figée
          ensuite. Elle reste montrée en correction — savoir lequel on modifie en dépend — mais
          n'est plus un champ : rien ne la saisit, rien ne l'envoie.
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
