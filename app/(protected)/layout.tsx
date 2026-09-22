import { AppSidebar, Navbar, RetourEnHaut } from "@/components/layout";
import { exigerSession } from "@/lib/serverAuth";

/**
 * Coquille des écrans authentifiés. La garde est ici, pas dans un intercepteur HTTP : une
 * redirection déclenchée depuis la couche réseau court-circuite la gestion d'état des écrans et
 * rend les erreurs intestables.
 *
 * **Coquille d'application à partir de `lg` (QF-47).** L'en-tête et la barre latérale restent en
 * place, seul le contenu défile. L'intention était déjà là — `lg:h-svh` sur la barre latérale et
 * `overflow-y-auto` sur le contenu ne veulent rien dire autrement — mais le conteneur extérieur était
 * `min-h-svh` : rien ne bornait la hauteur, la page défilait en entier, et `overflow-y-auto` ne
 * s'appliquait jamais. `lg:h-svh` + `lg:overflow-hidden` ferment la boîte.
 *
 * Ce que la correction protège : la **cloche de notifications** et son compteur — canal obligatoire
 * des alertes (NF-ALR-02) —, et la **déconnexion**, geste que le guide §1 réclame en poste partagé.
 * Les perdre en défilant une fiche de dossier, c'est perdre le seul dispositif qui signale une
 * échéance et le seul qui ferme la session.
 *
 * **Mobile inchangé, délibérément.** Sur 375 × 667, l'en-tête fait 64 px et la bande de navigation
 * 53 px : les figer mangerait 18 % de la hauteur, là où l'espace est le plus rare. F17 a
 * précisément transformé la navigation en bande défilante pour récupérer cette hauteur ; revenir
 * dessus en silence défairait une décision prise en connaissance de cause.
 *
 * `min-h-0` n'est pas décoratif : sans lui, un enfant de conteneur flexible refuse de rétrécir
 * sous sa hauteur de contenu, et le `overflow-y-auto` du contenu reste lettre morte.
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
