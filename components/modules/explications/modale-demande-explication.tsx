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
 * Management asks a lawyer for an explanation.
 *
 * The lawyer is searched server-side rather than picked from a dropdown: the directory grows and a
 * dropdown would be silently truncated.
 * No case file is required: the request concerns a conduct (e.g. missed hearings across several
 * cases), not one specific case.
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

        {/* Stated before sending: no automatic notification is sent, so the user is not surprised. */}
        <p className="max-w-prose text-[length:var(--taille-xs)] text-texte-tertiaire">
          {t("suspensionRelance")}
        </p>
      </div>
    </Dialog>
  );
}
