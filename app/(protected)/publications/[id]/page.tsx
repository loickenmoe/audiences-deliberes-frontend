import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DetailPublication } from "@/components/modules/publications/detail-publication";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("publications");
  return { title: t("titre") };
}

/** Écran 32 — une publication : `GET /publications/{id}` exige `ROLE_CONSULTATION`. */
export default async function PagePublication({ params }: { params: Promise<{ id: string }> }) {
  const session = await exigerCapacite("consulterDossiers");

  const { id } = await params;
  const publicationId = Number.parseInt(id, 10);
  // Une URL malformée ne doit pas produire un appel `/publications/NaN` au backend.
  if (Number.isNaN(publicationId) || publicationId <= 0) notFound();

  return <DetailPublication publicationId={publicationId} roles={session.roles} />;
}
