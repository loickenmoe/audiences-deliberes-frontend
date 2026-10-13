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
 * Un montant saisi à la main, rendu comparable à un nombre (QF-56).
 *
 * **Pourquoi cette fonction existe.** Le champ refusait « 12 000 » : la validation exigeait des
 * chiffres collés, le bouton restait éteint, et rien ne disait pourquoi. Or on écrit un montant avec
 * des espaces - c'est même ce que fait l'application quand elle en affiche un. Lui demander de les
 * retirer, sans le dire, c'est lui demander de devinerautre chose que ce qu'il voit partout
 * ailleurs.
 *
 * Trois espaces sont retirés, et pas seulement celui du clavier : l'**insécable** (U+00A0) et
 * l'**insécable étroite** (U+202F) arrivent par copier-coller depuis un tableur ou depuis
 * l'application elle-même, et sont invisibles à l'œil.
 *
 * La **virgule décimale** est acceptée et traduite en point : c'est la séparation française, et
 * `Number("12,5")` vaut `NaN`.
 */
export function normaliserMontant(saisie: string): string {
  return saisie.replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
}

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
  /** Les champs restés vides ou illisibles, signalés après une tentative de dépôt (QF-56). */
  const [manques, setManques] = useState<Record<string, string>>({});

  const montantNormalise = normaliserMontant(montant);
  const montantValide = /^\d+(\.\d+)?$/.test(montantNormalise) && Number(montantNormalise) > 0;

  /** La pièce que le téléversement affiche : c'est elle que l'œil voisin relit. */
  const derniere = pieces.length > 0 ? pieces[pieces.length - 1]! : null;

  /**
   * La croix du téléversement retire la pièce qu'il affiche.
   *
   * Elle appelait `onChangement(null)`, que le formulaire ignorait : le fichier disparaissait de
   * l'écran et partait quand même avec la demande. Un retrait qui ne retire pas est pire qu'un
   * bouton absent.
   */
  function retirerDerniere() {
    setPieces((precedentes) => precedentes.slice(0, -1));
  }

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

  /**
   * Ce qui manque, nommé champ par champ (QF-56).
   *
   * **Le bouton n'est plus éteint par l'incomplétude**, et c'est le cœur de la correction. Un bouton
   * mort sans explication laisse chercher : l'avocat voyait « Déposer » grisé sans savoir si c'était
   * son montant, sa facture ou sa pièce. Le formulaire accepte la tentative et **pointe ce qui
   * manque**, comme le fait déjà celui de création de dossier avec ses pièces attendues.
   */
  function manquants(): Record<string, string> {
    const problemes: Record<string, string> = {};
    if (dossierId === null) problemes.dossierId = t("fraisDossierManquant");
    if (referenceFacture.trim() === "") problemes.referenceFacture = t("fraisReferenceManquante");
    if (montant.trim() === "") problemes.montant = t("fraisMontantManquant");
    // Un montant saisi mais illisible est une autre erreur qu'un montant absent : le message le dit,
    // et nomme ce qui est accepté plutôt que de refuser sans expliquer.
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
  const erreurDe = (champ: string) =>
    erreurChamp?.champ === champ ? erreurChamp.message : manques[champ];

  /** Corriger un champ en efface le reproche : le laisser serait accuser après coup. */
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
          `min-w-0` sur le fieldset, et ce n'est pas décoratif : la feuille de style des navigateurs
          lui impose `min-inline-size: min-content`, si bien qu'il refuse d'être plus étroit que son
          contenu. Avec une rangée qui ne passe plus à la ligne et un nom de fichier long, il restait
          à 643 points dans un écran de 375 et faisait défiler toute la page horizontalement. Mesuré
          en recette automatisée, pas supposé.
        */}
        <fieldset className="flex min-w-0 flex-col gap-2">
          {/*
            L'astérisque manquait : rien ne disait qu'une pièce est obligatoire, et le bouton
            s'éteignait sans l'expliquer (QF-56). Même patron que `Champ` : elle est **hors du texte**
            de la légende, décorative et `aria-hidden`, pour ne pas devenir « Pièces justificatives* »
            dans le nom accessible. L'information est portée pour qui écoute par le nom du champ de
            fichier, qu'un `<input type="file">` masqué ne peut pas assortir d'un `required` sans
            déclencher la validation du navigateur - c'est le parti déjà retenu à la création d'un
            dossier.
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
            **Le téléversement et les pièces chargées sur la même ligne** (QF-56), comme au
            formulaire de création de dossier : l'œil d'aperçu s'affichait sur une ligne distincte,
            au-dessus, et le lien entre le fichier choisi et le bouton qui le relit se perdait.
            `flex-wrap` passe à la ligne de lui-même au-delà de deux ou trois pièces.
          */}
          {/*
            **La rangée ne passe plus à la ligne** (QF-56, second passage). Elle le faisait dès
            qu'un nom de fichier long élargissait le bloc de téléversement : mesuré, la rangée fait
            638 points et le bloc en prenait jusqu'à 570 avec un nom long, ne laissant pas les 90
            points du bouton d'aperçu. Désormais le bloc se **comprime** (`min-w-0 flex-1`), son nom
            de fichier se tronque, et le bouton garde sa place (`shrink-0`). C'est le nom qui cède,
            pas la disposition - il se lit en entier au survol et dans le nom accessible de
            l'aperçu.
          */}
          <div className="flex items-center gap-3">
            {/*
              Le composant porte ses propres contrôles de format et de poids (RG-GED-08), **et
              affiche lui-même le fichier choisi** : son nom, son poids, et une croix pour le
              retirer. C'est ce qui permet de ne mettre qu'un bouton d'aperçu à côté de lui, comme
              au formulaire de création de dossier - mesure faite, le bloc occupe 436 des 638 points
              de la rangée, et une puce portant une seconde fois le nom du fichier n'y tenait pas.

              **Sa croix retire vraiment la pièce.** Elle appelle `onChangement(null)`, qui ne
              faisait rien jusqu'ici : l'avocat voyait le fichier disparaître de l'écran alors qu'il
              partait quand même avec la demande. La pièce est déjà en GED dès qu'elle est choisie,
              et c'est donc ici qu'il faut la retirer.
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
              L'œil, **sur la même ligne** que le téléversement (QF-56) : il s'affichait au-dessus,
              sur une ligne distincte, et le lien entre le fichier choisi et le bouton qui le relit
              se perdait. Il relit la dernière pièce déposée, celle que le téléversement affiche à
              côté - les précédentes se relisent dans la liste en dessous.

              Relire avant d'envoyer : une pièce chargée ne se vérifiait qu'après le dépôt, quand il
              était trop tard pour la remplacer sans repasser par une demande.
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
            Les pièces déjà déposées avant la dernière. Le téléversement n'en affiche qu'une à la
            fois ; sans cette liste, les précédentes partiraient avec la demande sans que l'avocat
            puisse les revoir ni les retirer.
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
            **Désactivé seulement pendant un envoi**, et plus par l'incomplétude du formulaire
            (QF-56) : un bouton mort sans explication laisse chercher lequel des quatre champs est en
            cause. La tentative est acceptée, et ce qui manque est nommé champ par champ.
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
