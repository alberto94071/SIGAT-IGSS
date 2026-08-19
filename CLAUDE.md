# CIP — guía para trabajar en este repo

**El programa se llama CIP** (así aparece en el login, el launcher y todos los
documentos impresos). El nombre del repositorio de GitHub quedó como
`SIGAT-IGSS` por pereza de renombrarlo — es solo el nombre del repo, no el
nombre del producto. No usar "SIGAT" en texto nuevo de cara al usuario
(pantallas, documentos, manuales); solo aparece ya en algunos comentarios y
archivos de docs viejos que no vale la pena tocar uno por uno.

Sistema de Control Interno Presupuestario para **IGSS Tejutla/Tacaná, San Marcos**
(instalación de un solo cliente — no multi-tenant). Cubre todo el ciclo de
compras públicas y ejecución presupuestaria guatemalteca: A-01 SIAF →
Consolidación → Adjudicación/Junta → Compras (Órdenes o Fondo Rotativo) →
Compromiso → Devengado → Pago, más Presupuesto (Programación/Reprogramación/
Modificaciones/Ejecución), Almacén (DAB-60/DAB-75), Caja Chica/Vales/FRI,
Pasajes (SPS-75/DPD-23/Póliza), Viáticos, y catálogos maestros en Base de Datos.

**Este archivo es la referencia que se lee al empezar cada sesión nueva.**
Su trabajo es evitar que una ventana de contexto nueva repita errores ya
corregidos o contradiga reglas de negocio ya confirmadas por el cliente.
`README.md` e `implementation_plan.md` quedaron desactualizados de rondas
anteriores — no son la fuente de verdad; este archivo sí.

## Regla de mantenimiento (leer primero)

**Al terminar un cambio que el usuario pidió** (ya probado, commiteado y
mergeado), actualizá este archivo antes de dar el trabajo por cerrado:

- Si tocaste un módulo nuevo o cambiaste su ubicación → actualizá el "Mapa de
  módulos".
- Si encontraste una regla de negocio no obvia, una trampa del entorno, o un
  patrón que hay que repetir → agregalo a "Trampas y reglas que ya mordieron
  a alguien" (o corregí la entrada si ya no aplica).
- Si una regla vieja cambió (el cliente revirtió algo) → **reemplazá** la
  entrada vieja, no la dejes al lado de la nueva.
- No agregues un changelog cronológico de cada sesión acá — para eso está el
  historial de git y las descripciones de los PRs. Este archivo es una foto
  del estado actual, no un diario. Si una sección crece demasiado, resumí en
  vez de acumular.

## Stack y entorno

- Next.js 15 (App Router) + Drizzle ORM + Neon Postgres serverless
  (`@neondatabase/serverless`) + NextAuth v5 + Tailwind.
- Login de prueba en producción: `admin@cip.com` / `admin123` (rol superadmin).

### Trampas del entorno (perdés tiempo si no las sabés)

- **`drizzle-kit push` se cuelga indefinidamente** en este entorno (el proxy
  no deja conexión Postgres directa, solo HTTPS). Para cualquier cambio de
  esquema contra producción, usar el driver HTTP directo:
  ```bash
  set -a && source .env.local && set +a && node -e "
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.DATABASE_URL);
  (async () => { await sql('ALTER TABLE ...', []); })();
  "
  ```
  Actualizar también `src/lib/schema.ts` a mano para que Drizzle y la base
  real no diverjan.
- **Las herramientas MCP de Neon (`mcp__neon__*`) apuntan a un proyecto
  distinto** al de `.env.local` (host/proyecto diferente — confirmado). Nunca
  usarlas para leer o escribir datos de este proyecto; siempre el patrón de
  arriba.
- **Reusar esta misma rama (`claude/siaf-print-purchase-route-4275cv`) para
  muchos PRs seguidos, cada uno squash-mergeado, produce falsos conflictos**
  la próxima vez que se abre un PR: el hash del padre de la rama ya no
  coincide con el tip de `main` aunque el contenido sea idéntico. Si
  `mcp__github__merge_pull_request` responde "Pull Request has merge
  conflicts": `git fetch origin main && git merge origin/main`, resolver
  cualquier conflicto trivial con `git checkout --ours <archivo>` (el
  contenido de la rama ya es un superset), commitear el merge, push, y recién
  ahí reintentar el merge del PR.
- Tablas grandes que **nunca hay que traer sin filtro**: `base_datos_central`
  (~208k filas, catálogo nacional IGSS) y `pasajes_tarifario` (~7.5k filas,
  tarifa oficial de pasajes). Cualquier lookup nuevo sobre esas tablas debe
  acotarse por los códigos/rutas que el llamador realmente necesita (ver
  `unidadMedidaLookupMap`/`codigoLookupMap` en `renglon-utils.ts` y
  `listarPuntosPartida`/`listarDestinos` en `pasajes-actions.ts` como
  ejemplo del patrón).

## Mapa de módulos (`src/app/`)

| Carpeta | Qué es |
|---|---|
| `compras/` | A-01 SIAF, Consolidación, Adjudicación, Órdenes, catálogo de compras |
| `junta-adjudicadora/` | Actas de adjudicación |
| `presupuesto/` | Programación, Reprogramación, Modificaciones, Compromiso, Devengado, Ejecución, Presupuesto General |
| `almacen/` | DAB-60 (Normal y Fondo Rotativo), DAB-75, Catálogo |
| `fondo-rotativo/`, `caja-chica/`, `dashboard/` (pagos/fri/bancos/vales) | Pago de Fondo Rotativo: Pagos → Bancos/Liquidación → Caja Chica → FRI → Reintegro DAF |
| `pasajes/` | Tarifario, Solicitud de Pasaje (SPS-75), DPD-23, Póliza |
| `viaticos/` | Planilla de Viático (V-L) |
| `base-datos/` | Catálogos maestros: Insumos, Tarifario de Pasajes, Proveedores, Afiliados |
| `administracion/` | Usuarios, permisos, Configuración General, Firmantes |
| `developer/` | Herramientas de superadmin (backup/reset) |

## Trampas y reglas que ya mordieron a alguien

- **"S/C" no es un código compartido real.** Muchos insumos sin código IGSS
  usan el placeholder `"S/C"` como `codigo_igss` — no significa que compartan
  identidad. Agrupar/matchear solo por `codigo_igss + subproducto` mezcla
  insumos distintos entre sí. Siempre agregar `nombre` a la clave (ya
  aplicado en `catalogo_compras`, `siaf_compras_items`, `base_datos_central`,
  cotizaciones — pero es el primer sospechoso si aparece un bug de "se pisan
  los datos de dos insumos distintos").
- **`consolidaciones.destino` y `consolidaciones.regularizado` son cosas
  distintas, no las confundas.** `destino` (`"presupuesto"` | `"fondo_rotativo"`
  | null) decide si el caso va a Compras/Órdenes o a Fondo Rotativo/SIAF-04.
  `regularizado` (boolean) decide la ruta de ejecución presupuestaria
  (`devengado_regularizado` vs. Pre-Compromiso/Compromiso/Devengado normal).
- **Baja Cuantía Regularizado SÍ pasa por Junta Adjudicadora/Acta** antes de
  llegar a Fondo Rotativo (confirmado por el cliente 2026-08-16 — revirtió
  una regla anterior). `aprobarActa` decide el `destino` final según
  `con.regularizado`. Casos de Excepción Regularizado no tienen el límite de
  Q25,000 (`sinLimite` en `actas-adjudicacion-actions.ts`).
- **IVA es `costo / 1.12`, no `costo * 0.88`.** Son parecidos pero no iguales;
  ya se corrigió en todo el sistema una vez — si aparece una fórmula nueva de
  IVA, usar la división.
- **El pago de Fondo Rotativo en efectivo exige un Vale de Caja Chica
  (`gastos_varios`) ya activo**, creado antes en Caja Chica/Vale — no se
  genera al momento de pagar. Si no hay vale activo, el sistema lo dice
  explícitamente; no es un bug.
- **El firmante "Encargado(a) de Unidad" ya no es un campo fijo de
  Configuración** — se eligió así porque la persona que estaba ahí
  (`nombre_encargado_unidad`) dejó de trabajar en la unidad. Ahora es un
  selector (`SelectorFirmante`, ver `src/components/SelectorFirmante.tsx`)
  que lee de `catalogoFirmantes` (Configuración → Firmantes) en cada
  documento impreso que lo necesita. **Pendiente**: los Vales de Caja Chica
  todavía toman el jefe de ese campo de Configuración al crearse (mecanismo
  distinto — necesitaría número de empleado y NIT en `catalogoFirmantes`,
  que hoy no tiene).
- **`getConsolidacionesConDetalles`, `gruposRenglonDeConsolidacion` y
  similares ya tienen el patrón correcto de lookup acotado** — si se agrega
  una función nueva que lee `base_datos_central` o `pasajes_tarifario`,
  copiar ese patrón (recibir la lista de códigos/rutas necesarios como
  parámetro, no traer la tabla completa).
- **El correlativo del A-01 SIAF (`getNextSiafNumeroCompras` en
  `a01-siaf/actions.ts`) tiene un piso configurable** —
  `configuracion.siaf_compras_numero_inicial` / `_anio`, editable desde
  Administración → Configuración → Forma A-01 SIAF. Sirve para cuando la
  unidad ya venía llevando correlativo fuera del sistema (pasó al arrancar:
  105 SIAF ya hechos, se configuró piso 105/2026 para que el sistema
  siguiera en 106). Solo aplica mientras el año actual coincida con el año
  configurado — el año siguiente vuelve a arrancar en 1 solo. Sobrevive a
  "Reiniciar Sistema" porque `configuracion` no se trunca ahí.

## Cómo se prueba un cambio antes de darlo por terminado

1. `npx tsc --noEmit` sin errores.
2. Playwright contra la base de producción real vía `npm run dev` en
   background — login `admin@cip.com` / `admin123`,
   `page.waitForURL('**/launcher')` tras el login (más confiable que
   `waitForNavigation` + `networkidle`).
3. Para cambios de datos/esquema en producción: confirmar con una consulta
   directa (patrón del driver HTTP de arriba) antes y después.
4. Commit con pie `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` +
   `Claude-Session: ...`, push a la rama designada, PR vía
   `mcp__github__create_pull_request`, merge por squash vía
   `mcp__github__merge_pull_request` — solo cuando el usuario lo pida
   explícitamente (o ya esté claro por el patrón de la conversación que
   "mergeemos" significa esto).
