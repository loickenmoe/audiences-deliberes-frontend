import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DetailFrais } from "@/components/modules/frais/detail-frais";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("frais");
  return { title: t("titre") };
}

/**
 * Screen 29 - expense request detail and workflow action. Actions are filtered by profile and by
 * step; the backend is what actually refuses them.
 */
export default async function PageDemandeFrais({ params }: { params: Promise<{ id: string }> }) {
  const session = await exigerCapacite("consulterFrais");

  const { id } = await params;
  const demandeId = Number.parseInt(id, 10);
  // A malformed URL must not trigger a `/frais/demandes/NaN` backend call.
  if (Number.isNaN(demandeId) || demandeId <= 0) notFound();

  return <DetailFrais demandeId={demandeId} roles={session.roles} />;
}
