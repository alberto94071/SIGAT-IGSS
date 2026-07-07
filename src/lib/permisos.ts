export type Rol = "superadmin" | "admin" | "operador" | "consulta";

export interface Permisos {
  // ── Fondo Rotativo interno ──
  servicios:    boolean;
  pagos:        boolean;
  banco:        boolean;
  caja_chica:   boolean;
  liquidacion:  boolean;
  catalogos:    boolean;
  reportes:     boolean;
  documentos:   boolean;
  usuarios:     boolean;
  configuracion:boolean;
  // ── Módulos del launcher ──
  mod_compras:               boolean;
  mod_presupuesto:           boolean;
  mod_junta_adjudicadora:    boolean;
  mod_almacen:               boolean;
  mod_caja_chica:            boolean;
  mod_libros:                boolean;
  mod_viaticos:              boolean;
  mod_pasajes:               boolean;
  mod_contrato_cotizaciones: boolean;
  mod_base_datos:            boolean;
  mod_fondo_rotativo:        boolean;
  // Administración — usuarios, accesos y configuración general. Solo el superadmin la trae por defecto
  mod_administracion:        boolean;
}

export type Modulo =
  | "mod_compras" | "mod_presupuesto" | "mod_junta_adjudicadora" | "mod_almacen"
  | "mod_caja_chica" | "mod_libros" | "mod_viaticos" | "mod_pasajes"
  | "mod_contrato_cotizaciones" | "mod_base_datos" | "mod_fondo_rotativo"
  | "mod_administracion";

const MODULOS_DEFAULT = {
  mod_compras: true, mod_presupuesto: true, mod_junta_adjudicadora: true,
  mod_almacen: true, mod_caja_chica: true, mod_libros: true,
  mod_viaticos: true, mod_pasajes: true, mod_contrato_cotizaciones: true,
  mod_base_datos: true, mod_fondo_rotativo: true,
};

// Permisos por defecto según el rol
export const PERMISOS_DEFAULT: Record<Rol, Permisos> = {
  superadmin: {
    servicios: true, pagos: true, banco: true, caja_chica: true,
    liquidacion: true, catalogos: true, reportes: true,
    documentos: true, usuarios: true, configuracion: true,
    ...MODULOS_DEFAULT, mod_administracion: true,
  },
  admin: {
    servicios: true, pagos: true, banco: true, caja_chica: true,
    liquidacion: true, catalogos: true, reportes: true,
    documentos: true, usuarios: false, configuracion: false,
    ...MODULOS_DEFAULT, mod_administracion: false,
  },
  operador: {
    servicios: true, pagos: true, banco: true, caja_chica: true,
    liquidacion: false, catalogos: false, reportes: true,
    documentos: true, usuarios: false, configuracion: false,
    ...MODULOS_DEFAULT, mod_administracion: false,
  },
  consulta: {
    servicios: false, pagos: false, banco: false, caja_chica: false,
    liquidacion: false, catalogos: false, reportes: true,
    documentos: false, usuarios: false, configuracion: false,
    ...MODULOS_DEFAULT, mod_administracion: false,
  },
};

export const ROL_LABELS: Record<Rol, string> = {
  superadmin: "Super Administrador",
  admin:      "Administrador",
  operador:   "Operador",
  consulta:   "Consulta",
};

export const ROL_COLORS: Record<Rol, string> = {
  superadmin: "bg-purple-100 text-purple-800",
  admin:      "bg-blue-100 text-blue-800",
  operador:   "bg-green-100 text-green-800",
  consulta:   "bg-gray-100 text-gray-700",
};

export function parsePermisos(permisos_json: string, rol: Rol): Permisos {
  try {
    const custom = JSON.parse(permisos_json);
    return { ...PERMISOS_DEFAULT[rol], ...custom };
  } catch {
    return PERMISOS_DEFAULT[rol];
  }
}

export function canAccess(permisos: Permisos, modulo: keyof Permisos): boolean {
  return permisos[modulo] === true;
}

// Nav items con su permiso requerido — rutas del módulo Fondo Rotativo
export const NAV_ITEMS = [
  { href: "/dashboard/siaf-04",            label: "SIAF-04",            icon: "FileText",  permiso: null },
  { href: "/dashboard/pagos",              label: "Pagos",               icon: "Wallet",    permiso: null },
  { href: "/dashboard/bancos",             label: "Bancos",              icon: "Landmark",  permiso: null },
  { href: "/dashboard/voucher",            label: "Voucher",             icon: "Receipt",   permiso: null },
  { href: "/dashboard/libro-conciliacion", label: "Libro Conciliación",  icon: "Scale",     permiso: null },
  { href: "/dashboard/libro-caja-chica",   label: "Libro Caja Chica",    icon: "Coins",     permiso: null },
] as const;
