"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { EtatChargement, EtatErreur, EtatVide } from "@/components/global";
import { Pagination } from "@/components/metier/pagination";
import { Table, TableWrapper, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { ErreurApi } from "@/lib/api/errors";
import type { PageReponse } from "@/lib/api/client";

/**
 * Table de données paginée **côté serveur**.
 *
 * Le backend renvoie `{content, totalPages, totalElements}` : la pagination n'est jamais calculée
 * localement. `manualPagination` le dit explicitement à TanStack Table, faute de quoi elle
 * repaginerait la page déjà paginée — et n'afficherait qu'une fraction des lignes.
 *
 * Les quatre états obligatoires sont intégrés : chargement, erreur, vide, données. Un écran qui
 * consomme cette table n'a donc pas à les réimplémenter — c'est tout l'intérêt.
 */
export function TableDonnees<T>({
  colonnes,
  donnees,
  chargement,
  erreur,
  page,
  onChangementPage,
  titreVide,
  descriptionVide,
  actionVide,
  onReessayer,
  cleLigne,
  className,
}: {
  colonnes: ColumnDef<T, unknown>[];
  donnees: PageReponse<T> | undefined;
  chargement?: boolean;
  erreur?: unknown;
  page: number;
  onChangementPage: (page: number) => void;
  titreVide?: string;
  descriptionVide?: string;
  actionVide?: ReactNode;
  onReessayer?: () => void;
  /** Identité stable d'une ligne. À fournir dès que les lignes peuvent être réordonnées. */
  cleLigne?: (ligne: T, index: number) => string;
  className?: string;
}) {
  const t = useTranslations("metier");
  const tc = useTranslations("commun");

  const table = useReactTable({
    data: donnees?.content ?? [],
    columns: colonnes,
    getCoreRowModel: getCoreRowModel(),
    // La pagination vient du serveur : TanStack ne doit pas repaginer ce qui l'est déjà.
    manualPagination: true,
    pageCount: donnees?.totalPages ?? 0,
    getRowId: cleLigne ? (ligne, index) => cleLigne(ligne, index) : undefined,
  });

  if (chargement) return <EtatChargement lignes={6} className={className} />;

  if (erreur) {
    return (
      <EtatErreur
        message={erreur instanceof ErreurApi ? erreur.message : undefined}
        action={
          onReessayer ? (
            <button
              type="button"
              onClick={onReessayer}
              className="text-[length:var(--taille-sm)] font-medium underline underline-offset-4"
            >
              {tc("reessayer")}
            </button>
          ) : undefined
        }
        className={className}
      />
    );
  }

  if (!donnees || donnees.content.length === 0) {
    return (
      <EtatVide
        titre={titreVide ?? t("aucunResultat")}
        description={descriptionVide ?? t("aucunResultatFiltres")}
        action={actionVide}
        className={className}
      />
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className ?? ""}`}>
      <TableWrapper>
        <Table>
          <Thead>
            {table.getHeaderGroups().map((groupe) => (
              <Tr key={groupe.id}>
                {groupe.headers.map((entete) => (
                  <Th key={entete.id} style={{ width: entete.column.columnDef.size }}>
                    {entete.isPlaceholder
                      ? null
                      : flexRender(entete.column.columnDef.header, entete.getContext())}
                  </Th>
                ))}
              </Tr>
            ))}
          </Thead>
          <Tbody>
            {table.getRowModel().rows.map((ligne) => (
              <Tr key={ligne.id} className="hover:bg-surface-attenuee">
                {ligne.getVisibleCells().map((cellule) => (
                  <Td key={cellule.id}>
                    {flexRender(cellule.column.columnDef.cell, cellule.getContext())}
                  </Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrapper>

      <Pagination
        page={page}
        totalPages={donnees.totalPages}
        totalElements={donnees.totalElements}
        onChangement={onChangementPage}
      />
    </div>
  );
}
