import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { profilPrincipal } from "@/lib/rbac";

export async function UserNav({
  nom,
  prenom,
  email,
  roles,
}: {
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  roles: readonly string[];
}) {
  const t = await getTranslations("connexion");
  const tc = await getTranslations("commun");
  const tr = await getTranslations("roles");

  const profil = profilPrincipal(roles);
  const identite = [prenom, nom].filter(Boolean).join(" ") || email || "—";

  return (
    <div className="flex items-center gap-4">
      <div className="text-right leading-tight">
        <p className="text-[length:var(--taille-sm)] font-medium">{identite}</p>
        <p className="text-[length:var(--taille-xs)] text-texte-secondaire">
          {profil ? tr(profil) : tc("profilInconnu")}
        </p>
      </div>
      {/* POST vers un gestionnaire de route : révoque aussi le jeton côté Keycloak.
          Voir app/api/deconnexion/route.ts pour la raison du choix. */}
      <form action="/api/deconnexion" method="post">
        <Button type="submit" variante="secondaire" taille="sm">
          <LogOut size={14} aria-hidden />
          {t("deconnexion")}
        </Button>
      </form>
    </div>
  );
}
