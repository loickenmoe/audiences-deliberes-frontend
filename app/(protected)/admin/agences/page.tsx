import { getTranslations } from "next-intl/server";

import { ListeAgences } from "@/components/modules/administration/liste-agences";
import { exigerCapacite } from "@/lib/serverAuth";

export async function generateMetadata() {
  const t = await getTranslations("agences");
  return { title: t("titre") };
}

/**
 * Référentiel des agences (métier, 2026-10-03, observation 2).
 *
 * Consultation ouverte à tous les profils internes, comme celui des intervenants : cette liste
 * explique ce que propose le formulaire de création d'un dossier. La tenue - créer, corriger,
 * fermer - est réservée au DJ et à la DJA, et masquée pour les autres.
 */
export default async function PageAgences() {
  const session = await exigerCapacite("consulterReferentiels");
  return <ListeAgences roles={session.roles} />;
}
