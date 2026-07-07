import type { HojaDeRuta } from "./hoja-de-ruta-actions";

export type Tono = "gray" | "green" | "red" | "amber" | "blue";

// Resumen de una sola línea de en qué punto del flujo va un caso — se usa
// tanto en Hoja de Ruta (con el detalle paso a paso) como en Compras/Archivo
// (solo esta línea, como columna "Destino"). Vive fuera de hoja-de-ruta-actions.ts
// porque ese archivo es "use server" y solo puede exportar funciones async.
export function resumenEstado(h: HojaDeRuta): { texto: string; tono: Tono } {
  if (h.pago) {
    if (h.pago.estado === "Enviado a Bancos")
      return { texto: `Pago con cheque ${h.pago.numero_cheque ?? ""} enviado a Fondo Rotativo/Bancos`, tono: "green" };
    if (h.pago.estado === "Enviado a Liquidación")
      return { texto: `Pago en efectivo (vale ${h.pago.numero_vale ?? "—"}) esperando liquidarse en Caja Chica/Liquidación`, tono: "amber" };
    if (h.pago.estado === "Liquidado")
      return { texto: `Vale ${h.pago.numero_vale ?? "—"} liquidado — en Caja Chica/Libro Caja Chica`, tono: "green" };
    return { texto: "SIAF-04 generado — esperando forma de pago en Fondo Rotativo/Pagos", tono: "blue" };
  }

  if (h.orden) {
    const ref = `${h.orden.numero}/${h.orden.anio}`;
    if (h.orden.estado === "Generada") return { texto: `Orden ${ref} generada — esperando enviar a Presupuesto en Compras/Órdenes`, tono: "blue" };
    if (h.orden.estado === "En Compromiso") return { texto: `Orden ${ref} en Presupuesto/Compromiso — esperando comprometer`, tono: "amber" };
    if (h.orden.estado === "En Devengado") return { texto: `Orden ${ref} en Presupuesto/Devengado — esperando devengar`, tono: "amber" };
    if (h.orden.estado === "En DAB") return { texto: `Orden ${ref} esperando ingresar en Almacén/DAB-60`, tono: "amber" };
    return { texto: `Orden de Compra generada (${ref})`, tono: "green" };
  }

  if (h.acta) {
    if (h.acta.estado === "Rechazada") return { texto: "Acta rechazada — esperando corrección en Junta Adjudicadora/Acta", tono: "red" };
    if (h.acta.estado === "Aprobada") return { texto: "Acta aprobada — pasando a Compras/Órdenes", tono: "blue" };
    return { texto: "Acta generada — esperando previsualización y aprobación en Junta Adjudicadora/Acta", tono: "amber" };
  }

  if (h.consolidacion) {
    const c = h.consolidacion;
    if (c.estado === "Rechazado por Junta") return { texto: "Rechazado por la Junta Adjudicadora — esperando corrección en Compras/Adjudicación", tono: "red" };
    if (c.estado === "Adjudicado") return { texto: "Adjudicado — esperando generar el Acta en Junta Adjudicadora/Acta", tono: "blue" };
    if (c.estado === "Enviado a Junta") return { texto: "Enviado a Junta Adjudicadora — esperando revisión", tono: "amber" };
    if (c.estado === "Enviado a Fondo Rotativo") return { texto: "En bandeja de Fondo Rotativo — esperando generar el SIAF-04", tono: "blue" };
    if (c.estado === "Enviado a Presupuesto") return { texto: "En bandeja de Presupuesto — esperando generar la orden", tono: "blue" };
    return { texto: "En Compras/Adjudicación — pendiente iniciar la adjudicación", tono: "amber" };
  }

  if (h.siaf.estado === "Rechazado") return { texto: "Rechazado — esperando corrección en Compras/A-01 SIAF", tono: "red" };
  if (h.siaf.estado === "Aprobado") return { texto: "Aprobado — esperando consolidarse en Compras/Consolidación", tono: "blue" };
  return { texto: "Borrador — pendiente de aprobar en Compras/A-01 SIAF", tono: "gray" };
}
