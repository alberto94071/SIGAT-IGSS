// Nombres de columna que el importador de PAC reconoce en el encabezado
// (primera fila) del Excel — usado tanto por importar-action.ts (para
// encontrar cada columna) como por el instructivo en CatalogoComprasClient.tsx
// (para mostrárselo al usuario). Aparte de importar-action.ts porque ese es
// un archivo "use server", que solo puede exportar funciones async.
export const COLUMNAS_PAC = [
  { nombres: ["Renglón", "Renglon"], clave: "renglon", obligatoria: true,
    descripcion: "Renglón presupuestario del insumo (ej. 111, 182, 211)." },
  { nombres: ["Código IGSS", "Codigo IGSS"], clave: "codigo_igss", obligatoria: true,
    descripcion: 'Código del insumo en Base de Datos Central, o "S/C" si el insumo no tiene código propio.' },
  { nombres: ["Nombre Genérico, Forma, Concentración y Presentación", "Nombre Genérico", "Nombre Generico", "Nombre del Insumo", "Nombre"], clave: "nombre", obligatoria: true,
    descripcion: "Descripción completa del insumo." },
  { nombres: ["Sub-Producto", "Subproducto"], clave: "subproducto", obligatoria: true,
    descripcion: "Código de sub-producto (ej. 001-004-0001)." },
  { nombres: ["Cantidad", "Cantidad Autorizada"], clave: "cantidad", obligatoria: false,
    descripcion: "Cantidad autorizada para el año (número)." },
  { nombres: ["Precio Estimado"], clave: "precio_estimado", obligatoria: false,
    descripcion: "Precio unitario estimado (número, sin símbolo de moneda)." },
  { nombres: ["Monto"], clave: "monto", obligatoria: false,
    descripcion: "Monto total del insumo (número, sin símbolo de moneda)." },
] as const;
