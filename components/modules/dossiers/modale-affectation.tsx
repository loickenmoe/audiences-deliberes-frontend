"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { CasesACocher, DialogueConfirmation, SelecteurCherchable } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useModifierAffectation } from "@/hooks/useDossiers";
import { useIntervenants } from "@/hooks/useIntervenants";
import { useUtilisateurs } from "@/hooks/useReferentiels";
import { ErreurApi, messageErreur } from "@/lib/api/errors";
import type { Dossier } from "@/types/domaine";

/**
 * Screen 16 - assignment editing.
 * The endpoint **replaces** both lists, so selections start from the current assignment; otherwise
 * saving without changes would remove everyone.
 * Keeping an already assigned person returns a 409 `ERR-003`: a confirmation request (RG-DOS-07),
 * presented as such, then replayed with `?forcer=true`, after which the backend alerts the DJ.
 * At least one lawyer and one counsel are required, as at creation; the backend also enforces it.
 */
export function ModaleAffectation({
  dossier,
  ouvert,
  onFermeture,
}: Readonly<{
  dossier: Dossier;
  ouvert: boolean;
  onFermeture: () => void;
}>) {
  const t = useTranslations("fiche");
  const td = useTranslations("dossiers");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const juristes = useUtilisateurs("JURISTE");
  /*
   * Server-side search instead of loading the whole directory: the field only shows what the server
   * returns for the current input, so the choice stays exact whatever the number of counsel.
   */
  const [rechercheAvocat, setRechercheAvocat] = useState("");
  const avocats = useIntervenants({ type: "AVOCAT", nom: rechercheAvocat || undefined });
  const modifier = useModifierAffectation(dossier.id);

  const [juristesChoisis, setJuristesChoisis] = useState<number[]>(dossier.juristesAffectes);
  const [avocatsChoisis, setAvocatsChoisis] = useState<number[]>(dossier.avocatsAffectes);
  const [confirmation, setConfirmation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tentee, setTentee] = useState(false);

  // On each opening, start again from the case's current assignment, which may have changed.
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

          {/* Same checkboxes as at creation: one click adds or removes. */}
          <CasesACocher
            label={td("champJuristes")}
            obligatoire
            valeur={juristesChoisis}
            onChangement={setJuristesChoisis}
            chargement={juristes.isLoading}
            erreur={tentee && juristesManquants ? tm("champObligatoire") : undefined}
            options={(juristes.data ?? []).map((utilisateur) => ({
              id: utilisateur.id,
              libelle:
                [utilisateur.prenom, utilisateur.nom].filter(Boolean).join(" ") ||
                utilisateur.email ||
                `#${utilisateur.id}`,
            }))}
          />

          <div className="flex flex-col gap-1">
            <SelecteurCherchable
              id="affectation-avocats"
              label={td("champAvocats")}
              obligatoire
              multiple
              valeur={avocatsChoisis}
              onChangement={(valeur) => setAvocatsChoisis(valeur as number[])}
              options={(avocats.data?.content ?? []).map((avocat) => ({
                id: avocat.id,
                libelle: avocat.nom,
              }))}
              onRecherche={setRechercheAvocat}
              chargement={avocats.isLoading}
            />
            {tentee && avocatsManquants ? (
              <p className="text-[length:var(--taille-xs)] text-danger">{tm("champObligatoire")}</p>
            ) : null}
          </div>
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
