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
    description: "Never lose a lead because you forgot to follow up.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#7c3aed",
    icons: [{ src: "/icon", sizes: "32x32", type: "image/png" }],
  };
}
