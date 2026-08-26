import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vehicle photos, avatars, and ID documents all live in Supabase
    // Storage's public buckets — routing them through next/image gets
    // automatic resize + WebP/AVIF re-encoding instead of shipping
    // whatever raw file size a host's phone camera produced. Google/
    // Facebook host domains are here too since avatar_url can point at
    // an OAuth provider's own photo (see oauth-buttons.tsx) instead of
    // an uploaded one — next/image throws at runtime on any remote host
    // not explicitly allowlisted.
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "platform-lookaside.fbsbx.com" },
      { protocol: "https", hostname: "graph.facebook.com" },
    ],
  },
};

export default nextConfig;
