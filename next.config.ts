import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

/**
 * Les documents de la GED sont servis par des URL MinIO pré-signées (cf. RF-01 / QF-06).
 * L'hôte est déclaré ici pour que next/image puisse les afficher ; le contrôle CORS côté
 * MinIO reste à vérifier au jalon F10.
 */
/**
 * En-têtes de sécurité (revue F17).
 *
 * Aucun n'était posé : l'application pouvait être encadrée dans une page tierce, et le navigateur
 * était libre de deviner le type des réponses. Ces quatre en-têtes couvrent les risques que le
 * frontend peut traiter seul, sans dépendre du déploiement.
 *
 * **Ce qui n'est délibérément pas fait ici.** Une politique de sécurité du contenu (CSP) complète
 * suppose un `nonce` par requête, donc un middleware, et casserait silencieusement l'hydratation si
 * elle était posée à l'aveugle. Seule la directive `frame-ancestors` est déclarée — elle ne dépend
 * d'aucun script en ligne. La CSP complète et `Strict-Transport-Security` relèvent de la mise en
 * production sous TLS, avec la DSI : les poser ici, sur un déploiement en clair, donnerait
 * l'illusion d'une protection sans l'apporter.
 */
const ENTETES_SECURITE = [
  // Encadrement dans une page tierce : la seule défense contre le détournement de clic.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Le navigateur n'invente pas le type d'une réponse — un document mal typé ne devient pas script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Une référence de dossier ne doit pas fuiter dans l'URL de référence d'un site externe.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // L'application n'a besoin ni de caméra, ni de micro, ni de position.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** L'en-tête `X-Powered-By` annonce la pile au premier venu : sans valeur, et informatif pour qui cherche. */
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "9000" },
      { protocol: "http", hostname: "localhost", port: "8080" },
    ],
  },
  async headers() {
    return [{ source: "/:chemin*", headers: ENTETES_SECURITE }];
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
