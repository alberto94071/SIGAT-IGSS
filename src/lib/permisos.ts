export type Rol = "superadmin" | "admin" | "operador" | "consulta";

// Roles que un "admin" (no máster) puede administrar en Usuarios — el día a
// día del personal operativo. Crear/editar administradores u otros máster,
// y tocar los accesos (permisos por módulo), sigue siendo exclusivo del
// Administrador Máster (superadmin). Ver administracion/actions.ts.
export const ROLES_GESTIONABLES_POR_ADMIN: Rol[] = ["operador", "consulta"];

export interface Permisos {
  // ── Módulos del launcher (todo o nada por módulo completo) ──
  mod_compras:               boolean;
  mod_presupuesto:           boolean;
  mod_junta_adjudicadora:    boolean;
  mod_almacen:               boolean;
  mod_caja_chica:            boolean;
  mod_viaticos:              boolean;
  mod_pasajes:               boolean;
  mod_contrato_cotizaciones: boolean;
  mod_base_datos:            boolean;
  mod_fondo_rotativo:        boolean;
  // Administración — usuarios, accesos y configuración general. Solo el superadmin la trae por defecto
  mod_administracion:        boolean;
  // Hoja de Ruta — rastreo de pedidos, standalone. Solo el superadmin la trae por
  // defecto; el resto se habilita manualmente por usuario desde Administración.
  mod_hoja_de_ruta:          boolean;

  // ── Pestañas por módulo (control fino: cada persona puede tener el mismo
  //    módulo pero pestañas distintas visibles/ocultas). Todas se filtran
  //    en el layout de cada módulo (navItems) y se re-validan en el propio
  //    page.tsx de cada pestaña, no solo se ocultan en la UI. ──

  // Fondo Rotativo
  tab_fr_siaf04:                boolean;
  tab_fr_vales:                 boolean;
  tab_fr_pagos:                 boolean;
  tab_fr_fri:                   boolean;
  tab_fr_bancos:                boolean;
  tab_fr_libro_bancos:          boolean;
  tab_fr_libro_conciliacion:    boolean;
  tab_fr_archivo:               boolean;

  // Compras
  tab_compras_catalogo:         boolean;
  tab_compras_a01siaf:          boolean;
  tab_compras_consolidacion:    boolean;
  tab_compras_adjudicacion:     boolean;
  tab_compras_ordenes:          boolean;
  tab_compras_archivo:          boolean;

  // Junta Adjudicadora
  tab_junta_adjudicacion:       boolean;
  tab_junta_acta:                boolean;
  tab_junta_historial:          boolean;

  // Almacén
  tab_almacen_catalogo:         boolean;
  tab_almacen_dab60:            boolean;
  tab_almacen_dab75:            boolean;
  tab_almacen_cuadricula:       boolean;
  tab_almacen_archivo:          boolean;

  // Presupuesto — "Programación y Reprogramación" y "Modificaciones" tienen
  // submódulos propios dentro de la misma pestaña de nav (ver
  // ProgramacionClient.tsx / ModificacionesClient.tsx); el resto es 1 a 1.
  tab_presupuesto_general:                  boolean;
  tab_presupuesto_compromiso:               boolean;
  tab_presupuesto_devengado:                boolean;
  tab_presupuesto_ejecucion:                boolean;
  tab_presupuesto_programacion:             boolean; // submenú "Programación"
  tab_presupuesto_reprogramacion:           boolean; // submenú "Reprogramación"
  tab_presupuesto_autorizar_reprogramacion: boolean; // submenú "Reprogramaciones pendientes"
  tab_presupuesto_modif_ingru:              boolean; // submenú "Modificación tipo Ingru"
  tab_presupuesto_modif_ampliacion:         boolean; // submenú "Modificación Ampliación"
  tab_presupuesto_modif_transferencia:      boolean; // submenú "Transferencia entre renglón/sub-producto"
  tab_presupuesto_autorizar_modificaciones: boolean; // submenú "Autorizar" (nuevo)

  // Caja Chica
  tab_cajachica_vale:           boolean;
  tab_cajachica_pagos:          boolean;
  tab_cajachica_liquidacion:    boolean;
  tab_cajachica_libro:          boolean;

  // Pasajes
  tab_pasajes_solicitud:        boolean;
  tab_pasajes_tarifario:        boolean;
  tab_pasajes_dpd23:            boolean;
  tab_pasajes_poliza:           boolean;

  // Viáticos
  tab_viaticos_entrega:         boolean;
  tab_viaticos_comision:        boolean;

  // Base de Datos
  tab_basedatos_insumos:        boolean;
  tab_basedatos_tarifario:      boolean;
  tab_basedatos_proveedores:    boolean;
  tab_basedatos_afiliados:      boolean;

  // Administración ("Reiniciar Sistema" queda aparte, exclusivo de
  // superadmin — no es delegable por permiso, ver administracion/layout.tsx)
  tab_admin_usuarios:           boolean;
  tab_admin_configuracion:      boolean;
}

export type Modulo =
  | "mod_compras" | "mod_presupuesto" | "mod_junta_adjudicadora" | "mod_almacen"
  | "mod_caja_chica" | "mod_viaticos" | "mod_pasajes"
  | "mod_contrato_cotizaciones" | "mod_base_datos" | "mod_fondo_rotativo"
  | "mod_administracion" | "mod_hoja_de_ruta";

const MODULOS_DEFAULT = {
  mod_compras: true, mod_presupuesto: true, mod_junta_adjudicadora: true,
  mod_almacen: true, mod_caja_chica: true,
  mod_viaticos: true, mod_pasajes: true, mod_contrato_cotizaciones: true,
  mod_base_datos: true, mod_fondo_rotativo: true,
};

// Todas las pestañas "de ver/usar" (no las de Autorizar) por defecto van en
// `true` para los 4 roles — así ningún usuario existente pierde acceso a lo
// que ya venía viendo el día que se activó este control más fino; el
// superadmin las va cerrando por persona desde Administración según haga falta.
const TABS_DEFAULT_ABIERTAS = {
  tab_fr_siaf04: true, tab_fr_vales: true, tab_fr_pagos: true, tab_fr_fri: true,
  tab_fr_bancos: true, tab_fr_libro_bancos: true, tab_fr_libro_conciliacion: true, tab_fr_archivo: true,

  tab_compras_catalogo: true, tab_compras_a01siaf: true, tab_compras_consolidacion: true,
  tab_compras_adjudicacion: true, tab_compras_ordenes: true, tab_compras_archivo: true,

  tab_junta_adjudicacion: true, tab_junta_acta: true, tab_junta_historial: true,

  tab_almacen_catalogo: true, tab_almacen_dab60: true, tab_almacen_dab75: true,
  tab_almacen_cuadricula: true, tab_almacen_archivo: true,

  tab_presupuesto_general: true, tab_presupuesto_compromiso: true, tab_presupuesto_devengado: true,
  tab_presupuesto_ejecucion: true, tab_presupuesto_programacion: true, tab_presupuesto_reprogramacion: true,
  tab_presupuesto_modif_ingru: true, tab_presupuesto_modif_ampliacion: true, tab_presupuesto_modif_transferencia: true,

  tab_cajachica_vale: true, tab_cajachica_pagos: true, tab_cajachica_liquidacion: true, tab_cajachica_libro: true,

  tab_pasajes_solicitud: true, tab_pasajes_tarifario: true, tab_pasajes_dpd23: true, tab_pasajes_poliza: true,

  tab_viaticos_entrega: true, tab_viaticos_comision: true,

  tab_basedatos_insumos: true, tab_basedatos_tarifario: true, tab_basedatos_proveedores: true, tab_basedatos_afiliados: true,

  tab_admin_usuarios: true, tab_admin_configuracion: true,
};

// Las 2 pestañas de "Autorizar" (aprobar/rechazar) quedan cerradas por
// defecto para operador/consulta — antes de este cambio, aprobar
// Reprogramaciones ya estaba limitado a admin/superadmin por rol
// (ver antiguo `puedeAprobar` en ProgramacionClient.tsx), y aprobar
// Modificaciones/Transferencias no tenía ningún límite más allá de
// mod_presupuesto — este default no le quita el acceso a nadie que hoy
// pueda aprobar Reprogramaciones, y le pone el mismo límite a Modificaciones.
const AUTORIZAR_ADMIN = { tab_presupuesto_autorizar_reprogramacion: true, tab_presupuesto_autorizar_modificaciones: true };
const AUTORIZAR_CERRADO = { tab_presupuesto_autorizar_reprogramacion: false, tab_presupuesto_autorizar_modificaciones: false };

// Permisos por defecto según el rol
export const PERMISOS_DEFAULT: Record<Rol, Permisos> = {
  superadmin: {
    ...MODULOS_DEFAULT, mod_administracion: true, mod_hoja_de_ruta: true,
    ...TABS_DEFAULT_ABIERTAS, ...AUTORIZAR_ADMIN,
  },
  admin: {
    ...MODULOS_DEFAULT, mod_administracion: false, mod_hoja_de_ruta: false,
    ...TABS_DEFAULT_ABIERTAS, ...AUTORIZAR_ADMIN,
  },
  operador: {
    ...MODULOS_DEFAULT, mod_administracion: false, mod_hoja_de_ruta: false,
    ...TABS_DEFAULT_ABIERTAS, ...AUTORIZAR_CERRADO,
  },
  consulta: {
    ...MODULOS_DEFAULT, mod_administracion: false, mod_hoja_de_ruta: false,
    ...TABS_DEFAULT_ABIERTAS, ...AUTORIZAR_CERRADO,
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

// Sin esta protección, el propio Administrador Máster podía editar sus
// propios accesos por error (o por curiosidad) y quitarse mod_administracion
// — bloqueándose a sí mismo sin ningún aviso ni forma de revertirlo desde la
// pantalla (ya pasó una vez: registro de auditoría real, "editar_permisos"
// contra su propio id inmediatamente después de crear otro usuario). Ver
// UsuariosClient.tsx (botón oculto) y administracion/actions.ts
// (guardarPermisos, rechazo en el servidor).
export function puedeEditarPermisosDe(meId: number, objetivoId: number): boolean {
  return meId !== objetivoId;
}

// Nav items con su permiso requerido — rutas del módulo Fondo Rotativo.
// Antes estas 8 pestañas siempre existían con `permiso: null` (sin filtrar
// nunca) mientras la UI de Administración mostraba una sección "Fondo
// Rotativo (submenús internos)" que en realidad no controlaba nada — ver
// CLAUDE.md. Ahora cada una tiene su propio permiso real.
export const NAV_ITEMS = [
  { href: "/dashboard/siaf-04",            label: "SIAF-04",            icon: "FileText",  permiso: "tab_fr_siaf04" },
  { href: "/dashboard/vales",              label: "Vales",               icon: "Ticket",    permiso: "tab_fr_vales" },
  { href: "/dashboard/pagos",              label: "Pagos",               icon: "Wallet",    permiso: "tab_fr_pagos" },
  { href: "/dashboard/fri",                label: "Pago/FRI",            icon: "Receipt",   permiso: "tab_fr_fri" },
  { href: "/dashboard/bancos",             label: "Bancos",              icon: "Landmark",  permiso: "tab_fr_bancos" },
  { href: "/dashboard/libro-bancos",       label: "Libro Bancos",        icon: "BookOpen",  permiso: "tab_fr_libro_bancos" },
  { href: "/dashboard/libro-conciliacion", label: "Libro Conciliación",  icon: "Scale",     permiso: "tab_fr_libro_conciliacion" },
  { href: "/dashboard/archivo",            label: "Archivo",             icon: "Archive",   permiso: "tab_fr_archivo" },
] as const;
