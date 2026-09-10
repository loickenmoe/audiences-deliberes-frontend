"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, type ChangeEvent } from "react";

import { DialogueConfirmation } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Champ, Select } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useModifierAffectation } from "@/hooks/useDossiers";
import { useIntervenants } from "@/hooks/useIntervenants";
import { useUtilisateurs } from "@/hooks/useReferentiels";
import { ErreurApi, messageErreur } from "@/lib/api/errors";
import type { Dossier } from "@/types/domaine";

function selection(evenement: ChangeEvent<HTMLSelectElement>): number[] {
  return Array.from(evenement.target.selectedOptions, (option) => Number(option.value));
}

/**
 * Écran 16 — modification des affectations.
 *
 * Deux comportements du backend à connaître :
 * · l'endpoint **remplace** les deux listes. Les sélections partent donc de l'affectation actuelle,
 *   sans quoi valider sans rien toucher retirerait tout le monde ;
 * · conserver une personne déjà affectée provoque un 409 `ERR-003`. Ce n'est pas une erreur mais
 *   une demande de confirmation (RG-DOS-07) : on la présente comme telle, puis on rejoue avec
 *   `?forcer=true` — et le backend alerte alors le DJ.
 *
 * Au moins un juriste et un avocat sont exigés, comme à la création. Le backend l'impose aussi
 * depuis M16 (Q-75, QF-25) ; le vérifier ici évite seulement un aller-retour pour une omission
 * visible.
 */
export function ModaleAffectation({
  dossier,
  ouvert,
  onFermeture,
}: {
  dossier: Dossier;
  ouvert: boolean;
  onFermeture: () => void;
}) {
  const t = useTranslations("fiche");
  const td = useTranslations("dossiers");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const juristes = useUtilisateurs("JURISTE");
  const avocats = useIntervenants("AVOCAT");
  const modifier = useModifierAffectation(dossier.id);

  const [juristesChoisis, setJuristesChoisis] = useState<number[]>(dossier.juristesAffectes);
  const [avocatsChoisis, setAvocatsChoisis] = useState<number[]>(dossier.avocatsAffectes);
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tentee, setTentee] = useState(false);

  // À chaque ouverture, repartir de l'affectation actuelle du dossier — qui a pu changer entre-temps.
  useEffect(() => {
    if (ouvert) {
      setJuristesChoisis(dossier.juristesAffectes);
      setAvocatsChoisis(dossier.avocatsAffectes);
      setErreur(null);
      setTentee(false);
    }
  }, [ouvert, dossier.juristesAffectes, dossier.avocatsAffectes]);

  const juristesManquants = juristesChoisis.length === 0;
  const avocatsManquants = avocatsChoisis.length === 0;

  async function enregistrer(forcer: boolean) {
    setErreur(null);
    try {
      await modifier.mutateAsync({
        affectation: { juristesAffectes: juristesChoisis, avocatsAffectes: avocatsChoisis },
        forcer,
      });
      setConfirmation(false);
      onFermeture();
    } catch (e) {
      if (e instanceof ErreurApi && e.demandeConfirmation) {
        setConfirmation(true);
        return;
      }
      setConfirmation(false);
      setErreur(messageErreur(e));
    }
  }

  function soumettre() {
    setTentee(true);
    if (juristesManquants || avocatsManquants) return;
    void enregistrer(false);
  }

  return (
    <>
      <Dialog
        ouvert={ouvert && !confirmation}
        onFermeture={onFermeture}
        titre={t("affectationTitre")}
        description={t("affectationDescription")}
        pied={
          <>
            <Button variante="secondaire" onClick={onFermeture} disabled={modifier.isPending}>
              {tc("annuler")}
            </Button>
            <Button onClick={soumettre} disabled={modifier.isPending}>
              {tc("enregistrer")}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {erreur ? (
            <p
              role="alert"
              className="rounded border border-danger/40 bg-danger-fond px-4 py-3 text-[length:var(--taille-sm)] text-danger"
            >
              {erreur}
            </p>
          ) : null}

          <Champ
            id="affectation-juristes"
            label={td("champJuristes")}
            obligatoire
            aide={td("aideSelectionMultiple")}
            erreur={tentee && juristesManquants ? tm("champObligatoire") : undefined}
          >
            <Select
              id="affectation-juristes"
              multiple
              size={5}
              enErreur={tentee && juristesManquants}
              value={juristesChoisis.map(String)}
              onChange={(evenement) => setJuristesChoisis(selection(evenement))}
            >
              {(juristes.data ?? []).map((utilisateur) => (
                <option key={utilisateur.id} value={utilisateur.id}>
                  {[utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") ||
                    utilisateur.email ||
                    `#${utilisateur.id}`}
                </option>
              ))}
            </Select>
          </Champ>

          <Champ
            id="affectation-avocats"
            label={td("champAvocats")}
            obligatoire
            aide={td("aideSelectionMultiple")}
            erreur={tentee && avocatsManquants ? tm("champObligatoire") : undefined}
          >
            <Select
              id="affectation-avocats"
              multiple
              size={5}
              enErreur={tentee && avocatsManquants}
              value={avocatsChoisis.map(String)}
              onChange={(evenement) => setAvocatsChoisis(selection(evenement))}
            >
              {(avocats.data ?? []).map((avocat) => (
                <option key={avocat.id} value={avocat.id}>
                  {avocat.nom}
                </option>
              ))}
            </Select>
          </Champ>
        </div>
      </Dialog>

      <DialogueConfirmation
        ouvert={ouvert && confirmation}
        onFermeture={() => setConfirmation(false)}
        onConfirmation={() => void enregistrer(true)}
        titre={t("doublonTitre")}
        message={t("doublonMessage")}
        enCours={modifier.isPending}
      />
    </>
  );
}
