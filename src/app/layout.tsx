import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  parsePreferencias, cssVarsDePreferencias, FONT_SIZE_MAP, DEFAULT_PREFERENCIAS,
} from "@/lib/preferencias";

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Preferencias de interfaz del usuario logueado, resueltas del lado del
  // servidor y estampadas directamente en <html> — sin parpadeo ni props.
  let prefs = DEFAULT_PREFERENCIAS;
  try {
    const session = await auth();
    if (session) {
      const [row] = await db.select({ preferencias_ui: usuarios.preferencias_ui })
        .from(usuarios).where(eq(usuarios.id, Number(session.user.id))).limit(1);
      prefs = parsePreferencias(row?.preferencias_ui);
    }
  } catch {
    // Sin sesión o sin DB (build): se usan los defaults.
  }

  return (
    <html
      lang="es"
      className={prefs.tema === "oscuro" ? "dark" : undefined}
      style={{ fontSize: FONT_SIZE_MAP[prefs.tamano_letra], ...cssVarsDePreferencias(prefs) } as React.CSSProperties}
    >
      <body className="antialiased">{children}</body>
    </html>
  );
}
