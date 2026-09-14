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
    <div className="flex items-center gap-2 sm:gap-4">
      {/*
        Identité masquée en dessous de `sm` (F17) : l'en-tête débordait de la fenêtre sur un mobile
        de 375 px. Le nom reste accessible — il est répété sur l'accueil, et le bouton de déconnexion
        porte son propre libellé.
      */}
      <div className="hidden text-right leading-tight sm:block">
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
