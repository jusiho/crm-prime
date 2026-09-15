import { existsSync } from "node:fs";
import path from "node:path";

// El .env vive en la raíz del monorepo; Next solo lee el de apps/web.
// No pisa variables ya definidas (en Docker vienen del compose, sin .env).
// No usar @next/env: cachea la carga que Next ya hizo y lo ignora.
const rootEnv = path.join(import.meta.dirname, "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@crm/shared"],
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  // Genera un output autónomo para Docker (sin node_modules completos en runtime).
  output: "standalone",
};

export default nextConfig;
