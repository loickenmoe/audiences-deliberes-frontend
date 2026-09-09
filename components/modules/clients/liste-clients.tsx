"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useMemo, useState } from "react";

import { BarreFiltres, DateValeur, TableDonnees } from "@/components/metier";
import { FormulaireClient } from "@/components/modules/clients/formulaire-client";
import { Button } from "@/components/ui/button";
import { Champ, Input } from "@/components/ui/champ";
import { useClients } from "@/hooks/useClients";
import { useFiltresUrl } from "@/hooks/useFiltresUrl";
import { peut } from "@/lib/rbac";
import type { Client } from "@/types/domaine";

const DEFAUTS = { nom: "", reference: "" };

export function ListeClients({ roles }: { roles: readonly string[] }) {
  const t = useTranslations("clients");
  const { filtres, page, definirFiltre, definirPage, effacer, nbFiltresActifs } =
    useFiltresUrl(DEFAUTS);
  const [creationOuverte, setCreationOuverte] = useState(false);

  const requete = useClients({
    nom: filtres.nom || undefined,
    reference: filtres.reference || undefined,
    page,
  });

  const colonnes = useMemo<ColumnDef<Client, unknown>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("colonneReference"),
        cell: ({ row }) => (
          // La référence est le point d'entrée naturel vers la vue consolidée du client.
          <Link
            href={`/clients/${row.original.id}`}
            className="font-mono text-[length:var(--taille-xs)] underline underline-offset-4"
          >
            {row.original.reference}
          </Link>
        ),
      },
      { accessorKey: "nom", header: t("colonneNom") },
      {
        accessorKey: "email",
        header: t("colonneEmail"),
        cell: ({ row }) => row.original.email ?? "—",
      },
      {
        accessorKey: "telephone",
        header: t("colonneTelephone"),
        cell: ({ row }) => row.original.telephone ?? "—",
      },
      {
        accessorKey: "createdAt",
        header: t("colonneCreation"),
        cell: ({ row }) => <DateValeur valeur={row.original.createdAt} />,
      },
    ],
    [t],
  );

  const peutCreer = peut(roles, "creerClient");

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
            {t("nouveauClient")}
          </Button>
        ) : null}
      </header>

      <BarreFiltres nbFiltresActifs={nbFiltresActifs} onEffacer={effacer}>
        <Champ id="filtre-nom" label={t("rechercheNom")} className="w-56">
          <Input
            id="filtre-nom"
            defaultValue={filtres.nom}
            // `onBlur` plutôt qu'`onChange` : écrire dans l'URL à chaque frappe produirait une
            // requête et une entrée d'historique par caractère.
            onBlur={(evenement) => definirFiltre("nom", evenement.target.value || undefined)}
          />
        </Champ>

        <Champ id="filtre-reference" label={t("rechercheReference")} className="w-48">
          <Input
            id="filtre-reference"
            defaultValue={filtres.reference}
            onBlur={(evenement) => definirFiltre("reference", evenement.target.value || undefined)}
          />
        </Champ>
      </BarreFiltres>

      <TableDonnees
        colonnes={colonnes}
        donnees={requete.data}
        chargement={requete.isLoading}
        erreur={requete.error}
        page={page}
        onChangementPage={definirPage}
        onReessayer={() => void requete.refetch()}
        titreVide={t("aucunClient")}
        descriptionVide={t("aucunClientTexte")}
        cleLigne={(client) => String(client.id)}
      />

      {peutCreer ? (
        <FormulaireClient ouvert={creationOuverte} onFermeture={() => setCreationOuverte(false)} />
      ) : null}
    </div>
  );
}
