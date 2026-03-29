import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling packages that require native binaries or
  // a persistent Node.js process.  These are used only in API routes and
  // must be required at runtime, not bundled by Webpack/Turbopack.
  serverExternalPackages: ['whatsapp-web.js', 'puppeteer', 'puppeteer-core'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
