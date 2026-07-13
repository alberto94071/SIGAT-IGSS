import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  RotateCcw, MapPin, Bus, ArrowRight, Construction,
  ShieldCheck, ShoppingCart, Database, Calculator, Wallet,
  Archive, Library, Gavel, FileSignature, UserCog, Route
} from "lucide-react";
import { type Modulo, type Rol } from "@/lib/permisos";
import { getPermisosFrescos } from "@/lib/modulo-access";
import LogoutButton from "./LogoutButton";
import PersonalizacionButton from "@/components/PersonalizacionButton";
import { getMisPreferenciasUI } from "@/lib/preferencias-actions";

const MODULES = [
  {
    id: "compras",
    title: "Compras",
    description: "Catálogo de insumos autorizados, emisión de A-01 SIAF y gestión de órdenes de compra.",
    href: "/compras",
    icon: ShoppingCart,
    color: "bg-green-500",
    ring: "ring-green-200",
    textColor: "text-green-600",
    bgLight: "bg-green-50",
    available: true,
    permiso: "mod_compras" as Modulo | null,
  },
  {
    id: "fondo-rotativo",
    title: "Fondo Rotativo",
    description: "SIAF-04, Pagos, Bancos, Vales, Voucher y Libro de Caja Chica de las compras Regularizado del fondo rotativo interno.",
    href: "/dashboard/siaf-04",
    icon: RotateCcw,
    color: "bg-orange-500",
    ring: "ring-orange-200",
    textColor: "text-orange-600",
    bgLight: "bg-orange-50",
    available: true,
    permiso: "mod_fondo_rotativo" as Modulo | null,
  },
  {
    id: "base-datos",
    title: "Base de datos central",
    description: "Catálogo SIGES con proyecciones presupuestarias 2027-2031. Consulta, filtra y administra todos los registros de insumos y servicios.",
    href: "/base-datos",
    icon: Database,
    color: "bg-blue-600",
    ring: "ring-blue-200",
    textColor: "text-blue-600",
    bgLight: "bg-blue-50",
    available: true,
    permiso: "mod_base_datos" as Modulo | null,
  },
  {
    id: "viaticos",
    title: "Pago de Viáticos",
    description: "Registro, autorización y control del pago de viáticos al personal de la unidad.",
    href: "/viaticos",
    icon: MapPin,
    color: "bg-blue-500",
    ring: "ring-blue-200",
    textColor: "text-blue-600",
    bgLight: "bg-blue-50",
    available: false,
    permiso: "mod_viaticos" as Modulo | null,
  },
  {
    id: "pasajes",
    title: "Pago de Pasajes",
    description: "Solicitud de pasaje (SPS-75), DPD-23, tarifario y pólizas de pasajes pagados a afiliados.",
    href: "/pasajes",
    icon: Bus,
    color: "bg-purple-500",
    ring: "ring-purple-200",
    textColor: "text-purple-600",
    bgLight: "bg-purple-50",
    available: true,
    permiso: "mod_pasajes" as Modulo | null,
  },
  {
    id: "presupuesto",
    title: "Presupuesto",
    description: "Control general, compromiso y devengado, programación y modificaciones presupuestarias.",
    href: "/presupuesto",
    icon: Calculator,
    color: "bg-indigo-500",
    ring: "ring-indigo-200",
    textColor: "text-indigo-600",
    bgLight: "bg-indigo-50",
    available: true,
    permiso: "mod_presupuesto" as Modulo | null,
  },
  {
    id: "caja-chica",
    title: "Caja Chica",
    description: "Vale de Caja Chica, Liquidación y Libro de Caja Chica.",
    href: "/caja-chica",
    icon: Wallet,
    color: "bg-amber-500",
    ring: "ring-amber-200",
    textColor: "text-amber-600",
    bgLight: "bg-amber-50",
    available: true,
    permiso: "mod_caja_chica" as Modulo | null,
  },
  {
    id: "almacen",
    title: "Almacén",
    description: "Catálogo, formularios DAB-60 y DAB-75, y cuadrícula de existencias.",
    href: "/almacen",
    icon: Archive,
    color: "bg-teal-500",
    ring: "ring-teal-200",
    textColor: "text-teal-600",
    bgLight: "bg-teal-50",
    available: false,
    permiso: "mod_almacen" as Modulo | null,
  },
  {
    id: "libros",
    title: "Libros",
    description: "Libro de banco, libro de conciliación y libro de caja chica.",
    href: "/libros",
    icon: Library,
    color: "bg-slate-500",
    ring: "ring-slate-200",
    textColor: "text-slate-600",
    bgLight: "bg-slate-50",
    available: false,
    permiso: "mod_libros" as Modulo | null,
  },
  {
    id: "junta-adjudicadora",
    title: "Junta Adjudicadora",
    description: "Adjudicaciones resueltas y actas de la Junta Adjudicadora.",
    href: "/junta-adjudicadora",
    icon: Gavel,
    color: "bg-red-500",
    ring: "ring-red-200",
    textColor: "text-red-600",
    bgLight: "bg-red-50",
    available: true,
    permiso: "mod_junta_adjudicadora" as Modulo | null,
  },
  {
    id: "contrato-cotizaciones",
    title: "Contrato y Cotizaciones",
    description: "NOG, cotizaciones de proveedores y contratos abiertos vigentes.",
    href: "/contrato-cotizaciones",
    icon: FileSignature,
    color: "bg-cyan-500",
    ring: "ring-cyan-200",
    textColor: "text-cyan-600",
    bgLight: "bg-cyan-50",
    available: true,
    permiso: "mod_contrato_cotizaciones" as Modulo | null,
  },
  {
    id: "administracion",
    title: "Administración",
    description: "Creación de usuarios, control de acceso a cada módulo y configuración general de la unidad.",
    href: "/administracion",
    icon: UserCog,
    color: "bg-rose-500",
    ring: "ring-rose-200",
    textColor: "text-rose-600",
    bgLight: "bg-rose-50",
    available: true,
    permiso: "mod_administracion" as Modulo | null,
  },
  {
    id: "hoja-de-ruta",
    title: "Hoja de Ruta",
    description: "Rastrea el estado de un pedido o solicitud a lo largo de todo su recorrido, desde el A-01 SIAF hasta el pago.",
    href: "/hoja-de-ruta",
    icon: Route,
    color: "bg-teal-500",
    ring: "ring-teal-200",
    textColor: "text-teal-600",
    bgLight: "bg-teal-50",
    available: true,
    permiso: "mod_hoja_de_ruta" as Modulo | null,
  },
];

export default async function LauncherPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const rol = session.user.rol as Rol;
  const permisos = await getPermisosFrescos(Number(session.user.id), rol);
  const modules = MODULES.filter(m => m.permiso === null || permisos[m.permiso]);

  const userName = session.user.name ?? session.user.email ?? "Usuario";
  const prefs = await getMisPreferenciasUI();
  const cm = prefs.color_modulos; // si está definido, sobreescribe el color de cada tarjeta

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--cip-fondo, #f3f4f6)" }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="shadow-lg" style={{ background: "var(--cip-barra-grad, linear-gradient(to right, #166534, #16a34a))" }}>
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-white/15 rounded-xl flex items-center justify-center ring-2 ring-white/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight leading-none">CIP</h1>
              <p className="text-green-200 text-xs mt-0.5">
                Control Interno Presupuestario · Instituto Guatemalteco de Seguridad Social
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PersonalizacionButton variant="launcher" />
            <LogoutButton userName={userName} />
          </div>
        </div>
      </header>

      {/* ── Subheader ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <p className="text-sm text-gray-500">
            Selecciona el módulo al que deseas acceder
          </p>
        </div>
      </div>

      {/* ── Module grid ─────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                className={`
                  bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden
                  flex flex-col transition-all duration-200
                  ${mod.available
                    ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                    : "opacity-80"
                  }
                `}
              >
                {/* Card top bar color (personalizable) */}
                <div className={`h-1.5 w-full ${cm ? "" : mod.color}`} style={cm ? { backgroundColor: cm } : undefined} />

                {/* Card body */}
                <div className="p-6 flex flex-col flex-1">
                  {/* Icon */}
                  <div
                    className={`w-14 h-14 ${cm ? "ring-transparent" : `${mod.bgLight} ${mod.ring}`} ring-4 rounded-xl flex items-center justify-center mb-4`}
                    style={cm ? { backgroundColor: `${cm}1f` } : undefined}
                  >
                    <Icon className={`w-7 h-7 ${cm ? "" : mod.textColor}`} style={cm ? { color: cm } : undefined} />
                  </div>

                  {/* Title + badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-lg font-semibold text-gray-900 leading-tight">
                      {mod.title}
                    </h2>
                    {!mod.available && (
                      <span className="shrink-0 flex items-center gap-1 text-[10px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mt-0.5">
                        <Construction className="w-3 h-3" />
                        Próximamente
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-500 leading-relaxed flex-1">
                    {mod.description}
                  </p>

                  {/* Action */}
                  <div className="mt-5">
                    {mod.available ? (
                      <Link
                        href={mod.href}
                        className={`
                          inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                          ${cm ? "" : mod.color} text-white hover:opacity-90 transition-opacity w-full justify-center
                        `}
                        style={cm ? { backgroundColor: cm } : undefined}
                      >
                        Ingresar
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <Link
                        href={mod.href}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors w-full justify-center"
                      >
                        Ver detalle
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <p className="text-center text-xs text-gray-400">
          CIP · Control Interno Presupuestario · Instituto Guatemalteco de Seguridad Social &nbsp;·&nbsp; v1.0
        </p>
      </footer>
    </div>
  );
}
