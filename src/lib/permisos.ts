export type Rol = "superadmin" | "admin" | "operador" | "consulta";

export interface Permisos {
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
}

// Permisos por defecto según el rol
export const PERMISOS_DEFAULT: Record<Rol, Permisos> = {
  superadmin: {
    servicios: true, pagos: true, banco: true, caja_chica: true,
    liquidacion: true, catalogos: true, reportes: true,
    documentos: true, usuarios: true, configuracion: true,
  },
  admin: {
    servicios: true, pagos: true, banco: true, caja_chica: true,
    liquidacion: true, catalogos: true, reportes: true,
    documentos: true, usuarios: false, configuracion: false,
  },
  operador: {
    servicios: true, pagos: true, banco: true, caja_chica: true,
    liquidacion: false, catalogos: false, reportes: true,
    documentos: true, usuarios: false, configuracion: false,
  },
  consulta: {
    servicios: false, pagos: false, banco: false, caja_chica: false,
    liquidacion: false, catalogos: false, reportes: true,
    documentos: false, usuarios: false, configuracion: false,
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

// Nav items con su permiso requerido
export const NAV_ITEMS = [
  { href: "/dashboard",              label: "Inicio",         icon: "LayoutDashboard", permiso: null          },
  { href: "/dashboard/siaf-04",      label: "SIAF-04",        icon: "FileText",        permiso: null          },
  { href: "/dashboard/poliza",       label: "Póliza",         icon: "FileCheck",       permiso: null          },
  { href: "/dashboard/viatico",      label: "Viático",        icon: "MapPin",          permiso: null          },
  { href: "/dashboard/fri",          label: "FRI",            icon: "FileText",        permiso: null          },
  { href: "/dashboard/vale",         label: "Vale",           icon: "Receipt",         permiso: null          },
  { href: "/dashboard/baucher",      label: "Baucher",        icon: "Receipt",         permiso: null          },
  { href: "/dashboard/servicios",    label: "Servicios",      icon: "Package",         permiso: "servicios"   },
  { href: "/dashboard/pagos",        label: "Pagos",          icon: "CreditCard",      permiso: "pagos"       },
  { href: "/dashboard/banco",        label: "Banco",          icon: "Landmark",        permiso: "banco"       },
  { href: "/dashboard/caja-chica",   label: "Caja Chica",     icon: "Wallet",          permiso: "caja_chica"  },
  { href: "/dashboard/liquidacion",  label: "Liquidación",    icon: "FileCheck",       permiso: "liquidacion" },
  { href: "/dashboard/catalogos",    label: "Catálogos",      icon: "BookOpen",        permiso: "catalogos"   },
  { href: "/dashboard/reportes",     label: "Reportes",       icon: "BarChart3",       permiso: "reportes"    },
  { href: "/dashboard/documentos",   label: "Documentos",     icon: "FileText",        permiso: "documentos"  },
  { href: "/dashboard/usuarios",     label: "Usuarios",       icon: "Users",           permiso: "usuarios"    },
  { href: "/dashboard/configuracion",label: "Configuración",  icon: "Settings",        permiso: "configuracion"},
] as const;
