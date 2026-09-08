import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

/**
 * Les documents de la GED sont servis par des URL MinIO pré-signées (cf. RF-01 / QF-06).
 * L'hôte est déclaré ici pour que next/image puisse les afficher ; le contrôle CORS côté
 * MinIO reste à vérifier au jalon F10.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost", port: "9000" },
      { protocol: "http", hostname: "localhost", port: "8080" },
    ],
  },
};

export default createNextIntlPlugin("./i18n/request.ts")(nextConfig);
