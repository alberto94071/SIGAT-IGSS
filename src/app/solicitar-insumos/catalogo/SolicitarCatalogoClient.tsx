"use client";
import { useState } from "react";
import { ShoppingCart, X, AlertTriangle, Check } from "lucide-react";
import CatalogoAlmacenClient from "@/app/almacen/catalogo/CatalogoAlmacenClient";
import { type InsumoAlmacen } from "@/app/almacen/catalogo/actions";
import { agregarInsumoASolicitud } from "../actions";

export default function SolicitarCatalogoClient({ insumos }: { insumos: InsumoAlmacen[] }) {
  const [seleccionado, setSeleccionado] = useState<InsumoAlmacen | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exito, setExito] = useState(false);

  function abrir(insumo: InsumoAlmacen) {
    setSeleccionado(insumo); setCantidad(""); setError(""); setExito(false);
  }
  function cerrar() { setSeleccionado(null); }

  async function confirmar() {
    if (!seleccionado) return;
    const n = parseFloat(cantidad);
    if (!(n > 0)) return setError("Ingresá una cantidad válida");
    setSaving(true); setError("");
    const res = await agregarInsumoASolicitud(seleccionado.id, n);
    setSaving(false);
    if ("error" in res) return setError(res.error);
    setExito(true);
    setTimeout(cerrar, 900);
  }

  return (
    <>
      <CatalogoAlmacenClient insumos={insumos} canEdit={false} onAgregarASolicitud={abrir} />

      {seleccionado && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={cerrar}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-brand-600" /> Agregar a mi solicitud
              </h2>
              <button onClick={cerrar} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{seleccionado.nombre}</p>
              <p className="text-xs text-gray-500">
                Disponible: {seleccionado.cantidad_disponible_total.toLocaleString("es-GT")} {seleccionado.unidad_medida ?? ""}
              </p>
            </div>
            <div>
              <label className="label">Cantidad</label>
              <input type="number" min={0} step="0.01" autoFocus className="input"
                value={cantidad} onChange={e => setCantidad(e.target.value)} />
            </div>
            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
              </div>
            )}
            {exito && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <Check className="w-4 h-4" /> Agregado a tu solicitud
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={cerrar} className="btn-secondary">Cancelar</button>
              <button onClick={confirmar} disabled={saving} className="btn-primary disabled:opacity-50">
                {saving ? "Agregando..." : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
