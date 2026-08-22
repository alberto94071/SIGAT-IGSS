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

## Permisos por pestaña (`src/lib/permisos.ts`)

Cada módulo del launcher (`mod_*`) tiene además un permiso `tab_*` por cada
pestaña de su nav — dos personas pueden tener el mismo módulo con pestañas
distintas visibles/ocultas (confirmado por el cliente 2026-08-22). Piezas:

- **`Permisos`** (`src/lib/permisos.ts`): claves `mod_*` (módulo completo,
  como antes) + claves `tab_*` (una por pestaña). Los `tab_*` de "ver/usar"
  vienen en `true` por defecto para los 4 roles (nadie pierde acceso al
  activar esto); solo `tab_presupuesto_autorizar_reprogramacion` y
  `tab_presupuesto_autorizar_modificaciones` vienen en `false` para
  operador/consulta (ver `AUTORIZAR_CERRADO`/`AUTORIZAR_ADMIN`).
- **Ocultar la pestaña**: cada `layout.tsx` de módulo filtra su `NAV_*`
  (ahora con campo `permiso`) contra `permisos` antes de pasarlo a
  `DashboardShell`. Presupuesto es especial: "Programación y Reprogramación"
  y "Modificaciones" son UN nav item que engloba varios permisos internos
  (ver `PRESUPUESTO_NAV` en `presupuesto/layout.tsx`) — se muestra si el
  usuario tiene al menos uno de esos permisos.
- **Que no baste con ocultarla**: cada `page.tsx` detrás de una pestaña
  vuelve a validar con `requireTabAccess(modulo, tab)` (redirige a
  `/launcher` si falta) — `requireModuloAccess` sola ya no alcanza, porque
  solo protege el módulo completo, no la pestaña puntual. Para acciones de
  servidor (aprobar/rechazar) existe el equivalente
  `requireTabAccessAction(modulo, tab)`.
- **Editar desde la UI**: `UsuariosClient.tsx` (Administración → Usuarios →
  ícono de escudo) ya no tiene las dos listas planas de antes — ahora es una
  sola lista agrupada por módulo (`TABS_POR_MODULO`), con las pestañas de
  cada módulo indentadas debajo y visibles solo si el módulo está prendido.
- **Fondo Rotativo (`NAV_ITEMS` en `permisos.ts`) era la referencia rota**:
  antes tenía 8 pestañas con `permiso: null` en todas — la sección
  "Fondo Rotativo (submenús internos)" de la UI de permisos existía pero no
  controlaba nada (dead code, confirmado por investigación 2026-08-22). Ya
  tiene sus 8 `tab_fr_*` reales conectados — si aparece un módulo nuevo con
  pestañas, seguir este mismo patrón (nunca dejar `permiso: null`).
- **Nueva pestaña "Autorizar" en Modificaciones**
  (`presupuesto/modificaciones/ModificacionesClient.tsx`): antes Aprobar/
  Rechazar aparecían inline en la misma tabla donde cualquiera con
  `mod_presupuesto` solicitaba (sin permiso propio). Ahora es una pestaña
  aparte, gateada por `tab_presupuesto_autorizar_modificaciones`, que junta
  lo pendiente de Modificaciones (Ingru/Ampliación) y de Transferencias — los
  botones inline se quitaron de las tablas de solicitudes. Las 4 acciones
  server-side (`aprobarModificacion`/`rechazarModificacion`/
  `aprobarTransferencia`/`rechazarTransferencia` en `programacion-actions.ts`)
  exigen ese mismo permiso, no solo `mod_presupuesto`.
- **"Reprogramaciones pendientes" pasó de gate por rol a gate por permiso**:
  antes `requireAdminPresupuesto()` exigía `rol === "admin" | "superadmin"`
  a mano; ahora exige `tab_presupuesto_autorizar_reprogramacion` (permiso
  configurable por persona, no atado al rol) — el escape de "forzar fuera de
  la ventana de fecha" (`esMaster`) sigue siendo exclusivo de superadmin, eso
  no cambió.

## Trampas y reglas que ya mordieron a alguien

- **"S/C" no es un código compartido real — y tampoco lo son los códigos de
  servicio tipo `"SC-990510"`.** Muchos insumos sin código IGSS usan el
  placeholder `"S/C"` como `codigo_igss`, y varios servicios (ej.
  "Arrendamiento de Inmuebles", una fila del PAC por mes) comparten un mismo
  código de servicio + subproducto genérico — en ningún caso significa que
  compartan identidad. Agrupar/matchear solo por `codigo_igss + subproducto`
  mezcla insumos distintos entre sí. Siempre agregar `nombre` a la clave (ya
  aplicado en `catalogo_compras`, `siaf_compras_items`, `base_datos_central`,
  cotizaciones, y en el cálculo de "Disponible" del PAC tanto en
  `SiafClient.tsx` como en `verificarPacDisponible` de `a01-siaf/actions.ts`
  — pero es el primer sospechoso si aparece un bug de "se pisan los datos de
  dos insumos distintos" o "el disponible de uno se contamina con el de
  otro"). Además, estas filas de servicio no siempre tienen contraparte en
  Base de Datos Central — `editarInsumoCompras` (catálogo) solo revalida el
  código contra Base de Datos Central si el código realmente cambió, para no
  bloquear la edición de filas ya existentes que nunca tuvieron esa
  contraparte.
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
- **La asignación del vale y la confirmación del pago en efectivo son
  exclusivas de Caja Chica/Pagos — Fondo Rotativo/Pagos nunca las hace**
  (confirmado por el cliente 2026-08-19, revirtió el comportamiento
  anterior). Elegir "Efectivo" en Fondo Rotativo/Pagos (`registrarFormaPagoEfectivo`)
  solo marca `forma_pago` y manda el registro a `estado = "Enviado a
  Liquidación"` (o directo a `"Pendiente FRI"` si el renglón es 100-199,
  que nunca pasa por Caja Chica) — no pide vale ni fecha de pago. Es
  `liquidarPago` (`caja-chica-liquidacion-actions.ts`), en Caja Chica/Pagos,
  el que exige el vale de Caja Chica (`gastos_varios`) ya activo y la fecha
  de pago, y recién ahí mueve a `"Pendiente FRI"`. Si no hay vale activo
  todavía, el pago se queda esperando en la lista de Caja Chica/Pagos — no
  es un bug, es el diseño ("que espere el proceso mientras se cuenta con
  el efectivo").
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
- **La leyenda "Código PpR: ..." del A-01 SIAF (renglones que no son 182)
  imprime la columna "Código" de Base de Datos Central, NO su columna interna
  `codigo_ppr`** (confirmado por el cliente 2026-08-22 — son campos
  distintos, el nombre de la leyenda no corresponde con el nombre de la
  columna). `codigoPprLookupMap` (`renglon-utils.ts`) selecciona
  `baseDatosCentral.codigo` (mismo patrón acotado por código que
  `unidadMedidaLookupMap`/`codigoLookupMap`, cruzando por
  `codigo_igss::nombre`) — se usa como respaldo porque
  `siaf_compras_items.codigo_ppr` (el campo real, distinto del anterior)
  solo se llena en Consolidación vía `guardarPprSeleccion`, y un A-01 SIAF
  recién creado todavía no pasó por ahí. A diferencia de la columna "Código"
  de la tabla (ver punto siguiente), esta leyenda **no** recorta el rango —
  el cliente pidió el número completo tal como está guardado (confirmado
  2026-08-22, revirtió el recorte que se le había aplicado por consistencia).
- **Muchos códigos IGSS de Base de Datos Central vienen como un rango**
  (`"128843 - 135227"`) — corregirlo registro por registro no es viable
  (~207 mil filas). La impresión del A-01 SIAF (`codigoParaImprimir` en
  `ImprimirClient.tsx`) recorta al número de la izquierda del guión solo
  cuando ambos lados son numéricos — no toca el dato guardado. Códigos de
  servicio tipo `"SC-990510"` (izquierda no numérica) se imprimen completos.

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
