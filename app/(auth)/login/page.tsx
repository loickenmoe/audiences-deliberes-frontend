import { redirect } from "next/navigation";

import { auth, signIn } from "@/lib/auth";

export const metadata = { title: "Connexion" };

const MOTIFS: Record<string, string> = {
  "session-expiree": "Votre session a expiré. Reconnectez-vous pour continuer.",
  AccessDenied: "Ce compte n'a pas accès à l'application.",
  Configuration: "La connexion est mal configurée. Contactez la DSI.",
};

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ motif?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user && !session.erreur) redirect("/");

  const { motif, error } = await searchParams;
  const message = MOTIFS[motif ?? ""] ?? MOTIFS[error ?? ""] ?? null;

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.13em] text-(--color-muted-foreground)">
          Afriland First Bank · Direction Juridique
        </p>
        <h1 className="font-(family-name:--font-serif) text-3xl font-semibold tracking-tight">
          Audiences et Délibérés
        </h1>
        <p className="text-(--color-muted-foreground)">
          Suivi des audiences, des délibérés et des décisions devenues définitives.
        </p>
      </div>

      {message ? (
        <p
          role="status"
          className="rounded border border-(--color-border) bg-(--color-muted) px-4 py-3 text-sm"
        >
          {message}
        </p>
      ) : null}

      <form
        action={async () => {
          "use server";
          await signIn("keycloak", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="w-full rounded bg-(--color-foreground) px-4 py-3 font-medium text-(--color-background) transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Se connecter
        </button>
      </form>

      <p className="text-sm text-(--color-muted-foreground)">
        L’authentification est assurée par le service d’identité de la banque. Vos identifiants ne
        transitent jamais par cette application.
      </p>
    </main>
  );
}
