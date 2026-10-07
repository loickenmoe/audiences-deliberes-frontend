"use client";

import { Pencil, Plus, Power, PowerOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { EtatChargement, EtatErreur, EtatVide, StatutChip } from "@/components/global";
import { DialogueConfirmation, Pagination } from "@/components/metier";
import { FormulaireAgence } from "@/components/modules/administration/formulaire-agence";
import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { useAgences, useEcritureAgence } from "@/hooks/useReferentiels";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import type { Agence } from "@/types/domaine";

/**
 * Le référentiel des agences (métier, 2026-10-03, observation 2).
 *
 * **Pourquoi cet écran existe.** Les deux codes d'agence d'un dossier étaient du texte libre, sans
 * vérification : sur les 341 dossiers de recette, un seul était renseigné - `5466546546` - et il ne
 * désignait aucune agence. Les 82 agences sont désormais un référentiel, et c'est ici qu'il se
 * tient.
 *
 * **Lu par tous, tenu par la direction.** La liste se consulte avec la consultation simple, parce
 * qu'elle explique ce que la saisie propose. Créer, corriger et fermer restent au DJ et à la DJA :
 * un code engage les dossiers qui le portent.
 *
 * **On ferme, on ne supprime pas - et on rouvre.** Un dossier ouvert sous une agence fermée reste
 * un dossier valide, et son code doit continuer de désigner quelque chose - l'audit pose des
 * questions des années après. Une agence fermée quitte les listes de saisie, rien de plus. Les
 * agences fermées restent donc affichées ici, et seulement ici, avec de quoi les **rouvrir**
 * (métier, 2026-10-06) : une fermeture peut être une erreur de manipulation, et une agence peut
 * réouvrir. Dans les deux cas elle garde son code - sans quoi il faudrait en inventer un autre.
 */
export function ListeAgences({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("agences");
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(0);
  const [creationOuverte, setCreationOuverte] = useState(false);
  const [enEdition, setEnEdition] = useState<Agence | null>(null);
  const [aFermer, setAFermer] = useState<Agence | null>(null);

  /*
   * `actifSeulement: false` : c'est l'écran d'administration, le seul qui doive voir les agences
   * fermées. Les masquer laisserait croire qu'elles ont disparu, alors que des dossiers les citent.
   */
  const requete = useAgences({ recherche, actifSeulement: false, page, size: 25 });
  const { desactiver, reactiver } = useEcritureAgence();
  const peutAdministrer = peut(roles, "administrerAgences");

  async function fermerLAgence(agence: Agence) {
    try {
      await desactiver.mutateAsync(agence.id);
      toast.success(t("desactivee", { nom: agence.nom }));
      setAFermer(null);
    } catch (erreur) {
      toast.error(messageErreur(erreur));
    }
  }

  /*
   * Rouvrir ne demande pas de confirmation, contrairement à fermer : le geste est bénin - l'agence
   * redevient proposable - et immédiatement défaisable par la fermeture. Demander deux fois pour
   * une action sans conséquence apprend à confirmer sans lire.
   */
  async function rouvrirLAgence(agence: Agence) {
    try {
      await reactiver.mutateAsync(agence.id);
      toast.success(t("reactivee", { nom: agence.nom }));
    } catch (erreur) {
      toast.error(messageErreur(erreur));
    }
  }

  const agences = requete.data?.content ?? [];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
            {t("titre")}
          </h1>
          <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
        </div>

        {peutAdministrer ? (
          <Button onClick={() => setCreationOuverte(true)}>
            <Plus size={15} aria-hidden />
            {t("nouvelleAgence")}
          </Button>
        ) : null}
      </header>

      <div className="flex items-end gap-3 rounded-lg border border-bordure bg-surface px-4 py-3">
        <Champ id="recherche-agence" label={t("rechercher")} aide={t("rechercherAide")} className="w-80">
          <Input
            id="recherche-agence"
            placeholder={t("phRechercheAgence")}
            value={recherche}
            onChange={(evenement) => {
              setRecherche(evenement.target.value);
              // Revenir à la première page : la page 3 d'une recherche large n'existe plus après
              // qu'on a tapé trois lettres, et la liste serait vide sans raison visible.
              setPage(0);
            }}
          />
        </Champ>
      </div>

      {requete.isLoading ? (
        <EtatChargement lignes={5} />
      ) : requete.error ? (
        <EtatErreur
          message={messageErreur(requete.error)}
          action={
            <Button variante="secondaire" onClick={() => void requete.refetch()}>
              {t("reessayer")}
            </Button>
          }
        />
      ) : agences.length === 0 ? (
        <EtatVide
          titre={t("aucuneAgence")}
          description={recherche ? t("aucuneAgenceRecherche") : t("aucuneAgenceTexte")}
          action={
            peutAdministrer && !recherche ? (
              <Button onClick={() => setCreationOuverte(true)}>
                <Plus size={15} aria-hidden />
                {t("nouvelleAgence")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TableWrapper>
          <Table>
            <Thead>
              <Tr>
                <Th>{t("colonneCode")}</Th>
                <Th>{t("colonneNom")}</Th>
                <Th>{t("colonneVille")}</Th>
                <Th>{t("colonneAdresse")}</Th>
                <Th>{t("colonneTelephone")}</Th>
                <Th>{t("colonneEtat")}</Th>
                {peutAdministrer ? (
                  <Th>
                    <span className="sr-only">{t("colonneActions")}</span>
                  </Th>
                ) : null}
              </Tr>
            </Thead>
            <Tbody>
              {agences.map((agence) => (
                <Tr key={agence.id} className="hover:bg-surface-attenuee">
                  <Td className="font-mono text-[length:var(--taille-xs)]">{agence.code}</Td>
                  <Td className="font-medium">{agence.nom}</Td>
                  <Td>{agence.ville}</Td>
                  <Td className="max-w-80">{agence.adresse ?? "-"}</Td>
                  <Td>{agence.telephone ?? "-"}</Td>
                  <Td>
                    <StatutChip ton={agence.actif ? "succes" : "neutre"}>
                      {agence.actif ? t("ouverte") : t("fermee")}
                    </StatutChip>
                  </Td>
                  {peutAdministrer ? (
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variante="secondaire"
                          aria-label={t("modifierNommee", { nom: agence.nom })}
                          onClick={() => setEnEdition(agence)}
                        >
                          <Pencil size={14} aria-hidden />
                          {t("modifier")}
                        </Button>
                        {agence.actif ? (
                          <Button
                            variante="secondaire"
                            aria-label={t("desactiverNommee", { nom: agence.nom })}
                            onClick={() => setAFermer(agence)}
                          >
                            <PowerOff size={14} aria-hidden />
                            {t("desactiver")}
                          </Button>
                        ) : (
                          <Button
                            variante="secondaire"
                            aria-label={t("reactiverNommee", { nom: agence.nom })}
                            disabled={reactiver.isPending}
                            onClick={() => void rouvrirLAgence(agence)}
                          >
                            <Power size={14} aria-hidden />
                            {t("reactiver")}
                          </Button>
                        )}
                      </div>
                    </Td>
                  ) : null}
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrapper>
      )}

      {requete.data ? (
        <Pagination
          page={page}
          totalPages={requete.data.totalPages}
          totalElements={requete.data.totalElements}
          onChangement={setPage}
        />
      ) : null}

      {peutAdministrer ? (
        <FormulaireAgence ouvert={creationOuverte} onFermeture={() => setCreationOuverte(false)} />
      ) : null}

      {/* La clé remonte le formulaire à chaque agence : ses valeurs de départ sont les siennes. */}
      {enEdition ? (
        <FormulaireAgence
          key={enEdition.id}
          ouvert
          onFermeture={() => setEnEdition(null)}
          agence={enEdition}
        />
      ) : null}

      {aFermer ? (
        <DialogueConfirmation
          ouvert
          onFermeture={() => setAFermer(null)}
          onConfirmation={() => void fermerLAgence(aFermer)}
          titre={t("desactiverTitre")}
          message={t("desactiverMessage", { nom: aFermer.nom, code: aFermer.code })}
          libelleConfirmation={t("desactiver")}
          destructif
          enCours={desactiver.isPending}
        />
      ) : null}
    </div>
  );
}
