# Rediseño Proceso Compras → Adjudicación Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar el flujo de Compras en tres etapas — Compras consolida con Pre Orden manual, Junta Adjudicadora adjudica (tipo + proveedor + número de adjudicación SIGES), y Fondo Rotativo (SIAF-04) o Presupuesto (General) reciben la orden ya con precio para generarla — según la spec en `docs/superpowers/specs/2026-06-30-rediseno-proceso-compras-adjudicacion-design.md`.

**Architecture:** Next.js App Router con Server Actions y Drizzle ORM sobre Neon Postgres. Se extrae la lógica y el componente de Adjudicación (hoy solo en `/compras/adjudicacion`) a un módulo compartido en `src/lib/adjudicacion/` y `src/components/adjudicacion/`, parametrizado por rol (`"compras" | "junta"`), reutilizado por las dos rutas `/compras/adjudicacion` y `/junta-adjudicadora/adjudicacion`. Las pantallas destino (`/dashboard/siaf-04`, `/presupuesto/general`) comparten un componente "bandeja" parametrizado por `destino`.

**Tech Stack:** Next.js 15 (App Router, Server Actions), React 19, Drizzle ORM, `@neondatabase/serverless`, TypeScript, Tailwind CSS, lucide-react.

## Global Constraints

- No hay framework de pruebas unitarias en este repo (no jest/vitest, sin archivos `*.test.*`). La verificación de cada tarea es: `npx tsc --noEmit` (sin errores) + `npx next build` al final del plan + revisión manual en `npm run dev` cuando el paso es de UI.
- Las migraciones de base de datos en este repo son scripts `.mjs` en `scripts/` que usan `neon()` con un connection string embebido (mismo patrón que `scripts/migrate-adjudicacion.mjs`, `scripts/migrate-consolidaciones.mjs`) y se ejecutan una sola vez con `node scripts/<archivo>.mjs`. Seguir ese mismo patrón.
- La unicidad de `pre_orden` y `numero_adjudicacion` se valida en el server action (consulta previa), no con un constraint `UNIQUE` en la base de datos — así es como el resto del repo maneja "no duplicados" (ver `getNextSiafNumeroCompras`), no se introduce un patrón nuevo.
- `pre_orden` y `numero_adjudicacion` solo aceptan dígitos — se valida tanto en el cliente (regex en el input) como en el server action (nunca confiar solo en el cliente).
- Mantener `canEdit = rol !== "consulta"` como el único control de acceso a botones de acción (igual que el resto del repo); el control granular por módulo es un proyecto futuro aparte, no tocar aquí.
- Nombres de archivo, componentes y server actions en español, igual que el resto del código existente.

---

## Task 1: Esquema de base de datos — columnas nuevas y tabla `consolidacion_precios`

**Files:**
- Modify: `src/lib/schema.ts`
- Create: `scripts/migrate-completar-adjudicacion.mjs`

**Interfaces:**
- Produces: `consolidaciones.pre_orden` (text, nullable), `consolidaciones.numero_adjudicacion` (text, nullable), `consolidaciones.destino` (text, nullable: `"fondo_rotativo" | "presupuesto"`), `consolidaciones.regularizado` (boolean, nullable). Tabla `consolidacionPrecios` exportada desde `schema.ts` con columnas `id, consolidacion_id, codigo_igss, subproducto, precio_unitario`.

- [ ] **Step 1: Agregar las columnas nuevas a `consolidaciones` en el schema**

En `src/lib/schema.ts`, dentro de `export const consolidaciones = pgTable("consolidaciones", { ... })`, agregar después de `proveedor_nombre`:

```ts
  proveedor_nombre: text("proveedor_nombre"),
  pre_orden:           text("pre_orden"),
  numero_adjudicacion: text("numero_adjudicacion"),
  destino:             text("destino"),
  regularizado:        boolean("regularizado"),
  creado_por:       integer("creado_por"),
```

(la línea `creado_por` ya existe; solo se insertan las 4 líneas nuevas justo antes de ella, dejando el resto del objeto igual).

- [ ] **Step 2: Agregar la tabla `consolidacionPrecios` al schema**

En `src/lib/schema.ts`, inmediatamente después del cierre de `export const consolidaciones = pgTable(...)` (antes del comentario `// ─── Órdenes de Compra`), agregar:

```ts
// ─── Precio por insumo de cada consolidación adjudicada ──────────────────────
export const consolidacionPrecios = pgTable("consolidacion_precios", {
  id:               serial("id").primaryKey(),
  consolidacion_id: integer("consolidacion_id").notNull().references(() => consolidaciones.id, { onDelete: "cascade" }),
  codigo_igss:      integer("codigo_igss"),
  subproducto:      text("subproducto").notNull(),
  precio_unitario:  doublePrecision("precio_unitario").notNull(),
});
```

- [ ] **Step 3: Verificar que el schema compila**

Run: `npx tsc --noEmit`
Expected: sin errores relacionados a `schema.ts`.

- [ ] **Step 4: Escribir el script de migración**

Create `scripts/migrate-completar-adjudicacion.mjs`:

```js
import { neon } from "@neondatabase/serverless";

const DB = "postgresql://neondb_owner:npg_gaDnJLs0lK4T@ep-winter-boat-atha96e8-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(DB);

await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS pre_orden TEXT`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS numero_adjudicacion TEXT`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS destino TEXT`;
await sql`ALTER TABLE consolidaciones ADD COLUMN IF NOT EXISTS regularizado BOOLEAN`;

await sql`
  CREATE TABLE IF NOT EXISTS consolidacion_precios (
    id               SERIAL PRIMARY KEY,
    consolidacion_id INTEGER NOT NULL REFERENCES consolidaciones(id) ON DELETE CASCADE,
    codigo_igss      INTEGER,
    subproducto      TEXT NOT NULL,
    precio_unitario  DOUBLE PRECISION NOT NULL
  )
`;

console.log("✅ Migración completar-adjudicacion completada.");
process.exit(0);
```

- [ ] **Step 5: Ejecutar la migración contra la base de datos**

Run: `node scripts/migrate-completar-adjudicacion.mjs`
Expected output: `✅ Migración completar-adjudicacion completada.`

- [ ] **Step 6: Commit**

```bash
git add src/lib/schema.ts scripts/migrate-completar-adjudicacion.mjs
git commit -m "feat: agregar columnas pre_orden/numero_adjudicacion/destino/regularizado y tabla consolidacion_precios"
```

---

## Task 2: Compras — Número de Pre Orden al consolidar

**Files:**
- Modify: `src/app/compras/a01-siaf/actions.ts:192-223` (función `consolidarSiaf`)
- Modify: `src/app/compras/a01-siaf/SiafClient.tsx` (modal de consolidación)

**Interfaces:**
- Consumes: tabla `consolidaciones` con columna `pre_orden` (Task 1).
- Produces: `consolidarSiaf(ids: number[], preOrden: string)` — nueva firma (antes era `consolidarSiaf(ids: number[])`). Devuelve `{ consolidacion }` o `{ error: string }`.

- [ ] **Step 1: Modificar `consolidarSiaf` para recibir y validar `preOrden`**

En `src/app/compras/a01-siaf/actions.ts`, reemplazar la función completa:

```ts
export async function consolidarSiaf(ids: number[], preOrden: string) {
  try {
    const pre = preOrden.trim();
    if (!/^\d+$/.test(pre)) {
      return { error: "El Número de Pre Orden solo puede contener dígitos" };
    }

    const session = await auth();
    const uid = session ? Number(session.user.id) : null;
    const year = new Date().getFullYear();

    const rows = await db.select({ id: siafCompras.id, estado: siafCompras.estado })
      .from(siafCompras).where(inArray(siafCompras.id, ids));

    if (rows.length === 0) return { error: "No se encontraron las solicitudes" };
    if (rows.some(r => r.estado !== "Aprobado"))
      return { error: "Solo se pueden consolidar solicitudes con estado Aprobado" };

    const [existente] = await db.select({ id: consolidaciones.id })
      .from(consolidaciones).where(eq(consolidaciones.pre_orden, pre)).limit(1);
    if (existente) return { error: `Ya existe una consolidación con el Pre Orden ${pre}` };

    const res = await db.execute(
      sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM consolidaciones WHERE anio = ${year}`
    );
    const numero = Number((res.rows[0] as any).next) || 1;
    const fecha = new Date().toISOString().slice(0, 10);

    const [consolidacion] = await db.insert(consolidaciones)
      .values({ numero, anio: year, fecha, pre_orden: pre, creado_por: uid })
      .returning();

    await db.update(siafCompras)
      .set({ estado: "Consolidado", consolidacion_id: consolidacion.id })
      .where(inArray(siafCompras.id, ids));

    return { consolidacion };
  } catch {
    return { error: "Error al consolidar las solicitudes" };
  }
}
```

- [ ] **Step 2: Verificar que `eq` está importado**

En `src/app/compras/a01-siaf/actions.ts:4`, la línea de import ya incluye `eq`:
```ts
import { eq, and, sql, inArray } from "drizzle-orm";
```
No requiere cambio (ya está presente).

- [ ] **Step 3: Agregar el campo Pre Orden y corregir el texto en el modal de consolidación**

En `src/app/compras/a01-siaf/SiafClient.tsx`, agregar nuevo estado junto a los demás de consolidación (cerca de la línea 61-63):

```ts
  const [consolModal,    setConsolModal]    = useState(false);
  const [consolLoading,  setConsolLoading]  = useState(false);
  const [consolError,    setConsolError]    = useState("");
  const [preOrden,       setPreOrden]       = useState("");
```

- [ ] **Step 4: Actualizar `handleConsolidar` para enviar `preOrden` y validar antes**

Reemplazar la función `handleConsolidar` (líneas 287-299):

```ts
  async function handleConsolidar() {
    if (seleccionados.size === 0) return;
    if (!/^\d+$/.test(preOrden.trim())) {
      setConsolError("Ingresa un Número de Pre Orden válido (solo dígitos)");
      return;
    }
    setConsolLoading(true);
    setConsolError("");
    const res = await consolidarSiaf([...seleccionados], preOrden.trim());
    setConsolLoading(false);
    if (res.error) { setConsolError(res.error); return; }
    setSolicitudes(p => p.map(s =>
      seleccionados.has(s.id) ? { ...s, estado: "Consolidado" } : s
    ));
    setSeleccionados(new Set());
    setConsolModal(false);
    setPreOrden("");
  }
```

- [ ] **Step 5: Resetear `preOrden` al abrir el modal y agregar el input + corregir el texto de advertencia**

En el botón que abre el modal (línea ~322-324), agregar el reset:

```tsx
            <button
              onClick={() => { setConsolError(""); setPreOrden(""); setConsolModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm">
              <Layers className="w-4 h-4" />
              Consolidar ({seleccionados.size})
            </button>
```

Dentro del modal de consolidación (`{consolModal && (...)}`, dentro del `<div className="px-5 py-4 space-y-3">`), agregar el input de Pre Orden justo antes del bloque de advertencia ámbar (antes de la línea con `<AlertTriangle`), y reemplazar el texto de advertencia:

```tsx
              <div>
                <label className="label">Número de Pre Orden <span className="text-red-500 font-semibold">*</span></label>
                <input
                  className="input font-mono"
                  inputMode="numeric"
                  value={preOrden}
                  onChange={e => setPreOrden(e.target.value.replace(/\D/g, ""))}
                  placeholder="Ej: 1023"
                  autoFocus
                />
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Al confirmar, estas solicitudes pasarán a estado <strong>Consolidado</strong> de forma permanente. Esta acción no se puede deshacer.
              </div>
```

(Esto reemplaza el bloque de advertencia existente en líneas 669-672 — el texto viejo decía "Esta acción cambiará el estado de las solicitudes a Consolidado y no se podrá deshacer.")

- [ ] **Step 6: Deshabilitar el botón de confirmar hasta tener un Pre Orden válido**

En el botón "Confirmar consolidación" (línea ~681-686), agregar la condición al `disabled`:

```tsx
              <button onClick={handleConsolidar} disabled={consolLoading || !/^\d+$/.test(preOrden.trim())}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
                {consolLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Consolidando…</>
                  : <><Layers className="w-4 h-4" /> Confirmar consolidación</>}
              </button>
```

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 8: Probar manualmente**

Run: `npm run dev`, entrar a `/compras/a01-siaf`, seleccionar una o más solicitudes en estado "Aprobado", clic en "Consolidar", verificar:
- El botón "Confirmar consolidación" está deshabilitado hasta escribir solo dígitos en Pre Orden.
- El texto de advertencia muestra la nueva redacción.
- Al confirmar con un Pre Orden ya usado, se muestra el error de duplicado.
- Al confirmar con un Pre Orden nuevo, la consolidación se crea y las solicitudes pasan a "Consolidado".

- [ ] **Step 9: Commit**

```bash
git add src/app/compras/a01-siaf/actions.ts src/app/compras/a01-siaf/SiafClient.tsx
git commit -m "feat: pedir Numero de Pre Orden manual al consolidar SIAF"
```

---

## Task 3: Módulo compartido — tipos y lectura (`src/lib/adjudicacion/`)

**Files:**
- Create: `src/lib/adjudicacion/types.ts`
- Create: `src/lib/adjudicacion/actions.ts`

**Interfaces:**
- Consumes: `consolidaciones`, `consolidacionPrecios`, `siafCompras`, `siafComprasItems`, `ordenesCompra`, `proveedores` desde `@/lib/schema` (Task 1).
- Produces: tipos `SiafResumen`, `InsumoPrecio`, `Consolidacion`, `Proveedor` desde `src/lib/adjudicacion/types.ts`. Funciones `getConsolidacionesConDetalles(): Promise<Consolidacion[]>`, `getOrdenes()`, `buscarProveedoresAuto(q: string): Promise<Proveedor[]>` desde `src/lib/adjudicacion/actions.ts` — mismas firmas que las funciones que hoy viven en `src/app/compras/adjudicacion/actions.ts`, para que Task 9 pueda eliminar ese archivo sin romper nada.

- [ ] **Step 1: Crear los tipos compartidos**

Create `src/lib/adjudicacion/types.ts`:

```ts
export type SiafResumen = {
  id: number; numero: number; anio: number; fecha: string; estado: string;
};

export type InsumoPrecio = {
  codigo_igss: number | null;
  subproducto: string;
  nombre: string;
  unidad_medida: string | null;
  cantidad: number;
  precio_unitario: number | null;
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
  siaf: SiafResumen[];
  total_cantidad: number;
  precios: InsumoPrecio[];
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
```

- [ ] **Step 2: Crear las funciones de lectura, incluyendo precio por insumo**

Create `src/lib/adjudicacion/actions.ts`:

```ts
"use server";
import { db } from "@/lib/db";
import {
  consolidaciones, consolidacionPrecios, siafCompras, siafComprasItems,
  ordenesCompra, proveedores,
} from "@/lib/schema";
import { eq, sql, inArray, ilike, or, and, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import type { Consolidacion, InsumoPrecio } from "./types";

// ─── Lectura ──────────────────────────────────────────────────────────────────

export async function getConsolidacionesConDetalles(): Promise<Consolidacion[]> {
  const cons = await db.select().from(consolidaciones)
    .orderBy(sql`anio DESC, numero DESC`);

  const siaf = await db.select({
    id:               siafCompras.id,
    numero:           siafCompras.numero,
    anio:             siafCompras.anio,
    fecha:            siafCompras.fecha,
    estado:           siafCompras.estado,
    consolidacion_id: siafCompras.consolidacion_id,
  }).from(siafCompras).where(isNotNull(siafCompras.consolidacion_id));

  const siafIds = siaf.map(s => s.id);
  let items: { solicitud_id: number; codigo_igss: number | null; subproducto: string;
    nombre: string; unidad_medida: string | null; cantidad_solicitada: number }[] = [];
  if (siafIds.length > 0) {
    items = await db.select({
      solicitud_id:        siafComprasItems.solicitud_id,
      codigo_igss:         siafComprasItems.codigo_igss,
      subproducto:         siafComprasItems.subproducto,
      nombre:              siafComprasItems.nombre,
      unidad_medida:       siafComprasItems.unidad_medida,
      cantidad_solicitada: siafComprasItems.cantidad_solicitada,
    }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds));
  }

  const precios = cons.length > 0
    ? await db.select().from(consolidacionPrecios)
        .where(inArray(consolidacionPrecios.consolidacion_id, cons.map(c => c.id)))
    : [];

  return cons.map(c => {
    const cSiaf = siaf.filter(s => s.consolidacion_id === c.id);
    const cSiafIds = new Set(cSiaf.map(s => s.id));
    const cItems = items.filter(i => cSiafIds.has(i.solicitud_id));
    const total_cantidad = cItems.reduce((sum, i) => sum + (i.cantidad_solicitada ?? 0), 0);

    // Agrupar por codigo_igss + subproducto (mismo patrón que el historial de SiafClient)
    const grupos = new Map<string, InsumoPrecio>();
    for (const item of cItems) {
      const key = `${item.codigo_igss}::${item.subproducto}`;
      const existente = grupos.get(key);
      if (existente) {
        existente.cantidad += item.cantidad_solicitada;
      } else {
        grupos.set(key, {
          codigo_igss: item.codigo_igss, subproducto: item.subproducto,
          nombre: item.nombre, unidad_medida: item.unidad_medida,
          cantidad: item.cantidad_solicitada, precio_unitario: null,
        });
      }
    }
    const cPrecios = precios.filter(p => p.consolidacion_id === c.id);
    for (const p of cPrecios) {
      const key = `${p.codigo_igss}::${p.subproducto}`;
      const grupo = grupos.get(key);
      if (grupo) grupo.precio_unitario = p.precio_unitario;
    }

    return { ...c, siaf: cSiaf, total_cantidad, precios: Array.from(grupos.values()) };
  });
}

export async function getOrdenes() {
  return db.select().from(ordenesCompra).orderBy(sql`anio DESC, numero DESC`);
}

export async function buscarProveedoresAuto(q: string) {
  if (!q || q.trim().length < 2) return [];
  return db.select({
    id:       proveedores.id,
    nit:      proveedores.nit,
    nombre:   proveedores.nombre,
    telefono: proveedores.telefono,
  }).from(proveedores).where(
    and(
      eq(proveedores.activo, true),
      or(
        ilike(proveedores.nombre, `%${q}%`),
        sql`${proveedores.nit} ILIKE ${'%' + q + '%'}`,
      )
    )
  ).limit(8);
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores (las funciones de escritura `adjudicar`, `completarAdjudicacion`, etc. se agregan en las próximas tareas, en el mismo archivo).

- [ ] **Step 4: Commit**

```bash
git add src/lib/adjudicacion/types.ts src/lib/adjudicacion/actions.ts
git commit -m "feat: extraer lectura de adjudicacion a modulo compartido con precio por insumo"
```

---

## Task 4: Acción `adjudicar` (Junta Adjudicadora)

**Files:**
- Modify: `src/lib/adjudicacion/actions.ts` (agregar función al final del archivo)

**Interfaces:**
- Consumes: tipos `TIPOS`, `TipoCompra` desde `./types` (Task 3).
- Produces: `adjudicar(id: number, data: { tipo_compra: TipoCompra; proveedor_id: number | null; proveedor_nit: string; proveedor_nombre: string; numero_adjudicacion: string; nog?: string; fecha_evento?: string }): Promise<{ ok: true } | { error: string }>`. Task 7 (UI de Junta Adjudicadora) llama a esta función.

- [ ] **Step 1: Agregar la función `adjudicar` al final de `src/lib/adjudicacion/actions.ts`**

```ts
// ─── Adjudicación (Junta Adjudicadora) ───────────────────────────────────────

export async function adjudicar(id: number, data: {
  tipo_compra:      "Compra Directa" | "Baja Cuantía" | "Contrato Abierto" | "Casos de Excepción";
  proveedor_id:     number | null;
  proveedor_nit:    string;
  proveedor_nombre: string;
  numero_adjudicacion: string;
  nog?:          string;
  fecha_evento?: string;
}) {
  try {
    const numAdj = data.numero_adjudicacion.trim();
    if (!/^\d+$/.test(numAdj)) {
      return { error: "El Número de Adjudicación solo puede contener dígitos" };
    }
    if (!data.proveedor_nombre.trim()) {
      return { error: "Selecciona un proveedor" };
    }
    if (data.tipo_compra === "Compra Directa") {
      if (!data.nog?.trim()) return { error: "El NOG es obligatorio para Compra Directa" };
      if (!data.fecha_evento) return { error: "La fecha de finalización del evento es obligatoria" };
    }

    const [existente] = await db.select({ id: consolidaciones.id })
      .from(consolidaciones).where(eq(consolidaciones.numero_adjudicacion, numAdj)).limit(1);
    if (existente) return { error: `Ya existe una consolidación con el Número de Adjudicación ${numAdj}` };

    await db.update(consolidaciones).set({
      tipo_compra:         data.tipo_compra,
      estado:               "Adjudicado",
      proveedor_id:         data.proveedor_id,
      proveedor_nit:        data.proveedor_nit,
      proveedor_nombre:     data.proveedor_nombre,
      numero_adjudicacion:  numAdj,
      nog:                  data.tipo_compra === "Compra Directa" ? data.nog!.trim() : null,
      fecha_evento:         data.tipo_compra === "Compra Directa" ? data.fecha_evento! : null,
    }).where(eq(consolidaciones.id, id));

    await db.update(siafCompras)
      .set({ estado: "Adjudicado" })
      .where(eq(siafCompras.consolidacion_id, id));

    return { ok: true };
  } catch {
    return { error: "Error al registrar la adjudicación" };
  }
}

// ─── Anular Consolidación ─────────────────────────────────────────────────────

export async function anularConsolidacion(id: number) {
  try {
    await db.update(siafCompras)
      .set({ estado: "Borrador", consolidacion_id: null })
      .where(eq(siafCompras.consolidacion_id, id));
    await db.delete(consolidaciones).where(eq(consolidaciones.id, id));
    return { ok: true };
  } catch {
    return { error: "Error al anular la consolidación" };
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/adjudicacion/actions.ts
git commit -m "feat: accion adjudicar para Junta Adjudicadora (tipo, NIT, numero de adjudicacion)"
```

---

## Task 5: Acción `completarAdjudicacion` (Compras — precio por insumo + límite + destino)

**Files:**
- Modify: `src/lib/adjudicacion/actions.ts`

**Interfaces:**
- Consumes: `LIMITE_POR_TIPO`, `REFERENCIA_LABEL`, `TipoCompra` desde `./types` (Task 3); tabla `consolidacionPrecios` (Task 1).
- Produces: `completarAdjudicacion(id: number, data: { referencia: string | null; exento_iva: boolean; precios: { codigo_igss: number | null; subproducto: string; precio_unitario: number }[]; regularizado: boolean | null }): Promise<{ ok: true } | { error: string; limitExceeded?: true }>`. Task 8 (UI de Compras) llama a esta función.

- [ ] **Step 1: Actualizar la línea de import de tipos en `src/lib/adjudicacion/actions.ts`**

Reemplazar:
```ts
import type { Consolidacion, InsumoPrecio } from "./types";
```
por:
```ts
import type { Consolidacion, InsumoPrecio, TipoCompra } from "./types";
import { LIMITE_POR_TIPO, REFERENCIA_LABEL } from "./types";
```

- [ ] **Step 2: Agregar la función `completarAdjudicacion` al final del archivo**

```ts
// ─── Completar Adjudicación (Compras) ────────────────────────────────────────

export async function completarAdjudicacion(id: number, data: {
  referencia:   string | null;
  exento_iva:   boolean;
  precios:      { codigo_igss: number | null; subproducto: string; precio_unitario: number }[];
  regularizado: boolean | null;
}) {
  try {
    const [con] = await db.select({ tipo_compra: consolidaciones.tipo_compra, estado: consolidaciones.estado })
      .from(consolidaciones).where(eq(consolidaciones.id, id)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    if (con.estado !== "Adjudicado") return { error: "Solo se puede completar una consolidación en estado Adjudicado" };
    const tipo = con.tipo_compra as TipoCompra | null;
    if (!tipo) return { error: "La consolidación no tiene un tipo de compra asignado" };

    const esDirecta = tipo === "Compra Directa";

    if (!esDirecta && !data.referencia?.trim()) {
      return { error: `El campo "${REFERENCIA_LABEL[tipo]}" es obligatorio` };
    }
    if (!esDirecta && data.regularizado === null) {
      return { error: "Selecciona si es Regularizado o Normal" };
    }
    if (data.precios.length === 0 || data.precios.some(p => !(p.precio_unitario > 0))) {
      return { error: "Ingresa un precio válido para cada insumo" };
    }

    // Cantidad real por insumo, calculada server-side (no se confía en el cliente)
    const siafIds = (await db.select({ id: siafCompras.id })
      .from(siafCompras).where(eq(siafCompras.consolidacion_id, id))).map(s => s.id);
    const items = siafIds.length > 0
      ? await db.select({
          codigo_igss:         siafComprasItems.codigo_igss,
          subproducto:         siafComprasItems.subproducto,
          cantidad_solicitada: siafComprasItems.cantidad_solicitada,
        }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds))
      : [];
    const cantidadPorInsumo = new Map<string, number>();
    for (const it of items) {
      const key = `${it.codigo_igss}::${it.subproducto}`;
      cantidadPorInsumo.set(key, (cantidadPorInsumo.get(key) ?? 0) + it.cantidad_solicitada);
    }

    let bruto = 0;
    for (const p of data.precios) {
      const cantidad = cantidadPorInsumo.get(`${p.codigo_igss}::${p.subproducto}`) ?? 0;
      bruto += cantidad * p.precio_unitario;
    }
    const total = data.exento_iva ? bruto : bruto * 0.88;
    const limite = LIMITE_POR_TIPO[tipo];
    if (total > limite) {
      return {
        error: `El total Q${total.toFixed(2)} supera el límite de Q${limite.toLocaleString("es-GT")} para ${tipo}`,
        limitExceeded: true as const,
      };
    }

    const destino = esDirecta ? "presupuesto" : (data.regularizado ? "fondo_rotativo" : "presupuesto");
    const estado  = destino === "fondo_rotativo" ? "Enviado a Fondo Rotativo" : "Enviado a Presupuesto";

    await db.delete(consolidacionPrecios).where(eq(consolidacionPrecios.consolidacion_id, id));
    await db.insert(consolidacionPrecios).values(
      data.precios.map(p => ({
        consolidacion_id: id,
        codigo_igss:       p.codigo_igss,
        subproducto:       p.subproducto,
        precio_unitario:   p.precio_unitario,
      }))
    );

    await db.update(consolidaciones).set({
      referencia:   esDirecta ? null : data.referencia!.trim(),
      exento_iva:   data.exento_iva,
      total,
      destino,
      regularizado: esDirecta ? null : data.regularizado,
      estado,
    }).where(eq(consolidaciones.id, id));

    return { ok: true as const };
  } catch {
    return { error: "Error al completar la adjudicación" };
  }
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/lib/adjudicacion/actions.ts
git commit -m "feat: accion completarAdjudicacion con precio por insumo, limite y destino"
```

---

## Task 6: Acciones `getPendientesPorDestino` y `generarOrdenDesdeDestino`

**Files:**
- Modify: `src/lib/adjudicacion/actions.ts`

**Interfaces:**
- Produces: `getPendientesPorDestino(destino: "fondo_rotativo" | "presupuesto"): Promise<Consolidacion[]>` — usada por Task 10 (SIAF-04 y Presupuesto General pages). `generarOrdenDesdeDestino(id: number): Promise<{ ok: true } | { error: string }>` — usada por Task 9 (BandejaDestino component).

- [ ] **Step 1: Agregar `getPendientesPorDestino` y `generarOrdenDesdeDestino` al final de `src/lib/adjudicacion/actions.ts`**

```ts
// ─── Pantallas destino (SIAF-04 / Presupuesto General) ───────────────────────

export async function getPendientesPorDestino(destino: "fondo_rotativo" | "presupuesto"): Promise<Consolidacion[]> {
  const estadoBuscar = destino === "fondo_rotativo" ? "Enviado a Fondo Rotativo" : "Enviado a Presupuesto";

  const cons = await db.select().from(consolidaciones)
    .where(and(eq(consolidaciones.destino, destino), eq(consolidaciones.estado, estadoBuscar)))
    .orderBy(sql`created_at DESC`);

  if (cons.length === 0) return [];

  const siaf = await db.select({
    id: siafCompras.id, numero: siafCompras.numero, anio: siafCompras.anio,
    fecha: siafCompras.fecha, estado: siafCompras.estado,
    consolidacion_id: siafCompras.consolidacion_id,
  }).from(siafCompras).where(inArray(siafCompras.consolidacion_id, cons.map(c => c.id)));

  const siafIds = siaf.map(s => s.id);
  const items = siafIds.length > 0
    ? await db.select({
        solicitud_id: siafComprasItems.solicitud_id,
        codigo_igss:  siafComprasItems.codigo_igss,
        subproducto:  siafComprasItems.subproducto,
        nombre:       siafComprasItems.nombre,
        unidad_medida: siafComprasItems.unidad_medida,
        cantidad_solicitada: siafComprasItems.cantidad_solicitada,
      }).from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafIds))
    : [];

  const precios = await db.select().from(consolidacionPrecios)
    .where(inArray(consolidacionPrecios.consolidacion_id, cons.map(c => c.id)));

  return cons.map(c => {
    const cSiaf = siaf.filter(s => s.consolidacion_id === c.id);
    const cSiafIds = new Set(cSiaf.map(s => s.id));
    const cItems = items.filter(i => cSiafIds.has(i.solicitud_id));
    const total_cantidad = cItems.reduce((sum, i) => sum + i.cantidad_solicitada, 0);

    const grupos = new Map<string, InsumoPrecio>();
    for (const item of cItems) {
      const key = `${item.codigo_igss}::${item.subproducto}`;
      const ex = grupos.get(key);
      if (ex) { ex.cantidad += item.cantidad_solicitada; }
      else {
        grupos.set(key, {
          codigo_igss: item.codigo_igss, subproducto: item.subproducto,
          nombre: item.nombre, unidad_medida: item.unidad_medida,
          cantidad: item.cantidad_solicitada, precio_unitario: null,
        });
      }
    }
    for (const p of precios.filter(p => p.consolidacion_id === c.id)) {
      const g = grupos.get(`${p.codigo_igss}::${p.subproducto}`);
      if (g) g.precio_unitario = p.precio_unitario;
    }

    return { ...c, siaf: cSiaf, total_cantidad, precios: Array.from(grupos.values()) };
  });
}

export async function generarOrdenDesdeDestino(id: number) {
  try {
    const session = await auth();
    const uid = session ? Number(session.user.id) : null;
    const year = new Date().getFullYear();
    const fecha = new Date().toISOString().slice(0, 10);

    const [con] = await db.select().from(consolidaciones).where(eq(consolidaciones.id, id)).limit(1);
    if (!con) return { error: "No se encontró la consolidación" };
    const estadoOk = con.estado === "Enviado a Fondo Rotativo" || con.estado === "Enviado a Presupuesto";
    if (!estadoOk) return { error: "La consolidación no está lista para generar la orden" };

    const res = await db.execute(
      sql`SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM ordenes_compra WHERE anio = ${year}`
    );
    const numero = Number((res.rows[0] as any).next) || 1;

    const siafConsolIds = (await db.select({ id: siafCompras.id })
      .from(siafCompras).where(eq(siafCompras.consolidacion_id, id))).map(s => s.id);
    let total_cantidad = 0;
    if (siafConsolIds.length > 0) {
      const its = await db.select({ c: siafComprasItems.cantidad_solicitada })
        .from(siafComprasItems).where(inArray(siafComprasItems.solicitud_id, siafConsolIds));
      total_cantidad = its.reduce((s, i) => s + i.c, 0);
    }

    await db.insert(ordenesCompra).values({
      numero, anio: year, fecha,
      consolidacion_id: id,
      tipo_compra:      con.tipo_compra!,
      nog:              con.nog ?? null,
      referencia:       con.referencia ?? null,
      proveedor_id:     con.proveedor_id ?? null,
      proveedor_nit:    con.proveedor_nit ?? null,
      proveedor_nombre: con.proveedor_nombre ?? null,
      costo_unitario:   null,
      total_cantidad,
      exento_iva:       con.exento_iva,
      total:            con.total ?? null,
      estado:           "Activa",
      creado_por:       uid,
    });

    await db.update(consolidaciones)
      .set({ estado: "Orden de Compra Generada" })
      .where(eq(consolidaciones.id, id));

    await db.update(siafCompras)
      .set({ estado: "Orden de Compra" })
      .where(eq(siafCompras.consolidacion_id, id));

    return { ok: true as const };
  } catch {
    return { error: "Error al generar la orden de compra" };
  }
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/adjudicacion/actions.ts
git commit -m "feat: acciones getPendientesPorDestino y generarOrdenDesdeDestino"
```

---

## Task 7: Componente compartido `AdjudicacionClient` (dual-modo junta/compras)

**Files:**
- Create: `src/components/adjudicacion/AdjudicacionClient.tsx`

**Interfaces:**
- Consumes: tipos `Consolidacion`, `Proveedor`, `InsumoPrecio`, `TIPOS`, `REFERENCIA_LABEL`, `LIMITE_POR_TIPO`, `TipoCompra` desde `@/lib/adjudicacion/types` (Task 3). Funciones `adjudicar`, `completarAdjudicacion`, `anularConsolidacion`, `buscarProveedoresAuto` desde `@/lib/adjudicacion/actions` (Tasks 4–5).
- Produces: componente `AdjudicacionClient` exportado por default, con props `{ consolidaciones: Consolidacion[]; rol: "compras" | "junta"; canEdit: boolean }`.

- [ ] **Step 1: Crear `src/components/adjudicacion/AdjudicacionClient.tsx`**

```tsx
"use client";
import { Fragment, useState, useMemo, useEffect, useRef } from "react";
import {
  Gavel, ChevronDown, ChevronRight, Search, FileText,
  X, Loader2, AlertTriangle, CheckCircle2, Building2,
  ShoppingCart, Hash, Calendar, DollarSign, Layers,
} from "lucide-react";
import {
  adjudicar, completarAdjudicacion, anularConsolidacion, buscarProveedoresAuto,
} from "@/lib/adjudicacion/actions";
import {
  TIPOS, REFERENCIA_LABEL, LIMITE_POR_TIPO, type TipoCompra, type Consolidacion, type Proveedor,
} from "@/lib/adjudicacion/types";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ESTADO_COLOR: Record<string, string> = {
  "Pendiente adjudicación":  "bg-amber-100 text-amber-700",
  "Adjudicado":              "bg-blue-100 text-blue-700",
  "Enviado a Fondo Rotativo":"bg-purple-100 text-purple-700",
  "Enviado a Presupuesto":   "bg-indigo-100 text-indigo-700",
  "Orden de Compra Generada":"bg-green-100 text-green-700",
};

const TIPO_COLOR: Record<string, string> = {
  "Compra Directa":     "bg-blue-100 text-blue-700",
  "Baja Cuantía":       "bg-emerald-100 text-emerald-700",
  "Contrato Abierto":   "bg-amber-100 text-amber-700",
  "Casos de Excepción": "bg-orange-100 text-orange-700",
};

function correlativo(c: Consolidacion) {
  if (c.numero_adjudicacion) return `ADJ-${c.numero_adjudicacion}`;
  if (c.pre_orden) return `PRE-${c.pre_orden}`;
  return `${String(c.numero).padStart(3, "0")}/${c.anio}`;
}

type ModalMode = "adjudicar" | "completar";
type ModalCtx = { consolidacion: Consolidacion; mode: ModalMode } | null;

interface Props {
  consolidaciones: Consolidacion[];
  rol: "compras" | "junta";
  canEdit: boolean;
}

export default function AdjudicacionClient({ consolidaciones: init, rol, canEdit }: Props) {
  const [consolidaciones, setConsolidaciones] = useState(init);
  const [query,      setQuery]      = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Modal state
  const [ctx,           setCtx]           = useState<ModalCtx>(null);
  const [step,          setStep]          = useState(0);
  const [tipoCompra,    setTipoCompra]    = useState<TipoCompra | "">("");
  const [nog,           setNog]           = useState("");
  const [fechaEvento,   setFechaEvento]   = useState(new Date().toISOString().slice(0, 10));
  const [numAdj,        setNumAdj]        = useState("");
  const [provQ,         setProvQ]         = useState("");
  const [provSugg,      setProvSugg]      = useState<Proveedor[]>([]);
  const [provSearching, setProvSearching] = useState(false);
  const [provSelected,  setProvSelected]  = useState<Proveedor | null>(null);
  const [showProvDrop,  setShowProvDrop]  = useState(false);
  // Compras completar state
  const [referencia,    setReferencia]    = useState("");
  const [exentoIva,     setExentoIva]     = useState(true);
  const [precioInputs,  setPrecioInputs]  = useState<Map<string, string>>(new Map());
  const [regularizado,  setRegularizado]  = useState<boolean | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState("");
  const [limitExceeded, setLimitExceeded] = useState(false);

  const provTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return consolidaciones;
    return consolidaciones.filter(c =>
      correlativo(c).toLowerCase().includes(q) ||
      c.fecha.includes(q) ||
      (c.tipo_compra ?? "").toLowerCase().includes(q) ||
      (c.pre_orden ?? "").includes(q) ||
      (c.numero_adjudicacion ?? "").includes(q) ||
      c.siaf.some(s => `${s.numero}/${s.anio}`.includes(q))
    );
  }, [consolidaciones, query]);

  useEffect(() => {
    if (provTimer.current) clearTimeout(provTimer.current);
    if (provQ.trim().length < 2) { setProvSugg([]); return; }
    provTimer.current = setTimeout(async () => {
      setProvSearching(true);
      const res = await buscarProveedoresAuto(provQ);
      setProvSugg(res); setProvSearching(false); setShowProvDrop(true);
    }, 300);
  }, [provQ]);

  function resetModal() {
    setStep(0); setTipoCompra(""); setNog("");
    setFechaEvento(new Date().toISOString().slice(0, 10));
    setNumAdj(""); setProvQ(""); setProvSugg([]);
    setProvSelected(null); setShowProvDrop(false);
    setReferencia(""); setExentoIva(true);
    setPrecioInputs(new Map()); setRegularizado(null);
    setError(""); setLimitExceeded(false); setLoading(false);
  }

  function openAdjudicar(c: Consolidacion) { resetModal(); setCtx({ consolidacion: c, mode: "adjudicar" }); }
  function openCompletar(c: Consolidacion) {
    resetModal();
    const initPrecios = new Map<string, string>();
    c.precios.forEach(p => initPrecios.set(`${p.codigo_igss}::${p.subproducto}`, p.precio_unitario?.toString() ?? ""));
    setPrecioInputs(initPrecios);
    setCtx({ consolidacion: c, mode: "completar" });
  }
  function closeModal() { setCtx(null); resetModal(); }

  // ── Totales para modal compras ──
  const totalBruto = useMemo(() => {
    if (!ctx?.consolidacion) return 0;
    let s = 0;
    for (const p of ctx.consolidacion.precios) {
      const val = parseFloat(precioInputs.get(`${p.codigo_igss}::${p.subproducto}`) ?? "0") || 0;
      s += p.cantidad * val;
    }
    return s;
  }, [ctx, precioInputs]);
  const totalFinal = exentoIva ? totalBruto : totalBruto * 0.88;
  const limite = tipoCompra ? LIMITE_POR_TIPO[tipoCompra as TipoCompra] : (ctx?.consolidacion.tipo_compra ? LIMITE_POR_TIPO[ctx.consolidacion.tipo_compra as TipoCompra] : 90000);
  const totalExcede = totalFinal > 0 && totalFinal > limite;
  const tipoCompraActual = ctx?.consolidacion.tipo_compra as TipoCompra | null | undefined;

  // ── Handlers ──
  async function handleAdjudicar() {
    if (!ctx) return;
    if (!tipoCompra) return setError("Selecciona el tipo de compra");
    if (!provSelected) return setError("Selecciona un proveedor");
    if (!/^\d+$/.test(numAdj.trim())) return setError("El Número de Adjudicación solo puede contener dígitos");
    if (tipoCompra === "Compra Directa") {
      if (!nog.trim()) return setError("El NOG es obligatorio");
      if (!fechaEvento) return setError("La fecha de finalización del evento es obligatoria");
    }
    setLoading(true); setError("");
    const res = await adjudicar(ctx.consolidacion.id, {
      tipo_compra: tipoCompra as TipoCompra,
      proveedor_id: provSelected.id,
      proveedor_nit: provSelected.nit ?? "",
      proveedor_nombre: provSelected.nombre,
      numero_adjudicacion: numAdj.trim(),
      nog: tipoCompra === "Compra Directa" ? nog.trim() : undefined,
      fecha_evento: tipoCompra === "Compra Directa" ? fechaEvento : undefined,
    });
    setLoading(false);
    if (res.error) return setError(res.error);
    const destinoAuto = tipoCompra === "Compra Directa" ? "presupuesto" : null;
    setConsolidaciones(p => p.map(c =>
      c.id === ctx.consolidacion.id ? {
        ...c, estado: "Adjudicado", tipo_compra: tipoCompra as TipoCompra,
        proveedor_id: provSelected!.id, proveedor_nit: provSelected!.nit,
        proveedor_nombre: provSelected!.nombre, numero_adjudicacion: numAdj.trim(),
        nog: tipoCompra === "Compra Directa" ? nog.trim() : null,
        fecha_evento: tipoCompra === "Compra Directa" ? fechaEvento : null,
        destino: destinoAuto,
      } : c
    ));
    closeModal();
  }

  async function handleCompletar() {
    if (!ctx) return;
    const tipo = tipoCompraActual;
    if (!tipo) return setError("Tipo de compra no definido");
    const precios = ctx.consolidacion.precios.map(p => ({
      codigo_igss: p.codigo_igss,
      subproducto: p.subproducto,
      precio_unitario: parseFloat(precioInputs.get(`${p.codigo_igss}::${p.subproducto}`) ?? "0") || 0,
    }));
    setLoading(true); setError(""); setLimitExceeded(false);
    const res = await completarAdjudicacion(ctx.consolidacion.id, {
      referencia: tipo !== "Compra Directa" ? referencia.trim() : null,
      exento_iva: exentoIva,
      precios,
      regularizado: tipo !== "Compra Directa" ? regularizado : null,
    });
    setLoading(false);
    if ((res as any).limitExceeded) { setLimitExceeded(true); setError(res.error!); return; }
    if (res.error) return setError(res.error);
    const destino = tipo === "Compra Directa" ? "presupuesto" : (regularizado ? "fondo_rotativo" : "presupuesto");
    const estado  = destino === "fondo_rotativo" ? "Enviado a Fondo Rotativo" : "Enviado a Presupuesto";
    setConsolidaciones(p => p.map(c =>
      c.id === ctx.consolidacion.id ? { ...c, estado, destino, regularizado, total: totalFinal } : c
    ));
    closeModal();
  }

  async function handleAnular() {
    if (!ctx) return;
    setLoading(true); setError("");
    const res = await anularConsolidacion(ctx.consolidacion.id);
    setLoading(false);
    if (res.error) return setError(res.error);
    setConsolidaciones(p => p.filter(c => c.id !== ctx.consolidacion.id));
    closeModal();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Gavel className="w-5 h-5" />
          {rol === "junta" ? "Adjudicaciones — Junta Adjudicadora" : "Adjudicaciones"}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{consolidaciones.length} consolidación(es)</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por Pre Orden, Adj, tipo o SIAF…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Referencia</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">SIAFs</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Estado</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const expanded = expandedId === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(p => p === c.id ? null : c.id)}>
                      <td className="px-4 py-3 text-gray-400">
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">
                        {correlativo(c)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {c.tipo_compra
                          ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLOR[c.tipo_compra] ?? "bg-gray-100 text-gray-600"}`}>{c.tipo_compra}</span>
                          : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.fecha}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">{c.siaf.length}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap max-w-[180px] truncate">
                        {c.proveedor_nombre ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                        {c.total != null ? Q(c.total) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${ESTADO_COLOR[c.estado] ?? "bg-gray-100 text-gray-600"}`}>
                          {c.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {/* JUNTA: Adjudicar */}
                        {rol === "junta" && canEdit && c.estado === "Pendiente adjudicación" && (
                          <button onClick={() => openAdjudicar(c)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors">
                            <Gavel className="w-3 h-3" /> Adjudicar
                          </button>
                        )}
                        {/* COMPRAS: Completar Adjudicación (cuando ya adjudicó Junta) */}
                        {rol === "compras" && canEdit && c.estado === "Adjudicado" && (
                          <button onClick={() => openCompletar(c)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                            <ShoppingCart className="w-3 h-3" /> Completar Adjudicación
                          </button>
                        )}
                        {(c.estado === "Orden de Compra Generada") && (
                          <span className="flex items-center gap-1 text-xs text-green-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Generada
                          </span>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-purple-50/30">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* SIAFs */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" /> SIAFs consolidados
                              </p>
                              <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-gray-100">
                                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Correlativo</th>
                                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Fecha</th>
                                    <th className="px-3 py-1.5 text-center font-semibold text-gray-600">Estado</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-gray-100 bg-white">
                                    {c.siaf.map(s => (
                                      <tr key={s.id}>
                                        <td className="px-3 py-2 font-mono font-bold text-gray-900">{s.numero}/{s.anio}</td>
                                        <td className="px-3 py-2 text-gray-600">{s.fecha}</td>
                                        <td className="px-3 py-2 text-center">
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">{s.estado}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            {/* Insumos con precio */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Insumos</p>
                              {c.precios.length > 0 ? (
                                <div className="rounded-xl border border-gray-200 overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead><tr className="bg-gray-100">
                                      <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Insumo</th>
                                      <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Cant.</th>
                                      <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Precio</th>
                                      <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Subtotal</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                      {c.precios.map((p, i) => {
                                        const subtotal = p.precio_unitario != null ? p.cantidad * p.precio_unitario : null;
                                        return (
                                          <tr key={i}>
                                            <td className="px-3 py-2 text-gray-900 font-medium">{p.nombre}<span className="block text-gray-400 font-mono text-[10px]">{p.subproducto}</span></td>
                                            <td className="px-3 py-2 text-right tabular-nums text-gray-600">{p.cantidad.toLocaleString("es-GT")}</td>
                                            <td className="px-3 py-2 text-right tabular-nums text-gray-700">{p.precio_unitario != null ? Q(p.precio_unitario) : "—"}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">{subtotal != null ? Q(subtotal) : "—"}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400">Sin precios registrados aún</p>
                              )}
                              {/* Detalles adicionales */}
                              <div className="mt-3 space-y-1 text-xs text-gray-600">
                                {c.nog && <p><span className="font-semibold">NOG:</span> {c.nog}</p>}
                                {c.fecha_evento && <p><span className="font-semibold">Fecha evento:</span> {c.fecha_evento}</p>}
                                {c.referencia && <p><span className="font-semibold">Referencia:</span> {c.referencia}</p>}
                                {c.numero_adjudicacion && <p><span className="font-semibold">N° Adjudicación:</span> {c.numero_adjudicacion}</p>}
                                {c.proveedor_nombre && <p><span className="font-semibold">Proveedor:</span> {c.proveedor_nombre} {c.proveedor_nit && `· NIT: ${c.proveedor_nit}`}</p>}
                                {c.regularizado !== null && <p><span className="font-semibold">Tipo:</span> {c.regularizado ? "Regularizado" : "Normal"}</p>}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Gavel className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay consolidaciones.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal (shared) ── */}
      {ctx && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-amber-600" />
                  {ctx.mode === "adjudicar" ? "Adjudicar Consolidación" : "Completar Adjudicación"}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">{correlativo(ctx.consolidacion)} · {ctx.consolidacion.siaf.length} SIAF(s)</p>
              </div>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-5 py-5 space-y-5">

              {/* ── JUNTA: paso 0 — tipo de compra ── */}
              {ctx.mode === "adjudicar" && step === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Selecciona el tipo de compra:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {TIPOS.map(t => (
                      <button key={t} onClick={() => setTipoCompra(t)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all ${tipoCompra === t ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-700 hover:border-brand-300"}`}>
                        <Gavel className="w-5 h-5" />{t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── JUNTA: paso 1 — proveedor + N° adjudicación (+ NOG/fecha si CD) ── */}
              {ctx.mode === "adjudicar" && step === 1 && (
                <div className="space-y-4">
                  {/* Proveedor */}
                  <div className="relative">
                    <label className="label flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> NIT o Proveedor <span className="text-red-500">*</span></label>
                    {provSelected ? (
                      <div className="flex items-center justify-between p-3 border border-green-300 bg-green-50 rounded-xl">
                        <div><p className="text-sm font-semibold text-green-900">{provSelected.nombre}</p>
                          <p className="text-xs text-green-700">NIT: {provSelected.nit ?? "—"}</p></div>
                        <button onClick={() => { setProvSelected(null); setProvQ(""); }} className="p-1 text-green-600 hover:text-red-600 rounded-lg"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input className="input pl-9" value={provQ}
                          onChange={e => { setProvQ(e.target.value); setShowProvDrop(true); }}
                          onFocus={() => provSugg.length > 0 && setShowProvDrop(true)}
                          onBlur={() => setTimeout(() => setShowProvDrop(false), 200)}
                          placeholder="Escribe NIT o nombre…" autoFocus />
                        {provSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />}
                        {showProvDrop && provSugg.length > 0 && (
                          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                            {provSugg.map(p => (
                              <button key={p.id} type="button" onMouseDown={() => { setProvSelected(p); setProvQ(p.nombre); setShowProvDrop(false); }}
                                className="w-full text-left px-4 py-2.5 hover:bg-brand-50 border-b border-gray-50 last:border-0">
                                <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                                <p className="text-xs text-gray-400">NIT: {p.nit ?? "—"}</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* N° adjudicación SIGES */}
                  <div>
                    <label className="label flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Número de Adjudicación (SIGES) <span className="text-red-500">*</span></label>
                    <input className="input font-mono" value={numAdj}
                      onChange={e => setNumAdj(e.target.value.replace(/\D/g, ""))}
                      placeholder="Solo dígitos" />
                  </div>
                  {/* NOG y fecha solo si Compra Directa */}
                  {tipoCompra === "Compra Directa" && (
                    <>
                      <div>
                        <label className="label flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> NOG <span className="text-red-500">*</span></label>
                        <input className="input font-mono" value={nog} onChange={e => setNog(e.target.value)} placeholder="Ej: 12345678" />
                      </div>
                      <div>
                        <label className="label flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Fecha de finalización del evento <span className="text-red-500">*</span></label>
                        <input className="input" type="date" value={fechaEvento} onChange={e => setFechaEvento(e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── COMPRAS: Completar Adjudicación ── */}
              {ctx.mode === "completar" && (
                <div className="space-y-4">
                  {/* Referencia (no aplica a Compra Directa) */}
                  {tipoCompraActual && tipoCompraActual !== "Compra Directa" && REFERENCIA_LABEL[tipoCompraActual] && (
                    <div>
                      <label className="label">{REFERENCIA_LABEL[tipoCompraActual]} <span className="text-red-500">*</span></label>
                      <input className="input" value={referencia} onChange={e => setReferencia(e.target.value)} />
                    </div>
                  )}
                  {/* Precio por insumo */}
                  <div>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> Precio por insumo
                    </p>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      {ctx.consolidacion.precios.map((p, i) => {
                        const key = `${p.codigo_igss}::${p.subproducto}`;
                        const val = precioInputs.get(key) ?? "";
                        const precioNum = parseFloat(val) || 0;
                        return (
                          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 bg-white">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
                              <p className="text-xs text-gray-400 font-mono">{p.subproducto} · {p.cantidad.toLocaleString("es-GT")} {p.unidad_medida ?? "u."}</p>
                            </div>
                            <div className="relative w-28 shrink-0">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">Q</span>
                              <input type="number" step="0.01" min="0.01" className="input pl-6 text-right font-mono text-sm" placeholder="0.00"
                                value={val} onChange={e => setPrecioInputs(prev => { const m = new Map(prev); m.set(key, e.target.value); return m; })} />
                            </div>
                            {precioNum > 0 && <p className="text-xs text-gray-500 whitespace-nowrap">{Q(p.cantidad * precioNum)}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Exento IVA */}
                  <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                    <input type="checkbox" checked={exentoIva} onChange={e => setExentoIva(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Exento de IVA</p>
                      <p className="text-xs text-gray-400">{exentoIva ? "Sin descuento de IVA" : "Se descuenta el 12% del total"}</p>
                    </div>
                  </label>
                  {/* Total */}
                  {totalBruto > 0 && (
                    <div className={`rounded-xl border px-4 py-3 space-y-1.5 ${totalExcede ? "border-red-300 bg-red-50" : "border-green-200 bg-green-50"}`}>
                      <div className="flex justify-between text-xs text-gray-600"><span>Subtotal bruto:</span><span className="font-mono">{Q(totalBruto)}</span></div>
                      {!exentoIva && <div className="flex justify-between text-xs text-gray-500"><span>Descuento IVA (12%):</span><span className="font-mono">- {Q(totalBruto * 0.12)}</span></div>}
                      <div className={`flex justify-between text-sm font-bold border-t pt-1.5 ${totalExcede ? "border-red-300 text-red-700" : "border-green-300 text-green-700"}`}>
                        <span>Total</span><span className="font-mono">{Q(totalFinal)}</span>
                      </div>
                      {totalExcede
                        ? <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Supera el límite de {Q(limite)}</p>
                        : <p className="text-xs text-green-600">✓ Dentro del límite de {Q(limite)}</p>}
                    </div>
                  )}
                  {/* Regularizado/Normal — solo si no es Compra Directa */}
                  {tipoCompraActual && tipoCompraActual !== "Compra Directa" && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Tipo de gasto</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[{ val: true, label: "Regularizado", color: "purple" }, { val: false, label: "Normal", color: "indigo" }].map(opt => (
                          <button key={String(opt.val)} onClick={() => setRegularizado(opt.val)}
                            className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${regularizado === opt.val ? "border-brand-600 bg-brand-50 text-brand-700" : "border-gray-200 bg-white text-gray-700 hover:border-brand-300"}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        {regularizado === true ? "→ Pasará a Fondo Rotativo (SIAF-04)" : regularizado === false ? "→ Pasará a Presupuesto (General)" : "Elige para continuar"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Errores */}
              {error && !limitExceeded && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
              )}

              {/* Límite excedido */}
              {limitExceeded && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div><p className="font-semibold">Total supera el límite</p><p className="mt-0.5">{error}</p>
                      <p className="mt-1 text-xs text-red-600">Si anulas, los SIAFs regresan a "Borrador".</p></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setLimitExceeded(false); setError(""); }} className="flex-1 btn-secondary justify-center">Corregir precios</button>
                    <button onClick={handleAnular} disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />} Anular Consolidación
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!limitExceeded && (
              <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
                {ctx.mode === "adjudicar" && step > 0
                  ? <button onClick={() => { setStep(s => s - 1); setError(""); }} className="btn-secondary">← Atrás</button>
                  : <button onClick={closeModal} className="btn-secondary">Cancelar</button>}

                {/* Junta paso 0 → 1 */}
                {ctx.mode === "adjudicar" && step === 0 && (
                  <button onClick={() => { if (!tipoCompra) return setError("Selecciona un tipo"); setError(""); setStep(1); }}
                    disabled={!tipoCompra} className="btn-primary disabled:opacity-50">Continuar →</button>
                )}
                {/* Junta paso 1 → confirmar */}
                {ctx.mode === "adjudicar" && step === 1 && (
                  <button onClick={handleAdjudicar} disabled={loading || !provSelected || !numAdj}
                    className="btn-primary disabled:opacity-50">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Gavel className="w-4 h-4" /> Adjudicar</>}
                  </button>
                )}
                {/* Compras completar */}
                {ctx.mode === "completar" && (
                  <button onClick={handleCompletar}
                    disabled={loading || totalFinal <= 0 || totalExcede || (tipoCompraActual !== "Compra Directa" && regularizado === null)}
                    className="btn-primary disabled:opacity-50">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><Layers className="w-4 h-4" /> Confirmar</>}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/adjudicacion/AdjudicacionClient.tsx
git commit -m "feat: componente AdjudicacionClient compartido con modo junta/compras"
```

---

## Task 8: Cablear páginas de Adjudicación (Compras + Junta Adjudicadora)

**Files:**
- Modify: `src/app/compras/adjudicacion/page.tsx`
- Modify: `src/app/junta-adjudicadora/adjudicacion/page.tsx`
- Modify: `src/app/compras/ordenes/page.tsx` (actualizar import de `getOrdenes`)

**Interfaces:**
- Consumes: `AdjudicacionClient` (Task 7), `getConsolidacionesConDetalles` desde `@/lib/adjudicacion/actions` (Task 3), `getOrdenes` (Task 3).

- [ ] **Step 1: Actualizar `src/app/compras/adjudicacion/page.tsx`**

Reemplazar el contenido completo:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { getConsolidacionesConDetalles } from "@/lib/adjudicacion/actions";
import AdjudicacionClient from "@/components/adjudicacion/AdjudicacionClient";

export default async function AdjudicacionPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const consolidaciones = await getConsolidacionesConDetalles();
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";
  return <AdjudicacionClient consolidaciones={consolidaciones} rol="compras" canEdit={canEdit} />;
}
```

- [ ] **Step 2: Actualizar `src/app/junta-adjudicadora/adjudicacion/page.tsx`**

Reemplazar el placeholder "en desarrollo" con:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Rol } from "@/lib/permisos";
import { getConsolidacionesConDetalles } from "@/lib/adjudicacion/actions";
import AdjudicacionClient from "@/components/adjudicacion/AdjudicacionClient";

export default async function JuntaAdjudicacionPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const consolidaciones = await getConsolidacionesConDetalles();
  const rol = session.user.rol as Rol;
  const canEdit = rol !== "consulta";
  return <AdjudicacionClient consolidaciones={consolidaciones} rol="junta" canEdit={canEdit} />;
}
```

- [ ] **Step 3: Actualizar el import de `getOrdenes` en `src/app/compras/ordenes/page.tsx`**

Reemplazar:
```ts
import { getOrdenes } from "../adjudicacion/actions";
```
por:
```ts
import { getOrdenes } from "@/lib/adjudicacion/actions";
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/compras/adjudicacion/page.tsx src/app/junta-adjudicadora/adjudicacion/page.tsx src/app/compras/ordenes/page.tsx
git commit -m "feat: cablear paginas de adjudicacion con componente compartido"
```

---

## Task 9: Componente compartido `BandejaDestino` (SIAF-04 y Presupuesto General)

**Files:**
- Create: `src/components/adjudicacion/BandejaDestino.tsx`

**Interfaces:**
- Consumes: tipos `Consolidacion` (Task 3), función `generarOrdenDesdeDestino` desde `@/lib/adjudicacion/actions` (Task 6).
- Produces: componente `BandejaDestino` con props `{ consolidaciones: Consolidacion[]; titulo: string }`.

- [ ] **Step 1: Crear `src/components/adjudicacion/BandejaDestino.tsx`**

```tsx
"use client";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, ShoppingCart, Loader2, CheckCircle2 } from "lucide-react";
import { generarOrdenDesdeDestino } from "@/lib/adjudicacion/actions";
import type { Consolidacion } from "@/lib/adjudicacion/types";

const Q = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props { consolidaciones: Consolidacion[]; titulo: string; }

export default function BandejaDestino({ consolidaciones: init, titulo }: Props) {
  const [consolidaciones, setConsolidaciones] = useState(init);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [generando,  setGenerando]  = useState<number | null>(null);
  const [error,      setError]      = useState<Record<number, string>>({});

  async function handleGenerar(id: number) {
    setGenerando(id); setError(prev => ({ ...prev, [id]: "" }));
    const res = await generarOrdenDesdeDestino(id);
    setGenerando(null);
    if (res.error) { setError(prev => ({ ...prev, [id]: res.error! })); return; }
    setConsolidaciones(p => p.filter(c => c.id !== id));
  }

  if (consolidaciones.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 text-center max-w-lg mx-auto mt-10">
        <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Sin órdenes pendientes</h2>
        <p className="text-sm text-gray-500">No hay consolidaciones adjudicadas esperando en {titulo}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" /> {titulo}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{consolidaciones.length} orden(es) adjudicada(s) pendiente(s) de generar</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Referencia</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Tipo</th>
                <th className="px-4 py-3 text-left whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 text-left">Proveedor</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {consolidaciones.map(c => {
                const expanded = expandedId === c.id;
                const ref = c.numero_adjudicacion ? `ADJ-${c.numero_adjudicacion}` : c.pre_orden ? `PRE-${c.pre_orden}` : `${c.numero}/${c.anio}`;
                return (
                  <Fragment key={c.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(p => p === c.id ? null : c.id)}>
                      <td className="px-4 py-3 text-gray-400">{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</td>
                      <td className="px-4 py-3 font-mono font-bold text-gray-900 whitespace-nowrap">{ref}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{c.tipo_compra ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{c.fecha}</td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        <p className="font-medium">{c.proveedor_nombre ?? "—"}</p>
                        {c.proveedor_nit && <p className="text-gray-400">NIT: {c.proveedor_nit}</p>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-green-700 whitespace-nowrap">
                        {c.total != null ? Q(c.total) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-end gap-1">
                          <button onClick={() => handleGenerar(c.id)} disabled={generando === c.id}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                            {generando === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShoppingCart className="w-3 h-3" />}
                            Generar Orden
                          </button>
                          {error[c.id] && <p className="text-[10px] text-red-600">{error[c.id]}</p>}
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-green-50/30">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Detalle insumos y precios */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Insumos y precios</p>
                              <div className="rounded-xl border border-gray-200 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-gray-100">
                                    <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Insumo</th>
                                    <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Cant.</th>
                                    <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Precio</th>
                                    <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Subtotal</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-gray-100 bg-white">
                                    {c.precios.map((p, i) => (
                                      <tr key={i}>
                                        <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}<span className="block text-gray-400 font-mono text-[10px]">{p.subproducto}</span></td>
                                        <td className="px-3 py-2 text-right tabular-nums text-gray-600">{p.cantidad.toLocaleString("es-GT")}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{p.precio_unitario != null ? Q(p.precio_unitario) : "—"}</td>
                                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900">{p.precio_unitario != null ? Q(p.cantidad * p.precio_unitario) : "—"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                            {/* Datos adicionales */}
                            <div className="space-y-1 text-xs text-gray-600">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Datos</p>
                              {c.referencia && <p><span className="font-semibold">Referencia:</span> {c.referencia}</p>}
                              {c.nog && <p><span className="font-semibold">NOG:</span> {c.nog}</p>}
                              {c.fecha_evento && <p><span className="font-semibold">Fecha evento:</span> {c.fecha_evento}</p>}
                              <p><span className="font-semibold">IVA:</span> {c.exento_iva ? "Exento" : "Con descuento 12%"}</p>
                              {c.regularizado !== null && <p><span className="font-semibold">Tipo gasto:</span> {c.regularizado ? "Regularizado" : "Normal"}</p>}
                              <p><span className="font-semibold">SIAFs:</span> {c.siaf.map(s => `${s.numero}/${s.anio}`).join(", ")}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/adjudicacion/BandejaDestino.tsx
git commit -m "feat: componente BandejaDestino para generar ordenes desde SIAF-04 y Presupuesto"
```

---

## Task 10: Cablear SIAF-04 y Presupuesto/General como bandejas reales

**Files:**
- Modify: `src/app/dashboard/siaf-04/page.tsx`
- Modify: `src/app/presupuesto/general/page.tsx`

**Interfaces:**
- Consumes: `getPendientesPorDestino` (Task 6), `BandejaDestino` (Task 9).

- [ ] **Step 1: Reemplazar el placeholder de SIAF-04**

`src/app/dashboard/siaf-04/page.tsx`:

```tsx
import { getPendientesPorDestino } from "@/lib/adjudicacion/actions";
import BandejaDestino from "@/components/adjudicacion/BandejaDestino";

export default async function Siaf04Page() {
  const consolidaciones = await getPendientesPorDestino("fondo_rotativo");
  return <BandejaDestino consolidaciones={consolidaciones} titulo="Fondo Rotativo — SIAF-04" />;
}
```

- [ ] **Step 2: Reemplazar el placeholder de Presupuesto General**

`src/app/presupuesto/general/page.tsx`:

```tsx
import { getPendientesPorDestino } from "@/lib/adjudicacion/actions";
import BandejaDestino from "@/components/adjudicacion/BandejaDestino";

export default async function PresupuestoGeneralPage() {
  const consolidaciones = await getPendientesPorDestino("presupuesto");
  return <BandejaDestino consolidaciones={consolidaciones} titulo="Presupuesto — General" />;
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/siaf-04/page.tsx src/app/presupuesto/general/page.tsx
git commit -m "feat: SIAF-04 y Presupuesto General como bandejas de generacion de ordenes"
```

---

## Task 11: Limpieza, actualizar OrdenesClient y verificar build final

**Files:**
- Delete: `src/app/compras/adjudicacion/AdjudicacionClient.tsx`
- Delete: `src/app/compras/adjudicacion/actions.ts`
- Modify: `src/app/compras/ordenes/OrdenesClient.tsx` (quitar columna "Costo unit." obsoleta)

- [ ] **Step 1: Eliminar los archivos viejos de adjudicación en compras**

```bash
git rm src/app/compras/adjudicacion/AdjudicacionClient.tsx
git rm src/app/compras/adjudicacion/actions.ts
```

- [ ] **Step 2: Actualizar `OrdenesClient.tsx` — quitar columna "Costo unit." y "Cantidad"**

Con el nuevo modelo de precios por insumo, `costo_unitario` y `total_cantidad` son obsoletos en las nuevas órdenes (quedan en null). En `src/app/compras/ordenes/OrdenesClient.tsx`, dentro de la fila de encabezado `<thead>`, eliminar las dos columnas:
```tsx
<th className="px-4 py-3 text-right whitespace-nowrap">Costo unit.</th>
<th className="px-4 py-3 text-right whitespace-nowrap">Cantidad</th>
```
Y en las filas `<tbody>`, eliminar las dos celdas correspondientes:
```tsx
<td className="px-4 py-3 text-right font-mono text-gray-700 whitespace-nowrap">
  {o.costo_unitario != null ? Q(o.costo_unitario) : "—"}
</td>
<td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
  {o.total_cantidad != null ? o.total_cantidad.toLocaleString("es-GT") : "—"}
</td>
```
El tipo `Orden` en `OrdenesClient.tsx` puede conservar `costo_unitario` y `total_cantidad` como campos (para no romper consultas a la tabla que ya las tiene), simplemente dejan de mostrarse.

- [ ] **Step 3: Verificar tipos y build completo**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npx next build`
Expected: `✓ Generating static pages` sin errores de compilación ni tipo.

- [ ] **Step 4: Prueba manual en dev**

Run: `npm run dev`, probar el flujo completo:
1. `/compras/a01-siaf` → seleccionar solicitudes Aprobadas → "Consolidar" → ingresar Pre Orden (solo dígitos) → confirmar → solicitudes pasan a "Consolidado".
2. `/junta-adjudicadora/adjudicacion` → ver la consolidación en "Pendiente adjudicación" → "Adjudicar" → elegir tipo → buscar proveedor → ingresar número de adjudicación → confirmar → pasa a "Adjudicado".
3. `/compras/adjudicacion` → ver misma consolidación en "Adjudicado" → "Completar Adjudicación" → ingresar referencia + precio por insumo + exento IVA + elegir Regularizado/Normal → confirmar.
4. Según la elección: entrar a `/dashboard/siaf-04` (si Regularizado) o `/presupuesto/general` (si Normal) → ver la consolidación en la bandeja → "Generar Orden de Compra".
5. Ver la orden generada en `/compras/ordenes`.

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: limpieza archivos viejos, actualizar OrdenesClient, completar rediseno proceso compras"
```

---

