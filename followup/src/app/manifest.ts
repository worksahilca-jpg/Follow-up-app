import type { MetadataRoute } from "next";

// Lets a phone browser's "Add to Home Screen" install FollowUp with a real
// name, standalone (frameless) window, and branded colors instead of just
// bookmarking the raw URL.
//
// Real sizes, not the 32x32 favicon: a phone stretched that tiny PNG to a
// home-screen icon and it looked blurred (founder, 2026-09-25). These are
// cut from the brand master (public/brand/png/followup-app-icon-1024.png):
// 192/512 keep the brand's rounded square; the maskable one is full-bleed
// so Android's own mask shapes it. iPhone reads src/app/apple-icon.png
// (180, full-bleed — iOS rounds it itself).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FollowUp",
    short_name: "FollowUp",
    description: "The AI teammate that catches the lead that went quiet.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1e1e20",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
