/**
 * Page d'attente du jalon F1 : elle atteste que le socle démarre et se rend correctement.
 * Elle sera remplacée par l'accueil contextualisé par profil (écran 02) au jalon F2.
 */
export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.13em] text-(--color-muted-foreground)">
        Afriland First Bank · Direction Juridique
      </p>
      <h1 className="font-(family-name:--font-serif) text-4xl font-semibold tracking-tight">
        Audiences et Délibérés
      </h1>
      <p className="max-w-prose text-(--color-muted-foreground)">
        Socle technique en place. L’authentification et la navigation par profil arrivent au jalon
        suivant.
      </p>
      <dl className="grid gap-2 border-t border-(--color-border) pt-6 text-sm">
        <div className="flex gap-3">
          <dt className="w-32 text-(--color-muted-foreground)">Jalon</dt>
          <dd className="font-medium">F1 — squelette et outillage</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-32 text-(--color-muted-foreground)">Suivant</dt>
          <dd className="font-medium">F2 — authentification Keycloak et droits</dd>
        </div>
      </dl>
    </main>
  );
}
