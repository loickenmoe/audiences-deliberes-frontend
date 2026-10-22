import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DetailPublication } from "@/components/modules/publications/detail-publication";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("publications");
  return { title: t("titre") };
}

/** Screen 32 - a publication: `GET /publications/{id}` requires `ROLE_CONSULTATION`. */
export default async function PagePublication({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const session = await exigerCapacite("consulterDossiers");

  const { id } = await params;
  const publicationId = Number.parseInt(id, 10);
  // A malformed URL must not trigger a `/publications/NaN` backend call.
  if (Number.isNaN(publicationId) || publicationId <= 0) notFound();

  return <DetailPublication publicationId={publicationId} roles={session.roles} />;
}
