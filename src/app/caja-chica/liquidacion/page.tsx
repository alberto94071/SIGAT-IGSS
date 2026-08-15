import { getValeActivo, getUsoValePasajes, getUsoValeGastosVarios } from "@/lib/vale-actions";
import LiquidacionClient from "./LiquidacionClient";

export default async function CajaChicaLiquidacionPage() {
  const [valePasajes, valeGastosVarios] = await Promise.all([
    getValeActivo("pasajes"),
    getValeActivo("gastos_varios"),
  ]);

  const usoPasajes = valePasajes && valePasajes.estado === "Activo" ? await getUsoValePasajes(valePasajes.id) : null;
  const usoGastosVarios = valeGastosVarios && valeGastosVarios.estado === "Activo" ? await getUsoValeGastosVarios(valeGastosVarios.id) : null;

  return (
    <LiquidacionClient
      valePasajes={valePasajes?.estado === "Activo" ? valePasajes : null}
      usoPasajes={usoPasajes}
      valeGastosVarios={valeGastosVarios?.estado === "Activo" ? valeGastosVarios : null}
      usoGastosVarios={usoGastosVarios}
    />
  );
}
