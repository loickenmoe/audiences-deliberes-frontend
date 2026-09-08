import { AppSidebar, Navbar } from "@/components/layout";
import { exigerSession } from "@/lib/serverAuth";

/**
 * Coquille des écrans authentifiés. La garde est ici, pas dans un intercepteur HTTP : une
 * redirection déclenchée depuis la couche réseau court-circuite la gestion d'état des écrans et
 * rend les erreurs intestables.
 */
export default async function LayoutProtege({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await exigerSession();

  return (
    <div className="flex min-h-svh">
      <AppSidebar roles={session.roles} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar
          nom={session.user.nom}
          prenom={session.user.prenom}
          email={session.user.email}
          roles={session.roles}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
