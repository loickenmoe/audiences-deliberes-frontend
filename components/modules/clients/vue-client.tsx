"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { CycleEtape, MontantFcfa } from "@/components/metier";
import { EtatChargement, EtatErreur } from "@/components/global";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClient, useVueClientDossiers } from "@/hooks/useClients";
import { messageErreur } from "@/lib/api/errors";
import type { Dossier } from "@/types/domaine";

/**
 * Écran 20 — vue consolidée d'un client (US 8.6).
 *
 * Deux caractéristiques du backend structurent l'écran :
 * · les dossiers sont **déjà regroupés par catégorie** par l'endpoint, on n'en refait pas le tri ;
 * · la vue est **indépendante de l'affectation du juriste** : elle montre l'exposition totale de la
 *   banque sur ce client, y compris les dossiers que l'utilisateur ne suit pas.
 */
export function VueClient({ clientId }: { clientId: number }) {
  const t = useTranslations("clients");
  const client = useClient(clientId);
  const vue = useVueClientDossiers(clientId);

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

      <header className="flex flex-col gap-1">
        <p className="font-mono text-[length:var(--taille-2xs)] uppercase tracking-[0.13em] text-texte-tertiaire">
          {client.data?.reference}
        </p>
        <h1 className="text-[length:var(--taille-2xl)] font-semibold tracking-tight">
          {client.data?.nom}
        </h1>
        <p className="max-w-prose text-texte-secondaire">{t("vueDescription")}</p>
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
    </div>
  );
}

function LigneDossier({ dossier }: { dossier: Dossier }) {
  const t = useTranslations("clients");
  // Une étape sur trois au plus ; on montre celle en cours, c'est-à-dire la dernière ouverte.
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
