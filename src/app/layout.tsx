import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IGSS — Fondo Rotativo Interno",
  description: "Sistema de gestión del Fondo Rotativo Interno — U.I.A.A.D.D.M. Tejutla",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
