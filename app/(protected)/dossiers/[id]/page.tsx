import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { FicheDossier } from "@/components/modules/dossiers/fiche-dossier";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("dossiers");
  return { title: t("titre") };
}

/**
 * Screen 07 - case file, with its tabs (08 steps, 15 history) and modals (16 assignment,
 * 17 waiver, 18 sensitivity).
 *
 * `GET /dossiers/{id}` requires `ROLE_CONSULTATION`, so the lawyer is stopped here. Actions are then
 * filtered capability by capability, but the backend is what actually refuses them: hiding a button
 * protects nothing.
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
  // A malformed URL must not trigger a `/dossiers/NaN` backend call.
  if (Number.isNaN(dossierId) || dossierId <= 0) notFound();

  // `?onglet=documents`: after a creation where a document upload failed, open where it can be re-uploaded.
  const { onglet } = await searchParams;

  return <FicheDossier dossierId={dossierId} roles={session.roles} ongletInitial={onglet} />;
}
