"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { EtatChargement, EtatErreur, EtatVide, StatutChip } from "@/components/global";
import { FormulaireIntervenant } from "@/components/modules/intervenants/formulaire-intervenant";
import { Button } from "@/components/ui/button";
import { Champ, Select } from "@/components/ui/champ";
import { Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { useIntervenants } from "@/hooks/useIntervenants";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import { TypeIntervenant } from "@/types/enums";

/**
 * Écran 42 — référentiel des intervenants.
 *
 * **C'est l'écran qui débloque la suite** : `avocatsAffectes` est obligatoire à la création d'un
 * dossier, donc sans avocat ici, aucun dossier n'est créable. C'est pourquoi il arrive dès F5.
 *
 * La liste n'est pas paginée côté backend (#62, RF-05) : on affiche tout, sans pagination
 * artificielle qui laisserait croire à un découpage serveur.
 */
export function ListeIntervenants({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("intervenants");
  const td = useTranslations("domaine");
  const [type, setType] = useState<TypeIntervenant | "">("");
  const [creationOuverte, setCreationOuverte] = useState(false);

  const requete = useIntervenants(type || undefined);
  const peutCreer = peut(roles, "administrerIntervenants");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
            {t("titre")}
          </h1>
          <p className="max-w-prose text-texte-secondaire">{t("description")}</p>
        </div>

        {peutCreer ? (
          <Button onClick={() => setCreationOuverte(true)}>
            <Plus size={15} aria-hidden />
            {t("nouvelIntervenant")}
          </Button>
        ) : null}
      </header>

      <div className="flex items-end gap-3 rounded-lg border border-bordure bg-surface px-4 py-3">
        <Champ id="filtre-type" label={t("filtreType")} className="w-56">
          <Select
            id="filtre-type"
            value={type}
            onChange={(evenement) => setType(evenement.target.value as TypeIntervenant | "")}
          >
            <option value="">{t("tousTypes")}</option>
            {TypeIntervenant.map((valeur) => (
              <option key={valeur} value={valeur}>
                {td(`TypeIntervenant.${valeur}` as never)}
              </option>
            ))}
          </Select>
        </Champ>
      </div>

      {requete.isLoading ? (
        <EtatChargement lignes={5} />
      ) : requete.error ? (
        <EtatErreur
          message={messageErreur(requete.error)}
          action={
            <button
              type="button"
              onClick={() => void requete.refetch()}
              className="text-[length:var(--taille-sm)] font-medium underline underline-offset-4"
            >
              {t("titre")}
            </button>
          }
        />
      ) : (requete.data ?? []).length === 0 ? (
        <EtatVide
          titre={t("aucunIntervenant")}
          description={t("aucunIntervenantTexte")}
          action={
            peutCreer ? (
              <Button onClick={() => setCreationOuverte(true)}>
                <Plus size={15} aria-hidden />
                {t("nouvelIntervenant")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <TableWrapper>
          <Table>
            <Thead>
              <Tr>
                <Th>{t("colonneNom")}</Th>
                <Th>{t("colonneType")}</Th>
                <Th>{t("colonneEmail")}</Th>
                <Th>{t("colonneTelephone")}</Th>
                <Th>{t("colonneCompte")}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {(requete.data ?? []).map((intervenant) => (
                <Tr key={intervenant.id} className="hover:bg-surface-attenuee">
                  <Td className="font-medium">{intervenant.nom}</Td>
                  <Td>
                    <StatutChip ton={intervenant.type === "AVOCAT" ? "info" : "neutre"}>
                      {td(`TypeIntervenant.${intervenant.type}` as never)}
                    </StatutChip>
                  </Td>
                  <Td>{intervenant.email ?? "—"}</Td>
                  <Td>{intervenant.telephone ?? "—"}</Td>
                  <Td>
                    {intervenant.compteKeycloak ? (
                      <span className="font-mono text-[length:var(--taille-xs)]">
                        {intervenant.compteKeycloak}
                      </span>
                    ) : (
                      <span className="text-texte-tertiaire">{t("sansCompte")}</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableWrapper>
      )}

      {peutCreer ? (
        <FormulaireIntervenant
          ouvert={creationOuverte}
          onFermeture={() => setCreationOuverte(false)}
        />
      ) : null}
    </div>
  );
}
