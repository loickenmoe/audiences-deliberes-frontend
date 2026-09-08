import Link from "next/link";

export const metadata = { title: "Accès refusé" };

export default function PageNonAutorise() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.13em] text-(--color-muted-foreground)">
        Accès refusé
      </p>
      <h1 className="font-(family-name:--font-serif) text-3xl font-semibold">
        Vous n’avez pas les droits nécessaires
      </h1>
      <p className="text-(--color-muted-foreground)">
        Cette page est réservée à d’autres profils. Si vous pensez qu’il s’agit d’une erreur,
        contactez la Direction Juridique.
      </p>
      <Link href="/" className="mt-2 font-medium underline underline-offset-4">
        Revenir à l’accueil
      </Link>
    </main>
  );
}
