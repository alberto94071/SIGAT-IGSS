"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { restaurarBackup, type BackupData } from "@/lib/developer/backup-actions";
import { AlertTriangle, Loader2, UploadCloud, ArrowLeft } from "lucide-react";

export default function DeveloperRestorePage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [backup, setBackup] = useState<BackupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleArchivo(file: File | null) {
    setArchivo(file);
    setBackup(null);
    setMessage(null);
    if (!file) return;
    try {
      const texto = await file.text();
      const data = JSON.parse(texto) as BackupData;
      if (data.version !== 1 || !data.tablas) {
        setMessage({ type: "error", text: "Este archivo no tiene el formato de un respaldo válido." });
        return;
      }
      setBackup(data);
    } catch {
      setMessage({ type: "error", text: "No se pudo leer el archivo — asegúrate de que sea el .json descargado desde Reinicio de base de datos." });
    }
  }

  async function handleRestaurar() {
    if (!backup) return;
    if (!confirm(
      `ADVERTENCIA: Esto va a BORRAR todo lo que hay ahora mismo en la base de datos y lo va a reemplazar con el respaldo generado el ${new Date(backup.generado_en).toLocaleString("es-GT")}. Todo lo que haya pasado después de esa fecha se pierde. ¿ESTÁS COMPLETAMENTE SEGURO?`
    )) return;

    setLoading(true);
    setMessage(null);
    const result = await restaurarBackup(password, backup);
    setLoading(false);

    if ("error" in result) {
      setMessage({ type: "error", text: result.error });
    } else {
      const nota = result.omitidas.length > 0
        ? ` (nota: ${result.omitidas.join(", ")} no ${result.omitidas.length === 1 ? "existe" : "existen"} en esta base de datos y se omitieron)`
        : "";
      setMessage({ type: "success", text: `Sistema restaurado con éxito al estado del respaldo.${nota}` });
      setArchivo(null);
      setBackup(null);
      if (inputRef.current) inputRef.current.value = "";
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
          <form onSubmit={(e) => { e.preventDefault(); if (password) setUnlocked(true); }}>
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
          <AlertTriangle className="w-5 h-5" /> RESTAURAR RESPALDO
        </h1>
        <p className="text-sm mb-6 text-gray-400">
          Carga un archivo .json generado desde Reinicio de base de datos → Descargar respaldo completo. Al restaurar, TODO lo que haya ahora en la base de datos se reemplaza por el contenido de ese archivo — es tan destructivo como el reinicio, solo que en vez de dejarlo en cero, lo deja como estaba en ese momento.
        </p>

        <label className="block w-full mb-4">
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => handleArchivo(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <span
            onClick={() => inputRef.current?.click()}
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-100 font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" /> {archivo ? archivo.name : "Elegir archivo de respaldo"}
          </span>
        </label>

        {backup && (
          <div className="mb-6 p-3 rounded-lg border border-gray-800 bg-gray-950/60 text-xs text-gray-400">
            Respaldo generado el <span className="text-gray-200">{new Date(backup.generado_en).toLocaleString("es-GT")}</span>.
            <br />
            {Object.values(backup.tablas).reduce((s, f) => s + f.length, 0)} registros en {Object.keys(backup.tablas).length} tablas.
          </div>
        )}

        {message && (
          <div className={`p-4 rounded-lg mb-6 text-sm ${message.type === "error" ? "bg-red-950 border border-red-900 text-red-200" : "bg-emerald-950 border border-emerald-900 text-emerald-200"}`}>
            {message.text}
          </div>
        )}

        <button
          onClick={handleRestaurar}
          disabled={loading || !backup}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:shadow-[0_0_25px_rgba(220,38,38,0.5)] flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
          RESTAURAR ESTE RESPALDO
        </button>

        <Link href="/developer/peligro/reset" className="w-full mt-4 text-xs text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a Reinicio de base de datos
        </Link>
      </div>
    </div>
  );
}
