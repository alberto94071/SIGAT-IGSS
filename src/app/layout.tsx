import type { Metadata } from "next";
import "./globals.css";

// Vercel inyecta VERCEL_URL automáticamente en cada deployment
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const OG_IMAGE = `${APP_URL}/og-image.jpg`;

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "SIGAT — Sistema de Gestión Administrativa Tejutla | IGSS",
    template: "%s | SIGAT · IGSS Tejutla",
  },
  description:
    "Sistema interno de gestión administrativa del Instituto Guatemalteco de Seguridad Social — Consultorio Tejutla, San Marcos. Fondo Rotativo, Viáticos y más.",
  keywords: ["IGSS", "SIGAT", "Tejutla", "San Marcos", "Fondo Rotativo", "Guatemala", "gestión administrativa"],
  authors: [{ name: "IGSS — U.I.A.A.D.D.M. Tejutla" }],
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: "SIGAT · IGSS Tejutla",
    title: "SIGAT — Sistema de Gestión Administrativa Tejutla",
    description:
      "Plataforma oficial de gestión administrativa del IGSS en Tejutla, San Marcos. Fondo Rotativo Interno, control de pagos, servicios y reportes.",
    locale: "es_GT",
    images: [
      {
        url: OG_IMAGE,
        width: 1280,
        height: 672,
        alt: "SIGAT — Sistema Integral de Gestión Administrativa y Financiera · IGSS Tejutla",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SIGAT — Sistema de Gestión Administrativa Tejutla | IGSS",
    description:
      "Plataforma oficial de gestión administrativa del IGSS en Tejutla, San Marcos.",
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
