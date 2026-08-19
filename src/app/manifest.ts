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
    ],
  };
}
