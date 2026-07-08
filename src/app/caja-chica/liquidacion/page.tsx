import { getLiquidacionesPendientes } from "@/lib/caja-chica-liquidacion-actions";
import { getValeActivo, getUsoValePasajes, getUsoValeGastosVarios } from "@/lib/vale-actions";
import LiquidacionClient from "./LiquidacionClient";

export default async function CajaChicaLiquidacionPage() {
  const [pagos, valePasajes, valeGastosVarios] = await Promise.all([
    getLiquidacionesPendientes(),
    getValeActivo("pasajes"),
    getValeActivo("gastos_varios"),
  ]);

  const usoPasajes = valePasajes && valePasajes.estado === "Activo" ? await getUsoValePasajes(valePasajes.id) : null;
  const totalGastosVarios = valeGastosVarios && valeGastosVarios.estado === "Activo" ? await getUsoValeGastosVarios(valeGastosVarios.id) : null;

  return (
    <LiquidacionClient
      pagos={pagos}
      valePasajes={valePasajes?.estado === "Activo" ? valePasajes : null}
      usoPasajes={usoPasajes}
      valeGastosVarios={valeGastosVarios?.estado === "Activo" ? valeGastosVarios : null}
      usoGastosVarios={totalGastosVarios}
    />
  );
}
