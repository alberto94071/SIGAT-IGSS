import type { Metadata } from "next";
import "./globals.css";

// OG image con URL absoluta — env vars no disponibles en build time, la imagen requiere URL fija
const PROD_URL = "https://cip-igss.vercel.app";
const OG_IMAGE = `${PROD_URL}/og-image.jpg`;

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || PROD_URL;

const OG_DESCRIPTION =
  "Plataforma del Instituto Guatemalteco de Seguridad Social. Control interno presupuestario: compras, pagos, fondo rotativo, viáticos y reportes administrativos.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "CIP — Control Interno Presupuestario | Instituto Guatemalteco de Seguridad Social",
    template: "%s | CIP · IGSS",
  },
  description: OG_DESCRIPTION,
  keywords: ["IGSS", "CIP", "Control Interno Presupuestario", "Fondo Rotativo", "Guatemala", "gestión administrativa"],
  authors: [{ name: "Instituto Guatemalteco de Seguridad Social" }],
  openGraph: {
    type: "website",
    url: PROD_URL,
    siteName: "CIP · Instituto Guatemalteco de Seguridad Social",
    title: "CIP — Control Interno Presupuestario | IGSS",
    description: OG_DESCRIPTION,
    locale: "es_GT",
    images: [
      {
        url: OG_IMAGE,
        width: 1280,
        height: 672,
        alt: "CIP — Control Interno Presupuestario · Instituto Guatemalteco de Seguridad Social",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CIP — Control Interno Presupuestario | Instituto Guatemalteco de Seguridad Social",
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
