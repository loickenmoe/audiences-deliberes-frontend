import { AppSidebar, Navbar, RetourEnHaut } from "@/components/layout";
import { exigerSession } from "@/lib/serverAuth";

/**
 * Shell of authenticated screens. The guard lives here, not in an HTTP interceptor: a redirect
 * triggered from the network layer bypasses screen state handling and makes errors untestable.
 *
 * From `lg` up, header and sidebar stay in place and only the content scrolls (`lg:h-svh` +
 * `lg:overflow-hidden` bound the box). This keeps the notification bell (mandatory alert channel,
 * NF-ALR-02) and the logout button always visible. Mobile is deliberately unchanged: pinning the
 * header and navigation strip would cost 18% of an already scarce height.
 *
 * `min-h-0` is required: without it a flex child refuses to shrink below its content height and the
 * content's `overflow-y-auto` never applies.
 */
export default async function LayoutProtege({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await exigerSession();

  return (
    <div className="flex min-h-svh flex-col lg:h-svh lg:flex-row lg:overflow-hidden">
      <AppSidebar roles={session.roles} />
      <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
        <Navbar
          nom={session.user.nom}
          prenom={session.user.prenom}
          email={session.user.email}
          roles={session.roles}
        />
        <main id="contenu-principal" className="flex-1 p-6 lg:min-h-0 lg:overflow-y-auto lg:p-8">
          {children}
        </main>
        <RetourEnHaut />
      </div>
    </div>
  );
}
