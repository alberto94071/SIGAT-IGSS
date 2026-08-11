"use client";

import { useState } from "react";
import Link from "next/link";
import { executeDatabaseReset } from "@/lib/developer/reset-actions";
import { exportarBackup } from "@/lib/developer/backup-actions";
import { AlertTriangle, Loader2, DownloadCloud, CheckCircle2, History } from "lucide-react";

export default function DeveloperResetClient() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success", text: string } | null>(null);

  const [descargando, setDescargando] = useState(false);
  const [respaldoDescargado, setRespaldoDescargado] = useState(false);
  const [omitidas, setOmitidas] = useState<string[]>([]);
  const [errorRespaldo, setErrorRespaldo] = useState("");

  async function handleDescargarRespaldo() {
    setDescargando(true);
    setErrorRespaldo("");
    const res = await exportarBackup(password);
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

  async function handleReset() {
    if (!confirm("ADVERTENCIA: Vas a eliminar todos los registros transaccionales de la base de datos (SIAFs, consolidaciones, cotizaciones, órdenes, etc) y a restablecer saldos a cero. ¿ESTÁS COMPLETAMENTE SEGURO?")) return;

    setLoading(true);
    setMessage(null);
    const result = await executeDatabaseReset(password);
    setLoading(false);

    if ("error" in result) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "Base de datos reiniciada con éxito. Todos los saldos están en cero." });
    }
  }

  if (!unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 font-mono text-gray-300">
        <div className="max-w-md w-full p-6 border border-gray-800 bg-gray-900 rounded-xl shadow-2xl">
          <h1 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-500">
            <AlertTriangle className="w-5 h-5" /> Acceso Restringido
          </h1>
          <p className="text-sm mb-6 text-gray-400">Esta área es exclusivamente para el programador. Ingresa la clave de desarrollador para continuar.</p>
          <form onSubmit={(e) => { e.preventDefault(); if(password) setUnlocked(true); }}>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 transition-colors mb-4"
              placeholder="Clave de desarrollador"
            />
            <button type="submit" className="w-full bg-red-900/50 hover:bg-red-900 text-red-100 font-bold py-2 rounded-lg transition-colors border border-red-800">
              Desbloquear
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 font-mono text-gray-300">
      <div className="max-w-md w-full p-6 border border-red-900 bg-gray-900 rounded-xl shadow-2xl">
        <h1 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-500">
          <AlertTriangle className="w-5 h-5" /> ZONA DE PELIGRO
        </h1>
        <p className="text-sm mb-6 text-gray-400">
          Estás a punto de ejecutar un comando de truncado en cascada. Se eliminarán permanentemente todas las transacciones generadas en la base de datos de producción.
        </p>

        <div className="mb-6 p-4 rounded-lg border border-gray-800 bg-gray-950/60">
          <p className="text-xs text-gray-400 mb-3">
            Antes de reiniciar, descarga un respaldo completo del sistema (todas las tablas, no solo lo que se va a borrar). Si algún día necesitas regresar a este punto exacto, ese mismo archivo se carga en{" "}
            <Link href="/developer/peligro/restaurar" className="text-red-400 underline">Restaurar respaldo</Link>.
          </p>
          <button
            onClick={handleDescargarRespaldo}
            disabled={descargando || !password}
            className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-100 font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {descargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
            Descargar respaldo completo (.json)
          </button>
          {respaldoDescargado && (
            <>
              <p className="flex items-center gap-1.5 text-emerald-400 text-xs mt-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Respaldo descargado. Guárdalo en un lugar seguro.
              </p>
              {omitidas.length > 0 && (
                <p className="text-amber-400 text-xs mt-1">
                  Nota: {omitidas.join(", ")} no {omitidas.length === 1 ? "existe" : "existen"} todavía en esta base de datos — se omitieron.
                </p>
              )}
            </>
          )}
          {errorRespaldo && <p className="text-red-400 text-xs mt-2">{errorRespaldo}</p>}
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-6 text-sm ${message.type === "error" ? "bg-red-950 border border-red-900 text-red-200" : "bg-emerald-950 border border-emerald-900 text-emerald-200"}`}>
            {message.text}
          </div>
        )}

        <button
          onClick={handleReset}
          disabled={loading || !respaldoDescargado}
          title={!respaldoDescargado ? "Primero descarga un respaldo completo" : undefined}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:shadow-[0_0_25px_rgba(220,38,38,0.5)] flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
          EJECUTAR REINICIO TOTAL
        </button>
        {!respaldoDescargado && (
          <p className="text-center text-xs text-gray-500 mt-2">Descarga el respaldo primero para poder reiniciar.</p>
        )}

        <Link href="/developer/peligro/restaurar" className="w-full mt-4 text-xs text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1.5">
          <History className="w-3.5 h-3.5" /> Restaurar desde un respaldo anterior
        </Link>
        <button onClick={() => setUnlocked(false)} className="w-full mt-3 text-xs text-gray-500 hover:text-gray-300">
          ← Volver y bloquear
        </button>
      </div>
    </div>
  );
}
