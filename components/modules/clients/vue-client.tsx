"use client";

import { ArrowLeft, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { CycleEtape, MontantFcfa } from "@/components/metier";
import { EtatChargement, EtatErreur } from "@/components/global";
import { FormulaireClient } from "@/components/modules/clients/formulaire-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClient, useVueClientDossiers } from "@/hooks/useClients";
import { messageErreur } from "@/lib/api/errors";
import { peut } from "@/lib/rbac";
import type { Dossier } from "@/types/domaine";

/**
 * Screen 20 - consolidated client view (US 8.6).
 * The endpoint already groups cases by category, so no re-sorting here. The view does not depend on
 * the lawyer's assignment: it shows the bank's total exposure to this client, including cases the
 * user does not follow.
 */
export function VueClient({ clientId, roles }: { clientId: number; roles: readonly string[] }) {
  const t = useTranslations("clients");
  const tc = useTranslations("commun");
  const client = useClient(clientId);
  const vue = useVueClientDossiers(clientId);
  const [edition, setEdition] = useState(false);

  if (client.isLoading || vue.isLoading) return <EtatChargement lignes={8} />;

  if (client.error || vue.error) {
    return <EtatErreur message={messageErreur(client.error ?? vue.error)} />;
  }

  const categories = [
    { cle: "recouvrement" as const, titre: t("recouvrement"), dossiers: vue.data?.recouvrement ?? [] },
    {
      cle: "exploitationLitiges" as const,
      titre: t("exploitationLitiges"),
      dossiers: vue.data?.exploitationLitiges ?? [],
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-[length:var(--taille-sm)] text-texte-secondaire underline underline-offset-4"
        >
          <ArrowLeft size={14} aria-hidden />
          {t("retourListe")}
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[length:var(--taille-2xs)] uppercase tracking-[0.13em] text-texte-tertiaire">
            {client.data?.reference}
          </p>
          <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
            {client.data?.nom}
          </h1>
          {/*
            Contact details are shown where they are edited, so an email or phone change is visible
            on screen.
          */}
          <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[length:var(--taille-sm)]">
            <div className="flex gap-1.5">
              <dt className="text-texte-tertiaire">{t("colonneEmail")}</dt>
              <dd>{client.data?.email || tc("aucuneValeur")}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="text-texte-tertiaire">{t("colonneTelephone")}</dt>
              <dd>{client.data?.telephone || tc("aucuneValeur")}</dd>
            </div>
          </dl>
          <p className="max-w-prose text-texte-secondaire">{t("vueDescription")}</p>
        </div>
        {peut(roles, "modifierClient") ? (
          <Button variante="secondaire" onClick={() => setEdition(true)}>
            <Pencil size={16} aria-hidden />
            {t("modifier")}
          </Button>
        ) : null}
      </header>

      <div className="flex flex-col gap-5">
        {categories.map(({ cle, titre, dossiers }) => (
          <Card key={cle}>
            <CardHeader>
              <CardTitle>{titre}</CardTitle>
            </CardHeader>
            <CardContent>
              {dossiers.length === 0 ? (
                <p className="text-[length:var(--taille-sm)] text-texte-tertiaire">
                  {t("aucunDossierCategorie")}
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-bordure">
                  {dossiers.map((dossier) => (
                    <LigneDossier key={dossier.id} dossier={dossier} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {client.data ? (
        <FormulaireClient ouvert={edition} onFermeture={() => setEdition(false)} client={client.data} />
      ) : null}
    </div>
  );
}

function LigneDossier({ dossier }: { dossier: Dossier }) {
  const t = useTranslations("clients");
  // At most one of three steps: show the current one, i.e. the last opened.
  const etapeCourante = dossier.etapes.at(-1);

  return (
    <li className="flex flex-wrap items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="font-mono text-[length:var(--taille-xs)]">{dossier.reference}</span>
        <span className="text-[length:var(--taille-sm)]">{dossier.nature}</span>
        {etapeCourante ? (
          <CycleEtape statut={etapeCourante.statutCycleVie} type={etapeCourante.type} compact />
        ) : null}
      </div>

      <dl className="flex gap-6 text-[length:var(--taille-xs)]">
        <div className="flex flex-col gap-0.5">
          <dt className="text-texte-tertiaire">{t("juridiction")}</dt>
          <dd>{dossier.juridictionSaisie}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-texte-tertiaire">{t("risqueEncouru")}</dt>
          <dd className="font-medium">
            <MontantFcfa valeur={dossier.risqueEncouru} />
          </dd>
        </div>
      </dl>
    </li>
  );
}
