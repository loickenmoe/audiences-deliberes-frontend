import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DetailFrais } from "@/components/modules/frais/detail-frais";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("frais");
  return { title: t("titre") };
}

/**
 * Écran 29 — détail d'une demande de frais et action de circuit. Les actions sont filtrées par
 * profil et par étape ; c'est le backend qui les refuse réellement.
 */
export default async function PageDemandeFrais({ params }: { params: Promise<{ id: string }> }) {
  const session = await exigerCapacite("consulterFrais");

  const { id } = await params;
  const demandeId = Number.parseInt(id, 10);
  // Une URL malformée ne doit pas produire un appel `/frais/demandes/NaN` au backend.
  if (Number.isNaN(demandeId) || demandeId <= 0) notFound();

  return <DetailFrais demandeId={demandeId} roles={session.roles} />;
}
