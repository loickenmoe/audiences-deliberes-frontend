import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { FicheDossier } from "@/components/modules/dossiers/fiche-dossier";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("dossiers");
  return { title: t("titre") };
}

/**
 * Écran 07 — fiche dossier, avec ses onglets (08 étapes, 15 historique) et ses modales (16
 * affectation, 17 dérogation, 18 sensibilité).
 *
 * `GET /dossiers/{id}` exige `ROLE_CONSULTATION` : l'avocat, qui ne le porte pas, est arrêté ici.
 * Les actions de la fiche sont ensuite filtrées capacité par capacité — mais c'est le backend qui
 * les refuse réellement : masquer un bouton ne protège rien.
 */
export default async function PageDossier({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const session = await exigerCapacite("consulterDossiers");

  const { id } = await params;
  const dossierId = Number.parseInt(id, 10);
  // Une URL malformée ne doit pas produire un appel `/dossiers/NaN` au backend.
  if (Number.isNaN(dossierId) || dossierId <= 0) notFound();

  // `?onglet=documents` : après une création dont une pièce a échoué, on ouvre là où la redéposer.
  const { onglet } = await searchParams;

  return <FicheDossier dossierId={dossierId} roles={session.roles} ongletInitial={onglet} />;
}
