import type { Metadata } from "next";
import "./globals.css";

// OG image con URL absoluta — env vars no disponibles en build time, la imagen requiere URL fija
const PROD_URL = "https://sigat-igss.vercel.app";
const OG_IMAGE = `${PROD_URL}/og-image.jpg`;

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || PROD_URL;

const OG_DESCRIPTION =
  "Plataforma del IGSS en Tejutla, San Marcos. Gestión de compras, pagos, fondo rotativo, viáticos y reportes administrativos.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "SIGAT — Sistema de Gestión Administrativa Tejutla | IGSS",
    template: "%s | SIGAT · IGSS Tejutla",
  },
  description: OG_DESCRIPTION,
  keywords: ["IGSS", "SIGAT", "Tejutla", "San Marcos", "Fondo Rotativo", "Guatemala", "gestión administrativa"],
  authors: [{ name: "IGSS — U.I.A.A.D.D.M. Tejutla" }],
  openGraph: {
    type: "website",
    url: PROD_URL,
    siteName: "SIGAT · IGSS Tejutla",
    title: "SIGAT — Sistema de Gestión Administrativa Tejutla",
    description: OG_DESCRIPTION,
    locale: "es_GT",
    images: [
      {
        url: OG_IMAGE,
        width: 1280,
        height: 672,
        alt: "SIGAT — Sistema Integral de Gestión Administrativa · IGSS Tejutla",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SIGAT — Sistema de Gestión Administrativa Tejutla | IGSS",
    description: OG_DESCRIPTION,
    images: [OG_IMAGE],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
