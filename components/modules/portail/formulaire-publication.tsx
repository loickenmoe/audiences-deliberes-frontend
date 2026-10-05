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
 * Écran 33 — dépôt d'une publication par l'avocat (#29, #31).
 *
 * **Un seul formulaire, deux natures de dépôt.** Les deux onglets d'origine donnaient l'impression
 * de changer de page alors que le dossier restait le même en dessous ; et leurs libellés reprenaient
 * le défaut de l'écran 02 en miniature — « Pièce, décision, conclusion » énumérait les valeurs du
 * champ `typeDocument` affiché juste en dessous. Les deux natures sont désormais présentées côte à
 * côte, chacune avec la phrase qui la distingue, dans un formulaire continu.
 *
 * **Ce qui les sépare n'est plus le format mais l'objet du dépôt.** Depuis Q-98 le compte rendu
 * accepte lui aussi une pièce : ce n'est donc plus « du texte ou un fichier », c'est « je **relate**
 * une audience » contre « je **transmets** un document ». Le premier se rattache à une audience et
 * se valide comme un récit, le second au dossier.
 *
 * **Pourquoi deux objets et non un seul.** Un formulaire unique où le système devinerait la nature
 * — une audience choisie vaudrait compte rendu — remplacerait un choix explicite par une règle
 * cachée, et laisserait sans réponse trois des six combinaisons de champs que le modèle n'accepte
 * pas (un fichier seul rattaché à une audience, un texte seul sans audience, une audience avec un
 * type de document). La distinction existe côté métier ; l'écran la montre au lieu de la faire
 * deviner.
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
    // L'audience appartient au dossier : la conserver en changeant de dossier produirait un 404.
    setAudienceId(null);
  }

  /*
   * Chaque nature a son propre `Televersement`, avec son état interne : garder le fichier en
   * changeant de nature laisserait le bouton actif alors que le champ affiché est vide. On repart
   * donc d'un fichier nul — ce que le nouveau champ montre déjà.
   */
  function changerNature(nouvelle: Nature) {
    setNature(nouvelle);
    setFichier(null);
  }

  /** Le récit exige une audience et un texte ; le document, un fichier. La pièce du récit est libre. */
  const complet =
    dossierId !== null &&
    (nature === "compteRendu" ? audienceId !== null && contenu.trim() !== "" : fichier !== null);

  function soumettre() {
    if (!complet || dossierId === null) return;
    const apres = {
      onSuccess: () => {
        // Les deux natures ne suivent plus le même sort (RG-INT-06 amendée, 2026-10-05) : un
        // compte rendu est lisible des juristes du dossier dès maintenant, un document attend sa
        // validation. Un message unique en aurait trompé une moitié.
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
          Deux choix décrits, et non deux onglets : l'avocat lit ce qui les sépare avant de choisir,
          au lieu de le découvrir en basculant. `fieldset`/`legend` nomment le groupe, et chaque
          description est reliée à son option par `aria-describedby`.
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
                name="contenu"
                rows={8}
                required
                value={contenu}
                onChange={(evenement) => setContenu(evenement.target.value)}
              />
            </Champ>

            {/* Q-98 : la pièce qui étaye le récit. Facultative — le compte rendu reste un texte. */}
            <div className="flex flex-col gap-1">
              <p className="text-[length:var(--taille-sm)] font-medium">{t("pieceJointe")}</p>
              <p className="max-w-prose text-[length:var(--taille-xs)] text-texte-tertiaire">
                {t("pieceJointeAide")}
              </p>
              <Televersement nom="piece-jointe" label={t("pieceJointe")} onChangement={setFichier} />
              <BoutonRelire fichier={fichier} onOuverture={() => setApercu(true)} libelle={tdoc("consulter")} />
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

            <Televersement nom="fichier" label={t("fichier")} onChangement={setFichier} />
            <BoutonRelire fichier={fichier} onOuverture={() => setApercu(true)} libelle={tdoc("consulter")} />
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
        Relire le fichier **avant** de déposer. Le fichier n'est pas encore parti : l'aperçu lit
        directement celui que le navigateur tient en mémoire, sans aller-retour avec le serveur.
        Une publication déposée ne se corrige pas — elle se redépose.
      */}
      {apercu && fichier ? (
        <ApercuFichier
          ouvert
          onFermeture={() => setApercu(false)}
          nomFichier={fichier.name}
          obtenir={() => Promise.resolve(fichier)}
        />
      ) : null}

      {/* Un compte rendu d'audience est un récit : le reperdre, c'est le réécrire. */}
      <GardeSaisie
        actif={!enCours && (dossierId !== null || contenu.trim() !== "" || fichier !== null)}
      />
    </div>
  );
}

/** Le bouton de relecture : il n'apparaît que lorsqu'un fichier est effectivement choisi. */
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
    <div>
      <Button
        variante="secondaire"
        taille="sm"
        onClick={onOuverture}
        aria-label={`${libelle} - ${fichier.name}`}
      >
        <Eye size={14} aria-hidden />
        {libelle}
      </Button>
    </div>
  );
}
