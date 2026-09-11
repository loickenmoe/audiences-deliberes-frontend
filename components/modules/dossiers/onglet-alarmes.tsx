"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlarmClock, CornerDownRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { EtatChargement, EtatErreur } from "@/components/global";
import { StatutChip } from "@/components/global/statut-chip";
import { DateHeureValeur, DialogueConfirmation } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Champ, Input, Select } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useAlarmesDossier, useCreerAlarme, useReprogrammerAlarme, useTraiterAlarme } from "@/hooks/useAudiences";
import { useLibelles } from "@/hooks/useLibelles";
import { messageErreur } from "@/lib/api/errors";
import { maintenantLocal } from "@/lib/calendrier";
import { peut } from "@/lib/rbac";
import type { Alarme, Dossier } from "@/types/domaine";

/**
 * Écran 11 — alarmes du dossier, l'échéance la plus proche d'abord (ordre du backend).
 *
 * Reprogrammer n'édite pas une alarme : le backend **clôt** l'ancienne (`TRAITEE`) et en crée une
 * nouvelle qui la cite (RG-AUD-04). La liste garde donc les deux, et signale la filiation. Une alarme
 * active dont l'échéance est passée est marquée « échue » : le backend l'a signalée, mais ne la clôt
 * jamais d'elle-même. « Marquer traitée » la clôt sans la remplacer (QF-29, Q-77 backend).
 */
export function OngletAlarmes({ dossier, roles }: { dossier: Dossier; roles: readonly string[] }) {
  const t = useTranslations("audiences");
  const tdom = useTranslations("domaine");
  const requete = useAlarmesDossier(dossier.id);
  const { nomUtilisateur } = useLibelles();
  const peutGerer = peut(roles, "gererAudiences");
  const [creation, setCreation] = useState(false);
  const [reprogrammation, setReprogrammation] = useState<Alarme | null>(null);
  const [traitement, setTraitement] = useState<Alarme | null>(null);
  const traiter = useTraiterAlarme(dossier.id);

  async function confirmerTraitement() {
    if (!traitement) return;
    try {
      await traiter.mutateAsync(traitement.id);
      toast.success(t("alarmeTraitee"));
    } catch (erreur) {
      toast.error(messageErreur(erreur));
    } finally {
      setTraitement(null);
    }
  }

  const etapes = dossier.etapes.map((etape) => ({ id: etape.id, libelle: tdom(`TypeEtape.${etape.type}` as never) }));
  const libelleEtape = (etapeId: number) => etapes.find((etape) => etape.id === etapeId)?.libelle ?? `#${etapeId}`;

  if (requete.isLoading) return <EtatChargement lignes={4} />;
  if (requete.error) return <EtatErreur message={messageErreur(requete.error)} />;
  const alarmes = requete.data ?? [];
  const maintenant = new Date();

  return (
    <div className="flex flex-col gap-4">
      {peutGerer ? (
        <div>
          <Button onClick={() => setCreation(true)} disabled={etapes.length === 0}>
            <AlarmClock size={15} aria-hidden />
            {t("creerAlarme")}
          </Button>
        </div>
      ) : null}

      {alarmes.length === 0 ? (
        <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">{t("alarmesAucune")}</p>
      ) : (
        <div className="overflow-x-auto rounded border border-bordure bg-surface">
          <table className="w-full text-left text-[length:var(--taille-sm)]">
            <thead className="border-b border-bordure bg-surface-attenuee text-[length:var(--taille-xs)] text-texte-secondaire">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneObjet")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneEtape")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneEcheance")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneStatut")}</th>
                <th scope="col" className="px-4 py-2 font-medium">{t("colonneCreePar")}</th>
                <th scope="col" className="px-4 py-2 font-medium">
                  <span className="sr-only">{t("colonneActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {alarmes.map((alarme) => {
                const active = alarme.statut === "ACTIVE";
                const echue = active && new Date(alarme.dateEcheance) <= maintenant;
                return (
                  <tr key={alarme.id} className={active ? undefined : "text-texte-tertiaire"}>
                    <td className="px-4 py-2">
                      <span className="flex flex-col gap-0.5">
                        <span className={active ? "font-medium" : undefined}>{alarme.objet}</span>
                        {alarme.alarmePrecedenteId !== null ? (
                          <span className="inline-flex items-center gap-1 text-[length:var(--taille-xs)] text-texte-tertiaire">
                            <CornerDownRight size={12} aria-hidden />
                            {t("reprise")}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-2">{libelleEtape(alarme.etapeId)}</td>
                    <td className="px-4 py-2">
                      <DateHeureValeur valeur={alarme.dateEcheance} />
                    </td>
                    <td className="px-4 py-2">
                      <span className="flex flex-wrap gap-1">
                        <StatutChip ton={active ? "info" : "neutre"}>
                          {tdom(`StatutAlarme.${alarme.statut}` as never)}
                        </StatutChip>
                        {echue ? <StatutChip ton="attention">{t("echue")}</StatutChip> : null}
                      </span>
                    </td>
                    <td className="px-4 py-2">{alarme.createdBy !== null ? nomUtilisateur(alarme.createdBy) : "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {peutGerer && active ? (
                        <span className="inline-flex flex-wrap justify-end gap-2">
                          <Button
                            variante="secondaire"
                            taille="sm"
                            onClick={() => setTraitement(alarme)}
                            aria-label={t("traiterAria", { objet: alarme.objet })}
                          >
                            {t("traiter")}
                          </Button>
                          <Button
                            variante="secondaire"
                            taille="sm"
                            onClick={() => setReprogrammation(alarme)}
                            aria-label={`${t("reprogrammer")} — ${alarme.objet}`}
                          >
                            {t("reprogrammer")}
                          </Button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {peutGerer ? (
        <>
          <ModaleCreation dossierId={dossier.id} etapes={etapes} ouvert={creation} onFermeture={() => setCreation(false)} />
          <ModaleReprogrammation
            dossierId={dossier.id}
            alarme={reprogrammation}
            onFermeture={() => setReprogrammation(null)}
          />
          <DialogueConfirmation
            ouvert={traitement !== null}
            onFermeture={() => setTraitement(null)}
            onConfirmation={() => void confirmerTraitement()}
            titre={t("traiterTitre")}
            message={t("traiterMessage", { objet: traitement?.objet ?? "" })}
            libelleConfirmation={t("traiter")}
            enCours={traiter.isPending}
          />
        </>
      ) : null}
    </div>
  );
}

function useSchemaEcheance() {
  const tm = useTranslations("metier");
  // Comparaison de chaînes `YYYY-MM-DDTHH:mm` : l'ordre lexical est l'ordre chronologique.
  return z.string().min(1, tm("champObligatoire")).refine((valeur) => valeur > maintenantLocal(), {
    message: tm("champObligatoire"),
  });
}

function ModaleCreation({
  dossierId,
  etapes,
  ouvert,
  onFermeture,
}: {
  dossierId: number;
  etapes: { id: number; libelle: string }[];
  ouvert: boolean;
  onFermeture: () => void;
}) {
  const t = useTranslations("audiences");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const creer = useCreerAlarme(dossierId);
  const echeance = useSchemaEcheance();

  const schema = useMemo(
    () =>
      z.object({
        etapeId: z.coerce.number().int().positive(tm("champObligatoire")),
        objet: z.string().trim().min(1, tm("champObligatoire")),
        dateEcheance: echeance,
      }),
    [tm, echeance],
  );
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema) });

  // Réinitialiser à l'ouverture seulement : `etapes` est recréé à chaque rendu du parent, et en
  // dépendre effaçait la saisie à chaque rechargement du dossier.
  const etapeParDefaut = etapes.at(-1)?.id;
  useEffect(() => {
    if (ouvert) reset({ etapeId: etapeParDefaut, objet: "", dateEcheance: "" });
  }, [ouvert, etapeParDefaut, reset]);

  const soumettre = handleSubmit(async (valeurs) => {
    try {
      await creer.mutateAsync({
        etapeId: Number(valeurs.etapeId),
        objet: valeurs.objet.trim(),
        dateEcheance: String(valeurs.dateEcheance),
      });
      toast.success(t("alarmeCreee"));
      onFermeture();
    } catch (erreur) {
      setError("root", { message: messageErreur(erreur) });
    }
  });

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={onFermeture}
      titre={t("creerAlarme")}
      description={t("creerAlarmeDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={creer.isPending}>
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
          <p role="alert" className="rounded border border-danger/40 bg-danger-fond px-4 py-3 text-[length:var(--taille-sm)] text-danger">
            {errors.root.message}
          </p>
        ) : null}
        <Champ id="alarme-etape" label={t("champEtape")} obligatoire erreur={errors.etapeId?.message}>
          <Select id="alarme-etape" enErreur={!!errors.etapeId} {...register("etapeId")}>
            {etapes.map((etape) => (
              <option key={etape.id} value={etape.id}>
                {etape.libelle}
              </option>
            ))}
          </Select>
        </Champ>
        <Champ id="alarme-objet" label={t("champObjet")} obligatoire erreur={errors.objet?.message}>
          <Input id="alarme-objet" enErreur={!!errors.objet} {...register("objet")} />
        </Champ>
        <Champ id="alarme-echeance" label={t("champEcheance")} obligatoire erreur={errors.dateEcheance?.message}>
          <Input
            id="alarme-echeance"
            type="datetime-local"
            min={maintenantLocal()}
            enErreur={!!errors.dateEcheance}
            {...register("dateEcheance")}
          />
        </Champ>
      </form>
    </Dialog>
  );
}

function ModaleReprogrammation({
  dossierId,
  alarme,
  onFermeture,
}: {
  dossierId: number;
  alarme: Alarme | null;
  onFermeture: () => void;
}) {
  const t = useTranslations("audiences");
  const tc = useTranslations("commun");
  const reprogrammer = useReprogrammerAlarme(dossierId);
  const echeance = useSchemaEcheance();

  const schema = useMemo(() => z.object({ objet: z.string().optional(), dateEcheance: echeance }), [echeance]);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<z.input<typeof schema>>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (alarme) reset({ objet: "", dateEcheance: "" });
  }, [alarme, reset]);

  const soumettre = handleSubmit(async (valeurs) => {
    if (!alarme) return;
    try {
      await reprogrammer.mutateAsync({
        alarmeId: alarme.id,
        // Vide : ne rien envoyer, le backend reprend l'objet de l'alarme précédente.
        reprogrammation: { objet: valeurs.objet?.trim() || undefined, dateEcheance: String(valeurs.dateEcheance) },
      });
      toast.success(t("alarmeReprogrammee"));
      onFermeture();
    } catch (erreur) {
      setError("root", { message: messageErreur(erreur) });
    }
  });

  return (
    <Dialog
      ouvert={alarme !== null}
      onFermeture={onFermeture}
      titre={t("reprogrammerTitre")}
      description={t("reprogrammerDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={reprogrammer.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void soumettre()} disabled={reprogrammer.isPending}>
            {t("reprogrammer")}
          </Button>
        </>
      }
    >
      <form onSubmit={soumettre} className="flex flex-col gap-4">
        {errors.root ? (
          <p role="alert" className="rounded border border-danger/40 bg-danger-fond px-4 py-3 text-[length:var(--taille-sm)] text-danger">
            {errors.root.message}
          </p>
        ) : null}
        <Champ id="reprog-echeance" label={t("champEcheance")} obligatoire erreur={errors.dateEcheance?.message}>
          <Input
            id="reprog-echeance"
            type="datetime-local"
            min={maintenantLocal()}
            enErreur={!!errors.dateEcheance}
            {...register("dateEcheance")}
          />
        </Champ>
        <Champ id="reprog-objet" label={t("champObjetFacultatif")}>
          <Input id="reprog-objet" placeholder={alarme?.objet} {...register("objet")} />
        </Champ>
      </form>
    </Dialog>
  );
}
