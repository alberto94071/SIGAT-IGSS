"use client";

import { useState } from "react";
import { executeDatabaseReset } from "@/lib/developer/reset-actions";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function DeveloperResetPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success", text: string } | null>(null);

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

        {message && (
          <div className={`p-4 rounded-lg mb-6 text-sm ${message.type === "error" ? "bg-red-950 border border-red-900 text-red-200" : "bg-emerald-950 border border-emerald-900 text-emerald-200"}`}>
            {message.text}
          </div>
        )}

        <button 
          onClick={handleReset}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:shadow-[0_0_25px_rgba(220,38,38,0.5)] flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <AlertTriangle className="w-5 h-5" />}
          EJECUTAR REINICIO TOTAL
        </button>
        <button onClick={() => setUnlocked(false)} className="w-full mt-4 text-xs text-gray-500 hover:text-gray-300">
          ← Volver y bloquear
        </button>
      </div>
    </div>
  );
}
