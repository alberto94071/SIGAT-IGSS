import type { Metadata } from "next";
import "./globals.css";

const APP_URL = "https://sigat-igss.vercel.app";

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
    // images: [
    //   {
    //     url: "/og-image.png",   // ← pega aquí la URL de tu imagen cuando la tengas
    //     width: 1200,
    //     height: 630,
    //     alt: "SIGAT — IGSS Tejutla",
    //   },
    // ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SIGAT — Sistema de Gestión Administrativa Tejutla | IGSS",
    description:
      "Plataforma oficial de gestión administrativa del IGSS en Tejutla, San Marcos.",
    // images: ["/og-image.png"],  // ← misma imagen cuando la tengas
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
