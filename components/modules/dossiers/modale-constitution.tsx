"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Champ, Select, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useSolliciterConstitution } from "@/hooks/useConstitutions";
import { TAILLE_ANNUAIRE } from "@/hooks/const";
import { useIntervenants } from "@/hooks/useIntervenants";
import { messageErreur } from "@/lib/api/errors";

/**
 * UC-INT-05 - from the case page, the lawyer requests the representation of a service provider
 * (counsel or other); the request awaits the line manager's second signature (RG-INT-08). Assigning
 * a counsel to the case and appointing them are two separate procedures.
 * Saving chains into letter drafting: the created request is passed to `onSollicitee` so the caller
 * opens the letter directly (the backend creates the letter with the request, without a number).
 */
export function ModaleConstitution({
  dossierId,
  ouvert,
  onFermeture,
  onSollicitee,
}: Readonly<{
  dossierId: number;
  ouvert: boolean;
  onFermeture: () => void;
  /** The saved request, used to chain into drafting its letter. */
  onSollicitee?: (demandeId: number) => void;
}>) {
  const t = useTranslations("constitutions");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const td = useTranslations("domaine");
  const intervenants = useIntervenants({ size: TAILLE_ANNUAIRE });
  const solliciter = useSolliciterConstitution();
  const [prestataireId, setPrestataireId] = useState("");
  const [motif, setMotif] = useState("");
  const [erreurs, setErreurs] = useState<{ prestataire?: string; motif?: string; general?: string }>({});

  useEffect(() => {
    if (ouvert) {
      setPrestataireId("");
      setMotif("");
      setErreurs({});
    }
  }, [ouvert]);

  async function soumettre() {
    const suivantes = {
      prestataire: prestataireId ? undefined : tm("champObligatoire"),
      motif: motif.trim() ? undefined : tm("champObligatoire"),
    };
    setErreurs(suivantes);
    if (suivantes.prestataire || suivantes.motif) return;
    try {
      const demande = await solliciter.mutateAsync({
        dossierId,
        prestataireId: Number(prestataireId),
        motif: motif.trim(),
      });
      toast.success(t("sollicitee"));
      onFermeture();
      // The save is done: drafting can open, and its failure would not undo it. That is why the
      // chaining comes **after** `onFermeture`, outside the `try`.
      onSollicitee?.(demande.id);
    } catch (e) {
      setErreurs({ general: messageErreur(e) });
    }
  }

  const liste = intervenants.data?.content ?? [];

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={onFermeture}
      titre={t("solliciterTitre")}
      description={t("solliciterDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={solliciter.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void soumettre()} disabled={solliciter.isPending || liste.length === 0}>
            {t("soumettre")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!intervenants.isLoading && liste.length === 0 ? (
          <p className="text-[length:var(--taille-sm)] text-texte-secondaire">{t("aucunPrestataire")}</p>
        ) : (
          <Champ id="prestataire-constitution" label={t("champPrestataire")} obligatoire erreur={erreurs.prestataire}>
            <Select
              id="prestataire-constitution"
              value={prestataireId}
              enErreur={!!erreurs.prestataire}
              onChange={(evenement) => setPrestataireId(evenement.target.value)}
            >
              <option value="">{t("choisirPrestataire")}</option>
              {liste.map((intervenant) => (
                <option key={intervenant.id} value={intervenant.id}>
                  {intervenant.nom} - {td(`TypeIntervenant.${intervenant.type}` as never)}
                </option>
              ))}
            </Select>
          </Champ>
        )}
        <Champ id="motif-constitution" label={t("champMotif")} obligatoire erreur={erreurs.motif}>
          <Textarea
            id="motif-constitution"
            placeholder={t("phMotifDemande")}
            rows={4}
            enErreur={!!erreurs.motif}
            value={motif}
            onChange={(evenement) => setMotif(evenement.target.value)}
          />
        </Champ>
        {erreurs.general ? <p role="alert" className="text-[length:var(--taille-sm)] text-danger">{erreurs.general}</p> : null}
      </div>
    </Dialog>
  );
}
