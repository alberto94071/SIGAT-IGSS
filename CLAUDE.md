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
- **Carta de Conformidad (`/compras/adjudicacion/[id]/conformidad`) solo
  aplica a compras Regularizadas de renglón 100-199 (subgrupo 100, servicios
  personales)** — no a Regularizado en general. Gateado dos veces: el botón
  en `ComprasAdjudicacionClient.tsx` exige `regularizado === true` y que
  `c.precios.every(p => esGrupo100(p.renglon))`; la página server-side repite
  el mismo chequeo con `gruposRenglonDeConsolidacion` + `esGrupo100`
  (`programacion-constants.ts`) y devuelve 404 si no aplica — así no se
  puede llegar por URL directa a una consolidación de otro renglón.
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
- **Se puede "Devolver" la forma de pago elegida (Efectivo ↔ Cheque) desde
  Caja Chica/Pagos o Bancos** — por si el usuario se equivocó (eligió
  Efectivo sin tener efectivo, o Cheque cuando debía ser Efectivo).
  `devolverAFormaPago` (`fondo-rotativo-pagos-actions.ts`) regresa el pago a
  `"Pendiente forma de pago"` en Fondo Rotativo/Pagos — aplica a
  `"Enviado a Liquidación"` (Caja Chica/Pagos, antes de asignar vale) o
  `"Enviado a Bancos"` (Bancos, con o sin datos de cheque ya completados;
  bloqueado si el cheque ya fue conciliado). **No aplica a grupo 100**
  (renglón 100-199): esos van directo a `"Pendiente FRI"` sin pasar por
  ninguna de las dos pantallas, así que nunca llegan a este botón. Deshace
  también el posteo a Ejecución que se hizo al elegir la forma de pago
  (`reflejarEnEjecucion`) vía su inverso `revertirEjecucion` — si esto se
  omite, volver a elegir forma de pago cuenta el monto dos veces en
  `devengado_regularizado`/`pre_compromiso`.
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
- **Base de Datos Central se reimportó por completo el 2026-08-23** (207,821
  filas) desde un Excel limpio que el cliente preparó, tras confirmarse que
  el `codigo_ppr` del import anterior (`import-homologados.mjs`, ya no se
  usa) estaba mal mapeado desde el origen: traía un número pequeño (1, 2,
  3...) de la columna equivocada del Excel viejo. **El código PPR correcto
  es el de formato "número - número"** (ej. `"153739 - 179973"`, confirmado
  por el cliente) — es además único en el 100% de las filas, a diferencia de
  `codigo_igss` (código real), que solo existe en ~15% del catálogo; el
  resto queda `NULL` (ya no se rellena con un rango ni con "SC"). Import
  nuevo: `scripts/import-base-datos-central-v2.cjs` (recibe el .xlsx como
  argumento, trunca y recarga la tabla en un solo paso; usa `require` en vez
  de `import` porque la build ESM de la librería `xlsx` falla con "Cannot
  access file" al leer un archivo de este tamaño). De paso se eliminó la
  columna `codigo` (duplicada de `codigo_igss` — el Excel nuevo ya no tiene
  esa ambigüedad de dos campos de código real; `codigoPprLookupMap`/
  `codigoLookupMap`/`getPprsPorItems` en `renglon-utils.ts` ya no buscan por
  ambos campos, solo por `codigo_igss`). La leyenda "Código PpR: ..." del
  A-01 SIAF (`codigoPprLookupMap`) ahora lee directamente
  `baseDatosCentral.codigo_ppr` — antes leía la columna "Código" como parche
  porque el `codigo_ppr` real venía mal. Esta leyenda **no** recorta el
  rango — el cliente pidió el número completo tal como está guardado.
- **Efecto en datos ya existentes de la reimportación de arriba: el
  `codigo_igss` guardado ANTES del 2026-08-24 en `catalogo_compras`/
  `siaf_compras_items` a veces es en realidad un `codigo_ppr` de la base
  nueva, no un `codigo_igss`.** Detectado con un caso real del cliente (SIAF
  con "PPR 108241-125834" que no traía opciones en el selector, pese a
  existir una sola fila exacta en Base de Datos Central) y confirmado contra
  toda la base: **los 181 códigos de `catalogo_compras` con formato
  "número - número" coinciden 100% con un `codigo_ppr` de la base nueva, y
  0% con un `codigo_igss`** — ese rango es justo el placeholder que traía la
  columna `codigo_igss` de la Base de Datos Central VIEJA (antes de la
  reimportación), y por casualidad de cómo el cliente organizó su Excel
  nuevo, ese mismo valor terminó siendo el `codigo_ppr` de esa fila hoy. Fix:
  `getPprsPorItems`/`unidadMedidaLookupMap`/`codigoLookupMap`/
  `codigoPprLookupMap` (`renglon-utils.ts`) ahora buscan también por
  `codigo_ppr` cuando no matchea por `codigo_igss` (`filasPorCodigoIgssOPpr`)
  — sin riesgo de ambigüedad, porque `codigo_ppr` es único en el 100% de las
  207,821 filas (a diferencia de `codigo_igss`, donde un mismo código real
  puede cubrir varios nombres distintos — hasta 8 en un caso — por eso ESE
  cruce sí necesita `nombre` en la clave y el de `codigo_ppr` no). Con este
  fix, los SIAF/Órdenes/Consolidaciones creados antes de la reimportación
  con código formato rango SÍ encuentran su presentación real en el
  selector — ya no hace falta re-capturarlos.
- **`buscarInsumosCentral` (Catálogo/PAC → "Agregar insumo", `catalogo/
  actions.ts`) excluía por completo el ~85% de Base de Datos Central que no
  tiene `codigo_igss` real** (ej. "Mesa de conferencia") — el cliente
  reportó no poder agregar un insumo aunque aparecía en la búsqueda de Base
  de Datos Central. Ya no exige `codigo_igss` no nulo, y agrupa por
  `codigo_igss` cuando existe o por **nombre normalizado** cuando no —
  **no** por `codigo_ppr` (primer intento, revertido): un insumo sin código
  real puede tener docenas de presentaciones, cada una con su propio
  `codigo_ppr` — agrupar por ese campo las mostraba como insumos distintos y
  un solo producto (ej. "Servidor", 60+ presentaciones) llenaba las 10
  opciones visibles sin dejar aparecer nada más. El valor que se guarda para
  estos es literal **`"S/C"`** (el placeholder `SIN_CODIGO`, ahora exportado
  desde `renglon-utils.ts`, que ya usa el resto del sistema) — la
  presentación puntual se sigue eligiendo después, al generar la Orden o el
  SIAF-04 (`getPprsPorItems` ya agrupa ese caso por nombre). `validarCodigoCentral`
  acepta `"S/C"` sin buscarlo en Base de Datos Central (no corresponde a
  ninguna fila puntual). El agrupado se hace con `DISTINCT ON` en SQL crudo
  (`db.execute`), no después de traer un `LIMIT` de filas planas — con
  `LIMIT` plano, un producto con muchas presentaciones podía acaparar el
  límite completo antes de llegar a agrupar, dejando fuera productos
  distintos que sí coincidían con la búsqueda (detectado 2026-08-24 con una
  muestra de insumos sin código: la mayoría no aparecía buscando por su
  propio nombre). También se agregó una `relevancia` (coincidencia exacta >
  nombre que empieza con el término > el resto) para que, con más de 10
  productos distintos coincidiendo, salgan primero los más específicos.
  `InsumoCentralAgrupado` ahora trae `codigoReal: boolean` para que la UI
  (`CatalogoComprasClient.tsx`) muestre "Sin código real (S/C)" en vez de
  "Código ..." cuando no es un código IGSS real.
- **Para insumos sin código real, "Descripción IGSS" (la que imprime el A-01
  SIAF) se arma con nombre + características, no solo nombre** — Base de
  Datos Central solo trae una "Descripción IGSS" propia para el ~15% con
  código real (columna "Descripcion" del Excel); el resto la trae vacía.
  `elegirInsumo` (`CatalogoComprasClient.tsx`) ahora hace ese respaldo con
  `${nombre}; ${caracteristicas}` en vez de solo `nombre` — antes se perdía
  todo el detalle (capacidad, material, tipo...) en el A-01 SIAF impreso
  (reportado por el cliente 2026-08-24 con "Destructora de papel": imprimía
  solo eso, sin el resto de la ficha). `InsumoCentralAgrupado`/
  `buscarInsumosCentral` ahora también traen `caracteristicas`.
- **La leyenda "Código PpR:" del A-01 SIAF también se resuelve para ítems
  sin código real (S/C), no solo con código real** — `codigoPprLookupMap`
  (por `codigo_igss`) no aplica ahí porque no hay `codigo_igss` por el que
  buscar. `codigoPprSinCodigoLookupMap` (`renglon-utils.ts`) busca por
  nombre en su lugar, pero un mismo nombre puede tener cientos de
  presentaciones distintas en Base de Datos Central (ej. "Planta generadora
  de electricidad" con 272 variantes, cada una con su propio `codigo_ppr`)
  — para no imprimir el PPR de una presentación equivocada, solo se
  resuelve cuando es inequívoco: una sola presentación con ese nombre, o la
  descripción completa (nombre + características) coincide exacta con
  alguna (el mismo formato que arma `elegirInsumo` al agregar el insumo, así
  que los insumos agregados por ese camino siempre matchean). Reportado por
  el cliente 2026-08-24 ("Planta generadora de electricidad", SIAF 47/2026)
  — confirmado que sí hay una coincidencia exacta única en Base de Datos
  Central para ese caso.
- **Muchos códigos IGSS de Base de Datos Central vienen como un rango**
  (`"128843 - 135227"`) — corregirlo registro por registro no es viable
  (~207 mil filas). La impresión del A-01 SIAF (`codigoParaImprimir` en
  `ImprimirClient.tsx`) imprime **"SC"** (Sin Código) cuando el código
  guardado es un rango puramente numérico — no toca el dato guardado, es
  solo el texto impreso. (Antes se imprimía el número de la izquierda del
  rango; el cliente confirmó que eso podía leerse como si fuera el código
  real de ese insumo puntual, cuando el rango es solo un placeholder de
  importación masiva sin código real asignado.) Dos casos NO entran en esta
  regla: códigos de servicio tipo `"SC-990510"` (ya vienen con el prefijo
  SC) y códigos que son solo números sin guion (código real de un insumo
  puntual) — ambos se imprimen tal cual están guardados.
- **El Catálogo (PAC) guarda dos descripciones distintas de Base de Datos
  Central, no una** (confirmado por el cliente 2026-08-22): `nombre`
  (Código + Nombre) alimenta Órdenes, SIAF-04 y DAB-60; `descripcion_igss`
  (Código IGSS + Descripción IGSS, columna nueva en `catalogo_compras` y
  `siaf_compras_items`) alimenta específicamente el A-01 SIAF
  (`ImprimirClient.tsx` usa `item.descripcion_igss || item.nombre`, nunca
  queda en blanco). Antes `elegirInsumo` (`CatalogoComprasClient.tsx`)
  guardaba `descripcion_igss || nombre` como el único `nombre` — mezclaba
  las dos; ya no. Los ~1,634 insumos que ya estaban en el catálogo antes de
  este cambio se respaldaron con `descripcion_igss = nombre` (ese `nombre`
  ya venía de `descripcion_igss` por el comportamiento anterior, así que no
  cambia nada de lo que ya se imprimía) — no se reinterpretaron contra Base
  de Datos Central porque un mismo código puede tener varias presentaciones
  y no se puede desambiguar solo por código.
- **El selector de PPR/presentación (Órdenes y SIAF-04) SÍ existe** — antes
  de generar la Orden de Compra o el SIAF-04, si un insumo tiene varias
  presentaciones en Base de Datos Central (mismo `codigo_igss`, distinto
  `codigo_ppr`), un `<select>` en el modal ("PPR / Presentación por
  insumo") obliga a elegir una (`getPprsPorItems`/`getPprsParaRenglones` en
  `renglon-utils.ts`, duplicado como `GenerarOrdenModal`/`GenerarSiafModal`
  en `OrdenesClient.tsx`/`Siaf04Client.tsx`). Lo que SÍ estaba roto (ya
  corregido): el A-04 impreso ignoraba cuál presentación se había elegido y
  siempre mostraba en "Descripción" el nombre genérico del insumo
  (`siaf_compras_items.nombre`), no la descripción de la presentación
  puntual (`descripcion_igss` de esa fila de Base de Datos Central — cada
  presentación tiene la suya, pueden ser distintas). Ahora el modal manda
  también el `descripcion_igss` de la opción elegida, `guardarPprSeleccion`
  lo persiste en `siaf_compras_items.descripcion_igss` (sobreescribe el
  snapshot genérico), y `ImprimirA04Client.tsx` usa
  `descripcion_igss || nombre`. El "Código PpR" impreso se queda con su
  formato compuesto actual (`código-ppr`, ej. "36823-2") — el cliente
  confirmó que NO debe cambiar a solo la columna "Código" (eso es aparte, ya
  aplicado, en la leyenda "Código PpR:" del A-01 SIAF). Esto solo se aplicó
  a SIAF-04/A-04 — Órdenes/Orden de Compra queda fuera, no se tocó.
- **A-04 impreso de un solo renglón (`ImprimirA04Client.tsx`): "Precio
  Unitario" es `montoBruto ÷ cantidad`, no `montoBruto` directo** — con
  varios renglones esto ya se calculaba bien; el caso de un solo renglón
  (compras Regularizado con `a04_cantidad` capturado a mano) imprimía el
  mismo monto en unitario y en total sin dividir entre la cantidad (con
  cantidad 10 y total Q500 salía "Precio Unitario: Q500" en vez de Q50) —
  detectado por el cliente al revisar una captura de prueba.
- **Filas de altura fija + `overflow:hidden` cortan descripciones largas —
  cuidado con este patrón en cualquier documento impreso nuevo.** Pasó en
  el A-01 SIAF (`ImprimirClient.tsx`): cada fila de ítem tenía 24px fijos
  (`ROW_H`) con el texto centrado verticalmente: una descripción que
  necesitaba varias líneas se recortaba arriba y abajo, mostrando solo el
  pedazo centrado en esos 24px ("empezaba a la mitad"). El fix mide en una
  pasada oculta (mismo layout real, altura natural, ver `useLayoutEffect` +
  `medirRefs`) cuántas franjas de `ROW_H` necesita cada ítem, y
  `paginarItems` reparte hojas por franjas ocupadas (no por cantidad de
  ítems) — reservando franja para "Vienen.../Van..." igual que antes.
  Aparte y sin relación: la columna "Descripción IGSS" (y PpR/Característica/
  Presentación) de Base de Datos Central (`BaseDatosClient.tsx`) usaba el
  atributo `title` nativo del navegador como tooltip — se corta solo si el
  navegador lo posiciona cerca del borde de la pantalla, fuera del control
  de la app. Reemplazado por `CeldaTruncada`, un panel propio anclado a la
  derecha de la celda (nunca crece hacia la derecha, que es donde se salía).
- **DAB-60 (`ImprimirDab60Client.tsx`) tiene "campos ocultables" persistentes
  por navegador, independiente de "Ver posiciones"**: cada campo impreso
  tiene un botón "×" (`.dab-hide-btn`, no imprime) que lo oculta para
  siempre — la lista de ids ocultos vive en `localStorage["cip-dab60-campos-
  ocultos"]`, así que aplica a TODOS los DAB-60 (Normal y Fondo Rotativo,
  comparten el mismo componente) que se impriman después en ese navegador,
  hasta que el usuario le da clic a "Reiniciar campos ocultos" (solo aparece
  cuando hay al menos uno oculto). No confundir con "Restablecer" del modo
  "Ver posiciones", que resetea posiciones/tamaño, no visibilidad.
  `renglon`, `metodo_compra`, `marca`, `modelo` y `serie` llevan su etiqueta
  literal ("Renglón:", "Tipo de compra:", "Marca:", "Modelo:", "Serie:")
  concatenada al valor (Marca/Modelo/Serie además en mayúsculas) antes de
  pasar por `campo()` — no son etiquetas de UI, salen impresas en el papel;
  igual `serie_factura` ("SERIE: ...") y `no_factura` ("No. ..."). La
  columna "CODIGO" ya no es la concatenación "Código IGSS-PPR" — el cliente
  pidió que lleve únicamente el número de PpR (2026-08-25), así que la
  columna separada que existía para eso (`col_codigo_ppr`) se eliminó del
  todo (quedaba superpuesta sobre "CODIGO").
- **`siaf_compras_items.codigo_ppr` NO guarda el PpR puro — guarda la clave
  completa de selección del selector de presentación** (`codigoDeOpcion` en
  `OrdenesClient.tsx`/`Siaf04Client.tsx`, ej. `"92890-5477 - 5697"` para
  insumos con código real, o `"S/C-185613"` para insumos sin código real,
  donde el número tras "S/C-" es el `id` de esa fila en Base de Datos
  Central, NO un PpR). El A-04 SÍ necesita ese formato compuesto tal cual —
  confirmado por el cliente que no debe cambiar (ver "Código PpR" en
  `ImprimirA04Client.tsx`). Para el DAB-60, que pidió el PpR puro, se agregó
  `pprPuroParaImprimir` (`renglon-utils.ts`) — se llama solo desde los dos
  `page.tsx` de impresión de DAB-60 (Normal y Fondo Rotativo), nunca desde
  `gruposRenglonDeConsolidacion` en sí, para no afectar al A-04. Separa el
  prefijo "código-" cuando hay código real, y para "S/C-{id}" resuelve el
  PpR real contra Base de Datos Central por ese `id` — con precisión total
  (es exactamente la fila que se eligió), a diferencia de
  `codigoPprSinCodigoLookupMap` (que adivina por nombre porque no tiene un
  id exacto disponible).
- **"No. O/C:" y sin "/año" es el estándar de cómo se identifica una Orden
  de Compra en toda la pestaña de Órdenes** (confirmado por el cliente
  2026-08-25) — a diferencia de A-01 SIAF, Acta, FRI, Hoja de Ruta,
  Consolidación y Póliza, que siguen mostrando su propio "número/año".
  Aplicado en `OrdenesClient.tsx`, `DevengadoClient.tsx`,
  `Dab60Client.tsx` y `ArchivoClient.tsx` (búsqueda y despliegue), y en el
  DAB-60 impreso (`ordenCompra: "No. O/C: ${orden.numero}"` en
  `dab-60/[id]/imprimir/page.tsx` — el gemelo de Fondo Rotativo usa
  `"A-04 ${numeroA04}"` en su lugar, no se tocó, no es una Orden de
  Compra). "LUGAR Y FECHA" del DAB-60 también pasó a formato numérico
  (`fechaCorta`, `dd/mm/aaaa`) en vez de la fecha en letras, en ambas rutas
  de impresión. El campo "DEPENDENCIA" del DAB-60 lleva solo
  `configuracion.nombre_unidad` — antes iba prefijado con
  `codigo_contable-` (ej. "12.07.04-CONSULTORIO DE TACANÁ..."), el cliente
  pidió quitar ese número (2026-08-25); `claveAdministrativa` (el campo
  aparte "CLAVE ADMINISTRATIVA") sigue mostrando `codigo_centro_costo`, no
  se tocó.
- **Una escritura a la BD que ocurre durante el render de un Server Component
  (ej. dentro del `page.tsx` de una ruta `/imprimir`, antes del `return`) NO
  puede invalidar el Router Cache de Next.js con `revalidatePath`** —
  revienta ("no se puede llamar durante el render") o, si no truena, la
  lista que depende de ese dato queda con el snapshot de ANTES de la
  mutación hasta que el usuario recarga a mano. Pasó con
  `marcarActaPrevisualizada` (Junta Adjudicadora → Acta): se llamaba dentro
  de `imprimir/page.tsx`, y al volver de la vista previa con "Volver"
  (`router.back()`) el botón "Aprobar" no aparecía en
  `/junta-adjudicadora/acta` hasta un F5 — confirmado reproduciendo el bug
  en producción real antes de corregirlo. Fix: mover la escritura al
  cliente (un `useEffect` en el componente de impresión que llama a la
  Server Action de verdad, no durante el render de la página), y ahí sí
  `revalidatePath("/ruta/de/la/lista")` funciona y refresca la lista sola.
  Cualquier otra pantalla `/imprimir` que en el futuro necesite marcar algo
  como "visto" al abrirse (no solo Actas) debe seguir este mismo patrón.
- **El Acta de Adjudicación tiene dos formatos distintos según `tipo_compra`,
  no uno solo** (agregado 2026-08-25, a partir de un modelo Word que mandó el
  proveedor): cuando `consolidacion.tipo_compra === "Compra Directa"`,
  `ImprimirActaClient.tsx` imprime un cuerpo distinto — comisión fija de 3
  personas (`COMISION_COMPRA_DIRECTA`, hardcodeada igual que los otros 2
  firmantes fijos del Acta genérica), cita legal específica de Compra Directa
  (Decreto 57-92 art. 43 inciso b + Acuerdo 22-2025 Gerencia IGSS) en vez del
  texto genérico, y 3 firmas de cierre en vez de 2. El preámbulo "EL
  INFRASCRITO... CERTIFICA... HABER TENIDO A LA VISTA..." y el cierre "copia
  Certificada" **se mantienen iguales para ambos** (decisión explícita del
  cliente — no se separaron en un modo "para hoja membretada" y otro "para
  certificación", eso queda pendiente de que el cliente confirme si hace
  falta). El "No. de Acta" de este tipo es correlativo **automático**
  ("N/año", arranca en 1 cada año, sin piso configurable —
  `getNextActaCompraDirectaNumero` en `actas-adjudicacion-actions.ts`), a
  diferencia de los demás tipos que lo siguen escribiendo a mano en `GenerarActaModal`
  (`ActaClient.tsx`); si la consolidación ya tiene una acta de Compra Directa
  (p. ej. una rechazada que se está regenerando), `generarActa` reutiliza ese
  mismo número en vez de sacar uno nuevo, para no quemar correlativo en actas
  que nunca se llegaron a usar. La descripción del insumo que se imprime usa
  `descripcion_igss` (trae características, ej. "Refrigerador; Material:
  Acero inoxidable; ..."), no `nombre` como hace el DAB-60 — el modelo del
  cliente necesita la ficha completa, no solo el nombre corto. Lugar/fecha/
  hora se siguen escribiendo a mano igual que en el Acta genérica (no salen
  de `fecha_evento`, la reunión de comisión puede ser días después del
  evento Guatecompras) — el hint del campo "Lugar" cambia según el tipo
  porque la frase donde se inserta es distinta en cada plantilla.
- **El bloqueo temporal de login (5 intentos fallidos → 15 min, `auth.ts`)
  mostraba el mismo mensaje genérico "Credenciales incorrectas" tanto si la
  contraseña estaba mal como si la cuenta ya estaba bloqueada** — reportado
  por el cliente 2026-08-25 ("ya ni el super admin, lo sacó del sistema"):
  usuarios reales se bloqueaban solos reintentando sin saber que estaban
  bloqueados (cada intento durante el bloqueo lo reinicia). Fix:
  `estadoLoginUsuario` (`src/lib/auth-actions.ts`, nueva, lee
  `intentos_fallidos`/`bloqueado_hasta` directo de la fila — misma fuente que
  actualiza `authorize()`) se consulta desde `LoginClient.tsx` justo después
  de un intento fallido, y distingue "Contraseña incorrecta, te quedan N
  intentos" de "Cuenta bloqueada, faltan X:XX" con cuenta regresiva en vivo
  (se limpia sola al llegar a 0). `MAX_INTENTOS_FALLIDOS` se exportó de
  `auth.ts` para que ambos archivos usen el mismo número sin duplicarlo.
  Verificado en vivo con un usuario de prueba desechable (nunca contra una
  cuenta real, para no arriesgarse a bloquearla) — los 5 intentos muestran
  4/3/2/1 y luego el bloqueo con el contador bajando en tiempo real.
- **Unidad de medida en blanco en DAB-60/A-04 para insumos "S/C" (sin código
  real)** — reportado por el cliente 2026-08-25 con un "Aire acondicionado"
  real (orden 256958). El respaldo contra Base de Datos Central que ya existía
  en `gruposRenglonDeConsolidacion` (`unidadMedidaLookupMap`) busca por
  `codigo_igss` real, y "S/C" nunca aparece como valor real en esa tabla (es
  un placeholder local) — así que ese respaldo nunca cubría insumos sin
  código, aunque el snapshot (`siaf_compras_items.unidad_medida`) viniera
  vacío. Fix: mismo patrón que `pprPuroParaImprimir` — `codigo_ppr` para
  estos insumos guarda `"S/C-{id de Base de Datos Central}"`, y ese id es
  exactamente la fila elegida, así que `gruposRenglonDeConsolidacion` ahora
  también resuelve la unidad de medida por ese id antes de dejarla en `null`.
  Como es la función compartida, arregla DAB-60 y A-04 a la vez.
- **DAB-60: Marca/Modelo/Serie/Lote/Fecha de Vencimiento se ocultan por
  separado, cada uno solo si ese campo puntual viene vacío en esa orden**
  (confirmado por el cliente 2026-08-26) — a diferencia de los "campos
  ocultables" con el botón "×" (persistente por navegador, ver abajo), esto
  es automático y por orden: si esta orden no tiene lote, no se imprime ese
  renglón; si la siguiente orden sí lo tiene, se imprime normal. En
  `ImprimirDab60Client.tsx` cada uno de esos 5 campos se envuelve en
  `{o.campo && campo(...)}` (chequeando el valor crudo, no el texto ya
  formateado con la etiqueta — para Marca/Modelo/Serie el texto por defecto
  siempre trae la etiqueta concatenada, así que nunca queda vacío por sí
  solo). No afecta la posición de los demás campos porque cada uno tiene su
  propia posición absoluta independiente — simplemente no se renderiza nada
  ahí cuando falta el dato.

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
