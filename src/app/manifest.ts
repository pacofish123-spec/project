import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "yoRento | Your next journey starts here",
    short_name: "yoRento",
    description: "A trusted vehicle marketplace born in the Dominican Republic.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f6f3ed",
    theme_color: "#183b32",
    icons: [
      { src: "/yorento-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable: Android's adaptive-icon shapes (circle, squircle, ...)
      // crop anything outside a centered safe zone — these have the
      // mark scaled down onto a full-bleed brand-green background so
      // it survives every mask shape instead of getting clipped.
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
