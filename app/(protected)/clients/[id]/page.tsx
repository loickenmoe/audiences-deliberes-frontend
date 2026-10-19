import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { VueClient } from "@/components/modules/clients/vue-client";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("clients");
  return { title: t("vueConsolidee") };
}

export default async function PageClient({ params }: { params: Promise<{ id: string }> }) {
  const session = await exigerCapacite("consulterReferentiels");

  const { id } = await params;
  const clientId = Number.parseInt(id, 10);
  // A malformed URL must not trigger a `/clients/NaN` backend call.
  if (Number.isNaN(clientId) || clientId <= 0) notFound();

  return <VueClient clientId={clientId} roles={session.roles} />;
}
