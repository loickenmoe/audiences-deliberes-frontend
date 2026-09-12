import { obtenirJeton } from "@/lib/api/client";
import { getEnv } from "@/lib/env";
import type { Alerte } from "@/types/domaine";

/**
 * Canal temps réel des notifications (QF-11 — tranché en F14 : **push STOMP avec repli HTTP**).
 *
 * Le backend publie chaque alerte sur une destination propre au destinataire et l'enregistre
 * **avant** de tenter la diffusion. Le canal n'est donc qu'un accélérateur : il fait apparaître la
 * notification sans rechargement, et `GET /alertes/mes-notifications` reste la source de vérité si
 * le navigateur est hors ligne, le courtier indisponible ou l'onglet rouvert plus tard.
 *
 * Deux contraintes du backend dictent la forme du client :
 * - l'endpoint `/ws` n'est exposé qu'**en SockJS** (`registry.addEndpoint("/ws").withSockJS()`),
 *   une WebSocket native sur cette URL ne négocierait rien ;
 * - l'authentification se fait sur la trame STOMP `CONNECT`, pas sur la poignée de main HTTP —
 *   les transports de repli de SockJS ne permettent pas d'en-tête `Authorization`. Le jeton est
 *   relu **à chaque connexion** (`beforeConnect`) : après une rotation, la reconnexion repart avec
 *   le jeton courant et non avec celui capturé au montage.
 *
 * Les deux bibliothèques sont importées dynamiquement : `sockjs-client` touche des globales du
 * navigateur, et ce module est aussi lu côté serveur et sous Node par les tests.
 */

/** Destination personnelle : le préfixe `/user` est résolu par le courtier vers le seul destinataire. */
export const DESTINATION_ALERTES = "/user/queue/alertes";

/** Reconnexion : assez court pour être transparent, assez long pour ne pas marteler un backend éteint. */
export const DELAI_RECONNEXION = 5_000;

export interface CanalAlertes {
  /** Ferme le canal et arrête les tentatives de reconnexion. */
  arreter: () => void;
}

export interface OptionsCanalAlertes {
  /** Appelé pour chaque alerte poussée. */
  surAlerte: (alerte: Alerte) => void;
  /** Appelé à chaque changement d'état du canal — l'écran bascule sur le repli quand il est faux. */
  surEtat?: (connecte: boolean) => void;
}

/**
 * Lit le corps d'une trame. Une charge illisible est ignorée plutôt que propagée : une notification
 * manquée se rattrape au prochain rafraîchissement, une exception dans le gestionnaire STOMP
 * emporterait l'abonnement.
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
      signalerEtat(true);
      client.subscribe(DESTINATION_ALERTES, (message) => {
        const alerte = lireAlerte(message.body);
        if (alerte) options.surAlerte(alerte);
      });
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
