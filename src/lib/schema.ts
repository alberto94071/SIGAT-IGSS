import {
  pgTable, serial, integer, text, doublePrecision, boolean
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── Configuración del sistema ────────────────────────────────────────────────
export const configuracion = pgTable("configuracion", {
  id:                   serial("id").primaryKey(),
  nombre_unidad:        text("nombre_unidad").notNull().default("Consultorio del Instituto en San Marcos / U.I.A.A.D.D.M. en el Municipio de Tejutla"),
  codigo_unidad:        text("codigo_unidad").notNull().default("407"),
  codigo_contable:      text("codigo_contable").notNull().default("12.10.09"),
  municipio:            text("municipio").notNull().default("Tejutla, San Marcos"),
  monto_fondo_rotativo: doublePrecision("monto_fondo_rotativo").notNull().default(15000.00),
  efectivo_caja:        doublePrecision("efectivo_caja").notNull().default(0.00),
  ejercicio_fiscal:     integer("ejercicio_fiscal").notNull().default(2026),
  nombre_responsable:   text("nombre_responsable").notNull().default("Bernon Raul Miranda González"),
  numero_empleado_resp: text("numero_empleado_resp").notNull().default("29178"),
  nombre_solicitante:   text("nombre_solicitante").notNull().default(""),
  numero_empleado_sol:  text("numero_empleado_sol").notNull().default("34531"),
  resolucion_fondo:     text("resolucion_fondo").notNull().default("Resolución 01 SGF/2025 de fecha 02/01/2025"),
  // Datos para Forma A-01 SIAF
  nombre_unidad_ejecutora: text("nombre_unidad_ejecutora").notNull().default("UNIDAD EJECUTORA 407 CONSULTORIO DEL INSTITUTO EN SAN MARCOS"),
  centro_costo_nombre:     text("centro_costo_nombre").notNull().default("CENTRO DE COSTO: 121009 UNIDAD INTEGRAL DE ADSCRIPCIÓN, ACREDITACIÓN DE DERECHOS Y DESPACHO DE MEDICAMENTOS EN EL MUNICIPIO DE TEJUTLA, SAN MARCOS"),
  direccion_unidad:        text("direccion_unidad").notNull().default("2ª. AVENIDA 4-54 ZONA 2 TEJUTLA, SAN MARCOS"),
  justificacion_siaf:      text("justificacion_siaf").notNull().default("SERVICIOS NECESARIOS E INDISPENSABLES PARA BRINDAR ATENCIÓN A LOS PACIENTES DEL IGSS U.I.A.A.D.D.M. EN EL MUNICIPIO DE TEJUTLA."),
  updated_at:           text("updated_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Usuarios y roles ─────────────────────────────────────────────────────────
// rol: 'superadmin' | 'admin' | 'operador' | 'consulta'
export const usuarios = pgTable("usuarios", {
  id:             serial("id").primaryKey(),
  nombre:         text("nombre").notNull(),
  email:          text("email").notNull().unique(),
  password_hash:  text("password_hash").notNull(),
  rol:            text("rol").notNull().default("operador"),
  activo:         boolean("activo").notNull().default(true),
  permisos:       text("permisos").notNull().default("{}"),
  created_at:     text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
  updated_at:     text("updated_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
  last_login:     text("last_login"),
});

// ─── Catálogo de insumos (hoja Cod) ──────────────────────────────────────────
export const catalogoInsumos = pgTable("catalogo_insumos", {
  id:                      serial("id").primaryKey(),
  codigo_igss:             integer("codigo_igss").notNull().unique(),
  codigo_ppr:              text("codigo_ppr"),
  codigo_minfin:           integer("codigo_minfin"),
  nombre:                  text("nombre").notNull(),
  caracteristicas:         text("caracteristicas"),
  presentacion:            text("presentacion"),
  unidad_medida:           text("unidad_medida"),
  subproducto:             text("subproducto"),
  cantidad_solicitada:     doublePrecision("cantidad_solicitada"),
  precio_unitario:         doublePrecision("precio_unitario"),
  activo:                  boolean("activo").notNull().default(true),
  created_at:              text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Catálogo 182 (referencia IGSS completa) ──────────────────────────────────
export const catalogo182 = pgTable("catalogo_182", {
  id:              serial("id").primaryKey(),
  codigo_igss:     integer("codigo_igss"),
  codigo_minfin:   integer("codigo_minfin"),
  insumo:          text("insumo"),
  caracteristicas: text("caracteristicas"),
  codigo_ppr:      text("codigo_ppr"),
  presentacion:    text("presentacion"),
  unidad_medida:   text("unidad_medida"),
});

// ─── Servicios / Ingresos (hoja Serv) ─────────────────────────────────────────
export const servicios = pgTable("servicios", {
  id:                serial("id").primaryKey(),
  tipo_documento:    text("tipo_documento").notNull().default("SIAF"),
  siaf_numero:       integer("siaf_numero"),
  fecha:             text("fecha").notNull(),
  cuatrimestre:      text("cuatrimestre"),
  renglon:           integer("renglon"),
  codigo_igss:       integer("codigo_igss").references(() => catalogoInsumos.codigo_igss),
  insumo:            text("insumo"),
  cantidad:          doublePrecision("cantidad"),
  subproducto:       text("subproducto"),
  precio_registrado: doublePrecision("precio_registrado"),
  fecha_compra:      text("fecha_compra"),
  numero_compra:     text("numero_compra"),
  numero_documento:  text("numero_documento"),
  estado_oc:         text("estado_oc"),
  creado_por:        integer("creado_por").references(() => usuarios.id),
  created_at:        text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Tabla maestra de Pagos (hoja Pag) ────────────────────────────────────────
export const pagos = pgTable("pagos", {
  id:                serial("id").primaryKey(),
  servicio_id:       integer("servicio_id").references(() => servicios.id),
  siaf_numero:       integer("siaf_numero"),
  numero_oc:         text("numero_oc"),
  renglon:           integer("renglon"),
  codigo_igss:       integer("codigo_igss"),
  codigo_ppr:        text("codigo_ppr"),
  descripcion:       text("descripcion"),
  unidad_medida:     text("unidad_medida"),
  subproducto:       text("subproducto"),
  cantidad:          doublePrecision("cantidad"),
  monto:             doublePrecision("monto"),
  metodo_compra:     text("metodo_compra"),
  nit_proveedor:     text("nit_proveedor"),
  proveedor:         text("proveedor"),
  numero_documento:  text("numero_documento"),
  numero_serie:      text("numero_serie"),
  fecha_documento:   text("fecha_documento"),
  marca:             text("marca"),
  modelo:            text("modelo"),
  serie_equipo:      text("serie_equipo"),
  fecha_recepcion:   text("fecha_recepcion"),
  obs_lote:          text("obs_lote"),
  npg_vencimiento:   text("npg_vencimiento"),
  numero_cheque:     text("numero_cheque"),
  numero_vale:       integer("numero_vale"),
  numero_fri:        text("numero_fri"),
  estatus:           text("estatus").notNull().default("Pendiente"),
  fecha_pagado:      text("fecha_pagado"),
  cuatrimestre:      text("cuatrimestre"),
  numero_dab:        text("numero_dab"),
  creado_por:        integer("creado_por").references(() => usuarios.id),
  created_at:        text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
  updated_at:        text("updated_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Movimientos bancarios (hoja Ban) ─────────────────────────────────────────
export const movimientosBanco = pgTable("movimientos_banco", {
  id:                serial("id").primaryKey(),
  mes:               text("mes"),
  numero_documento:  text("numero_documento"),
  tipo_documento:    text("tipo_documento"),
  status:            text("status"),
  fecha_movimiento:  text("fecha_movimiento").notNull(),
  nit_beneficiario:  text("nit_beneficiario"),
  beneficiario:      text("beneficiario"),
  descripcion:       text("descripcion"),
  egresos:           doublePrecision("egresos").default(0),
  ingresos:          doublePrecision("ingresos").default(0),
  saldo:             doublePrecision("saldo"),
  creado_por:        integer("creado_por").references(() => usuarios.id),
  created_at:        text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Caja chica (hoja CajaC) ──────────────────────────────────────────────────
export const cajaChica = pgTable("caja_chica", {
  id:                   serial("id").primaryKey(),
  numero_cheque:        text("numero_cheque"),
  numero_vale:          integer("numero_vale"),
  tipo_documento:       text("tipo_documento"),
  numero_documento:     text("numero_documento"),
  numero_serie:         text("numero_serie"),
  fecha:                text("fecha"),
  nombre_beneficiario:  text("nombre_beneficiario"),
  municipio_residencia: text("municipio_residencia"),
  municipio_cita:       text("municipio_cita"),
  costo:                doublePrecision("costo"),
  tipo_servicio:        text("tipo_servicio"),
  fecha_pago:           text("fecha_pago"),
  creado_por:           integer("creado_por").references(() => usuarios.id),
  created_at:           text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Log de auditoría ─────────────────────────────────────────────────────────
export const auditLog = pgTable("audit_log", {
  id:          serial("id").primaryKey(),
  usuario_id:  integer("usuario_id").references(() => usuarios.id),
  accion:      text("accion").notNull(),
  tabla:       text("tabla"),
  registro_id: integer("registro_id"),
  detalle:     text("detalle"),
  ip:          text("ip"),
  created_at:  text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Compras: catálogo de insumos autorizados de la unidad ───────────────────
export const catalogoCompras = pgTable("catalogo_compras", {
  id:              serial("id").primaryKey(),
  codigo_igss:     integer("codigo_igss"),
  codigo_ppr:      text("codigo_ppr"),
  nombre:          text("nombre").notNull(),
  caracteristicas: text("caracteristicas"),
  presentacion:    text("presentacion"),
  unidad_medida:   text("unidad_medida"),
  subproducto:     text("subproducto").notNull(),
  cantidad:        doublePrecision("cantidad"),
  activo:          boolean("activo").notNull().default(true),
  created_at:      text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Catálogo de subproductos (controlado por superadmin) ────────────────────
export const catalogoSubproductos = pgTable("catalogo_subproductos", {
  id:         serial("id").primaryKey(),
  nombre:     text("nombre").notNull().unique(),
  activo:     boolean("activo").notNull().default(true),
  created_at: text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Consolidaciones de solicitudes A-01 SIAF ────────────────────────────────
export const consolidaciones = pgTable("consolidaciones", {
  id:               serial("id").primaryKey(),
  numero:           integer("numero").notNull(),
  anio:             integer("anio").notNull(),
  fecha:            text("fecha").notNull(),
  tipo_compra:      text("tipo_compra"),
  estado:           text("estado").notNull().default("Pendiente adjudicación"),
  // Compra Directa Fase 1
  nog:              text("nog"),
  fecha_evento:     text("fecha_evento"),
  // Todos los tipos (referencia = cotización / contrato / tipo-servicio)
  referencia:       text("referencia"),
  costo_unitario:   doublePrecision("costo_unitario"),
  exento_iva:       boolean("exento_iva").notNull().default(false),
  total:            doublePrecision("total"),
  proveedor_id:     integer("proveedor_id"),
  proveedor_nit:    text("proveedor_nit"),
  proveedor_nombre: text("proveedor_nombre"),
  creado_por:       integer("creado_por"),
  created_at:       text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Órdenes de Compra ────────────────────────────────────────────────────────
export const ordenesCompra = pgTable("ordenes_compra", {
  id:               serial("id").primaryKey(),
  numero:           integer("numero").notNull(),
  anio:             integer("anio").notNull(),
  fecha:            text("fecha").notNull(),
  consolidacion_id: integer("consolidacion_id").notNull(),
  tipo_compra:      text("tipo_compra").notNull(),
  nog:              text("nog"),
  referencia:       text("referencia"),
  proveedor_id:     integer("proveedor_id"),
  proveedor_nit:    text("proveedor_nit"),
  proveedor_nombre: text("proveedor_nombre"),
  costo_unitario:   doublePrecision("costo_unitario"),
  total_cantidad:   doublePrecision("total_cantidad"),
  exento_iva:       boolean("exento_iva").notNull().default(false),
  total:            doublePrecision("total"),
  estado:           text("estado").notNull().default("Activa"),
  creado_por:       integer("creado_por"),
  created_at:       text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Compras: solicitudes A-01 SIAF ──────────────────────────────────────────
export const siafCompras = pgTable("siaf_compras", {
  id:               serial("id").primaryKey(),
  numero:           integer("numero").notNull(),
  anio:             integer("anio").notNull(),
  fecha:            text("fecha").notNull(),
  estado:           text("estado").notNull().default("Borrador"),
  observaciones:    text("observaciones"),
  consolidacion_id: integer("consolidacion_id"),
  creado_por:       integer("creado_por").references(() => usuarios.id),
  created_at:       text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

export const siafComprasItems = pgTable("siaf_compras_items", {
  id:                  serial("id").primaryKey(),
  solicitud_id:        integer("solicitud_id").notNull().references(() => siafCompras.id, { onDelete: "cascade" }),
  catalogo_id:         integer("catalogo_id").references(() => catalogoCompras.id),
  codigo_igss:         integer("codigo_igss"),
  codigo_ppr:          text("codigo_ppr"),
  nombre:              text("nombre").notNull(),
  subproducto:         text("subproducto").notNull(),
  unidad_medida:       text("unidad_medida"),
  cantidad_antes:      doublePrecision("cantidad_antes"),
  cantidad_solicitada: doublePrecision("cantidad_solicitada").notNull(),
  created_at:          text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Firmantes para Forma A-01 SIAF ──────────────────────────────────────────
export const catalogoFirmantes = pgTable("catalogo_firmantes", {
  id:         serial("id").primaryKey(),
  nombre:     text("nombre").notNull(),
  cargo:      text("cargo").notNull(),
  activo:     boolean("activo").notNull().default(true),
  created_at: text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Secuencia SIAF ───────────────────────────────────────────────────────────
export const siafSeq = pgTable("siaf_seq", {
  id:    integer("id").primaryKey().default(1),
  valor: integer("valor").notNull().default(12),
});

// ─── Base de Datos Central — catálogo IGSS de insumos y servicios ────────────
export const baseDatosCentral = pgTable("base_datos_central", {
  id:              serial("id").primaryKey(),
  codigo_igss:     integer("codigo_igss"),
  codigo_ppr:      integer("codigo_ppr"),
  nombre:          text("nombre").notNull(),
  caracteristicas: text("caracteristicas"),
  presentacion:    text("presentacion"),
  renglon:         integer("renglon"),
  activo:          boolean("activo").notNull().default(true),
  created_at:      text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
  updated_at:      text("updated_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Proveedores ──────────────────────────────────────────────────────────────
export const proveedores = pgTable("proveedores", {
  id:          serial("id").primaryKey(),
  nit:         text("nit"),
  nombre:      text("nombre").notNull(),
  contacto:    text("contacto"),
  telefono:    text("telefono"),
  email:       text("email"),
  direccion:   text("direccion"),
  activo:      boolean("activo").notNull().default(true),
  created_at:  text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
  updated_at:  text("updated_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});
