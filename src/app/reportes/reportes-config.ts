import { type Permisos } from "@/lib/permisos";

// Un grupo por cada módulo existente del sistema — el menú de Reportes los
// muestra TODOS (pedido explícito del cliente: "en la barra de tareas me
// van a salir todos los módulos que existen"), aunque todavía no tengan
// ningún reporte cargado (Sidebar.tsx los muestra deshabilitados con "Sin
// reportes todavía" en vez de ocultarlos). Para agregar un reporte nuevo:
// 1) agregar su `tab_reportes_*` a Permisos (permisos.ts) + TABS_DEFAULT_ABIERTAS,
// 2) agregar la entrada acá, 3) crear su carpeta bajo reportes/<grupo>/<reporte>/.
export type ReporteDef = { label: string; href: string; permiso: keyof Permisos };
export type GrupoReporte = { id: string; label: string; icon: string; reportes: ReporteDef[] };

export const REPORTES_GRUPOS: GrupoReporte[] = [
  {
    id: "compras", label: "Compras", icon: "ShoppingCart",
    reportes: [
      { label: "A-01 SIAF — todos los insumos", href: "/reportes/compras/a01-siaf", permiso: "tab_reportes_compras_a01siaf" },
    ],
  },
  { id: "presupuesto",            label: "Presupuesto",             icon: "Calculator",    reportes: [] },
  { id: "junta-adjudicadora",     label: "Junta Adjudicadora",      icon: "Gavel",         reportes: [] },
  { id: "almacen",                label: "Almacén",                 icon: "Archive",       reportes: [] },
  { id: "fondo-rotativo",         label: "Fondo Rotativo",          icon: "RotateCcw",     reportes: [] },
  { id: "caja-chica",             label: "Caja Chica",              icon: "Wallet",        reportes: [] },
  { id: "pasajes",                label: "Pasajes",                 icon: "Bus",           reportes: [] },
  { id: "viaticos",                label: "Viáticos",                icon: "MapPin",        reportes: [] },
  { id: "contrato-cotizaciones",  label: "Contrato y Cotizaciones", icon: "FileSignature", reportes: [] },
  { id: "base-datos",             label: "Base de Datos",           icon: "Database",      reportes: [] },
];
