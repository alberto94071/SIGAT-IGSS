import type { MetadataRoute } from "next";

// Manifest PWA: permite instalar el CIP como aplicación de escritorio/móvil
// con el logo y el nombre propios.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CIP — Control Interno Presupuestario",
    short_name: "CIP",
    description:
      "Plataforma del Instituto Guatemalteco de Seguridad Social. Control interno presupuestario: compras, pagos, fondo rotativo, viáticos y reportes administrativos.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#1e3a5f",
    lang: "es-GT",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
