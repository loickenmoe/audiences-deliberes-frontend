import { obtenirJeton } from "@/lib/api/client";
import { getEnv } from "@/lib/env";
import type { Alerte } from "@/types/domaine";

/**
 * Real-time notification channel: STOMP push with HTTP fallback.
 *
 * The backend stores each alert before pushing it to a recipient-specific destination, so the
 * channel is only an accelerator; `GET /alertes/mes-notifications` remains the source of truth.
 *
 * Backend constraints:
 * - `/ws` is exposed through SockJS only (`registry.addEndpoint("/ws").withSockJS()`);
 * - authentication happens on the STOMP `CONNECT` frame, since SockJS fallback transports allow no
 *   `Authorization` header. The token is re-read on every connection (`beforeConnect`) so a
 *   reconnection after rotation uses the current token.
 *
 * Both libraries are imported dynamically: `sockjs-client` touches browser globals, and this module
 * is also loaded server-side and under Node by tests.
 */

/** Personal destination: the broker resolves the `/user` prefix to the sole recipient. */
export const DESTINATION_ALERTES = "/user/queue/alertes";

/** Reconnection delay: short enough to be transparent, long enough not to hammer a down backend. */
export const DELAI_RECONNEXION = 5_000;

export interface CanalAlertes {
  /** Closes the channel and stops reconnection attempts. */
  arreter: () => void;
}

export interface OptionsCanalAlertes {
  /** Called for each pushed alert. */
  surAlerte: (alerte: Alerte) => void;
  /** Called on each channel state change; the screen switches to the fallback when false. */
  surEtat?: (connecte: boolean) => void;
}

/**
 * Parses a frame body. An unreadable payload is ignored: a missed notification is caught up on the
 * next refresh, while an exception in the STOMP handler would kill the subscription.
 */
export function lireAlerte(corps: string): Alerte | null {
  try {
    const objet: unknown = JSON.parse(corps);
    if (!objet || typeof objet !== "object") return null;
    const candidat = objet as Partial<Alerte>;
    if (typeof candidat.id !== "number" || typeof candidat.statut !== "string") return null;
    return candidat as Alerte;
  } catch {
    return null;
  }
}

export async function ouvrirCanalAlertes(options: OptionsCanalAlertes): Promise<CanalAlertes> {
  const [{ Client }, { default: SockJS }] = await Promise.all([
    import("@stomp/stompjs"),
    import("sockjs-client"),
  ]);

  const signalerEtat = (connecte: boolean) => options.surEtat?.(connecte);

  const client = new Client({
    webSocketFactory: () => new SockJS(getEnv().NEXT_PUBLIC_WS_URL),
    reconnectDelay: DELAI_RECONNEXION,
    beforeConnect: async () => {
      const jeton = await obtenirJeton();
      client.connectHeaders = jeton ? { Authorization: `Bearer ${jeton}` } : {};
    },
    onConnect: () => {
      /*
       * Subscribe before announcing the channel open: a STOMP broker keeps nothing for a destination
       * without subscribers, and the fallback is disabled once the channel is reported active.
       */
      client.subscribe(DESTINATION_ALERTES, (message) => {
        const alerte = lireAlerte(message.body);
        if (alerte) options.surAlerte(alerte);
      });
      signalerEtat(true);
    },
    onDisconnect: () => signalerEtat(false),
    onWebSocketClose: () => signalerEtat(false),
    onStompError: () => signalerEtat(false),
  });

  client.activate();

  return {
    arreter: () => {
      signalerEtat(false);
      void client.deactivate();
    },
  };
}
