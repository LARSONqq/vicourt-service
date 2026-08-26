import type {
  MetadataRoute,
} from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ViCourt Service",
    short_name: "ViCourt",
    description:
      "Система керування об’єктами, завданнями, складом і роботою команди.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color:
      "#f3f4f6",
    theme_color: "#166534",
    lang: "uk",
    icons: [
      {
        src: "/icons/vicourt-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/vicourt-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/vicourt-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
