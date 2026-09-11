import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { VueClient } from "@/components/modules/clients/vue-client";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("clients");
  return { title: t("vueConsolidee") };
}

export default async function PageClient({ params }: { params: Promise<{ id: string }> }) {
  await exigerCapacite("consulterReferentiels");

  const { id } = await params;
  const clientId = Number.parseInt(id, 10);
  // Une URL malformée ne doit pas produire un appel `/clients/NaN` au backend.
  if (Number.isNaN(clientId) || clientId <= 0) notFound();

  return <VueClient clientId={clientId} />;
}
