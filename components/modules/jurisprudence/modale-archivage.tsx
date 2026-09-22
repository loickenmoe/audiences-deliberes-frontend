"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Televersement } from "@/components/metier/televersement";
import { Button } from "@/components/ui/button";
import { Champ, Input, Select } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useArchiverJurisprudence } from "@/hooks/useDecisions";
import { messageErreur } from "@/lib/api/errors";
import { decouperMotsCles } from "@/services/decisionService";
import { TypeArchiveJurisprudence } from "@/types/enums";

type Erreurs = Partial<Record<"fichier" | "typeArchive" | "motsCles" | "natureDecision" | "juridiction" | "dateDecision" | "general", string>>;

/**
 * UC-DEF-03 — archiver une décision de justice : le PDF (10 Mo au plus) et son indexation, toute
 * obligatoire (RG-DEF-05). Ouverte depuis la fiche, la décision est rattachée au dossier ; depuis la
 * base jurisprudentielle, elle peut ne l'être à aucun (Q-58 backend).
 */
export function ModaleArchivage({
  dossierId,
  ouvert,
  onFermeture,
}: {
  dossierId?: number;
  ouvert: boolean;
  onFermeture: () => void;
}) {
  const t = useTranslations("jurisprudence");
  const tc = useTranslations("commun");
  const tm = useTranslations("metier");
  const td = useTranslations("domaine");
  const archiver = useArchiverJurisprudence();
  const [fichier, setFichier] = useState<File | null>(null);
  const [typeArchive, setTypeArchive] = useState("");
  const [motsCles, setMotsCles] = useState("");
  const [natureDecision, setNatureDecision] = useState("");
  const [juridiction, setJuridiction] = useState("");
  const [dateDecision, setDateDecision] = useState("");
  const [erreurs, setErreurs] = useState<Erreurs>({});
  // Le composant de téléversement garde son propre état : on le recrée à chaque ouverture.
  const [cleFormulaire, setCleFormulaire] = useState(0);

  useEffect(() => {
    if (ouvert) {
      setFichier(null);
      setTypeArchive("");
      setMotsCles("");
      setNatureDecision("");
      setJuridiction("");
      setDateDecision("");
      setErreurs({});
      setCleFormulaire((n) => n + 1);
    }
  }, [ouvert]);

  async function soumettre() {
    const liste = decouperMotsCles(motsCles);
    const obligatoire = tm("champObligatoire");
    const suivantes: Erreurs = {
      fichier: fichier ? undefined : t("fichierObligatoire"),
      typeArchive: typeArchive ? undefined : obligatoire,
      motsCles: liste.length > 0 ? undefined : obligatoire,
      natureDecision: natureDecision.trim() ? undefined : obligatoire,
      juridiction: juridiction.trim() ? undefined : obligatoire,
      dateDecision: dateDecision ? undefined : obligatoire,
    };
    setErreurs(suivantes);
    if (Object.values(suivantes).some(Boolean) || !fichier) return;
    try {
      await archiver.mutateAsync({
        indexation: {
          dossierId,
          typeArchive: typeArchive as TypeArchiveJurisprudence,
          motsCles: liste,
          natureDecision: natureDecision.trim(),
          juridiction: juridiction.trim(),
          dateDecision,
        },
        fichier,
      });
      toast.success(t("archivee"));
      onFermeture();
    } catch (e) {
      setErreurs({ general: messageErreur(e) });
    }
  }

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={onFermeture}
      titre={t("archiverTitre")}
      description={t("archiverDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={archiver.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void soumettre()} disabled={archiver.isPending}>
            {t("archiver")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Champ id="fichier-jurisprudence" label={t("champFichier")} obligatoire erreur={erreurs.fichier}>
          <Televersement key={cleFormulaire} nom="fichier-jurisprudence" formatsAcceptes={["pdf"]} onChangement={setFichier} />
        </Champ>
        <Champ id="type-archive" label={t("champTypeArchive")} obligatoire erreur={erreurs.typeArchive}>
          <Select id="type-archive" value={typeArchive} onChange={(e) => setTypeArchive(e.target.value)}>
            <option value="">{t("choisirType")}</option>
            {TypeArchiveJurisprudence.map((valeur) => (
              <option key={valeur} value={valeur}>
                {td(`TypeArchiveJurisprudence.${valeur}` as never)}
              </option>
            ))}
          </Select>
        </Champ>
        <Champ id="mots-cles" label={t("champMotsCles")} obligatoire aide={t("motsClesAide")} erreur={erreurs.motsCles}>
          <Input id="mots-cles" value={motsCles} onChange={(e) => setMotsCles(e.target.value)} />
        </Champ>
        <Champ id="nature-decision" label={t("champNature")} obligatoire erreur={erreurs.natureDecision}>
          <Input id="nature-decision" maxLength={50} value={natureDecision} onChange={(e) => setNatureDecision(e.target.value)} />
        </Champ>
        <Champ id="juridiction-decision" label={t("champJuridiction")} obligatoire erreur={erreurs.juridiction}>
          <Input id="juridiction-decision" maxLength={100} value={juridiction} onChange={(e) => setJuridiction(e.target.value)} />
        </Champ>
        <Champ id="date-decision-jurisprudence" label={t("champDate")} obligatoire erreur={erreurs.dateDecision}>
          <Input id="date-decision-jurisprudence" type="date" value={dateDecision} onChange={(e) => setDateDecision(e.target.value)} />
        </Champ>
        {erreurs.general ? <p role="alert" className="text-[length:var(--taille-sm)] text-danger">{erreurs.general}</p> : null}
      </div>
    </Dialog>
  );
}
