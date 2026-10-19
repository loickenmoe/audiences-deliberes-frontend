"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Eye } from "lucide-react";

import { GardeSaisie, Televersement } from "@/components/metier";
import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { SelecteurDossier } from "@/components/modules/portail/selecteur-dossier";
import { Button } from "@/components/ui/button";
import { Champ, Select, Textarea } from "@/components/ui/champ";
import { useAudiencesDeMonDossier, useDeposerAutrePublication, useDeposerCompteRendu } from "@/hooks/usePortailAvocat";
import { messageErreur } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { TypeAutrePublication } from "@/types/enums";

type Nature = "compteRendu" | "document";

const NATURES: Nature[] = ["compteRendu", "document"];

/**
 * Screen 33 - publication submission by the lawyer.
 *
 * One form, two kinds of submission, shown side by side with the sentence that distinguishes them.
 * They differ by purpose, not format: a hearing report relates a hearing (linked to a hearing,
 * validated as a narrative, optional attachment), a document is transmitted for the case file.
 * The choice is explicit rather than inferred from the fields: inference would hide a rule and
 * leave several invalid field combinations unexplained.
 */
export function FormulairePublication() {
  const t = useTranslations("portail");
  const tdoc = useTranslations("documents");
  const td = useTranslations("domaine");
  const router = useRouter();

  const [nature, setNature] = useState<Nature>("compteRendu");
  const [dossierId, setDossierId] = useState<number | null>(null);
  const [audienceId, setAudienceId] = useState<number | null>(null);
  const [contenu, setContenu] = useState("");
  const [typeDocument, setTypeDocument] = useState<(typeof TypeAutrePublication)[number]>("PIECE");
  const [fichier, setFichier] = useState<File | null>(null);
  const [apercu, setApercu] = useState(false);

  const audiences = useAudiencesDeMonDossier(nature === "compteRendu" ? dossierId : null);
  const deposerCompteRendu = useDeposerCompteRendu();
  const deposerAutre = useDeposerAutrePublication();
  const enCours = deposerCompteRendu.isPending || deposerAutre.isPending;

  function changerDossier(nouveau: number | null) {
    setDossierId(nouveau);
    // The hearing belongs to the case file: keeping it when changing case file would cause a 404.
    setAudienceId(null);
  }

  /*
   * Each kind has its own `Televersement` with internal state: keeping the file when switching kind
   * would leave the button enabled while the displayed field is empty. Reset to no file, which is
   * what the new field already shows.
   */
  function changerNature(nouvelle: Nature) {
    setNature(nouvelle);
    setFichier(null);
  }

  /** A hearing report requires a hearing and a text; a document requires a file. The report's attachment is optional. */
  const complet =
    dossierId !== null &&
    (nature === "compteRendu" ? audienceId !== null && contenu.trim() !== "" : fichier !== null);

  function soumettre() {
    if (!complet || dossierId === null) return;
    const apres = {
      onSuccess: () => {
        // The two kinds are handled differently (amended RG-INT-06): a hearing report is readable by the
        // case file's legal officers immediately, a document awaits validation. Hence two messages.
        toast.success(t(nature === "compteRendu" ? "compteRenduDepose" : "publicationDeposee"));
        router.push("/portail");
      },
      onError: (erreur: unknown) => toast.error(messageErreur(erreur)),
    };

    if (nature === "compteRendu" && audienceId !== null) {
      deposerCompteRendu.mutate({ dossierId, audienceId, contenu: contenu.trim(), fichier }, apres);
    } else if (fichier) {
      deposerAutre.mutate({ dossierId, typeDocument, fichier }, apres);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
          {t("publicationTitre")}
        </h1>
        <p className="max-w-prose text-texte-secondaire">{t("publicationDescription")}</p>
      </header>

      <div className="flex max-w-2xl flex-col gap-5 rounded-lg border border-bordure bg-surface p-4">
        <SelecteurDossier valeur={dossierId} onChangement={changerDossier} id="publication-dossier" />

        {/*
          Two described options rather than two tabs: the lawyer reads what separates them before
          choosing. `fieldset`/`legend` name the group and each description is linked to its option
          through `aria-describedby`.
        */}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[length:var(--taille-sm)] font-medium">{t("natureDepot")}</legend>
          <div className="flex flex-col gap-2">
            {NATURES.map((valeur) => (
              <label
                key={valeur}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded border p-3 transition-colors",
                  valeur === nature
                    ? "border-anthracite bg-surface-attenuee"
                    : "border-bordure hover:bg-surface-attenuee",
                )}
              >
                <input
                  type="radio"
                  name="nature-depot"
                  value={valeur}
                  checked={valeur === nature}
                  onChange={() => changerNature(valeur)}
                  aria-describedby={`nature-${valeur}-aide`}
                  className="mt-0.5 size-4 accent-[color:var(--afb-anthracite)]"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-[length:var(--taille-sm)] font-medium">
                    {t(`natures.${valeur}.titre` as never)}
                  </span>
                  <span
                    id={`nature-${valeur}-aide`}
                    className="text-[length:var(--taille-xs)] text-texte-tertiaire"
                  >
                    {t(`natures.${valeur}.aide` as never)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {nature === "compteRendu" ? (
          <>
            <Champ
              id="publication-audience"
              label={t("audience")}
              aide={dossierId === null ? t("audienceAide") : undefined}
              obligatoire
              className="max-w-md"
            >
              <Select
                id="publication-audience"
                required
                disabled={dossierId === null || audiences.isLoading}
                value={audienceId ?? ""}
                onChange={(evenement) =>
                  setAudienceId(evenement.target.value === "" ? null : Number(evenement.target.value))
                }
              >
                <option value="">{t("choisirAudience")}</option>
                {(audiences.data ?? []).map((audience) => (
                  <option key={audience.id} value={audience.id}>
                    {audience.datePlanifiee} - {td(`StatutAudience.${audience.statut}` as never)}
                  </option>
                ))}
              </Select>
            </Champ>

            {dossierId !== null && !audiences.isLoading && (audiences.data ?? []).length === 0 ? (
              <p className="max-w-prose text-[length:var(--taille-sm)] text-texte-secondaire">
                {t("aucuneAudience")}
              </p>
            ) : null}

            <Champ id="publication-contenu" label={t("contenu")} obligatoire className="max-w-2xl">
              <Textarea
                id="publication-contenu"
                placeholder={t("phPublicationContenu")}
                name="contenu"
                rows={8}
                required
                value={contenu}
                onChange={(evenement) => setContenu(evenement.target.value)}
              />
            </Champ>

            {/* Optional document supporting the report; the report itself remains a text. */}
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[length:var(--taille-sm)] font-medium">{t("pieceJointe")}</p>
              <p className="max-w-prose text-[length:var(--taille-xs)] text-texte-tertiaire">
                {t("pieceJointeAide")}
              </p>
              {/*
                Upload and preview button on a single line, as in the expense form: the block shrinks and
                truncates its file name (readable on hover) while the button keeps its place.
                `min-w-0` on the row and on its container: a flex item has `min-width: auto` and would refuse to
                shrink below its content, scrolling the page horizontally on a phone with a long file name.
              */}
              <div className="flex min-w-0 items-center gap-3">
                <Televersement
                  className="min-w-0 flex-1"
                  surUneLigne
                  nom="piece-jointe"
                  label={t("pieceJointe")}
                  onChangement={setFichier}
                />
                <BoutonRelire fichier={fichier} onOuverture={() => setApercu(true)} libelle={tdoc("consulter")} />
              </div>
            </div>
          </>
        ) : (
          <>
            <Champ id="publication-type" label={t("typeDocument")} obligatoire className="max-w-sm">
              <Select
                id="publication-type"
                required
                value={typeDocument}
                onChange={(evenement) =>
                  setTypeDocument(evenement.target.value as (typeof TypeAutrePublication)[number])
                }
              >
                {TypeAutrePublication.map((valeur) => (
                  <option key={valeur} value={valeur}>
                    {td(`TypeAutrePublication.${valeur}` as never)}
                  </option>
                ))}
              </Select>
            </Champ>

            {/* Same layout as the hearing report's attachment above. */}
            <div className="flex min-w-0 items-center gap-3">
              <Televersement
                className="min-w-0 flex-1"
                surUneLigne
                nom="fichier"
                label={t("fichier")}
                onChangement={setFichier}
              />
              <BoutonRelire fichier={fichier} onOuverture={() => setApercu(true)} libelle={tdoc("consulter")} />
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={soumettre} disabled={!complet || enCours}>
            {enCours ? t("envoiEnCours") : t(`natures.${nature}.action` as never)}
          </Button>
          <Button variante="discrete" data-garde-saisie="ignorer" onClick={() => router.back()}>
            {t("annuler")}
          </Button>
        </div>
      </div>

      {/*
        Review the file before submitting. It has not been sent yet: the preview reads it from browser
        memory, without a server round trip. A submitted publication cannot be corrected, only resubmitted.
      */}
      {apercu && fichier ? (
        <ApercuFichier
          ouvert
          onFermeture={() => setApercu(false)}
          nomFichier={fichier.name}
          obtenir={() => Promise.resolve(fichier)}
        />
      ) : null}

      {/* A hearing report is a narrative: losing it means rewriting it. */}
      <GardeSaisie
        actif={!enCours && (dossierId !== null || contenu.trim() !== "" || fichier !== null)}
      />
    </div>
  );
}

/**
 * The preview button, shown only when a file is chosen. Rendered without a wrapping `<div>` so it
 * stays on the upload row, with `shrink-0` so a long file name does not compress it.
 */
function BoutonRelire({
  fichier,
  onOuverture,
  libelle,
}: {
  fichier: File | null;
  onOuverture: () => void;
  libelle: string;
}) {
  if (!fichier) return null;
  return (
    <Button
      variante="secondaire"
      taille="sm"
      className="shrink-0"
      onClick={onOuverture}
      aria-label={`${libelle} - ${fichier.name}`}
    >
      <Eye size={14} aria-hidden />
      {libelle}
    </Button>
  );
}
