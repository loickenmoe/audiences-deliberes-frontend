"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DateHeureValeur, MontantFcfa } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Champ, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useDerogations, useValiderDerogation } from "@/hooks/useDossiers";
import { useLibelles } from "@/hooks/useLibelles";
import { appliquerErreurApi } from "@/lib/api/erreurs-formulaire";
import { messageErreur } from "@/lib/api/errors";
import type { AuditSeuil } from "@/types/domaine";

/**
 * Écran 17, volet arbitrage — les dérogations de seuil en attente, en tête de fiche.
 *
 * N'existe que depuis l'ajout de `GET /dossiers/{id}/seuil-derogation` au backend (Q-74) : sans
 * lui, l'identifiant de la demande n'était exposé nulle part et le DJ/DJA ne pouvait pas arbitrer
 * (QF-23). Affiché seulement sur un dossier sensible **validé** : avant, le seul audit en attente
 * est la proposition initiale, qui se tranche par la validation de sensibilité.
 */
export function DerogationsEnAttente({ dossierId }: { dossierId: number }) {
  const t = useTranslations("fiche");
  const requete = useDerogations(dossierId, "EN_ATTENTE");
  const { nomUtilisateur } = useLibelles();
  const [enCours, setEnCours] = useState<AuditSeuil | null>(null);

  const demandes = requete.data ?? [];
  // Rien à arbitrer : pas de carte vide qui attirerait l'œil pour rien.
  if (demandes.length === 0) return null;

  return (
    <Card className="border-attention/40">
      <CardHeader>
        <CardTitle>{t("derogationsEnAttente")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("derogationsEnAttenteAide")}</p>
        <ul className="flex flex-col divide-y divide-bordure">
          {demandes.map((demande) => (
            <li key={demande.id} className="flex flex-wrap items-start justify-between gap-4 py-3 first:pt-0">
              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[length:var(--taille-sm)]">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("champAncienSeuil")}</dt>
                  <dd>
                    <MontantFcfa valeur={demande.ancienSeuil} />
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("champSeuilDemande")}</dt>
                  <dd className="font-medium">
                    <MontantFcfa valeur={demande.nouveauSeuil} />
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("demandeePar")}</dt>
                  <dd>
                    {demande.utilisateurId !== null ? nomUtilisateur(demande.utilisateurId) : "—"}
                    {" · "}
                    <DateHeureValeur valeur={demande.dateAction} />
                  </dd>
                </div>
                <div className="flex min-w-0 basis-full flex-col gap-0.5">
                  <dt className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("motifDemande")}</dt>
                  <dd>{demande.motif ?? "—"}</dd>
                </div>
              </dl>
              <Button onClick={() => setEnCours(demande)}>{t("arbitrer")}</Button>
            </li>
          ))}
        </ul>

        <ModaleArbitrage dossierId={dossierId} demande={enCours} onFermeture={() => setEnCours(null)} />
      </CardContent>
    </Card>
  );
}

const CHAMPS = ["motif"] as const;

function ModaleArbitrage({
  dossierId,
  demande,
  onFermeture,
}: {
  dossierId: number;
  demande: AuditSeuil | null;
  onFermeture: () => void;
}) {
  const t = useTranslations("fiche");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const valider = useValiderDerogation(dossierId);

  const schema = useMemo(
    () =>
      z
        .object({ statut: z.enum(["VALIDEE", "REJETEE"]), motif: z.string().max(255).optional() })
        .superRefine((valeurs, contexte) => {
          // Le backend exige un motif en cas de rejet : le signaler avant l'envoi.
          if (valeurs.statut === "REJETEE" && !valeurs.motif?.trim()) {
            contexte.addIssue({ code: "custom", path: ["motif"], message: tm("champObligatoire") });
          }
        }),
    [tm],
  );

  const {
    register,
    handleSubmit,
    watch,
    setError,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { statut: "VALIDEE", motif: "" },
  });

  useEffect(() => {
    if (demande) reset({ statut: "VALIDEE", motif: "" });
  }, [demande, reset]);

  const rejet = watch("statut") === "REJETEE";

  const soumettre = handleSubmit(async (valeurs) => {
    if (!demande) return;
    try {
      await valider.mutateAsync({
        auditId: demande.id,
        decision: { statut: valeurs.statut, motif: valeurs.motif?.trim() || undefined },
      });
      onFermeture();
    } catch (erreur) {
      if (!appliquerErreurApi(erreur, setError, CHAMPS)) {
        setError("root", { message: messageErreur(erreur) });
      }
    }
  });

  return (
    <Dialog
      ouvert={demande !== null}
      onFermeture={onFermeture}
      titre={t("arbitrageTitre")}
      description={t("arbitrageDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={valider.isPending}>
            {tc("annuler")}
          </Button>
          <Button
            variante={rejet ? "destructive" : "principale"}
            onClick={() => void soumettre()}
            disabled={valider.isPending}
          >
            {rejet ? t("rejeter") : t("valider")}
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

        {demande ? (
          <p className="text-[length:var(--taille-sm)]">
            <MontantFcfa valeur={demande.ancienSeuil} /> → <strong><MontantFcfa valeur={demande.nouveauSeuil} /></strong>
          </p>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[length:var(--taille-sm)] font-medium">{t("decision")}</legend>
          <label className="flex items-center gap-2 text-[length:var(--taille-sm)]">
            <input type="radio" value="VALIDEE" {...register("statut")} />
            {t("valider")}
          </label>
          <label className="flex items-center gap-2 text-[length:var(--taille-sm)]">
            <input type="radio" value="REJETEE" {...register("statut")} />
            {t("rejeter")}
          </label>
        </fieldset>

        <Champ id="motif-arbitrage" label={t("motifDecision")} obligatoire={rejet} erreur={errors.motif?.message}>
          <Textarea id="motif-arbitrage" rows={3} enErreur={!!errors.motif} {...register("motif")} />
        </Champ>
      </form>
    </Dialog>
  );
}
