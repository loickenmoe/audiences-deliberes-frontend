import { deconnexion } from "@/lib/deconnexion";
import { libelleRole } from "@/types/enums";
import { profilPrincipal } from "@/lib/rbac";

export function UserNav({
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
  const profil = profilPrincipal(roles);
  const identite = [prenom, nom].filter(Boolean).join(" ") || email || "Utilisateur";

  return (
    <div className="flex items-center gap-4">
      <div className="text-right leading-tight">
        <p className="text-sm font-medium">{identite}</p>
        <p className="text-xs text-(--color-muted-foreground)">
          {profil ? libelleRole[profil] : "Profil inconnu"}
        </p>
      </div>
      {/* Action serveur : la déconnexion ferme aussi la session Keycloak (cf. lib/deconnexion.ts). */}
      <form action={deconnexion}>
        <button
          type="submit"
          className="rounded border border-(--color-border) px-3 py-1.5 text-sm transition-colors hover:bg-(--color-muted) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
