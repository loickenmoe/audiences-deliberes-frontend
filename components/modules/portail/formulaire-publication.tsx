"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { SelecteurDossier } from "@/components/modules/portail/selecteur-dossier";
import { Televersement } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Champ, Select, Textarea } from "@/components/ui/champ";
import { useAudiencesDeMonDossier, useDeposerAutrePublication, useDeposerCompteRendu } from "@/hooks/usePortailAvocat";
import { messageErreur } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { TypeAutrePublication } from "@/types/enums";

type Onglet = "compteRendu" | "autre";

/**
 * Écran 33 — dépôt d'un compte rendu d'audience (#29) ou d'une autre publication (#31).
 *
 * **Deux dépôts, deux formes, et ce n'est pas une lacune** : la story 5.1 décrit un compte rendu
 * comme un `contenu` textuel rattaché à une audience, la story 5.3 une pièce, décision ou conclusion
 * déposée en fichier. QF-20 supposait qu'il manquait le fichier au compte rendu ; les sources disent
 * le contraire. L'écran expose donc les deux voies côte à côte, en nommant ce que chacune attend.
 *
 * Le sélecteur d'audience ne se remplit qu'une fois le dossier choisi : les audiences sont lues
 * dossier par dossier, et le backend refuse en 403 un dossier qui n'est pas le sien.
 */
export function FormulairePublication() {
  const t = useTranslations("portail");
  const td = useTranslations("domaine");
  const router = useRouter();

  const [onglet, setOnglet] = useState<Onglet>("compteRendu");
  const [dossierId, setDossierId] = useState<number | null>(null);
  const [audienceId, setAudienceId] = useState<number | null>(null);
  const [contenu, setContenu] = useState("");
  const [typeDocument, setTypeDocument] = useState<(typeof TypeAutrePublication)[number]>("PIECE");
  const [fichier, setFichier] = useState<File | null>(null);

  const audiences = useAudiencesDeMonDossier(onglet === "compteRendu" ? dossierId : null);
  const deposerCompteRendu = useDeposerCompteRendu();
  const deposerAutre = useDeposerAutrePublication();
  const enCours = deposerCompteRendu.isPending || deposerAutre.isPending;

  function changerDossier(nouveau: number | null) {
    setDossierId(nouveau);
    // L'audience appartient au dossier : la conserver en changeant de dossier produirait un 404.
    setAudienceId(null);
  }

  const complet =
    dossierId !== null &&
    (onglet === "compteRendu" ? audienceId !== null && contenu.trim() !== "" : fichier !== null);

  function soumettre() {
    if (!complet || dossierId === null) return;
    const apres = {
      onSuccess: () => {
        toast.success(t("publicationDeposee"));
        router.push("/portail");
      },
      onError: (erreur: unknown) => toast.error(messageErreur(erreur)),
    };

    if (onglet === "compteRendu" && audienceId !== null) {
      deposerCompteRendu.mutate({ dossierId, audienceId, contenu: contenu.trim() }, apres);
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

      <div role="group" aria-label={t("typeDepot")} className="flex w-fit rounded border border-bordure-forte">
        {(["compteRendu", "autre"] as const).map((cle) => (
          <button
            key={cle}
            type="button"
            aria-pressed={cle === onglet}
            onClick={() => setOnglet(cle)}
            className={cn(
              "px-3 py-1.5 text-[length:var(--taille-sm)] transition-colors first:rounded-l last:rounded-r",
              cle === onglet ? "bg-anthracite text-white" : "hover:bg-surface-attenuee",
            )}
          >
            {t(`onglets.${cle}` as never)}
          </button>
        ))}
      </div>

      <div className="flex max-w-2xl flex-col gap-4 rounded-lg border border-bordure bg-surface p-4">
        <SelecteurDossier valeur={dossierId} onChangement={changerDossier} id="publication-dossier" />

        {onglet === "compteRendu" ? (
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
                    {audience.datePlanifiee} — {td(`StatutAudience.${audience.statut}` as never)}
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

            {/* Le composant porte lui-même son libellé et ses contrôles de format et de poids. */}
            <Televersement nom="fichier" onChangement={setFichier} />
          </>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={soumettre} disabled={!complet || enCours}>
            {enCours ? t("envoiEnCours") : t("deposer")}
          </Button>
          <Button variante="discrete" onClick={() => router.back()}>
            {t("annuler")}
          </Button>
        </div>
      </div>
    </div>
  );
}
