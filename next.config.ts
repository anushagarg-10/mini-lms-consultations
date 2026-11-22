import type { NextConfig } from "next";

// Security headers applied to every response. A strict CSP is left as a
// follow-up (see README) because it needs nonce plumbing for Next's inline scripts.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Emit a self-contained server in .next/standalone for the Docker image.
  output: "standalone",
  // Don't advertise the framework in response headers.
  poweredByHeader: false,
  // Don't generate AGENTS.md (Next's notes for AI coding tools) in the repo.
  agentRules: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
