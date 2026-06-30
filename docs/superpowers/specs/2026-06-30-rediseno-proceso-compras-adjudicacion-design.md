# Rediseño del proceso Compras → Adjudicación → Fondo Rotativo / Presupuesto

## Contexto

Hoy el flujo de Compras (`/compras/a01-siaf` → `/compras/adjudicacion`) hace todo dentro del módulo de Compras: el correlativo de consolidación se genera automático, la misma persona de Compras adjudica (elige tipo, NOG/referencia, costo, proveedor) y genera la Orden de Compra.

Se va a separar responsabilidades entre tres roles/módulos: **Compras** (consolida y pone precios), **Junta Adjudicadora** (adjudica: tipo, proveedor, número de adjudicación de SIGES) y **Fondo Rotativo / Presupuesto** (reciben la orden ya adjudicada y generan la Orden de Compra final). Esto es preparación para un proyecto futuro y separado de permisos por módulo, donde el superadmin podrá asignar a cada usuario nuevo qué módulos puede ver — ese proyecto de permisos **no** está incluido aquí.

## Línea de tiempo del nuevo proceso

```
Compras consolida (ingresa Pre Orden manual, solo dígitos, único)
        │
        ▼
"Pendiente adjudicación"  ← Compras/Adjudicación: SOLO LECTURA
        │
        │   Junta Adjudicadora → botón "Adjudicar":
        │     1. Elige tipo (Compra Directa / Baja Cuantía / Contrato Abierto / Excepción)
        │     2. Ingresa NIT del proveedor (buscador con autocompletar) + Número de Adjudicación (SIGES)
        │     3. Si es Compra Directa → además NOG + Fecha de finalización del evento
        ▼
"Adjudicado" (tipo, proveedor y número de adjudicación ya definidos)
        │
        │   Compras/Adjudicación → botón "Completar Adjudicación" (los 4 tipos):
        │     - Baja Cuantía / Contrato Abierto / Excepción:
        │         Referencia + precio por insumo + exento IVA + límite Q25,000
        │         + elige Regularizado o Normal
        │     - Compra Directa:
        │         (sin Referencia) precio por insumo + exento IVA + límite Q90,000
        │         (sin elegir Regularizado/Normal — destino fijo: Presupuesto)
        ▼
        ├── Regularizado ──► destino = Fondo Rotativo   → estado "Enviado a Fondo Rotativo"
        └── Normal / Compra Directa ──► destino = Presupuesto → estado "Enviado a Presupuesto"
        │
        ▼
Pantalla destino (SIAF-04 si Fondo Rotativo, Presupuesto General si Presupuesto):
  bandeja de revisión (proveedor, tipo, desglose por insumo, total) → "Generar Orden de Compra"
        │
        ▼
"Orden de Compra Generada" (visible en /compras/ordenes, igual que hoy)
```

Si el total supera el límite (Q25,000 para los 3 tipos no-directos, Q90,000 para Compra Directa), en el paso de "Completar Adjudicación" se bloquea continuar y se ofrece **Anular Consolidación** (igual que hoy: las solicitudes SIAF regresan a "Aprobado" para poder corregirlas).

## Cambios en base de datos

### `consolidaciones` — columnas nuevas

| Columna | Tipo | Quién la llena |
|---|---|---|
| `pre_orden` | text, único, solo dígitos | Compras, al consolidar |
| `numero_adjudicacion` | text, único, solo dígitos | Junta Adjudicadora, al adjudicar (los 4 tipos) |
| `destino` | text (`fondo_rotativo` \| `presupuesto`) | Compras (Completar Adjudicación); automático = `presupuesto` si Compra Directa |
| `regularizado` | boolean, nullable | Compras (Completar Adjudicación); `null` en Compra Directa |

Columnas existentes que cambian de "quién las llena":
- `tipo_compra`, `proveedor_id`, `proveedor_nit`, `proveedor_nombre`, `nog`, `fecha_evento` → ahora los llena **Junta Adjudicadora** al adjudicar (antes algunos los llenaba Compras en el paso final).
- `referencia`, `exento_iva`, `total` → los sigue llenando **Compras** en "Completar Adjudicación" (para los 4 tipos; `referencia` queda vacío en Compra Directa).
- `costo_unitario` queda en desuso (ya no hay un precio único por consolidación) — no se elimina la columna, simplemente se deja de escribir en ella.
- `numero` / `anio` se mantienen como orden interno de base de datos, pero ya no se muestran como identificador principal — se reemplazan en pantalla por `pre_orden` y, una vez adjudicado, por `numero_adjudicacion`.

### Tabla nueva `consolidacion_precios` (precio por insumo)

| Columna | Tipo |
|---|---|
| `id` | serial, PK |
| `consolidacion_id` | integer, FK → `consolidaciones.id` |
| `codigo_igss` | integer |
| `subproducto` | text |
| `precio_unitario` | doublePrecision |

La cantidad de cada insumo **no se guarda aquí**: se calcula en cada lectura sumando `siaf_compras_items` de las solicitudes de esa consolidación, agrupadas por `codigo_igss + subproducto` (mismo patrón que ya usa `getConsolidacionesConDetalles()` para `total_cantidad`). Esto es seguro porque una solicitud SIAF ya no se puede editar ni eliminar una vez en estado "Consolidado" — no hay riesgo de desincronización.

`ordenes_compra` no necesita su propia tabla de precios: tiene `consolidacion_id`, así que el desglose por insumo se consulta uniendo con `consolidacion_precios`.

## Pantallas

### 1. Compras — Consolidar (`/compras/a01-siaf`, modal de consolidación en `SiafClient.tsx`)

- Se agrega un campo obligatorio **Número de Pre Orden** (input numérico). Se valida formato solo-dígitos y unicidad contra `consolidaciones.pre_orden` antes de permitir confirmar.
- El botón "Confirmar consolidación" queda deshabilitado hasta tener un Pre Orden válido.
- El texto de advertencia se reescribe:
  > "Al confirmar, estas solicitudes pasarán a estado **Consolidado** de forma permanente. Esta acción no se puede deshacer."

### 2. Compras — Adjudicación (`/compras/adjudicacion`)

Componente compartido (ver sección de implementación) en modo `compras`:
- **Sin botón "Adjudicar"** — solo lectura mientras `estado = "Pendiente adjudicación"`.
- Identificador mostrado: Pre Orden (antes de adjudicar) o Número de Adjudicación (después).
- Botón **"Completar Adjudicación"** visible cuando `estado = "Adjudicado"`. Modal:
  - Si tipo ≠ Compra Directa: Referencia (label según tipo) + tabla de precio por insumo + checkbox exento IVA + validación límite Q25,000 + selector final Regularizado/Normal.
  - Si tipo = Compra Directa: tabla de precio por insumo + checkbox exento IVA + validación límite Q90,000 (sin Referencia, sin selector Regularizado/Normal).
  - Si el total excede el límite: ofrecer "Anular Consolidación" (mismo comportamiento que hoy).
- Para estados posteriores (`Enviado a...`, `Orden de Compra Generada`) no hay botones, solo el badge de estado.

### 3. Junta Adjudicadora — Adjudicación (`/junta-adjudicadora/adjudicacion`)

Mismo componente compartido, modo `junta`, reemplaza el placeholder actual:
- Botón **"Adjudicar"** visible solo cuando `estado = "Pendiente adjudicación"`. Modal:
  1. Selector de tipo (4 opciones, mismo estilo que hoy).
  2. Buscador de proveedor por NIT o nombre (autocompletar, igual al que ya existe).
  3. Número de Adjudicación (SIGES) — input numérico, único.
  4. Si tipo = Compra Directa: además NOG + Fecha de finalización del evento.
- Al confirmar: `estado → "Adjudicado"`, se guardan tipo/proveedor/numero_adjudicacion (y nog/fecha_evento si aplica); los SIAFs de la consolidación pasan a `estado = "Adjudicado"`.
- Para estados posteriores, solo lectura (sin botones de acción).

### 4. Fondo Rotativo — SIAF-04 (`/dashboard/siaf-04`, primera pestaña del módulo)

Reemplaza el placeholder "en desarrollo":
- Bandeja con consolidaciones `destino = "fondo_rotativo"` y `estado = "Enviado a Fondo Rotativo"`.
- Por cada una: desglose por insumo con precio, proveedor, tipo, total, referencia.
- Botón **"Generar Orden de Compra"** → inserta en `ordenes_compra`, `estado → "Orden de Compra Generada"`, SIAFs → `estado = "Orden de Compra"`.

### 5. Presupuesto — General (`/presupuesto/general`, primera pestaña del módulo)

Misma bandeja que SIAF-04, pero filtrando `destino = "presupuesto"` y `estado = "Enviado a Presupuesto"` (incluye tipo Normal y Compra Directa). Mismo botón "Generar Orden de Compra" con el mismo resultado.

## Notas de implementación

- `AdjudicacionClient.tsx` se convierte en un componente compartido que recibe un prop de rol (`"compras" | "junta"`) para decidir qué botones de acción mostrar; el resto de la tabla/expansión de detalle es igual para ambos.
- Las acciones de servidor (`adjudicarFase1`, `generarOrdenCompra`, `completarOrdenDirecta` en `compras/adjudicacion/actions.ts`) se reescriben para el nuevo flujo: `consolidarSiaf` (recibe `preOrden`), `adjudicar` (Junta Adjudicadora, los 4 tipos), `completarAdjudicacion` (Compras, precio por insumo + destino), `generarOrdenDesdeDestino` (SIAF-04 / Presupuesto General).
- El control de quién puede pulsar cada botón usa el mismo patrón actual (`canEdit = rol !== "consulta"`); el control granular por módulo/persona es el proyecto de permisos que se hará después.

## Fuera de alcance

- Permisos por módulo por usuario (proyecto separado, futuro).
- Cualquier cambio a Caja Chica, Almacén, Libros, Junta Adjudicadora → Acta, Contrato y Cotizaciones (módulos placeholder no tocados por este proyecto).
