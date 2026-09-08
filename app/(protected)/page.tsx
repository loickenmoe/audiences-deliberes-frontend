import { libelleRole } from "@/types/enums";
import { CAPACITES, type Capacite, peut, profilPrincipal } from "@/lib/rbac";
import { exigerSession } from "@/lib/serverAuth";

export const metadata = { title: "Accueil" };

/**
 * Accueil minimal du jalon F2 : il atteste que la session, les rôles et les droits sont
 * correctement résolus. Il sera remplacé par l'accueil contextualisé (files de travail par profil)
 * au fil des jalons métier.
 */
export default async function PageAccueil() {
  const session = await exigerSession();
  const profil = profilPrincipal(session.roles);
  const capacites = (Object.keys(CAPACITES) as Capacite[]).filter((c) => peut(session.roles, c));

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.13em] text-(--color-muted-foreground)">
          {profil ? libelleRole[profil] : "Profil inconnu"}
        </p>
        <h1 className="font-(family-name:--font-serif) text-3xl font-semibold tracking-tight">
          Bonjour {session.user.prenom ?? ""}
        </h1>
        <p className="text-(--color-muted-foreground)">
          Session active. Les modules métier arrivent au fil des jalons.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-(--color-muted-foreground)">
          Rôles portés par votre compte
        </h2>
        <ul className="flex flex-wrap gap-2">
          {session.roles.map((role) => (
            <li
              key={role}
              className="rounded border border-(--color-border) px-2.5 py-1 font-mono text-xs"
            >
              {role}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.13em] text-(--color-muted-foreground)">
          Droits accordés · {capacites.length} sur {Object.keys(CAPACITES).length}
        </h2>
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {capacites.map((capacite) => (
            <li key={capacite} className="text-(--color-muted-foreground)">
              {capacite}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
