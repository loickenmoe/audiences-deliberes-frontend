import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.13em] text-(--color-muted-foreground)">
        Erreur 404
      </p>
      <h1 className="font-(family-name:--font-serif) text-3xl font-semibold">Page introuvable</h1>
      <p className="text-(--color-muted-foreground)">
        Cette page n’existe pas ou a été déplacée.
      </p>
      <Link href="/" className="mt-2 font-medium underline underline-offset-4">
        Revenir à l’accueil
      </Link>
    </main>
  );
}
