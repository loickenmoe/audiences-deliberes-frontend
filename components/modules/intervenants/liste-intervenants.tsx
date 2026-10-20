"use client";

import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { EtatChargement, EtatErreur, EtatVide, StatutChip } from "@/components/global";
import { FormulaireIntervenant } from "@/components/modules/intervenants/formulaire-intervenant";
import { Button } from "@/components/ui/button";
import { Champ, Select } from "@/components/ui/champ";
import { Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { useIntervenants } from "@/hooks/useIntervenants";
import { messageErreur } from "@/lib/api/errors";
import { Pagination } from "@/components/metier";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { peut } from "@/lib/rbac";
import type { Intervenant } from "@/types/domaine";
import { TypeIntervenant } from "@/types/enums";

/**
 * Screen 42 - third-party directory.
 *
 * `avocatsAffectes` is mandatory when creating a case file, so no case file can be created
 * without a lawyer registered here.
 * The list is not paginated by the backend (RF-05): everything is displayed, without artificial
 * client-side pagination.
 */
export function ListeIntervenants({ roles }: Readonly<{ roles: readonly string[] }>) {
  const t = useTranslations("intervenants");
  const td = useTranslations("domaine");
  const [type, setType] = useState<TypeIntervenant | "">("");
  const { page, taille, definirPage, definirTaille } = useFiltresUrl({});
  const [creationOuverte, setCreationOuverte] = useState(false);
  // No third-party detail page: editing opens from the directory row.
  const [enEdition, setEnEdition] = useState<Intervenant | null>(null);

  const requete = useIntervenants({ type: type || undefined, page, size: taille });
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
      ) : (requete.data?.content ?? []).length === 0 ? (
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
                {peutCreer ? (
                  <Th>
                    <span className="sr-only">{t("colonneActions")}</span>
                  </Th>
                ) : null}
              </Tr>
            </Thead>
            <Tbody>
              {(requete.data?.content ?? []).map((intervenant) => (
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
                  {peutCreer ? (
                    <Td className="text-right">
                      <Button
                        variante="secondaire"
                        aria-label={t("modifierNomme", { nom: intervenant.nom })}
                        onClick={() => setEnEdition(intervenant)}
                      >
                        <Pencil size={14} aria-hidden />
                        {t("modifier")}
                      </Button>
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
          onChangement={definirPage}
          taille={taille}
          onChangementTaille={definirTaille}
        />
      ) : null}

      {peutCreer ? (
        <FormulaireIntervenant
          ouvert={creationOuverte}
          onFermeture={() => setCreationOuverte(false)}
        />
      ) : null}

      {/* The key remounts the form for each third party so its initial values are that party's own. */}
      {enEdition ? (
        <FormulaireIntervenant
          key={enEdition.id}
          ouvert
          onFermeture={() => setEnEdition(null)}
          intervenant={enEdition}
        />
      ) : null}
    </div>
  );
}
