// Aparte de ImprimirVCClient.tsx porque ese archivo es "use client" — una
// función exportada desde ahí no se puede invocar desde un Server Component
// (page.tsx), aunque sea una función pura sin nada de React.
export function nombramientosUnicos(
  comisiones: { nombramiento_numero: string | null; fecha_nombramiento: string | null }[]
): { numero: string; fecha: string }[] {
  const vistos = new Set<string>();
  const out: { numero: string; fecha: string }[] = [];
  for (const c of comisiones) {
    if (!c.nombramiento_numero || vistos.has(c.nombramiento_numero)) continue;
    vistos.add(c.nombramiento_numero);
    out.push({ numero: c.nombramiento_numero, fecha: c.fecha_nombramiento ?? "" });
  }
  return out;
}
