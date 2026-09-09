import type { MetadataRoute } from "next";

// Lets a phone browser's "Add to Home Screen" install FollowUp with a real
// name, standalone (frameless) window, and branded colors instead of just
// bookmarking the raw URL. Reuses the existing icon.tsx route rather than
// generating separate large sizes — most mobile OSes scale a 32x32 PNG
// fine for a home-screen icon, and predicting the URL generateImageMetadata
// would produce for multiple sizes isn't worth the risk of a broken
// reference for what's a nice-to-have, not a redesign.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FollowUp",
    short_name: "FollowUp",
    description: "The AI teammate that catches the lead that went quiet.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f9fb",
    theme_color: "#3b82c4",
    icons: [{ src: "/icon", sizes: "32x32", type: "image/png" }],
  };
}
