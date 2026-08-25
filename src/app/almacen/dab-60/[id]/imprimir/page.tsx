import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ordenesCompra, configuracion } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { gruposRenglonDeConsolidacion, siafCorrelativosDeConsolidacion, pprPuroParaImprimir } from "@/lib/adjudicacion/renglon-utils";
import { getPosicionesDab60 } from "@/lib/adjudicacion/dab60-actions";
import ImprimirDab60Client from "./ImprimirDab60Client";

interface Props { params: Promise<{ id: string }> }

// "2026-06-23" → "23/06/2026" — el cliente pidió formato fecha, no en
// letras, para el "LUGAR Y FECHA" del DAB-60 (confirmado 2026-08-24).
function fechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export default async function ImprimirDab60Page({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const [orden] = await db.select().from(ordenesCompra).where(eq(ordenesCompra.id, Number(id))).limit(1);
  if (!orden || !orden.dab60_generado_en) notFound();

  if (orden.dab60_anulado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">DAB-60 anulado</h1>
          <p className="text-sm text-gray-500">
            Este DAB-60 fue anulado al devolver la orden a Compras/Adjudicación — ya no se puede imprimir.
          </p>
        </div>
      </div>
    );
  }

  const [renglonesCrudos, a01SiafCorrelativos, config, posicionesGuardadas] = await Promise.all([
    gruposRenglonDeConsolidacion(orden.consolidacion_id),
    siafCorrelativosDeConsolidacion(orden.consolidacion_id),
    db.select().from(configuracion).limit(1),
    getPosicionesDab60(),
  ]);
  const pprPuro = await pprPuroParaImprimir(renglonesCrudos.map(r => r.codigo_ppr));
  const renglones = renglonesCrudos.map(r => ({
    ...r, codigo_ppr: r.codigo_ppr ? (pprPuro.get(r.codigo_ppr) ?? r.codigo_ppr) : r.codigo_ppr,
  }));

  const cfg = config[0];
  const renglonesUnicos = [...new Set(renglones.map(r => r.renglon).filter((r): r is number => r != null))];
  const descripcion = [...new Set(renglones.map(r => r.nombre.trim()).filter(Boolean))].join("; ");

  // El "LUGAR Y FECHA" del formulario debe ser la fecha de ingreso del
  // producto a bodega (dato que se captura al generar el DAB-60), no la
  // fecha en que se creó la Orden de Compra — si todavía no se capturó,
  // se cae de vuelta a la fecha de la orden.
  const fechaFormulario = orden.fecha_ingreso_producto ?? orden.fecha;
  const datos = {
    lugarFecha: cfg ? `${cfg.municipio}, ${fechaCorta(fechaFormulario)}` : fechaCorta(fechaFormulario),
    dependencia: cfg ? cfg.nombre_unidad.toUpperCase() : "",
    claveAdministrativa: cfg?.codigo_centro_costo ?? "",
    ordenCompra: `No. O/C: ${orden.numero}`,
    a01Siaf: a01SiafCorrelativos.join(", "),
    metodoCompra: orden.tipo_compra,
    renglon: renglonesUnicos.join(", "),
    descripcion,
  };

  return (
    <ImprimirDab60Client
      orden={orden as any}
      renglones={renglones as any}
      datos={datos}
      posicionesGuardadas={posicionesGuardadas}
    />
  );
}
