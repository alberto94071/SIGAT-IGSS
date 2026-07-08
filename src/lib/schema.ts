import {
  pgTable, serial, integer, text, doublePrecision, boolean, type AnyPgColumn
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
  // Firmantes adicionales para Forma A-04 SIAF (el Encargado de Fondo Rotativo ya usa nombre_responsable)
  nombre_analista_presupuesto: text("nombre_analista_presupuesto").notNull().default("Ener Ivandrino Vásquez Barrios"),
  nombre_director:             text("nombre_director").notNull().default("Kareen Marisol Guevara Orozco"),
  // Datos adicionales para el Vale de Caja Chica
  nit_responsable:           text("nit_responsable").notNull().default("18864325"),
  nombre_dependencia_medica: text("nombre_dependencia_medica").notNull()
    .default("Unidad Integral de Adscripción, Acreditación de Derechos y Despacho de Medicamentos, en el Municipio de Tejutla"),
  // Datos adicionales para la Planilla de Viático (Formulario V-L)
  nombre_encargado_unidad: text("nombre_encargado_unidad").notNull().default("Lilia Zucely Pérez Fuentes"),
  cargo_encargado_unidad:  text("cargo_encargado_unidad").notNull().default("Analista \"A\" con funciones de Encargada de Unidad"),
  entidad_recibio_viatico: text("entidad_recibio_viatico").notNull().default("IGSS U.I.A.A.D.D.M. en el Municipio de Tejutla"),
  // Datos adicionales para el DPD-23 (Recibo de Gastos de Transporte)
  nombre_secretaria_unidad: text("nombre_secretaria_unidad").notNull().default("Elesinda Gabriela Rodriguez Orozco"),
  cargo_secretaria_unidad:  text("cargo_secretaria_unidad").notNull().default("Secretaria \"A\""),
  // Identidad completa del "Jefe de la Dependencia" / Encargado de Unidad — usada
  // como firmante en Vale de Caja Chica (Vo.Bo.) y como destinatario del SPS-75.
  numero_empleado_encargado: text("numero_empleado_encargado").notNull().default("35985"),
  nit_encargado_unidad:      text("nit_encargado_unidad").notNull().default("52392678"),
  // NIT del solicitante (Caja Chica) — el nombre y número de empleado ya existían.
  nit_solicitante: text("nit_solicitante").notNull().default(""),
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

// ─── Fondo Rotativo: Pagos / Bancos / Libro Caja Chica ───────────────────────
// Una sola tabla para las 3 pantallas — se diferencian por `forma_pago`/`estado`,
// igual que ya se hace en otras partes de la app (BandejaDestino por destino/estado).
// estado: 'Pendiente forma de pago' | 'Enviado a Bancos' | 'Enviado a Libro Caja Chica'
export const fondoRotativoPagos = pgTable("fondo_rotativo_pagos", {
  id:                    serial("id").primaryKey(),
  consolidacion_id:      integer("consolidacion_id").notNull().unique()
                          .references(() => consolidaciones.id),
  no_factura:            text("no_factura").notNull(),
  serie_factura:         text("serie_factura").notNull(),
  fecha_emision_factura: text("fecha_emision_factura").notNull(),
  forma_pago:            text("forma_pago"),
  numero_cheque:         text("numero_cheque"),
  fecha_emision_cheque:  text("fecha_emision_cheque"),
  destinatario_nombre:   text("destinatario_nombre"),
  fecha_pago:            text("fecha_pago"),
  numero_vale:           text("numero_vale"),
  vale_id:               integer("vale_id").references((): AnyPgColumn => valesCajaChica.id),
  // 'Pendiente forma de pago' → (cheque) 'Enviado a Bancos'
  //                          → (efectivo) 'Enviado a Liquidación' → 'Liquidado'
  estado:                text("estado").notNull().default("Pendiente forma de pago"),
  creado_por:            integer("creado_por").references(() => usuarios.id),
  created_at:            text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
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
  id:                      serial("id").primaryKey(),
  // Columnas del PAC (Plan Anual de Compras)
  ug:                      integer("ug"),
  cc:                      integer("cc"),
  estructura_programatica: text("estructura_programatica"),
  codigo_igss:             text("codigo_igss"),       // "SC-122080" — texto, no entero
  nombre:                  text("nombre").notNull(),
  codigo_nombre_ppr:       integer("codigo_nombre_ppr"),
  nombre_ppr:              text("nombre_ppr"),
  codigo_presentacion_ppr: integer("codigo_presentacion_ppr"),
  unidad_medida:           text("unidad_medida"),
  renglon:                 integer("renglon"),
  subproducto:             text("subproducto").notNull(),
  cantidad:                doublePrecision("cantidad"),
  precio_estimado:         doublePrecision("precio_estimado"),
  monto:                   doublePrecision("monto"),
  // Columnas legacy (compatibilidad)
  codigo_ppr:              text("codigo_ppr"),
  caracteristicas:         text("caracteristicas"),
  presentacion:            text("presentacion"),
  activo:                  boolean("activo").notNull().default(true),
  created_at:              text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
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
  pre_orden:           text("pre_orden").unique(),
  numero_adjudicacion: text("numero_adjudicacion").unique(),
  destino:             text("destino"),
  regularizado:        boolean("regularizado"),
  creado_por:       integer("creado_por"),
  created_at:       text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
  // ── Rediseño Compras-inicia-adjudicación ──
  motivo_rechazo:       text("motivo_rechazo"),
  rechazado_por:        integer("rechazado_por").references(() => usuarios.id),
  rechazado_en:         text("rechazado_en"),
  enviado_a_junta_por:  integer("enviado_a_junta_por").references(() => usuarios.id),
  enviado_a_junta_en:   text("enviado_a_junta_en"),
  oferente_ganador_id:  integer("oferente_ganador_id").references((): AnyPgColumn => oferentes.id),
  numero_cheque:        text("numero_cheque"),
  // Correlativo A-04 SIAF, asignado automáticamente al llegar a Fondo Rotativo
  numero_a04:           integer("numero_a04"),
  anio_a04:             integer("anio_a04"),
  // "Completar Adjudicación" (Compras) queda bloqueado hasta que el Acta se aprueba
  acta_aprobada:        boolean("acta_aprobada").notNull().default(false),
  // ── Datos para imprimir la Forma A-04 SIAF (Regularizado) ──
  proveedor_direccion: text("proveedor_direccion"),
  proveedor_telefono:  text("proveedor_telefono"),
  a04_fecha:           text("a04_fecha"),
  a04_dte_numero:      text("a04_dte_numero"),
  a04_dte_serie:       text("a04_dte_serie"),
  a04_dte_fecha:       text("a04_dte_fecha"),
  a04_no_pedido:       text("a04_no_pedido"),
  a04_descripcion:     text("a04_descripcion"),
  a04_unidad_medida:   text("a04_unidad_medida"),
  a04_cantidad:        doublePrecision("a04_cantidad"),
  monto_bruto:         doublePrecision("monto_bruto"),
  // Cotización anual (Contrato y Cotizaciones) que respaldó una Baja Cuantía/Normal
  // enviada directo a Actas — solo trazabilidad, ver cotizacionesAnuales abajo.
  cotizacion_anual_id: integer("cotizacion_anual_id"),
});

// ─── Acta de Junta Adjudicadora — una por consolidación adjudicada ───────────
// estado: 'Generada' | 'Aprobada' | 'Rechazada'
export const actasAdjudicacion = pgTable("actas_adjudicacion", {
  id:               serial("id").primaryKey(),
  consolidacion_id: integer("consolidacion_id").notNull().unique()
                      .references(() => consolidaciones.id, { onDelete: "cascade" }),
  no_formulario:    text("no_formulario").notNull(),
  no_acta:          text("no_acta").notNull(),
  lugar:            text("lugar").notNull(),
  fecha:            text("fecha").notNull(),
  hora:             text("hora").notNull(),
  estado:           text("estado").notNull().default("Generada"),
  previsualizada:   boolean("previsualizada").notNull().default(false),
  motivo_rechazo:   text("motivo_rechazo"),
  generado_por:     integer("generado_por").references(() => usuarios.id),
  aprobado_por:     integer("aprobado_por").references(() => usuarios.id),
  aprobado_en:      text("aprobado_en"),
  rechazado_por:    integer("rechazado_por").references(() => usuarios.id),
  rechazado_en:     text("rechazado_en"),
  created_at:       text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Precio por insumo de cada consolidación adjudicada ──────────────────────
export const consolidacionPrecios = pgTable("consolidacion_precios", {
  id:               serial("id").primaryKey(),
  consolidacion_id: integer("consolidacion_id").notNull().references(() => consolidaciones.id, { onDelete: "cascade" }),
  codigo_igss:      text("codigo_igss"),
  subproducto:      text("subproducto").notNull(),
  precio_unitario:  doublePrecision("precio_unitario").notNull(),
});

// ─── Cotizaciones de servicio recibidas con antelación ───────────────────────
export const cotizacionesServicio = pgTable("cotizaciones_servicio", {
  id:                        serial("id").primaryKey(),
  fecha:                     text("fecha").notNull(),
  proveedor_id:              integer("proveedor_id"),
  proveedor_nit:             text("proveedor_nit"),
  proveedor_nombre:          text("proveedor_nombre").notNull(),
  servicio:                  text("servicio").notNull(),
  costo:                     doublePrecision("costo").notNull(),
  exento_iva:                boolean("exento_iva").notNull().default(false),
  usado_en_consolidacion_id: integer("usado_en_consolidacion_id"),
  usado:                     boolean("usado").notNull().default(false),
  creado_por:                integer("creado_por").references(() => usuarios.id),
  created_at:                text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Cotizaciones anuales por proveedor (varios insumos con precio pactado) ──
// Un proveedor puede tener varias cotizaciones vigentes en el mismo año (ej. una
// renovación a mitad de año) — cada una con su propio número y sus propias
// líneas de insumo, cada línea con su propio IVA (no uno solo para toda la
// cotización). Se usan para Baja Cuantía/Normal con insumos: en vez de armar
// una comparación manual de oferentes, Compras solo ingresa el número de
// cotización y el sistema cruza los precios por código de insumo.
export const cotizacionesAnuales = pgTable("cotizaciones_anuales", {
  id:               serial("id").primaryKey(),
  numero:           text("numero").notNull().unique(),
  anio:             integer("anio").notNull(),
  proveedor_id:     integer("proveedor_id"),
  proveedor_nit:    text("proveedor_nit"),
  proveedor_nombre: text("proveedor_nombre").notNull(),
  fecha:            text("fecha").notNull(),
  creado_por:       integer("creado_por").references(() => usuarios.id),
  created_at:       text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

export const cotizacionesAnualesItems = pgTable("cotizaciones_anuales_items", {
  id:                  serial("id").primaryKey(),
  cotizacion_anual_id: integer("cotizacion_anual_id").notNull()
                         .references(() => cotizacionesAnuales.id, { onDelete: "cascade" }),
  codigo_igss:         text("codigo_igss").notNull(),
  precio_unitario:     doublePrecision("precio_unitario").notNull(),
  exento_iva:          boolean("exento_iva").notNull().default(false),
});

// ─── Oferentes (comparación de proveedores por consolidación, hasta 10) ──────
export const oferentes = pgTable("oferentes", {
  id:                     serial("id").primaryKey(),
  consolidacion_id:       integer("consolidacion_id").notNull()
                            .references(() => consolidaciones.id, { onDelete: "cascade" }),
  proveedor_id:           integer("proveedor_id"),
  cotizacion_servicio_id: integer("cotizacion_servicio_id").references(() => cotizacionesServicio.id),
  nit:                    text("nit").notNull(),
  nombre:                 text("nombre").notNull(),
  costo:                  doublePrecision("costo").notNull(),
  exento_iva:             boolean("exento_iva").notNull().default(false),
  orden:                  integer("orden").notNull().default(0),
  creado_por:             integer("creado_por").references(() => usuarios.id),
  created_at:             text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Acta de Negociación — plantilla fija por año ────────────────────────────
export const actasNegociacion = pgTable("actas_negociacion", {
  id:              serial("id").primaryKey(),
  anio:            integer("anio").notNull().unique(),
  contenido:       text("contenido"),
  archivo_url:     text("archivo_url"),
  actualizado_por: integer("actualizado_por").references(() => usuarios.id),
  updated_at:      text("updated_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
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
  // ── Pipeline Ordenes → Compromiso → Devengado → DAB-60 ──
  codigo_ppr:                   text("codigo_ppr"),
  fecha_notificacion_proveedor: text("fecha_notificacion_proveedor"),
  no_compromiso:                text("no_compromiso"),
  fecha_ingreso_producto:       text("fecha_ingreso_producto"),
  no_factura:                   text("no_factura"),
  serie_factura:                text("serie_factura"),
  fecha_emision:                text("fecha_emision"),
  lote:                         text("lote"),
  fecha_vencimiento:            text("fecha_vencimiento"),
  marca:                        text("marca"),
  modelo:                       text("modelo"),
  serie:                        text("serie"),
  no_devengado:                 text("no_devengado"),
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
  motivo_rechazo:   text("motivo_rechazo"),
  rechazado_por:    integer("rechazado_por").references(() => usuarios.id),
  rechazado_en:     text("rechazado_en"),
  // Evita sumar dos veces el pre-compromiso si se rechaza y se vuelve a aprobar
  presupuesto_aplicado: boolean("presupuesto_aplicado").notNull().default(false),
  created_at:       text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

export const siafComprasItems = pgTable("siaf_compras_items", {
  id:                  serial("id").primaryKey(),
  solicitud_id:        integer("solicitud_id").notNull().references(() => siafCompras.id, { onDelete: "cascade" }),
  catalogo_id:         integer("catalogo_id").references(() => catalogoCompras.id),
  codigo_igss:         text("codigo_igss"),   // texto para coincidir con catalogoCompras.codigo_igss
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
  codigo_rango:    text("codigo_rango"),
  renglon:         integer("renglon"),
  activo:          boolean("activo").notNull().default(true),
  created_at:      text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
  updated_at:      text("updated_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Presupuesto por renglón ──────────────────────────────────────────────────
export const presupuestoRenglones = pgTable("presupuesto_renglones", {
  id:                   serial("id").primaryKey(),
  ejercicio_fiscal:     integer("ejercicio_fiscal").notNull().default(2026),
  ug:                   integer("ug"),
  cc:                   integer("cc"),
  pg_spg_py_act_ob:     text("pg_spg_py_act_ob"),
  subproducto:          text("subproducto"),
  renglon:              integer("renglon"),
  nombre:               text("nombre").notNull(),
  vigente:              doublePrecision("vigente"),
  modificado:           doublePrecision("modificado"),
  presupuesto:          doublePrecision("presupuesto"),
  pre_compromiso:       doublePrecision("pre_compromiso"),
  compromiso:           doublePrecision("compromiso"),
  devengado:            doublePrecision("devengado"),
  saldo_presupuestario: doublePrecision("saldo_presupuestario"),
  saldo_disponible:     doublePrecision("saldo_disponible"),
  created_at:           text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
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

// ─── Registro de NOG (Número de Operación de Guatecompras) ──────────────────────
export const nogRegistros = pgTable("nog_registros", {
  id:                   serial("id").primaryKey(),
  nog:                  text("nog").notNull(),
  proveedor_id:         integer("proveedor_id"),
  proveedor_nit:        text("proveedor_nit"),
  proveedor_nombre:     text("proveedor_nombre").notNull(),
  insumo_id:            integer("insumo_id"),
  insumo_nombre:        text("insumo_nombre").notNull(),
  insumo_codigo_igss:   text("insumo_codigo_igss"),
  subproducto:          text("subproducto"),
  cantidad_autorizada:  doublePrecision("cantidad_autorizada").notNull(),
  precio:               doublePrecision("precio"),
  exento_iva:           boolean("exento_iva").notNull().default(false),
  total:                doublePrecision("total"),
  creado_por:           integer("creado_por").references(() => usuarios.id),
  created_at:           text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Vale de Caja Chica ───────────────────────────────────────────────────────
// Ciclo de vida: Caja Chica solicita (tipo + monto + justificación) → Fondo
// Rotativo autoriza (puede ajustar el monto, topado al saldo disponible) o
// rechaza → una vez autorizado, Fondo Rotativo asigna cheque (queda "Activo",
// utilizable) → Caja Chica lo usa (pasajes: se le asignan pólizas; gastos
// varios: se liga a pagos en efectivo de Fondo Rotativo/Pagos) → Liquidación.
export const valesCajaChica = pgTable("vales_caja_chica", {
  id:                          serial("id").primaryKey(),
  numero:                      integer("numero").notNull(), // correlativo independiente por tipo
  tipo:                        text("tipo").notNull().default("pasajes"), // "pasajes" | "gastos_varios"
  fecha:                       text("fecha").notNull(),
  monto:                       doublePrecision("monto").notNull(), // monto solicitado por Caja Chica
  monto_autorizado:            doublePrecision("monto_autorizado"), // definido por Fondo Rotativo al autorizar
  motivo:                      text("motivo").notNull(),
  solicitante_nombre:          text("solicitante_nombre").notNull(),
  solicitante_numero_empleado: text("solicitante_numero_empleado").notNull(),
  solicitante_nit:             text("solicitante_nit").notNull(),
  jefe_nombre:                 text("jefe_nombre").notNull(),
  jefe_numero_empleado:        text("jefe_numero_empleado").notNull(),
  jefe_nit:                    text("jefe_nit").notNull(),
  numero_cheque:               text("numero_cheque"),
  destinatario_cheque:         text("destinatario_cheque"), // a nombre de quién sale el cheque
  fecha_emision:               text("fecha_emision"),
  fecha_entregado:             text("fecha_entregado"),
  motivo_rechazo:              text("motivo_rechazo"),
  // Liquidación
  monto_liquidado:             doublePrecision("monto_liquidado"), // total realmente usado (pasajes: suma de pólizas; gastos varios: ingresado a mano)
  numero_boleta_deposito:      text("numero_boleta_deposito"), // solo si sobró efectivo
  monto_boleta_deposito:       doublePrecision("monto_boleta_deposito"),
  fecha_liquidacion:           text("fecha_liquidacion"),
  // 'Pendiente autorización' → 'Rechazado' | 'Autorizado' → 'Activo' (cheque
  // asignado, utilizable) → 'Liquidado'
  estado:                      text("estado").notNull().default("Pendiente autorización"),
  creado_por:                  integer("creado_por").references(() => usuarios.id),
  created_at:                  text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Póliza (Pago de Pasajes) ─────────────────────────────────────────────────
// Consolida varios DPD-23 ya generados en un solo "Cuadro de Caja" imprimible;
// luego se le asigna el vale de pasajes activo y se envía a liquidar.
export const polizas = pgTable("polizas", {
  id:          serial("id").primaryKey(),
  numero:      integer("numero").notNull().unique(),
  fecha:       text("fecha").notNull(),
  vale_id:     integer("vale_id").references((): AnyPgColumn => valesCajaChica.id),
  total:       doublePrecision("total").notNull().default(0),
  // 'Generada' → 'Vale asignado' → 'Enviada a Liquidar' → 'Liquidada'
  estado:      text("estado").notNull().default("Generada"),
  creado_por:  integer("creado_por").references(() => usuarios.id),
  created_at:  text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Notificaciones (campanita) ───────────────────────────────────────────────
// tipo: 'siaf_rechazado' | ... (futuros tipos de otros procesos)
export const notificaciones = pgTable("notificaciones", {
  id:              serial("id").primaryKey(),
  usuario_id:      integer("usuario_id").notNull().references(() => usuarios.id),
  tipo:            text("tipo").notNull(),
  titulo:          text("titulo").notNull(),
  mensaje:         text("mensaje").notNull(),
  ruta:            text("ruta"),
  referencia_tipo: text("referencia_tipo"),
  referencia_id:   integer("referencia_id"),
  leida:           boolean("leida").notNull().default(false),
  created_at:      text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── DAB-75: Requisición a Bodega Local (Almacén) ─────────────────────────────
// Formulario pre-impreso: aquí solo se guardan los datos que luego se imprimen
// sobre la hoja ya impresa (sin dibujar líneas ni casillas).
export const requisicionesBodega = pgTable("requisiciones_bodega", {
  id:                    serial("id").primaryKey(),
  no_pedido:             text("no_pedido").notNull(),
  fecha_emision:         text("fecha_emision").notNull(),
  clave_administrativa:  text("clave_administrativa").notNull(),
  sala_servicio:         text("sala_servicio").notNull(),
  bodega:                text("bodega").notNull(), // "I" | "II"
  fecha_despacho:        text("fecha_despacho"),
  solicita_nombre:       text("solicita_nombre").notNull(),
  solicita_no_empleado:  text("solicita_no_empleado").notNull(),
  solicita_cargo:        text("solicita_cargo").notNull(),
  entrega_nombre:        text("entrega_nombre"),
  entrega_no_empleado:   text("entrega_no_empleado"),
  entrega_cargo:         text("entrega_cargo"),
  recibe_nombre:         text("recibe_nombre"),
  recibe_no_empleado:    text("recibe_no_empleado"),
  recibe_cargo:          text("recibe_cargo"),
  director_nombre:       text("director_nombre"),
  creado_por:            integer("creado_por").references(() => usuarios.id),
  created_at:            text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

export const requisicionBodegaItems = pgTable("requisicion_bodega_items", {
  id:                  serial("id").primaryKey(),
  requisicion_id:      integer("requisicion_id").notNull().references(() => requisicionesBodega.id, { onDelete: "cascade" }),
  codigo:              text("codigo").notNull(),
  nombre:              text("nombre").notNull(),
  cantidad_solicitada: doublePrecision("cantidad_solicitada").notNull(),
  orden:               integer("orden").notNull().default(0),
});

// ─── Planilla de Viático — Formulario V-L (Pago de Viáticos) ─────────────────
// Igual que DAB-75: formulario pre-impreso, solo se posicionan los datos.
export const viaticoLiquidaciones = pgTable("viatico_liquidaciones", {
  id:                       serial("id").primaryKey(),
  comisiones_json:          text("comisiones_json").notNull().default("[]"), // [{tipo, lugar}]
  dias:                     integer("dias").notNull().default(0),
  gasto_desayuno:           doublePrecision("gasto_desayuno"),
  gasto_almuerzo:           doublePrecision("gasto_almuerzo"),
  gasto_cena:               doublePrecision("gasto_cena"),
  gasto_hospedaje:          doublePrecision("gasto_hospedaje"),
  otros_gastos:             doublePrecision("otros_gastos").notNull().default(0),
  recibido_va_no:           text("recibido_va_no"),
  recibido_va_monto:        doublePrecision("recibido_va_monto"),
  reintegro:                doublePrecision("reintegro"),
  complemento:              doublePrecision("complemento"),
  forma_pago:               text("forma_pago"),
  fecha_pago:               text("fecha_pago"),
  persona_nombre:           text("persona_nombre").notNull(),
  persona_nit:              text("persona_nit").notNull(),
  persona_cargo:            text("persona_cargo").notNull(),
  persona_grupo:            text("persona_grupo"),
  persona_no_empleado:      text("persona_no_empleado").notNull(),
  persona_sueldo:           doublePrecision("persona_sueldo"),
  persona_categoria_puesto: text("persona_categoria_puesto"),
  partida_presupuestaria:   text("partida_presupuestaria"),
  nombramiento_numero:      text("nombramiento_numero"),
  fecha_nombramiento:       text("fecha_nombramiento"),
  creado_por:               integer("creado_por").references(() => usuarios.id),
  created_at:               text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// ─── Pago de Pasajes (Caja Chica/Solicitud Pasaje) ───────────────────────────
// Portado del libro de Excel "PASAJES_TEJUTLA" usado hasta ahora: base de
// afiliados + tarifario por ruta (datos de referencia, importados una vez) y
// el historial real de pasajes pagados (formulario "Ingreso de Datos").

// Base de afiliados — solo lectura/autocompletado al capturar un pago (igual
// que el VLOOKUP contra la hoja "Base de Datos" del libro original).
export const pasajesAfiliados = pgTable("pasajes_afiliados", {
  id:               serial("id").primaryKey(),
  afiliacion:       text("afiliacion").notNull().unique(),
  dpi:              text("dpi"),
  nombre:           text("nombre").notNull(),
  calidad:          text("calidad"),
  edad:             integer("edad"),
  sexo:             text("sexo"),
  direccion:        text("direccion"),
  telefono:         text("telefono"),
  fallecido:        text("fallecido"), // "S" | "N"
  numero_patronal:  text("numero_patronal"),
  patrono:          text("patrono"),
});

// Tarifario por ruta — administrable desde Caja Chica/Tarifario (igual que la
// hoja "Tarifa": precio de ida = precio de vuelta, por punto de partida/destino).
export const pasajesTarifario = pgTable("pasajes_tarifario", {
  id:             serial("id").primaryKey(),
  punto_partida:  text("punto_partida").notNull(),
  destino:        text("destino").notNull(),
  valor_ida:      doublePrecision("valor_ida").notNull(),
  creado_por:     integer("creado_por").references(() => usuarios.id),
  created_at:     text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// Solicitud de Pago de Pasaje (SPS-75) — memo de autorización dirigido al Jefe
// de Unidad, que pide el pago de un tramo (ida o vuelta) para un afiliado.
// Se genera primero; su DPD-23 (el recibo de pago en sí) se genera después,
// desde Caja Chica/DPD-23, ya con los datos de forma de pago.
export const pasajesSolicitudes = pgTable("pasajes_solicitudes", {
  id:               serial("id").primaryKey(),
  numero:           integer("numero").notNull().unique(),
  fecha:            text("fecha").notNull(),
  afiliacion:       text("afiliacion").notNull(),
  nombre_afiliado:  text("nombre_afiliado").notNull(),
  direccion:        text("direccion"),
  tramo:            text("tramo").notNull(), // "Ida" | "Vuelta" | "Ida y Vuelta"
  punto_partida:    text("punto_partida").notNull(),
  destino:          text("destino").notNull(),
  lugar_especifico: text("lugar_especifico"), // ej. "Consultorio San Marcos" — detalle impreso junto al destino
  especialidad:     text("especialidad"),     // "Transporte ordenado por" (ej. "MEDICINA GENERAL")
  caso_concluido:   boolean("caso_concluido").notNull().default(false),
  fecha_cita:       text("fecha_cita"), // "Se le citó para el día" — solo si no es caso concluido
  observaciones:    text("observaciones"), // texto libre del solicitante (hacia dónde fue / motivo)
  motivo_rechazo:   text("motivo_rechazo"),
  // 'Pendiente DPD-23' (esperando generar el recibo de pago) | 'Generado' | 'Rechazada'
  estado:           text("estado").notNull().default("Pendiente DPD-23"),
  creado_por:       integer("creado_por").references(() => usuarios.id),
  created_at:       text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});

// Historial de pasajes pagados — el recibo DPD-23 en sí, generado a partir de
// una Solicitud de Pago de Pasaje (SPS-75) ya con forma de pago (cheque +
// vale). Los datos del afiliado se copian al momento del pago (denormalizado)
// para que el recibo impreso no cambie si luego se actualiza la base de
// afiliados.
export const pasajesPagos = pgTable("pasajes_pagos", {
  id:               serial("id").primaryKey(),
  formulario_no:    integer("formulario_no").notNull().unique(),
  solicitud_id:     integer("solicitud_id").references(() => pasajesSolicitudes.id),
  fecha_pago:       text("fecha_pago").notNull(),
  afiliacion:       text("afiliacion").notNull(),
  nombre_afiliado:  text("nombre_afiliado").notNull(),
  calidad:          text("calidad"),
  dpi:              text("dpi"),
  numero_patronal:  text("numero_patronal"),
  patrono:          text("patrono"),
  punto_partida:    text("punto_partida").notNull(),
  destino:          text("destino").notNull(),
  ida:              boolean("ida").notNull().default(true),
  vuelta:           boolean("vuelta").notNull().default(true),
  valor_pasaje:     doublePrecision("valor_pasaje").notNull(),
  observaciones:    text("observaciones"),
  fecha_cita:       text("fecha_cita"),
  poliza_no:        integer("poliza_no"), // legado — reemplazado por poliza_id
  poliza_id:        integer("poliza_id").references((): AnyPgColumn => polizas.id),
  cheque_no:        text("cheque_no"), // legado — el cheque ahora se asigna a nivel de vale
  vale_id:          integer("vale_id").references(() => valesCajaChica.id), // legado
  creado_por:       integer("creado_por").references(() => usuarios.id),
  created_at:       text("created_at").default(sql`to_char(now(), 'YYYY-MM-DD HH24:MI:SS')`),
});
