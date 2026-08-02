# Plan de implementación — Módulo de Presupuesto y Finanzas (SIGAT-IGSS)

## Contexto

El cliente envió una serie de audios con reglas de negocio para el módulo de
Presupuesto/Fondo Rotativo. Esas reglas se transcribieron y se estructuraron
en un prompt de implementación (ver mensaje original del usuario). Antes de
tocar código, se investigó a fondo el estado actual del proyecto para
detectar choques entre lo que el cliente pide y lo que ya existe. Este
documento resume esos hallazgos y deja preguntas abiertas que **deben
resolverse con el cliente antes de codificar**, porque varias de ellas
cambian el alcance y la arquitectura de forma significativa.

Las Fases 1-7 (más abajo) ya están implementadas, verificadas y empujadas a
la rama. Este documento ahora también cubre una **Ronda 2** (Fases 8+):
audios adicionales del cliente revelaron que el patrón "Solicitado →
Aprobado" no es exclusivo de Programación/Reprogramación/Modificaciones —
aplica a **todo** el pipeline de ejecución presupuestaria (Compromiso,
Devengado, Pago de Fondo Rotativo), y además la aprobación de Programación/
Reprogramación que se construyó como automática-por-fecha en realidad debe
ser manual (un botón, solo disponible en la ventana de fecha que
corresponde).

---

## 1. Lo que YA existe y cumple (o casi) lo pedido

- **Liquidación de vale con boleta de depósito** (`vale-actions.ts:
  liquidarValePasajes` / `liquidarValeGastosVarios`): ya exige No. y monto de
  boleta de depósito cuando el remanente del vale es mayor a Q0.01. ✅ No
  requiere cambios de fondo.
- **Libro de Caja Chica con doble origen** (`caja-chica-liquidacion-actions.ts:
  getLibroCajaChicaCompleto`): ya distingue "Factura" vs "Vale" (pasajes sin
  factura) en una sola tabla. ✅
- **Ejecución con columnas Normal/Regularizado**: la tabla ya existe en
  `EjecucionClient.tsx`, aunque el cálculo interno tiene un bug (ver §2.3).
- **Fondo Rotativo/FRI**: el pipeline de Bancos → Caja Chica → Pagos Free →
  FRI → Reintegro ya existe con estados, solo le faltan piezas puntuales
  (ver §2.9 y §2.13).
- **Grupos de renglón (100-199 / 200-299 / 300-399)** y las excepciones
  261/266/295 para saltar DAB-60 ya están codificadas en
  `programacion-constants.ts` (`requiereDab60`, `esGrupo100`).
- **El patrón "Solicitado → Aprobado" YA EXISTE como referencia real**: A-01
  SIAF (`src/app/compras/a01-siaf/actions.ts`, `aprobarSolicitud`) funciona
  exactamente como el cliente describe para todo lo demás — `Borrador` no
  mueve nada; solo al llamar `aprobarSolicitud` se calcula el monto y se
  suma a `presupuestoRenglones.pre_compromiso` (protegido contra doble
  aplicación con la bandera `presupuesto_aplicado`). **Este es el patrón a
  replicar** en Compromiso, Devengado y Pago de Fondo Rotativo — no hay que
  inventar el diseño desde cero.

## 2. Choques / huecos encontrados entre el pedido y el código actual

### 2.1 "DAB" vs "DAF" — no es un error de texto, es una función que no existe
El grep de `"DAF"` en todo `src/` da **cero resultados**. El pipeline actual
termina en `devengar()` (`devengado-actions.ts`) marcando la orden como
`"Completada"` — no hay ningún paso de "enviar a pago", ni estado, ni fecha.
Las únicas menciones de "DAB" son legítimas (DAB-60/DAB-75, nombres de
formulario reales), salvo un comentario en `schema.ts:477` que describe mal
el orden del pipeline (dice Compromiso→Devengado→DAB-60, pero el código real
hace Compromiso→DAB-60→Devengado). **Conclusión: hay que construir el paso
de envío a DAF desde cero, no corregir un texto.**
→ **Resuelto en Fase 5** (implementada).

### 2.2 Ruteo a DAB-60 es por ORDEN completa, no por renglón individual
Confirmado con el usuario que esto está bien así: ninguna orden real mezcla
renglones de distintos grupos, por norma general. **No requiere cambios.**

### 2.3 "Saldo Programado = Programado − Ejecutado" no es lo que calcula hoy
→ **Resuelto en Fase 2** (implementada): se pobló `programadoNormal/
Regularizado` del cuatrimestre vigente; `saldoProgramadoNormal/Regularizado`
se dejó igual a propósito (fórmula preservada del Excel del cliente).

### 2.4 Caducidad del cuatrimestre y traslado por Compromiso
→ **Resuelto en Fase 6** (implementada): ledger `programacionCompromisos` +
`cierre-cuatrimestre.ts`.

### 2.5 Validaciones de días hábiles / ventanas de fecha
→ **Resuelto en Fase 1** (implementada): `dias-habiles.ts`.

### 2.6 Estados "Solicitado"/"Aprobado"/"Rechazado" en Programación/Reprogramación
→ Implementado en Fase 3, **pero con un defecto que hay que corregir**: se
construyó como aprobación **automática por fecha** (sin clic). El cliente
confirmó que es **manual** — un botón "Aprobar" que solo se puede presionar
dentro de la ventana de fecha correspondiente. Ver Fase 8 abajo.

### 2.7 Modificaciones: mapeo INTER/INTRA/Ampliación
→ Resuelto en Fase 4 (implementada): Transferencia = la función real
(sin el nombre "INTER", que fue error de transcripción), sin restricción de
mismo Grupo/Subproducto. **Pendiente**: igual que Programación/
Reprogramación, hoy `guardarModificacion`/`transferirPresupuesto` escriben
en `presupuestoRenglones` de inmediato — les falta el mismo gate de
aprobación manual. Ver Fase 9.

### 2.8-2.13
→ Resueltos en Fases 5 y 7 (implementadas).

### 2.14 Código muerto/duplicado detectado (no pedido, pero relevante)
`movimientosBanco`, `cajaChica` (tablas), y las rutas `/libros/banco` y
`/libros/caja-chica` son placeholders o legado sin consumidores reales. No
se toca a menos que el cliente confirme que quiere limpieza en este mismo
esfuerzo.

---

## 3. Ronda 2 — hallazgos de los audios 13 a 18

### 3.1 Confirmado por el cliente (vía Alberto)
- **Aprobación manual, no automática.** Solo se puede presionar "Aprobar"
  dentro de la ventana de fecha: Programación y Reprogramación el 6to día
  hábil (⚠️ ver pregunta abajo — el plan original tenía Programación con
  fechas distintas por cuatrimestre: 6to hábil enero / 1er hábil mayo / 1er
  hábil septiembre; hay que confirmar si el cliente de verdad simplificó
  esto a "6to día hábil" uniforme, o si Alberto resumió y sigue aplicando lo
  original). Ingru: 1er/2do día hábil de cada mes. Entre Renglones: 15-20
  de cada mes. Esto ya coincide con las ventanas que construí en Fases 3-4,
  solo cambia el mecanismo (botón, no automático).
- **Quién aprueba**: cualquier persona con acceso al módulo de Presupuesto
  (permiso `mod_presupuesto` ya existente) — no es un rol nuevo. De la misma
  forma, "Compras" se refiere a cualquiera con acceso a `mod_compras`.
- **Alcance de la aprobación**: además de controlar cuándo se refleja el
  número en Ejecución/Presupuesto General, **también frena el flujo
  operativo** — ej. una orden NO puede pasar a Almacén/DAB-60 hasta que
  Presupuesto apruebe el Compromiso. Es un gate real en el pipeline, no solo
  contable.
- **Regla general (audio 18)**: mientras algo esté en cualquier estado que
  no sea "Aprobado" (Solicitado, Registrado, etc.), NO cuenta en ninguna
  columna ni pestaña. Solo al aprobar se refleja donde corresponde.

### 3.2 Qué falta construir (con el patrón de A-01 SIAF como referencia)

**Fase 8 — Programación/Reprogramación/Modificaciones: de automático a manual.**
Reemplazar `aprobarSolicitudesVencidas` (Fase 3, lazy sweep automático) por
una acción `aprobarEntrada(id)` con botón real en la UI, que:
- Solo se puede ejecutar si `ventanaProgramacionAbierta`/
  `ventanaReprogramacionAbierta` está abierta hoy para esa entrada (mismo
  helper de `programacion-fechas.ts`, ya existe).
- Requiere acceso a `mod_presupuesto`.
- Mismo tratamiento para `guardarModificacion`/`transferirPresupuesto`
  (Fase 9): separar "registrar" (no escribe `presupuestoRenglones`) de
  "aprobar" (sí escribe), gateado por `ventanaIngruAbierta`/
  `ventanaTransferenciaAbierta`/`ventanaAmpliacionAbierta` + acceso a
  `mod_presupuesto`.
- Ejecución y Presupuesto General: filtrar el cálculo de "Programado" a
  `estado = 'Aprobado'` únicamente (hoy no filtra por estado en absoluto).
- Poblar la columna "Programado" de Presupuesto General
  (`presupuesto-general-actions.ts`), que hoy está hardcodeada en `null`.

**Fase 10 — Compromiso: registrar vs aprobar (gate operativo real).**
Hoy `comprometerYEnviarADevengado` hace todo junto: guarda `no_compromiso`,
mueve `pre_compromiso→compromiso`, y rutea a "Pendiente DAB-60"/"En
Devengado". Split propuesto (calcado de A-01 SIAF):
- `registrarCompromiso(ordenId, noCompromiso)`: guarda `no_compromiso`,
  cambia `ordenesCompra.estado` a un nuevo valor intermedio (ej. `"Compromiso
  Solicitado"`). NO toca `presupuestoRenglones`.
- `aprobarCompromiso(ordenId)`: requiere acceso a `mod_presupuesto`. Mueve
  `pre_compromiso→compromiso` (igual que hoy) y AHORA SÍ rutea a "Pendiente
  DAB-60"/"En Devengado" — antes de esto, la orden queda visible pero
  bloqueada (no aparece en la bandeja de Almacén/Devengado).
- `rechazarCompromiso(ordenId, motivo)`: regresa a "En Compromiso" para
  corregir el número, igual que `rechazarSolicitud` en A-01 SIAF.

**Fase 11 — Devengado: mismo patrón.**
- `registrarDevengado(ordenId, {no_devengado, fecha_envio_daf})`: guarda los
  campos, pasa a estado intermedio `"Devengado Solicitado"`. NO mueve
  `compromiso→devengado` todavía.
- `aprobarDevengado(ordenId)`: requiere `mod_presupuesto`. Mueve
  `compromiso→devengado` (o `devengado_regularizado`), marca la orden
  `"Completada"`, y **ahí** arranca el seguimiento DAF (`estado_devengado =
  "Enviado"`) que ya se construyó en la Fase 5.

**Fase 12 — Pago de Fondo Rotativo (SIAF-04): sin gate de Presupuesto.**
Confirmado por el cliente: Fondo Rotativo **no pasa por aprobación de
Presupuesto** — se refleja con lo que el propio Fondo Rotativo ya
aprueba/hace/paga/gasta dentro de su propio módulo. No hay que construir
ningún botón ni rol nuevo aquí; solo enganchar el reflejo contable al
evento que ya existe y que representa "se pagó/gastó de verdad":
`registrarFormaPagoCheque` y `registrarFormaPagoEfectivo`
(`fondo-rotativo-pagos-actions.ts`) — ahí es donde Fondo Rotativo decide y
ejecuta la forma de pago (emite cheque o asigna vale). En ese momento:
calcular el monto por renglón/subproducto de la consolidación (mismo
`gruposRenglonDeConsolidacion` que ya usan Compromiso/Devengado) y sumarlo
a `presupuestoRenglones.devengado_regularizado` (las consolidaciones de
Fondo Rotativo son siempre `regularizado = true` por definición, no hace
falta chequear la bandera como en `devengar()`).

## 4. Confirmado por el cliente (respuestas a P1-P3)

- **P1 — Programación/Reprogramación**: la fecha sigue siendo distinta por
  cuatrimestre (lo que ya está construido en Fase 3: Programación 6to hábil
  de enero / 1er hábil de mayo / 1er hábil de septiembre; Reprogramación
  6to hábil del mes de creación). Solo cambia el mecanismo — de automático
  a botón manual — no las fechas.
- **P2 — Pago de Fondo Rotativo**: no hay aprobación de Presupuesto; ver
  Fase 12 arriba.
- **P3 — Rechazo**: regresa un nivel (igual que `rechazarSolicitud` en A-01
  SIAF) — tanto para Compromiso como para Devengado.

Ya no quedan preguntas abiertas para el cliente. Se procede a implementar
Fases 8, 10, 11 y 12.

## 5. Verificación (para cada fase)

- `npx tsc --noEmit` y `npm run build` limpios.
- Migración de BD contra la rama de Neon (nunca contra `production`
  directamente sin aprobación).
- Prueba manual de cada flujo nuevo vía el código fuente/lectura estática
  cuando no se pueda levantar sesión autenticada fácilmente, o pidiendo
  confirmación visual al usuario si aplica.
