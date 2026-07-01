"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function ImportPacPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "running" | "ok" | "error">("idle");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const rol = (session?.user as any)?.rol;
  if (rol && rol !== "superadmin") {
    router.replace("/dashboard");
    return null;
  }

  async function handleImport() {
    setStatus("running");
    setResult(null);
    try {
      const res = await fetch("/api/admin/import-pac", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStatus("ok");
        setResult(data);
      } else {
        setStatus("error");
        setResult(data);
      }
    } catch (e: any) {
      setStatus("error");
      setResult({ error: e.message });
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-20 p-8 border rounded-xl shadow space-y-6">
      <h1 className="text-xl font-bold">Importar PAC 2026 a la base de datos</h1>
      <p className="text-sm text-gray-600">
        Carga 579 insumos únicos a <b>base_datos_central</b>, 1,404 filas a{" "}
        <b>catalogo_compras</b> y 99 renglones a <b>presupuesto_renglones</b>.
        Solo disponible para superadmin. Puedes ejecutarlo más de una vez (no crea duplicados).
      </p>

      <button
        onClick={handleImport}
        disabled={status === "running"}
        className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
      >
        {status === "running" ? "Importando… (puede tardar 30–60 s)" : "Ejecutar importación"}
      </button>

      {status === "ok" && result && (
        <div className="p-4 bg-green-50 border border-green-300 rounded-lg text-sm space-y-1">
          <p className="font-semibold text-green-700">Importación completada</p>
          <p>presupuesto_renglones: <b>{(result.results as any)?.presupuesto_renglones}</b> filas</p>
          <p>base_datos_central: <b>{(result.results as any)?.base_datos_central}</b> filas nuevas</p>
          <p>catalogo_compras: <b>{(result.results as any)?.catalogo_compras}</b> filas</p>
        </div>
      )}

      {status === "error" && result && (
        <div className="p-4 bg-red-50 border border-red-300 rounded-lg text-sm">
          <p className="font-semibold text-red-700">Error</p>
          <pre className="text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
