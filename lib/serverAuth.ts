import "server-only";

import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/lib/auth";
import { sessionInutilisable } from "@/lib/rotation-jeton";
import { type Capacite, peut } from "@/lib/rbac";

/**
 * Authentication guard for server components.
 *
 * A session whose rotation failed (rejected token or unreachable service) is treated as absent,
 * rather than letting every call hit a 401. The two causes only differ in what the user is told.
 */
export async function exigerSession(redirection = "/login"): Promise<Session> {
  const session = await auth();

  if (!session?.user || sessionInutilisable(session.erreur)) {
    redirect(redirection);
  }

  return session;
}

/**
 * Authorization guard. The backend rejects the call anyway; this avoids showing a screen the user
 * could not use.
 */
export async function exigerCapacite(capacite: Capacite, redirection = "/unauthorized") {
  const session = await exigerSession();

  if (!peut(session.roles, capacite)) {
    redirect(redirection);
  }

  return session;
}
