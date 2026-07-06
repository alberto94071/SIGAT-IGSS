export type SiafResumen = {
  id: number; numero: number; anio: number; fecha: string; estado: string;
};

export type InsumoPrecio = {
  codigo_igss: string | null;
  subproducto: string;
  nombre: string;
  unidad_medida: string | null;
  cantidad: number;
  precio_unitario: number | null;
  renglon: number | null;
};

export type Oferente = {
  id: number; consolidacion_id: number; proveedor_id: number | null;
  cotizacion_servicio_id: number | null;
  nit: string; nombre: string; costo: number; exento_iva: boolean; orden: number;
};

export type CotizacionServicio = {
  id: number; fecha: string; proveedor_id: number | null;
  proveedor_nit: string | null; proveedor_nombre: string;
  servicio: string; costo: number; exento_iva: boolean; usado: boolean;
};

export type ActaNegociacion = {
  anio: number; contenido: string | null; archivo_url: string | null;
};

export type Consolidacion = {
  id: number; numero: number; anio: number; fecha: string;
  pre_orden: string | null;
  numero_adjudicacion: string | null;
  tipo_compra: string | null;
  estado: string;
  nog: string | null;
  fecha_evento: string | null;
  referencia: string | null;
  exento_iva: boolean;
  total: number | null;
  destino: string | null;
  regularizado: boolean | null;
  proveedor_id: number | null;
  proveedor_nit: string | null;
  proveedor_nombre: string | null;
  creado_por: number | null;
  created_at: string | null;
  motivo_rechazo: string | null;
  rechazado_por: number | null;
  rechazado_por_nombre: string | null;
  rechazado_en: string | null;
  enviado_a_junta_por: number | null;
  enviado_a_junta_en: string | null;
  oferente_ganador_id: number | null;
  numero_cheque: string | null;
  numero_a04: number | null;
  anio_a04: number | null;
  acta_aprobada: boolean;
  siaf: SiafResumen[];
  total_cantidad: number;
  precios: InsumoPrecio[];
  oferentes: Oferente[];
};

export type Proveedor = { id: number; nit: string | null; nombre: string; telefono: string | null };

export const TIPOS = ["Compra Directa", "Baja Cuantía", "Contrato Abierto", "Casos de Excepción"] as const;
export type TipoCompra = typeof TIPOS[number];

export const LIMITE_POR_TIPO: Record<TipoCompra, number> = {
  "Compra Directa":     90000,
  "Baja Cuantía":       25000,
  "Contrato Abierto":   25000,
  "Casos de Excepción": 25000,
};

export const REFERENCIA_LABEL: Record<string, string> = {
  "Baja Cuantía":       "No. de Cotización",
  "Contrato Abierto":   "No. de Contrato",
  "Casos de Excepción": "Tipo de Servicio",
};

// Máximo de oferentes por consolidación (Compra Directa / Baja Cuantía con insumos)
export const MAX_OFERENTES = 10;
