import "@/app/globals.css";

export const metadata = { title: "Imprimir — IGSS Fondo Rotativo" };

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-white">
        <div className="print-container">
          {children}
        </div>
      </body>
    </html>
  );
}
