import { UserNav } from "@/components/layout/user-nav";

export function Navbar({
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
  return (
    <header className="flex items-center justify-between border-b border-(--color-border) px-6 py-3">
      <p className="font-(family-name:--font-serif) text-lg font-semibold">Audiences et Délibérés</p>
      <UserNav nom={nom} prenom={prenom} email={email} roles={roles} />
    </header>
  );
}
