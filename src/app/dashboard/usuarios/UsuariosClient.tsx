"use client";
import { useState } from "react";
import {
  Users, Plus, Pencil, KeyRound, Power, ShieldCheck,
  X, Check, Eye, EyeOff, AlertTriangle
} from "lucide-react";
import {
  PERMISOS_DEFAULT, ROL_LABELS, ROL_COLORS,
  type Rol, type Permisos
} from "@/lib/permisos";
import {
  crearUsuario, editarUsuario, resetPassword,
  toggleActivo, guardarPermisos
} from "./actions";

type Usuario = {
  id: number; nombre: string; email: string;
  rol: Rol; activo: boolean; permisos: string;
  last_login: Date | null; created_at: Date | null;
};

const MODULOS: { key: keyof Permisos; label: string }[] = [
  { key: "servicios",     label: "Servicios"      },
  { key: "pagos",         label: "Pagos"          },
  { key: "banco",         label: "Banco"          },
  { key: "caja_chica",    label: "Caja Chica"     },
  { key: "liquidacion",   label: "Liquidación"    },
  { key: "catalogos",     label: "Catálogos"      },
  { key: "reportes",      label: "Reportes"       },
  { key: "documentos",    label: "Documentos"     },
  { key: "usuarios",      label: "Usuarios"       },
  { key: "configuracion", label: "Configuración"  },
];

interface Props {
  usuarios:      Usuario[];
  isSuperAdmin:  boolean;
  currentUserId: number;
}

export default function UsuariosClient({ usuarios: init, isSuperAdmin, currentUserId }: Props) {
  const [lista,       setLista]       = useState(init);
  const [modal,       setModal]       = useState<"crear" | "editar" | "permisos" | "reset" | null>(null);
  const [selected,    setSelected]    = useState<Usuario | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [newPass,     setNewPass]     = useState("");
  const [permEdit,    setPermEdit]    = useState<Permisos>(PERMISOS_DEFAULT.operador);

  // Form state
  const [nombre,  setNombre]  = useState("");
  const [email,   setEmail]   = useState("");
  const [rolForm, setRolForm] = useState<Rol>("operador");
  const [pass,    setPass]    = useState("");

  function openCrear() {
    setNombre(""); setEmail(""); setRolForm("operador"); setPass(""); setError("");
    setModal("crear");
  }
  function openEditar(u: Usuario) {
    setSelected(u); setNombre(u.nombre); setEmail(u.email);
    setRolForm(u.rol); setError("");
    setModal("editar");
  }
  function openPermisos(u: Usuario) {
    setSelected(u);
    try { setPermEdit({ ...PERMISOS_DEFAULT[u.rol], ...JSON.parse(u.permisos) }); }
    catch { setPermEdit(PERMISOS_DEFAULT[u.rol]); }
    setModal("permisos");
  }
  function openReset(u: Usuario) {
    setSelected(u); setNewPass(""); setError("");
    setModal("reset");
  }
  function closeModal() { setModal(null); setSelected(null); setError(""); }

  async function handleCrear() {
    if (!nombre || !email || !pass) return setError("Complete todos los campos");
    setLoading(true);
    const res = await crearUsuario({ nombre, email, password: pass, rol: rolForm });
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(prev => [...prev, res.usuario!] as unknown as Usuario[]);
    closeModal();
  }

  async function handleEditar() {
    if (!selected) return;
    setLoading(true);
    const res = await editarUsuario({ id: selected.id, nombre, email, rol: rolForm });
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(prev => prev.map(u => u.id === selected.id
      ? { ...u, nombre, email, rol: rolForm } : u));
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

  async function handleToggle(u: Usuario) {
    if (u.id === currentUserId) return;
    await toggleActivo({ id: u.id, activo: !u.activo });
    setLista(prev => prev.map(x => x.id === u.id ? { ...x, activo: !x.activo } : x));
  }

  async function handlePermisos() {
    if (!selected) return;
    setLoading(true);
    const res = await guardarPermisos({ id: selected.id, permisos: permEdit });
    setLoading(false);
    if (res.error) return setError(res.error);
    setLista(prev => prev.map(u =>
      u.id === selected.id ? { ...u, permisos: JSON.stringify(permEdit) } : u));
    closeModal();
  }

  function applyRolDefaults(r: Rol) {
    setRolForm(r);
    if (modal === "permisos") setPermEdit(PERMISOS_DEFAULT[r]);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5" /> Gestión de Usuarios
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{lista.length} usuarios en el sistema</p>
        </div>
        {isSuperAdmin && (
          <button onClick={openCrear} className="btn-primary">
            <Plus className="w-4 h-4" /> Nuevo usuario
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3 text-left">Usuario</th>
              <th className="px-4 py-3 text-left">Rol</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Último ingreso</th>
              {isSuperAdmin && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lista.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                      {u.nombre.slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {u.nombre}
                        {u.id === currentUserId && (
                          <span className="ml-2 text-xs text-gray-400">(yo)</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROL_COLORS[u.rol]}`}>
                    {ROL_LABELS[u.rol]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${u.activo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${u.activo ? "bg-green-500" : "bg-gray-400"}`} />
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {u.last_login
                    ? new Date(u.last_login).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "Nunca"}
                </td>
                {isSuperAdmin && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEditar(u)}
                        title="Editar"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => openPermisos(u)}
                        title="Permisos"
                        className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                        <ShieldCheck className="w-4 h-4" />
                      </button>
                      <button onClick={() => openReset(u)}
                        title="Restablecer contraseña"
                        className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
                        <KeyRound className="w-4 h-4" />
                      </button>
                      {u.id !== currentUserId && (
                        <button onClick={() => handleToggle(u)}
                          title={u.activo ? "Deshabilitar" : "Habilitar"}
                          className={`p-1.5 rounded-lg transition-colors ${u.activo
                            ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                            : "text-gray-400 hover:text-green-600 hover:bg-green-50"}`}>
                          <Power className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── MODAL: Crear / Editar ─────────────────────────────────────────── */}
      {(modal === "crear" || modal === "editar") && (
        <ModalBase
          title={modal === "crear" ? "Nuevo usuario" : "Editar usuario"}
          onClose={closeModal}
          onConfirm={modal === "crear" ? handleCrear : handleEditar}
          loading={loading}
          confirmLabel={modal === "crear" ? "Crear usuario" : "Guardar cambios"}
          error={error}
        >
          <div className="space-y-3">
            <div>
              <label className="label">Nombre completo</label>
              <input className="input" value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div>
              <label className="label">Correo electrónico</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Rol</label>
              <select className="input" value={rolForm} onChange={e => applyRolDefaults(e.target.value as Rol)}>
                {(Object.keys(ROL_LABELS) as Rol[]).map(r => (
                  <option key={r} value={r}>{ROL_LABELS[r]}</option>
                ))}
              </select>
            </div>
            {modal === "crear" && (
              <div>
                <label className="label">Contraseña inicial</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPass ? "text" : "password"}
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                  />
                  <button type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </ModalBase>
      )}

      {/* ── MODAL: Reset contraseña ───────────────────────────────────────── */}
      {modal === "reset" && selected && (
        <ModalBase
          title="Restablecer contraseña"
          onClose={closeModal}
          onConfirm={handleReset}
          loading={loading}
          confirmLabel="Restablecer"
          error={error}
          danger
        >
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700">
                Se cambiará la contraseña de <strong>{selected.nombre}</strong>.
                Comuníquela al usuario de forma segura.
              </p>
            </div>
            <div>
              <label className="label">Nueva contraseña</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? "text" : "password"}
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                />
                <button type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </ModalBase>
      )}

      {/* ── MODAL: Permisos ───────────────────────────────────────────────── */}
      {modal === "permisos" && selected && (
        <ModalBase
          title={`Permisos — ${selected.nombre}`}
          onClose={closeModal}
          onConfirm={handlePermisos}
          loading={loading}
          confirmLabel="Guardar permisos"
          error={error}
          wide
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="label mb-0">Rol base:</label>
              <select
                className="input w-auto"
                value={rolForm}
                onChange={e => applyRolDefaults(e.target.value as Rol)}
              >
                {(Object.keys(ROL_LABELS) as Rol[]).map(r => (
                  <option key={r} value={r}>{ROL_LABELS[r]}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400">Aplicar defaults del rol</p>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="table-header px-4 py-2 grid grid-cols-2 text-xs">
                <span>Módulo</span>
                <span className="text-center">Acceso</span>
              </div>
              {MODULOS.map(m => (
                <div key={m.key}
                  className="grid grid-cols-2 px-4 py-2.5 border-t border-gray-100 hover:bg-gray-50 items-center">
                  <span className="text-sm text-gray-700">{m.label}</span>
                  <div className="flex justify-center">
                    <button
                      onClick={() => setPermEdit(prev => ({ ...prev, [m.key]: !prev[m.key] }))}
                      className={`w-10 h-5 rounded-full transition-colors relative ${permEdit[m.key] ? "bg-brand-500" : "bg-gray-200"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${permEdit[m.key] ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ModalBase>
      )}
    </div>
  );
}

// ── Modal base reutilizable ────────────────────────────────────────────────────
function ModalBase({ title, children, onClose, onConfirm, loading, confirmLabel, error, danger, wide }: {
  title: string; children: React.ReactNode;
  onClose: () => void; onConfirm: () => void;
  loading: boolean; confirmLabel: string; error: string;
  danger?: boolean; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {error && (
          <div className="mx-5 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={danger ? "btn-danger" : "btn-primary"}
          >
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
