"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { SelecteurCherchable } from "@/components/metier";
import { Button } from "@/components/ui/button";
import { Champ, Textarea } from "@/components/ui/champ";
import { Dialog } from "@/components/ui/dialog";
import { useEcritureExplication } from "@/hooks/useDemandesExplication";
import { useRepertoire } from "@/hooks/useConstitutions";
import { messageErreur } from "@/lib/api/errors";

/**
 * La direction demande à un avocat de s'expliquer (N7 temps 2).
 *
 * **Pourquoi l'avocat se cherche, et ne se choisit pas dans une liste.** Le répertoire grandit ;
 * une liste déroulante se tronquerait en silence, et l'avocat qu'on veut nommer n'y serait plus -
 * c'est le défaut que Q-105 a déjà corrigé ailleurs.
 *
 * **Le dossier n'est pas demandé.** La demande porte sur une conduite - des audiences manquées à
 * travers plusieurs affaires - et non sur l'une d'elles. Exiger un dossier obligerait à en choisir
 * un arbitrairement, et la demande se lirait comme un reproche sur ce dossier-là.
 */
export function ModaleDemandeExplication({
  ouvert,
  onFermeture,
}: {
  ouvert: boolean;
  onFermeture: () => void;
}) {
  const t = useTranslations("explications");
  const tc = useTranslations("commun");
  const { demander } = useEcritureExplication();

  const [recherche, setRecherche] = useState("");
  const [avocatId, setAvocatId] = useState<number | null>(null);
  const [contenu, setContenu] = useState("");
  const [erreur, setErreur] = useState("");
  const repertoire = useRepertoire(recherche);

  const options = (repertoire.data?.content ?? []).map((avocat) => ({
    id: avocat.id,
    libelle: avocat.nom,
  }));

  async function envoyer() {
    setErreur("");
    if (avocatId === null) {
      setErreur(t("avocatRequis"));
      return;
    }
    try {
      await demander.mutateAsync({ avocatId, contenu });
      toast.success(t("demandeEnvoyee"));
      setAvocatId(null);
      setContenu("");
      setRecherche("");
      onFermeture();
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  return (
    <Dialog
      ouvert={ouvert}
      onFermeture={onFermeture}
      titre={t("demanderTitre")}
      description={t("demanderDescription")}
      pied={
        <>
          <Button variante="secondaire" onClick={onFermeture} disabled={demander.isPending}>
            {tc("annuler")}
          </Button>
          <Button onClick={() => void envoyer()} disabled={demander.isPending}>
            {t("envoyer")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <SelecteurCherchable
          id="explication-avocat"
          label={t("champAvocat")}
          obligatoire
          chargement={repertoire.isLoading}
          options={options}
          valeur={avocatId}
          onChangement={(choix) => setAvocatId(typeof choix === "number" ? choix : null)}
          onRecherche={setRecherche}
          placeholder={t("placeholderAvocat")}
        />

        <Champ id="explication-contenu" label={t("champDemande")} obligatoire erreur={erreur || undefined}>
          <Textarea
            id="explication-contenu"
            rows={6}
            placeholder={t("placeholderDemande")}
            value={contenu}
            onChange={(evenement) => setContenu(evenement.target.value)}
          />
        </Champ>

        {/* Dit avant l'envoi : la machine se tait, et il faut le savoir pour ne pas s'en étonner. */}
        <p className="max-w-prose text-[length:var(--taille-xs)] text-texte-tertiaire">
          {t("suspensionRelance")}
        </p>
      </div>
    </Dialog>
  );
}
