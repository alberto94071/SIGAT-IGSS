"use client";
import { useState } from "react";
import {
  RotateCcw, AlertTriangle, Loader2, DownloadCloud, CheckCircle2,
} from "lucide-react";
import { exportarBackupComoSuperadmin } from "@/lib/developer/backup-actions";
import { reiniciarSistemaComoSuperadmin } from "@/lib/developer/reset-actions";

const FRASE_CONFIRMACION = "REINICIAR";

export default function ReiniciarClient() {
  const [descargando, setDescargando] = useState(false);
  const [respaldoDescargado, setRespaldoDescargado] = useState(false);
  const [omitidas, setOmitidas] = useState<string[]>([]);
  const [errorRespaldo, setErrorRespaldo] = useState("");

  const [confirmacion, setConfirmacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ tipo: "error" | "ok"; texto: string } | null>(null);

  async function handleDescargarRespaldo() {
    setDescargando(true);
    setErrorRespaldo("");
    const res = await exportarBackupComoSuperadmin();
    setDescargando(false);
    if ("error" in res) { setErrorRespaldo(res.error); return; }

    const blob = new Blob([JSON.stringify(res.data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const marca = res.data.generado_en.replace(/[:.]/g, "-");
    a.href = url;
    a.download = `sigat-igss-respaldo-${marca}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setRespaldoDescargado(true);
    setOmitidas(res.data.omitidas);
  }

  async function handleReiniciar() {
    if (!confirm(
      "Vas a borrar TODA la operación registrada este ciclo (compras, presupuesto comprometido/devengado, " +
      "fondo rotativo, viáticos, pasajes, etc). La configuración, los catálogos, los firmantes y los usuarios " +
      "NO se tocan. ¿Estás completamente seguro?"
    )) return;

    setLoading(true);
    setResultado(null);
    const res = await reiniciarSistemaComoSuperadmin();
    setLoading(false);

    setResultado(
      "error" in res
        ? { tipo: "error", texto: res.error }
        : { tipo: "ok", texto: "Sistema reiniciado. Todos los saldos volvieron a cero y el sistema queda listo para empezar de nuevo." }
    );
    if (!("error" in res)) {
      setRespaldoDescargado(false);
      setConfirmacion("");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <RotateCcw className="w-5 h-5" /> Reiniciar Sistema
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Borra todos los datos operativos (compras, presupuesto, fondo rotativo, viáticos, pasajes, etc.)
          y deja el sistema listo para empezar un nuevo ciclo desde cero — sin tocar la configuración,
          los catálogos, los firmantes ni los usuarios.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <DownloadCloud className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            Primero descargá un respaldo completo. Si más adelante necesitás consultar algo del ciclo
            anterior, ese mismo archivo se puede volver a cargar (pedile ayuda al programador para
            restaurarlo).
          </p>
        </div>

        <button
          onClick={handleDescargarRespaldo}
          disabled={descargando}
          className="btn-secondary w-full justify-center"
        >
          {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
          Descargar respaldo completo (.json)
        </button>
        {respaldoDescargado && (
          <>
            <p className="flex items-center gap-1.5 text-emerald-600 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" /> Respaldo descargado. Guardalo en un lugar seguro.
            </p>
            {omitidas.length > 0 && (
              <p className="text-amber-600 text-xs">
                Nota: {omitidas.join(", ")} no {omitidas.length === 1 ? "existe" : "existen"} todavía — se omitió del respaldo.
              </p>
            )}
          </>
        )}
        {errorRespaldo && <p className="text-red-600 text-xs">{errorRespaldo}</p>}
      </div>

      <div className="card p-5 space-y-4 border-red-200">
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            Esta acción no se puede deshacer. Se eliminan todas las compras, órdenes, cotizaciones,
            presupuesto comprometido/devengado, fondo rotativo, viáticos y pasajes registrados hasta
            ahora, y los saldos vuelven a su punto de partida.
          </p>
        </div>

        <div>
          <label className="label">
            Para confirmar, escribí <strong>{FRASE_CONFIRMACION}</strong>
          </label>
          <input
            className="input"
            value={confirmacion}
            onChange={e => setConfirmacion(e.target.value)}
            placeholder={FRASE_CONFIRMACION}
          />
        </div>

        {resultado && (
          <div className={`p-3 rounded-lg text-sm ${resultado.tipo === "error"
            ? "bg-red-50 border border-red-200 text-red-700"
            : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`}>
            {resultado.texto}
          </div>
        )}

        <button
          onClick={handleReiniciar}
          disabled={loading || !respaldoDescargado || confirmacion !== FRASE_CONFIRMACION}
          title={!respaldoDescargado ? "Primero descargá el respaldo" : confirmacion !== FRASE_CONFIRMACION ? `Escribí ${FRASE_CONFIRMACION} para confirmar` : undefined}
          className="btn-danger w-full justify-center"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
          Reiniciar sistema
        </button>
      </div>
    </div>
  );
}
