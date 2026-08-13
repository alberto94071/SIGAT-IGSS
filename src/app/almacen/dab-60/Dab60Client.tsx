"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, X, Loader2, Send, CheckCircle, Pencil, Printer, Wallet } from "lucide-react";
import { generarDab60, aprobarDab60, generarDab60FondoRotativo, type Dab60Data, type Dab60DataFr } from "@/lib/adjudicacion/dab60-actions";
import type { PagoFondoRotativo } from "@/lib/adjudicacion/fondo-rotativo-pagos-actions";
import RenglonBadges from "@/components/RenglonBadges";

type Orden = {
  id: number; numero: number; anio: number;
  proveedor_nit: string | null; proveedor_nombre: string | null;
  total: number | null; no_compromiso: string | null;
  no_recibo_almacen: string | null; serie_recibo_almacen: string | null; encargado_almacen: string | null;
  fecha_ingreso_producto: string | null; no_factura: string | null; serie_factura: string | null;
  fecha_emision: string | null; lote: string | null; fecha_vencimiento: string | null;
  marca: string | null; modelo: string | null; serie: string | null;
  renglones: { renglon: number | null; subproducto: string; nombre: string; cantidad: number }[];
};

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type CampoOpcional = Omit<Dab60Data, "no_recibo_almacen" | "serie_recibo_almacen" | "encargado_almacen">;

const CAMPOS: { key: keyof CampoOpcional; label: string; tipo: "date" | "text" }[] = [
  { key: "fecha_ingreso_producto", label: "Fecha de ingreso del producto", tipo: "date" },
  { key: "no_factura",             label: "No. Factura",                  tipo: "text" },
  { key: "serie_factura",          label: "Serie de factura",             tipo: "text" },
  { key: "fecha_emision",          label: "Fecha de emisión",             tipo: "date" },
  { key: "lote",                   label: "Lote",                        tipo: "text" },
  { key: "fecha_vencimiento",      label: "Fecha de vencimiento",         tipo: "date" },
  { key: "marca",                  label: "Marca",                       tipo: "text" },
  { key: "modelo",                 label: "Modelo",                      tipo: "text" },
  { key: "serie",                  label: "Serie",                       tipo: "text" },
];

export default function Dab60Client({ ordenes: init, pendientesAprobacion: initPendientes, pagosFondoRotativo: initFr }: {
  ordenes: Orden[]; pendientesAprobacion: Orden[]; pagosFondoRotativo: PagoFondoRotativo[];
}) {
  const [ordenes, setOrdenes] = useState(init);
  const [pendientesAprobacion, setPendientesAprobacion] = useState(initPendientes);
  const [pagosFondoRotativo, setPagosFondoRotativo] = useState(initFr);
  const [dabFor, setDabFor] = useState<Orden | null>(null);
  const [dabFrFor, setDabFrFor] = useState<PagoFondoRotativo | null>(null);
  const [acciones, setAcciones] = useState<Record<number, { cargando: boolean; error: string | null }>>({});

  async function handleAprobar(id: number) {
    setAcciones(prev => ({ ...prev, [id]: { cargando: true, error: null } }));
    const res = await aprobarDab60(id);
    if ("error" in res) {
      setAcciones(prev => ({ ...prev, [id]: { cargando: false, error: res.error } }));
    } else {
      setAcciones(prev => ({ ...prev, [id]: { cargando: false, error: null } }));
      setPendientesAprobacion(p => p.filter(o => o.id !== id));
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Archive className="w-5 h-5" /> DAB-60
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{ordenes.length} orden(es) pendiente(s) de ingresar a Almacén</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Orden</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No. Compromiso</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordenes.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    OC-{String(o.numero).padStart(3, "0")}/{o.anio}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{o.no_compromiso ?? "—"}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{o.proveedor_nombre ?? "—"}</p>
                    {o.proveedor_nit && <p className="text-xs text-gray-400">NIT: {o.proveedor_nit}</p>}
                    <RenglonBadges renglones={o.renglones} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {o.total != null ? Q(o.total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setDabFor(o)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors ml-auto">
                      <Archive className="w-3 h-3" /> Generar DAB-60
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ordenes.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay órdenes pendientes de ingresar a Almacén.</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900">Pendientes de aprobación de DAB-60</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {pendientesAprobacion.length} orden(es) con DAB-60 generado, esperando aprobación antes de pasar a Presupuesto/Devengado. Si algo se ingresó mal, corrígelo aquí con "Editar" antes de aprobar.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">Orden</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">No./Serie Recibo</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendientesAprobacion.map(o => {
                const a = acciones[o.id];
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                      OC-{String(o.numero).padStart(3, "0")}/{o.anio}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">
                      {o.no_recibo_almacen ?? "—"} / {o.serie_recibo_almacen ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{o.proveedor_nombre ?? "—"}</p>
                      {o.proveedor_nit && <p className="text-xs text-gray-400">NIT: {o.proveedor_nit}</p>}
                      <RenglonBadges renglones={o.renglones} />
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                      {o.total != null ? Q(o.total) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/almacen/dab-60/${o.id}/imprimir`}
                          title="Imprimir"
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                          <Printer className="w-4 h-4" />
                        </Link>
                        <button onClick={() => setDabFor(o)} disabled={a?.cargando}
                          title="Editar"
                          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleAprobar(o.id)} disabled={a?.cargando}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                          {a?.cargando ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Aprobar
                        </button>
                      </div>
                      {a?.error && <p className="text-red-600 text-xs mt-1 max-w-[220px] text-right ml-auto">{a.error}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pendientesAprobacion.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay DAB-60 pendientes de aprobación.</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-4 h-4" /> Fondo Rotativo pendientes de ingresar a Almacén
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          {pagosFondoRotativo.length} pago(s) Regularizado(s) esperando DAB-60 antes de seguir a Fondo Rotativo/Pagos.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left whitespace-nowrap">No. A-04 SIAF</th>
                <th className="px-4 py-3 text-left">Destinatario</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Factura</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagosFondoRotativo.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                    {p.numero_a04 != null ? `${p.numero_a04}/${p.anio_a04}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{p.destinatario_nombre ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {p.serie_factura}-{p.no_factura} · {p.fecha_emision_factura}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                    {p.total != null ? Q(p.total) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => setDabFrFor(p)}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors ml-auto">
                      <Archive className="w-3 h-3" /> Generar DAB-60
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagosFondoRotativo.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay pagos de Fondo Rotativo pendientes de ingresar a Almacén.</p>
            </div>
          )}
        </div>
      </div>

      {dabFor && (
        <Dab60Modal
          orden={dabFor}
          onClose={() => setDabFor(null)}
          onDone={(orden, esNuevo) => {
            if (esNuevo) {
              setOrdenes(p => p.filter(o => o.id !== orden.id));
              setPendientesAprobacion(p => [...p, orden]);
            } else {
              setPendientesAprobacion(p => p.map(o => o.id === orden.id ? orden : o));
            }
            setDabFor(null);
          }}
        />
      )}

      {dabFrFor && (
        <Dab60FrModal
          pago={dabFrFor}
          onClose={() => setDabFrFor(null)}
          onDone={(pagoId) => {
            setPagosFondoRotativo(p => p.filter(x => x.id !== pagoId));
            setDabFrFor(null);
          }}
        />
      )}
    </div>
  );
}

function Dab60Modal({ orden: o, onClose, onDone }: {
  orden: Orden; onClose: () => void; onDone: (orden: Orden, esNuevo: boolean) => void;
}) {
  const router = useRouter();
  const esNuevo = !o.no_recibo_almacen;
  const [noRecibo, setNoRecibo] = useState(o.no_recibo_almacen ?? "");
  const [serieRecibo, setSerieRecibo] = useState(o.serie_recibo_almacen ?? "");
  const [encargado, setEncargado] = useState(o.encargado_almacen ?? "");
  const [data, setData] = useState<CampoOpcional>({
    fecha_ingreso_producto: o.fecha_ingreso_producto ?? "", no_factura: o.no_factura ?? "",
    serie_factura: o.serie_factura ?? "", fecha_emision: o.fecha_emision ?? "",
    lote: o.lote ?? "", fecha_vencimiento: o.fecha_vencimiento ?? "",
    marca: o.marca ?? "", modelo: o.modelo ?? "", serie: o.serie ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof CampoOpcional, value: string) {
    setData(p => ({ ...p, [key]: value }));
  }

  async function handleEnviar() {
    if (!noRecibo.trim() || !serieRecibo.trim())
      return setError("El No. y la Serie de Recibo de Almacén son obligatorios");
    if (!encargado.trim())
      return setError("El nombre del Encargado de Almacén es obligatorio");
    setSaving(true); setError("");
    const res = await generarDab60(o.id, {
      ...data, no_recibo_almacen: noRecibo, serie_recibo_almacen: serieRecibo, encargado_almacen: encargado,
    });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    const ordenActualizada: Orden = {
      ...o, ...data,
      no_recibo_almacen: noRecibo.trim(), serie_recibo_almacen: serieRecibo.trim(), encargado_almacen: encargado.trim(),
    };
    if (esNuevo) router.push(`/almacen/dab-60/${o.id}/imprimir`);
    onDone(ordenActualizada, esNuevo);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">DAB-60 — OC-{String(o.numero).padStart(3, "0")}/{o.anio}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 grid grid-cols-2 gap-3">
          <div>
            <label className="label">No. de Recibo de Almacén</label>
            <input className="input" value={noRecibo} onChange={e => setNoRecibo(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Serie de Recibo de Almacén</label>
            <input className="input" value={serieRecibo} onChange={e => setSerieRecibo(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Encargado de Almacén</label>
            <input className="input" value={encargado} onChange={e => setEncargado(e.target.value)} />
          </div>
          <p className="col-span-2 text-xs text-gray-400 -mt-1 mb-1">
            El resto de estos datos son opcionales — puedes dejarlos en blanco y completarlos después.
          </p>
          {CAMPOS.map(({ key, label, tipo }) => (
            <div key={key} className={tipo === "date" ? "" : "col-span-2 sm:col-span-1"}>
              <label className="label">{label}</label>
              <input type={tipo} className="input" value={data[key]} onChange={e => set(key, e.target.value)} />
            </div>
          ))}
          {error && (
            <div className="col-span-2 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleEnviar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {esNuevo ? "Generar DAB-60" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

type CampoOpcionalFr = Omit<Dab60DataFr, "no_recibo_almacen" | "serie_recibo_almacen" | "encargado_almacen">;

const CAMPOS_FR: { key: keyof CampoOpcionalFr; label: string; tipo: "date" | "text" }[] = [
  { key: "fecha_ingreso_producto", label: "Fecha de ingreso del producto", tipo: "date" },
  { key: "lote",                   label: "Lote",                        tipo: "text" },
  { key: "fecha_vencimiento",      label: "Fecha de vencimiento",         tipo: "date" },
  { key: "marca",                  label: "Marca",                       tipo: "text" },
  { key: "modelo",                 label: "Modelo",                      tipo: "text" },
  { key: "serie",                  label: "Serie",                       tipo: "text" },
];

// Igual que Dab60Modal, pero para pagos de Fondo Rotativo — sin campos de
// factura (ya se conocen desde el SIAF-04) y en un solo paso: al enviar, el
// pago ya queda en Fondo Rotativo/Pagos, sin bandeja de aprobación aparte.
function Dab60FrModal({ pago: p, onClose, onDone }: {
  pago: PagoFondoRotativo; onClose: () => void; onDone: (pagoId: number) => void;
}) {
  const router = useRouter();
  const [noRecibo, setNoRecibo] = useState("");
  const [serieRecibo, setSerieRecibo] = useState("");
  const [encargado, setEncargado] = useState("");
  const [data, setData] = useState<CampoOpcionalFr>({
    fecha_ingreso_producto: "", lote: "", fecha_vencimiento: "", marca: "", modelo: "", serie: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof CampoOpcionalFr, value: string) {
    setData(prev => ({ ...prev, [key]: value }));
  }

  async function handleEnviar() {
    if (!noRecibo.trim() || !serieRecibo.trim())
      return setError("El No. y la Serie de Recibo de Almacén son obligatorios");
    if (!encargado.trim())
      return setError("El nombre del Encargado de Almacén es obligatorio");
    setSaving(true); setError("");
    const res = await generarDab60FondoRotativo(p.id, {
      ...data, no_recibo_almacen: noRecibo, serie_recibo_almacen: serieRecibo, encargado_almacen: encargado,
    });
    setSaving(false);
    if ("error" in res) return setError(res.error);
    router.push(`/almacen/dab-60/fondo-rotativo/${p.id}/imprimir`);
    onDone(p.id);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-gray-900">
            DAB-60 — A-04 {p.numero_a04 != null ? `${p.numero_a04}/${p.anio_a04}` : ""}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-5 grid grid-cols-2 gap-3">
          <div>
            <label className="label">No. de Recibo de Almacén</label>
            <input className="input" value={noRecibo} onChange={e => setNoRecibo(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label">Serie de Recibo de Almacén</label>
            <input className="input" value={serieRecibo} onChange={e => setSerieRecibo(e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Encargado de Almacén</label>
            <input className="input" value={encargado} onChange={e => setEncargado(e.target.value)} />
          </div>
          <p className="col-span-2 text-xs text-gray-400 -mt-1 mb-1">
            El resto de estos datos son opcionales — puedes dejarlos en blanco y completarlos después.
          </p>
          {CAMPOS_FR.map(({ key, label, tipo }) => (
            <div key={key} className={tipo === "date" ? "" : "col-span-2 sm:col-span-1"}>
              <label className="label">{label}</label>
              <input type={tipo} className="input" value={data[key]} onChange={e => set(key, e.target.value)} />
            </div>
          ))}
          {error && (
            <div className="col-span-2 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleEnviar} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Generar DAB-60
          </button>
        </div>
      </div>
    </div>
  );
}
