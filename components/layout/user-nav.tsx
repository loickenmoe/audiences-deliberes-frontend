import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { BoutonDeconnexion } from "@/components/layout/bouton-deconnexion";
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
        Identity hidden below `sm`: the header overflowed the window on a 375 px mobile. The name
        stays accessible: it is repeated on the home page, and the logout button has its own label.
      */}
      {/*
        The identity links to the account page: that is where users look for "my signature", rather
        than in a menu entry six profiles out of seven would never open.
      */}
      <div className="hidden text-right leading-tight sm:block">
        <Link href="/mon-compte" className="underline-offset-4 hover:underline">
          <p className="text-[length:var(--taille-sm)] font-medium">{identite}</p>
        </Link>
        <p className="text-[length:var(--taille-xs)] text-texte-secondaire">
          {profil ? tr(profil) : tc("profilInconnu")}
        </p>
      </div>
      {/* POST to a route handler: also revokes the token at Keycloak.
          See app/api/deconnexion/route.ts for the rationale. */}
      <BoutonDeconnexion libelle={t("deconnexion")} />
    </div>
  );
}
