"use client";

import { Eye, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { SelecteurDossier } from "@/components/modules/portail/selecteur-dossier";
import { GardeSaisie, Televersement } from "@/components/metier";
import { ApercuFichier } from "@/components/metier/apercu-fichier";
import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { useDeposerFrais } from "@/hooks/usePortailAvocat";
import { ErreurApi, messageErreur } from "@/lib/api/errors";
import { gedService } from "@/services/gedService";
import { portailAvocatService, type PieceJustificative } from "@/services/portailAvocatService";

/**
 * Parses a manually typed amount into a number.
 *
 * Users type amounts with spaces ("12 000"), as the application displays them. Three kinds of space
 * are removed: regular, non-breaking (U+00A0) and narrow non-breaking (U+202F), the latter two
 * arriving through copy-paste. A decimal comma is accepted and converted, since `Number("12,5")`
 * is `NaN`.
 */
export function normaliserMontant(saisie: string): string {
  return saisie.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
}

/**
 * Screen 30 - expense request submission by the lawyer (US 4.1).
 *
 * Supporting documents are real files (UC-INT-01 step 4): each file is uploaded as soon as it is
 * chosen and its storage key is sent with the request, so the Assistant can open it for the
 * compliance check (UC-INT-02 step 3).
 * `referenceFacture` is unique: a duplicate returns 409 `ERR-006` naming the field, shown on that
 * field instead of a generic banner.
 */
export function FormulaireFrais() {
  const t = useTranslations("portail");
  const tdoc = useTranslations("documents");
  const router = useRouter();
  const deposer = useDeposerFrais();

  const [dossierId, setDossierId] = useState<number | null>(null);
  const [montant, setMontant] = useState("");
  const [referenceFacture, setReferenceFacture] = useState("");
  const [pieces, setPieces] = useState<PieceJustificative[]>([]);
  const [apercu, setApercu] = useState<PieceJustificative | null>(null);
  const [envoiPiece, setEnvoiPiece] = useState(false);
  const [erreurChamp, setErreurChamp] = useState<{ champ: string; message: string } | null>(null);
  /** Fields left empty or unreadable, reported after a submission attempt. */
  const [manques, setManques] = useState<Record<string, string>>({});

  const montantNormalise = normaliserMontant(montant);
  const montantValide = /^\d+(\.\d+)?$/.test(montantNormalise) && Number(montantNormalise) > 0;

  /** The document shown by the upload component, which the adjacent preview button opens. */
  const derniere = pieces.length > 0 ? pieces[pieces.length - 1]! : null;

  /**
   * The upload component's remove button removes the document it shows, so it is not sent with
   * the request.
   */
  function retirerDerniere() {
    setPieces((precedentes) => precedentes.slice(0, -1));
  }

  /**
   * Each document is uploaded as soon as it is chosen: a batch upload on submit would lose everything
   * if one failed, without telling the lawyer which one.
   */
  async function ajouterPiece(fichier: File | null) {
    if (!fichier) return;
    setEnvoiPiece(true);
    try {
      const piece = await portailAvocatService.deposerPieceJustificative(fichier);
      setPieces((precedentes) => [...precedentes, piece]);
    } catch (erreur) {
      toast.error(messageErreur(erreur));
    } finally {
      setEnvoiPiece(false);
    }
  }

  /**
   * What is missing, named field by field. The submit button is not disabled for incompleteness:
   * the form accepts the attempt and points out what is missing, like the case file creation form.
   */
  function manquants(): Record<string, string> {
    const problemes: Record<string, string> = {};
    if (dossierId === null) problemes.dossierId = t("fraisDossierManquant");
    if (referenceFacture.trim() === "") problemes.referenceFacture = t("fraisReferenceManquante");
    if (montant.trim() === "") problemes.montant = t("fraisMontantManquant");
    // An amount entered but unreadable is a different error from a missing one: the message says so
    // and states the accepted format.
    else if (!montantValide) problemes.montant = t("fraisMontantInvalide");
    if (pieces.length === 0) problemes.pieces = t("fraisPiecesManquantes");
    return problemes;
  }

  function soumettre() {
    const problemes = manquants();
    if (Object.keys(problemes).length > 0) {
      setManques(problemes);
      return;
    }
    if (dossierId === null) return;
    setManques({});
    setErreurChamp(null);
    deposer.mutate(
      {
        dossierId,
        montant: Number(montantNormalise),
        piecesJustificatives: pieces.map((piece) => piece.cle),
        referenceFacture: referenceFacture.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t("fraisDeposes"));
          router.push("/frais");
        },
        onError: (erreur) => {
          // The backend names the faulty field when there is one: the message goes under that control,
          // not in a banner.
          const champ = erreur instanceof ErreurApi ? erreur.champ : null;
          if (champ) setErreurChamp({ champ, message: messageErreur(erreur) });
          else toast.error(messageErreur(erreur));
        },
      },
    );
  }

  // `Champ` displays the message; `Input` carries `aria-invalid` through `enErreur`. Both are needed:
  // a red border alone means nothing to a screen reader.
  const erreurDe = (champ: string) =>
    erreurChamp?.champ === champ ? erreurChamp.message : manques[champ];

  /** Editing a field clears its error. */
  function oublier(champ: string) {
    setManques((precedents) => {
      if (!(champ in precedents)) return precedents;
      const suite = { ...precedents };
      delete suite[champ];
      return suite;
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("fraisTitre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("fraisDescription")}</p>
      </header>

      <div className="flex max-w-2xl flex-col gap-4 rounded-lg border border-bordure bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <SelecteurDossier
            valeur={dossierId}
            onChangement={(choisi) => {
              setDossierId(choisi);
              oublier("dossierId");
            }}
            id="frais-dossier"
          />
          {erreurDe("dossierId") ? (
            <p role="alert" className="text-[length:var(--taille-xs)] text-danger">
              {erreurDe("dossierId")}
            </p>
          ) : null}
        </div>

        <Champ
          id="frais-reference"
          label={t("referenceFacture")}
          aide={t("referenceFactureAide")}
          erreur={erreurDe("referenceFacture")}
          obligatoire
          className="max-w-sm"
        >
          <Input
            id="frais-reference"
            name="referenceFacture"
            required
            enErreur={erreurDe("referenceFacture") !== undefined}
            value={referenceFacture}
            onChange={(evenement) => {
              setReferenceFacture(evenement.target.value);
              oublier("referenceFacture");
            }}
          />
        </Champ>

        <Champ
          id="frais-montant"
          label={t("montant")}
          aide={t("montantAide")}
          erreur={erreurDe("montant")}
          obligatoire
          className="max-w-xs"
        >
          <Input
            id="frais-montant"
            placeholder={t("phFraisMontant")}
            name="montant"
            inputMode="numeric"
            required
            enErreur={erreurDe("montant") !== undefined}
            value={montant}
            onChange={(evenement) => {
              setMontant(evenement.target.value);
              oublier("montant");
            }}
          />
        </Champ>

        {/*
          `min-w-0` on the fieldset is required: browsers give fieldsets `min-inline-size: min-content`,
          so with a long file name it would overflow and scroll the whole page horizontally on mobile.
        */}
        <fieldset className="flex min-w-0 flex-col gap-2">
          {/*
            The asterisk is outside the legend text, decorative and `aria-hidden`, like in `Champ`, so the
            accessible name does not become "Pièces justificatives*". A hidden `<input type="file">` cannot
            carry `required` without triggering native browser validation (same choice as case file creation).
          */}
          <legend className="flex items-center gap-0.5 text-[length:var(--taille-sm)] font-medium">
            {t("pieces")}
            <span aria-hidden className="text-danger">
              *
            </span>
          </legend>
          <p className="max-w-prose text-[length:var(--taille-xs)] text-texte-tertiaire">
            {t("piecesAide")}
          </p>

          {/*
            Upload and loaded documents on the same line, as in the case file creation form, so the preview
            button stays next to the chosen file. `flex-wrap` wraps beyond two or three documents.
          */}
          {/*
            The row does not wrap: the upload block shrinks (`min-w-0 flex-1`) and truncates its file name,
            while the preview button keeps its place (`shrink-0`). The full name is available on hover and
            in the preview's accessible name.
          */}
          <div className="flex items-center gap-3">
            {/*
              The component performs its own format and size checks (RG-GED-08) and shows the chosen file
              (name, size, remove button), so only a preview button is needed next to it.
              Its remove button really removes the document: the file is already in the DMS once chosen, so
              it must be removed from the request here.
            */}
            <Televersement
              className="min-w-0 flex-1"
              surUneLigne
              nom="piece-justificative"
              label={t("piecesFichier")}
              onChangement={(fichier) => {
                if (fichier === null) retirerDerniere();
                else void ajouterPiece(fichier);
                oublier("pieces");
              }}
            />

            {/*
              Preview button on the same line as the upload. It opens the last uploaded document, the one
              shown next to it; earlier ones are previewed in the list below. Reviewing before sending avoids
              having to submit a new request to replace a wrong document.
            */}
            {derniere ? (
              <Button
                variante="secondaire"
                taille="sm"
                className="shrink-0"
                aria-label={`${tdoc("consulter")} - ${derniere.nomFichier}`}
                onClick={() => setApercu(derniere)}
              >
                <Eye size={14} aria-hidden />
                {tdoc("apercu")}
              </Button>
            ) : null}
          </div>

          {/*
            Documents uploaded before the last one. The upload component shows only one at a time; without
            this list, earlier documents would be sent without the lawyer being able to review or remove them.
          */}
          {pieces.length > 1 ? (
            <ul className="flex flex-col gap-1">
              {pieces.slice(0, -1).map((piece, index) => (
                <li
                  key={piece.cle}
                  className="flex items-center justify-between gap-2 rounded border border-bordure bg-fond px-3 py-1.5"
                >
                  <span className="truncate text-[length:var(--taille-sm)]">{piece.nomFichier}</span>
                  <span className="flex items-center gap-1">
                    <Button
                      variante="discrete"
                      taille="sm"
                      aria-label={`${tdoc("consulter")} - ${piece.nomFichier}`}
                      onClick={() => setApercu(piece)}
                    >
                      <Eye size={14} aria-hidden />
                    </Button>
                    <Button
                      variante="discrete"
                      taille="sm"
                      aria-label={t("retirerPiece", { numero: index + 1 })}
                      onClick={() => setPieces((precedentes) => precedentes.filter((p) => p.cle !== piece.cle))}
                    >
                      <X size={14} aria-hidden />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {envoiPiece ? (
            <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("envoiPiece")}</p>
          ) : null}
          {erreurDe("pieces") ? (
            <p role="alert" className="text-[length:var(--taille-xs)] text-danger">
              {erreurDe("pieces")}
            </p>
          ) : null}
        </fieldset>

        <div className="flex items-center gap-2">
          {/*
            Disabled only while sending, not for incompleteness: the attempt is accepted and what is
            missing is named field by field.
          */}
          <Button onClick={soumettre} disabled={deposer.isPending || envoiPiece}>
            {deposer.isPending ? t("envoiEnCours") : t("deposer")}
          </Button>
          <Button variante="discrete" data-garde-saisie="ignorer" onClick={() => router.push("/frais")}>
            {t("annuler")}
          </Button>
        </div>
      </div>

      {apercu ? (
        <ApercuFichier
          ouvert
          onFermeture={() => setApercu(null)}
          nomFichier={apercu.nomFichier}
          obtenir={() => gedService.recupererContenu(apercu.urlTelechargement)}
        />
      ) : null}

      {/* Documents are already uploaded: leaving the screen would lose their link with the request. */}
      <GardeSaisie
        actif={
          !deposer.isPending &&
          (dossierId !== null || montant !== "" || referenceFacture !== "" || pieces.length > 0)
        }
      />
    </div>
  );
}
