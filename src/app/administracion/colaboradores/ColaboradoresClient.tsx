"use client";
import { useState } from "react";
import { Users, Plus, Pencil, KeyRound, Power, X, Eye, EyeOff } from "lucide-react";
import { crearColaborador, editarColaborador, type Colaborador } from "./actions";
import { resetPassword, toggleActivo } from "../actions";

export default function ColaboradoresClient({ colaboradores: init }: {
  colaboradores: Colaborador[];
}) {
  const [lista, setLista] = useState(init);
  const [modal, setModal] = useState<"crear" | "editar" | "reset" | null>(null);
  const [selected, setSelected] = useState<Colaborador | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [nombre, setNombre] = useState("");
  const [ibm, setIbm] = useState("");
  const [puesto, setPuesto] = useState("");
  const [pass, setPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [nit, setNit] = useState("");
  const [salario, setSalario] = useState("");
  const [grupo, setGrupo] = useState("");
  const [categoriaPuesto, setCategoriaPuesto] = useState("");

  function openCrear() {
    setNombre(""); setIbm(""); setPuesto(""); setPass(""); setError(""); setShowPass(false);
    setNit(""); setSalario(""); setGrupo(""); setCategoriaPuesto("");
    setModal("crear");
  }
  function openEditar(c: Colaborador) {
    setSelected(c); setNombre(c.nombre); setIbm(c.ibm ?? ""); setPuesto(c.puesto_nominal ?? ""); setError("");
    setNit(c.nit ?? ""); setSalario(c.salario != null ? String(c.salario) : ""); setGrupo(c.grupo ?? ""); setCategoriaPuesto(c.categoria_puesto ?? "");
    setModal("editar");
  }
  function openReset(c: Colaborador) {
    setSelected(c); setNewPass(""); setError(""); setShowPass(false);
    setModal("reset");
  }
  function closeModal() { setModal(null); setSelected(null); setError(""); }

  async function handleCrear() {
    if (!nombre.trim() || !ibm.trim() || !puesto.trim() || !pass) return setError("Complete todos los campos");
    setLoading(true);
    const res = await crearColaborador({
      nombre, ibm, puesto_nominal: puesto, password: pass,
      nit, grupo, categoria_puesto: categoriaPuesto, salario: salario.trim() ? Number(salario) : null,
    });
    setLoading(false);
    if ("error" in res) return setError(res.error);
    setLista(prev => [...prev, res.colaborador].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    closeModal();
  }

  async function handleEditar() {
    if (!selected) return;
    if (!nombre.trim() || !ibm.trim() || !puesto.trim()) return setError("Complete todos los campos");
    setLoading(true);
    const res = await editarColaborador({
      id: selected.id, nombre, ibm, puesto_nominal: puesto,
      nit, grupo, categoria_puesto: categoriaPuesto, salario: salario.trim() ? Number(salario) : null,
    });
    setLoading(false);
    if ("error" in res) return setError(res.error);
    setLista(prev => prev.map(c => c.id === selected.id ? {
      ...c, nombre, ibm, puesto_nominal: puesto, nit: nit || null, grupo: grupo || null,
      categoria_puesto: categoriaPuesto || null, salario: salario.trim() ? Number(salario) : null,
    } : c));
    closeModal();
  }

  async function handleReset() {
    if (!selected || !newPass) return setError("Ingrese la nueva contraseña");
    setLoading(true);
    const res = await resetPassword({ id: selected.id, password: newPass });
    setLoading(false);
    if (res.error) return setError(res.error);
    closeModal();
  }

  async function handleToggle(c: Colaborador) {
    await toggleActivo({ id: c.id, activo: !c.activo });
    setLista(prev => prev.map(x => x.id === c.id ? { ...x, activo: !x.activo } : x));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" /> Colaboradores
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Usuarios de autoservicio — solo pueden Solicitar Insumos (y, más adelante, Viáticos). {lista.length} colaborador(es).
          </p>
        </div>
        <button onClick={openCrear}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Nuevo Colaborador
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">IBM</th>
                <th className="px-4 py-3 text-left">Puesto Nominal</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{c.nombre}</td>
                  <td className="px-4 py-3 font-mono text-gray-600 whitespace-nowrap">{c.ibm}</td>
                  <td className="px-4 py-3 text-gray-700">{c.puesto_nominal}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.activo ? "Activo" : "Inhabilitado"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditar(c)} title="Editar"
                        className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-gray-100">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => openReset(c)} title="Restablecer contraseña"
                        className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-gray-100">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleToggle(c)} title={c.activo ? "Inhabilitar" : "Habilitar"}
                        className={`p-1.5 rounded-lg hover:bg-gray-100 ${c.activo ? "text-gray-400 hover:text-red-600" : "text-gray-400 hover:text-green-600"}`}>
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Todavía no hay colaboradores registrados.</p>
            </div>
          )}
        </div>
      </div>

      {modal === "crear" && (
        <ModalBase title="Nuevo Colaborador" onClose={closeModal} onConfirm={handleCrear}
          loading={loading} confirmLabel="Crear" error={error}>
          <div className="space-y-3">
            <div>
              <label className="label">Nombre completo</label>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div>
              <label className="label">IBM (número de empleado)</label>
              <input className="input font-mono" value={ibm} onChange={e => setIbm(e.target.value)} />
            </div>
            <div>
              <label className="label">Puesto nominal</label>
              <input className="input" value={puesto} onChange={e => setPuesto(e.target.value)} />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <div className="relative">
                <input type={showPass ? "text" : "password"} className="input pr-10" value={pass} onChange={e => setPass(e.target.value)} />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">El colaborador inicia sesión con su IBM y esta contraseña.</p>
            </div>
            <DatosViaticoFields nit={nit} setNit={setNit} salario={salario} setSalario={setSalario}
              grupo={grupo} setGrupo={setGrupo} categoriaPuesto={categoriaPuesto} setCategoriaPuesto={setCategoriaPuesto} />
          </div>
        </ModalBase>
      )}

      {modal === "editar" && selected && (
        <ModalBase title="Editar Colaborador" onClose={closeModal} onConfirm={handleEditar}
          loading={loading} confirmLabel="Guardar" error={error}>
          <div className="space-y-3">
            <div>
              <label className="label">Nombre completo</label>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div>
              <label className="label">IBM (número de empleado)</label>
              <input className="input font-mono" value={ibm} onChange={e => setIbm(e.target.value)} />
            </div>
            <div>
              <label className="label">Puesto nominal</label>
              <input className="input" value={puesto} onChange={e => setPuesto(e.target.value)} />
            </div>
            <DatosViaticoFields nit={nit} setNit={setNit} salario={salario} setSalario={setSalario}
              grupo={grupo} setGrupo={setGrupo} categoriaPuesto={categoriaPuesto} setCategoriaPuesto={setCategoriaPuesto} />
          </div>
        </ModalBase>
      )}

      {modal === "reset" && selected && (
        <ModalBase title={`Restablecer contraseña — ${selected.nombre}`} onClose={closeModal} onConfirm={handleReset}
          loading={loading} confirmLabel="Restablecer" error={error}>
          <div>
            <label className="label">Nueva contraseña</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} className="input pr-10" value={newPass} onChange={e => setNewPass(e.target.value)} />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </ModalBase>
      )}
    </div>
  );
}

// Datos que solo hacen falta para Viáticos (Formulario V-L) — opcionales,
// un colaborador que solo pide insumos puede no tenerlos nunca.
function DatosViaticoFields({ nit, setNit, salario, setSalario, grupo, setGrupo, categoriaPuesto, setCategoriaPuesto }: {
  nit: string; setNit: (v: string) => void;
  salario: string; setSalario: (v: string) => void;
  grupo: string; setGrupo: (v: string) => void;
  categoriaPuesto: string; setCategoriaPuesto: (v: string) => void;
}) {
  return (
    <div className="pt-2 border-t border-gray-100 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Datos para Viáticos (opcional)</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">NIT</label>
          <input className="input font-mono" value={nit} onChange={e => setNit(e.target.value)} />
        </div>
        <div>
          <label className="label">Salario</label>
          <input type="number" step="0.01" className="input" value={salario} onChange={e => setSalario(e.target.value)} />
        </div>
        <div>
          <label className="label">Grupo</label>
          <input className="input" value={grupo} onChange={e => setGrupo(e.target.value)} />
        </div>
        <div>
          <label className="label">Categoría de puesto</label>
          <input className="input" value={categoriaPuesto} onChange={e => setCategoriaPuesto(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function ModalBase({ title, children, onClose, onConfirm, loading, confirmLabel, error }: {
  title: string; children: React.ReactNode;
  onClose: () => void; onConfirm: () => void;
  loading: boolean; confirmLabel: string; error: string;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {error && (
          <div className="mx-5 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={onConfirm} disabled={loading} className="btn-primary">
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
