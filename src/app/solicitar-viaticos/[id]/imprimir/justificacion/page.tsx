import { notFound } from "next/navigation";
import { requireColaborador } from "@/lib/modulo-access";
import { db } from "@/lib/db";
import { configuracion, catalogoFirmantes } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import { fechaGuatemala } from "@/lib/date-utils";
import { getSolicitud } from "../../../actions";
import ImprimirNarrativoClient from "@/components/ImprimirNarrativoClient";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
  "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// "2026-08-14" → "14 de Agosto de 2026." — mismo formato que la carta real
// que mandó el cliente (2026-09-19), con el mes capitalizado y punto final
// (a diferencia de fechaCorta de otros documentos, en minúscula sin punto).
function fechaCartaFormal(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const mes = MESES[m - 1];
  return `${d} de ${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${y}.`;
}

// "Tacaná, San Marcos" → "San Marcos" — la carta va fechada con la cabecera
// departamental, no con el municipio de la unidad (mismo criterio ya usado
// al revés, quedarse solo con el municipio, en soloMunicipio de Libro
// Bancos — acá es la otra mitad del mismo campo compuesto).
function soloDepartamento(municipio: string): string {
  const partes = municipio.split(",");
  return (partes[1] ?? partes[0]).trim();
}

export default async function ImprimirJustificacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { session } = await requireColaborador();
  const { id } = await params;

  const solicitud = await getSolicitud(Number(id));
  if (!solicitud) notFound();
  if (solicitud.colaborador_id !== Number(session.user.id) || solicitud.estado !== "Aprobado") notFound();

  const [config, firmantes] = await Promise.all([
    db.select().from(configuracion).limit(1).then(r => r[0]),
    db.select().from(catalogoFirmantes).where(eq(catalogoFirmantes.activo, true)).orderBy(asc(catalogoFirmantes.nombre)),
  ]);

  return (
    <ImprimirNarrativoClient
      titulo={`Justificación de Estancia, según Formulario V-L No. ${solicitud.numero_formulario ?? ""}`}
      nombreUnidad={config?.nombre_dependencia_medica ?? ""}
      destinatarioNombre=""
      destinatarioCargo=""
      // A diferencia del Informe de Comisión (que se dirige automáticamente
      // a quien firmó el nombramiento, ver getFirmantePrincipal), la
      // Justificación de Estancia va dirigida al de la DAF — un firmante
      // distinto que no tiene por qué coincidir con el del nombramiento, así
      // que acá SÍ hace falta elegirlo a mano (pedido explícito del cliente
      // 2026-09-17). Mismo catálogo de siempre (Configuración → Firmantes).
      firmantesDirigidoA={firmantes as any}
      // "Carta formal" (2026-09-19) — ver el modelo real que mandó el
      // cliente dirigido al Jefe de DAF: etiqueta "Licenciado:"/unidad sobre
      // el destinatario, saludo "Licenciado {apellido}:", párrafo de
      // cortesía fijo y encabezado en negrita antes del cuerpo (que solo
      // trae los dos párrafos de la justificación, ver
      // generarJustificacionEstancia). "Datos del comisionado" no aplica
      // acá — el destinatario es externo, ese bloque era redundante.
      cartaFormal
      parrafoIntro="De manera atenta me dirijo a usted, para manifestarle lo siguiente:"
      seccionTitulo="JUSTIFICACIÓN DEL PAGO DE CENA Y HOSPEDAJE"
      ocultarDatosComisionado
      personaNombre={solicitud.persona_nombre}
      personaCargo={solicitud.persona_cargo}
      personaNoEmpleado={solicitud.persona_no_empleado}
      lugarYFecha={`${soloDepartamento(config?.municipio ?? "")}, ${fechaCartaFormal(solicitud.fecha_limite ?? fechaGuatemala())}`}
      texto={solicitud.justificacion_estancia}
    />
  );
}
