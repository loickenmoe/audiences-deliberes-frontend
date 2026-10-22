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
 * Server-side paginated data table.
 * The backend returns `{content, totalPages, totalElements}`; `manualPagination` stops TanStack
 * Table from re-paginating an already paginated page. The four required states (loading, error,
 * empty, data) are built in.
 */
export function TableDonnees<T>({
  colonnes,
  donnees,
  chargement,
  erreur,
  page,
  onChangementPage,
  taille,
  onChangementTaille,
  titreVide,
  descriptionVide,
  actionVide,
  onReessayer,
  cleLigne,
  className,
}: Readonly<{
  colonnes: ColumnDef<T, unknown>[];
  donnees: PageReponse<T> | undefined;
  chargement?: boolean;
  erreur?: unknown;
  page: number;
  onChangementPage: (page: number) => void;
  /** Current page size; when omitted, the size selector is not rendered. */
  taille?: number;
  onChangementTaille?: (taille: number) => void;
  titreVide?: string;
  descriptionVide?: string;
  actionVide?: ReactNode;
  onReessayer?: () => void;
  /** Stable row identity. Provide it whenever rows can be reordered. */
  cleLigne?: (ligne: T, index: number) => string;
  className?: string;
}>) {
  const t = useTranslations("metier");
  const tc = useTranslations("commun");

  const table = useReactTable({
    data: donnees?.content ?? [],
    columns: colonnes,
    getCoreRowModel: getCoreRowModel(),
    // Pagination comes from the server: TanStack must not re-paginate it.
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
        taille={taille}
        onChangementTaille={onChangementTaille}
        totalPages={donnees.totalPages}
        totalElements={donnees.totalElements}
        onChangement={onChangementPage}
      />
    </div>
  );
}
