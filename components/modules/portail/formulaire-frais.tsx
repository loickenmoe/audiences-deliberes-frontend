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
 * Écran 30 — dépôt d'une demande de frais par l'avocat (#23, US 4.1).
 *
 * **Les pièces justificatives sont de vrais fichiers** (QF-26, corrigée par le backend Q-97) :
 * UC-INT-01 étape 4 dit que « l'avocat **charge** les pièces justificatives », et le dictionnaire
 * décrit `pieces_justificatives` comme des « chemins ou références ». Chaque fichier part dès qu'il
 * est choisi, et c'est sa **clé de stockage** qui accompagne la demande — l'Assistante peut ensuite
 * l'ouvrir pour contrôler la conformité (UC-INT-02 étape 3).
 *
 * `referenceFacture` est unique : un doublon revient en 409 `ERR-006` en nommant le champ, que l'on
 * repose sur le contrôle concerné au lieu d'un bandeau générique.
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

  const montantValide = /^\d+(\.\d+)?$/.test(montant) && Number(montant) > 0;
  const complet = dossierId !== null && montantValide && referenceFacture.trim() !== "" && pieces.length > 0;

  /**
   * Chaque pièce part **dès qu'elle est choisie** : un envoi groupé à la soumission ferait tout
   * reperdre si une seule échouait, et l'avocat ne saurait pas laquelle.
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

  function soumettre() {
    if (!complet || dossierId === null) return;
    setErreurChamp(null);
    deposer.mutate(
      {
        dossierId,
        montant: Number(montant),
        piecesJustificatives: pieces.map((piece) => piece.cle),
        referenceFacture: referenceFacture.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t("fraisDeposes"));
          router.push("/frais");
        },
        onError: (erreur) => {
          // Le backend nomme le champ fautif quand il y en a un (QF-21) : le message va sous le
          // contrôle concerné, pas dans un bandeau que l'avocat devrait interpréter.
          const champ = erreur instanceof ErreurApi ? erreur.champ : null;
          if (champ) setErreurChamp({ champ, message: messageErreur(erreur) });
          else toast.error(messageErreur(erreur));
        },
      },
    );
  }

  // `Champ` affiche le message ; c'est `Input` qui porte `aria-invalid` via `enErreur`. Les deux
  // vont ensemble : la bordure rouge seule ne dit rien à un lecteur d'écran.
  const erreurDe = (champ: string) => (erreurChamp?.champ === champ ? erreurChamp.message : undefined);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">{t("fraisTitre")}</h1>
        <p className="max-w-prose text-texte-secondaire">{t("fraisDescription")}</p>
      </header>

      <div className="flex max-w-2xl flex-col gap-4 rounded-lg border border-bordure bg-surface p-4">
        <SelecteurDossier valeur={dossierId} onChangement={setDossierId} id="frais-dossier" />

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
            onChange={(evenement) => setReferenceFacture(evenement.target.value)}
          />
        </Champ>

        <Champ
          id="frais-montant"
          label={t("montant")}
          erreur={erreurDe("montant")}
          obligatoire
          className="max-w-xs"
        >
          <Input
            id="frais-montant"
            name="montant"
            inputMode="numeric"
            required
            enErreur={erreurDe("montant") !== undefined}
            value={montant}
            onChange={(evenement) => setMontant(evenement.target.value)}
          />
        </Champ>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-[length:var(--taille-sm)] font-medium">{t("pieces")}</legend>
          <p className="max-w-prose text-[length:var(--taille-xs)] text-texte-tertiaire">
            {t("piecesAide")}
          </p>

          {pieces.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {pieces.map((piece, index) => (
                <li
                  key={piece.cle}
                  className="flex items-center justify-between gap-2 rounded border border-bordure bg-fond px-3 py-1.5"
                >
                  <span className="truncate text-[length:var(--taille-sm)]">{piece.nomFichier}</span>
                  <span className="flex items-center gap-1">
                    {/*
                      Relire avant d'envoyer : une pièce chargée ne se vérifiait qu'après le dépôt,
                      quand il était trop tard pour la remplacer sans repasser par une demande.
                    */}
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

          {/* Le composant porte ses propres contrôles de format et de poids (RG-GED-08). */}
          <Televersement
            nom="piece-justificative"
            label={t("pieces")}
            onChangement={(fichier) => void ajouterPiece(fichier)}
          />
          {envoiPiece ? (
            <p className="text-[length:var(--taille-xs)] text-texte-tertiaire">{t("envoiPiece")}</p>
          ) : null}
        </fieldset>

        <div className="flex items-center gap-2">
          <Button onClick={soumettre} disabled={!complet || deposer.isPending}>
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

      {/* Les pièces sont déjà téléversées : perdre l'écran perdrait le lien entre elles et la demande. */}
      <GardeSaisie
        actif={
          !deposer.isPending &&
          (dossierId !== null || montant !== "" || referenceFacture !== "" || pieces.length > 0)
        }
      />
    </div>
  );
}
