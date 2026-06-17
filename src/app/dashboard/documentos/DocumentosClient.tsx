"use client";
import { useState, useMemo } from "react";
import { FileText, Printer, Search, ExternalLink } from "lucide-react";

type PagoDoc = { id: number; siaf_numero: number|null; descripcion: string|null; monto: number|null; estatus: string; numero_cheque: string|null; numero_dab: string|null; proveedor: string|null; cuatrimestre: string|null };
type ChequeDoc = { numero_documento: string|null; tipo_documento: string|null; beneficiario: string|null; mes: string|null };

interface Props { pagos: PagoDoc[]; cheques: ChequeDoc[] }

const TABS = ["SIAF (Forma A-04)", "DAB-60", "Vale de Caja Chica", "Baucher de Pago"];

export default function DocumentosClient({ pagos, cheques }: Props) {
  const [tab,   setTab]   = useState(0);
  const [query, setQuery] = useState("");

  const fmtQ = (n: number|null) =>
    n != null ? `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "—";

  const pagosFiltered = useMemo(() =>
    pagos.filter(p =>
      !query ||
      String(p.siaf_numero ?? "").includes(query) ||
      (p.descripcion ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (p.proveedor ?? "").toLowerCase().includes(query.toLowerCase()) ||
      (p.numero_cheque ?? "").includes(query)
    ), [pagos, query]);

  const chequesFiltered = useMemo(() =>
    cheques.filter(c =>
      !query ||
      (c.numero_documento ?? "").includes(query) ||
      (c.beneficiario ?? "").toLowerCase().includes(query.toLowerCase())
    ), [cheques, query]);

  function openPrint(url: string) {
    window.open(url, "_blank", "width=900,height=700");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Centro de documentos
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Genera e imprime los formularios oficiales del IGSS
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => { setTab(i); setQuery(""); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === i
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por SIAF, insumo, cheque…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      {/* ── SIAF ──────────────────────────────────────────────────── */}
      {tab === 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-500">Selecciona un pago para generar el SIAF Forma A-04</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">SIAF #</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-left">Estatus</th>
                <th className="px-4 py-3 text-center">Imprimir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagosFiltered.slice(0, 50).map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.siaf_numero ?? "—"}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate font-medium text-gray-800">{p.descripcion}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">{p.proveedor}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtQ(p.monto)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.estatus === "Pagado" ? "badge-pagado" : "badge-pendiente"}`}>
                      {p.estatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openPrint(`/imprimir/siaf?id=${p.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg text-xs font-medium transition-colors">
                      <Printer className="w-3.5 h-3.5" /> SIAF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── DAB-60 ───────────────────────────────────────────────── */}
      {tab === 1 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-500">Genera el Documento de Abono DAB-60 por pago</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">N° DAB</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-left">Cheque</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-center">Imprimir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagosFiltered.filter(p => p.estatus === "Pagado").slice(0, 50).map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.numero_dab ?? `C-${p.id}`}</td>
                  <td className="px-4 py-3 max-w-[200px] truncate font-medium text-gray-800">{p.descripcion}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.numero_cheque ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{fmtQ(p.monto)}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openPrint(`/imprimir/dab60?id=${p.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium transition-colors">
                      <Printer className="w-3.5 h-3.5" /> DAB-60
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Vale ─────────────────────────────────────────────────── */}
      {tab === 2 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-500">Genera el Vale de Caja Chica por número de cheque</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">N° Cheque</th>
                <th className="px-4 py-3 text-left">Beneficiario</th>
                <th className="px-4 py-3 text-left">Mes</th>
                <th className="px-4 py-3 text-center">Imprimir Vale</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {chequesFiltered.map(c => (
                <tr key={c.numero_documento} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm font-bold text-gray-700">{c.numero_documento}</td>
                  <td className="px-4 py-3 text-gray-700">{c.beneficiario}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{c.mes}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openPrint(`/imprimir/vale?cheque=${c.numero_documento}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 rounded-lg text-xs font-medium transition-colors">
                      <Printer className="w-3.5 h-3.5" /> Vale
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Baucher ──────────────────────────────────────────────── */}
      {tab === 3 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-500">Genera el Baucher de pago por número de cheque</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">N° Cheque</th>
                <th className="px-4 py-3 text-left">Beneficiario</th>
                <th className="px-4 py-3 text-left">Mes</th>
                <th className="px-4 py-3 text-center">Imprimir Baucher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {chequesFiltered.map(c => (
                <tr key={c.numero_documento} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm font-bold text-gray-700">{c.numero_documento}</td>
                  <td className="px-4 py-3 text-gray-700">{c.beneficiario}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{c.mes}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openPrint(`/imprimir/baucher?cheque=${c.numero_documento}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-medium transition-colors">
                      <Printer className="w-3.5 h-3.5" /> Baucher
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
