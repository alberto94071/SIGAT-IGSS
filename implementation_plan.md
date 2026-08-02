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

**No se ha escrito ningún código todavía.** Este plan es solo de
investigación + diseño propuesto.

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

### 2.2 Ruteo a DAB-60 es por ORDEN completa, no por renglón individual
`compromiso-actions.ts:43`: `necesitaDab60 = renglones.some(r =>
requiereDab60(r.renglon))`. Confirmado con el usuario que esto está bien
así: ninguna orden real mezcla renglones de distintos grupos, por norma
general. **No requiere cambios.**

### 2.3 "Saldo Programado = Programado − Ejecutado" no es lo que calcula hoy
En `ejecucion-actions.ts`:
- `programadoNormal`/`programadoRegularizado` vienen de un seed estático
  (`EJECUCION_DATA`) y **nunca se sobreescriben** — quedan en 0 siempre.
- `saldoProgramadoNormal`/`Regularizado` es en realidad la suma cruda de
  `programacionEntradas` de **todos los cuatrimestres acumulados**, no una
  resta contra lo ejecutado, y no filtra por cuatrimestre vigente.
Esto hay que reconstruirlo para que calcule de verdad `Programado del
cuatrimestre − Ejecutado del cuatrimestre`.

### 2.4 Caducidad del cuatrimestre y traslado por Compromiso: no existe nada
`programacionEntradas` no tiene columna `estado`, y no hay ninguna lógica que
resetee saldo no ejecutado al cambiar de cuatrimestre, ni que identifique qué
porción de lo programado tiene un número de Compromiso asignado. Hoy los
compromisos se registran en agregado en `presupuestoRenglones.compromiso`
(un solo número por renglón+subproducto), **no** ligados a una fila
específica de `programacionEntradas` ni a un cuatrimestre. Para implementar
"solo se traslada el monto comprometido" hace falta diseñar cómo enlazar un
Compromiso a la entrada de programación que consumió (nueva FK o ledger).
→ Ver Q4 abajo, es una pieza de diseño nueva no trivial.

### 2.5 Validaciones de días hábiles / ventanas de fecha: no existe nada
Cero utilidades de días hábiles o feriados guatemaltecos en todo el repo.
Toda la lógica de "primeros 5 días hábiles de Enero/Abril/Agosto",
"día 15-20 del mes", "1er o 2do día hábil", etc. hay que construirla desde
cero. Confirmado con el usuario: solo feriados nacionales oficiales (ver
§3, Q1).

### 2.6 Estados "Solicitado"/"Aprobado"/"Rechazado" en Programación/Reprogramación
No existen en el schema. Hoy cualquier usuario con rol ≠ "consulta" edita en
cualquier momento sin restricción de estado. Hace falta agregar `estado` +
lógica de aprobación (¿automática por fecha, o manual con botón de alguien?).
→ Ver Q3 abajo.

### 2.7 Modificaciones: el mapeo INTER/INTRA/Ampliación no calza limpio con lo que ya existe
- `TIPOS_MODIFICACION` hoy solo tiene `"ingru"` y `"ampliacion"` (2 opciones,
  edición de un solo valor por renglón/subproducto, sin origen/destino).
- La columna `presupuestoRenglones.modificacion_entre_renglones` sigue
  huérfana (no conectada a ningún tipo seleccionable) — se queda así, no es
  necesaria.
- Confirmado con el usuario: "INTER" no es un término real (error de
  transcripción), pero la Transferencia (`transferirPresupuesto`, origen→
  destino) sí es una funcionalidad real bajo otro nombre. Se mantiene su
  lógica actual **sin** restricción de mismo Grupo de Gasto/Subproducto —
  esa restricción del prompt se descarta. Solo falta agregarle ventana de
  fecha + PDF (ver §3, Q5 y Fase 3).

### 2.8 Devengado no captura nada hoy — el "No. de Devengado" está en el paso equivocado
`devengar()` es un solo clic sin formulario. El campo `no_devengado` que
pide el cliente para la pestaña Devengado en realidad se captura hoy en
`dab60-actions.ts` (paso de Almacén) — lo cual significa que **las órdenes
que se saltan DAB-60 (renglones 100-199, y 261/266/295) nunca tienen forma de
registrar No. de Devengado** en el código actual. Hay que mover ese campo (y
agregar fecha de envío a DAF, estado Enviado/Rechazado/Pagado, fecha de pago
obligatoria si Pagado) al paso de Devengado para que aplique parejo a todos
los renglones.

### 2.9 Pago por cheque: faltan campos obligatorios
`registrarFormaPagoCheque` solo captura No. cheque + fecha de emisión. No
captura Tipo (Factura/Vale/Formulario), NIT, ni Nombre del Beneficiario —
`destinatario_nombre` existe en el schema pero nunca se setea, y no hay
columna de NIT propia en `fondoRotativoPagos` (el NIT viene indirectamente de
`consolidaciones.proveedor_nit`).
→ Ver Q6 abajo (¿el NIT del pago siempre es el del proveedor de la
consolidación, o puede ser distinto — ej. un empleado — y hay que capturarlo
aparte?).

### 2.10 "El cheque nunca desaparece del listado en Bancos"
Hoy esto ya se cumple por accidente: `"Enviado a Bancos"` es un estado
terminal de facto, nada lo mueve de ahí. No haría falta código nuevo salvo
que el cliente quiera agregar una conciliación futura — en ese caso habría
que asegurarse de no removerlo del listado, solo marcarlo. No es una
inconsistencia, solo una nota de cuidado a futuro.

### 2.11 FRI: le faltan los estados "Enviado" y "Rechazado" + fecha de envío a DAF
Hoy `friFondoRotativo.estado` solo tiene `"Generado"` → `"Reintegrado"`. El
cliente pide que al consolidado (FRI) se le asigne "Fecha de envío a la DAF"
y un estado de 3 valores: Enviado / Rechazado / Reintegrado. Hace falta
agregar columna `fecha_envio_daf` y el estado `"Enviado"`/`"Rechazado"` al
ciclo de vida del FRI (hoy pasa directo de `"Generado"` a `"Reintegrado"`
sin ningún paso intermedio de envío/rechazo).

### 2.12 Reporte de Arqueo del Fondo Rotativo Interno: no existe
El PDF de "arqueo" con monto otorgado / disponibilidad / saldo en caja que
pide el cliente no está implementado. El saldo hoy es un solo contador
corrido (`configuracion.efectivo_caja`) que se debita/acredita por evento,
funcionalmente parecido a la fórmula pedida pero nunca expuesto en un PDF.

### 2.13 Correlativo del FRI se reinicia por año calendario, no por ejercicio fiscal
`fri-actions.ts` usa `new Date().getFullYear()` en vez del
`EJERCICIO_FISCAL` (2026, hardcodeado) que usa el resto del sistema. Menor,
pero vale confirmarlo para consistencia.

### 2.14 Código muerto/duplicado detectado (no pedido, pero relevante)
`movimientosBanco`, `cajaChica` (tablas), y las rutas `/libros/banco` y
`/libros/caja-chica` son placeholders o legado sin consumidores reales — el
flujo activo vive en `/dashboard/bancos`, `/caja-chica/libro-caja-chica`,
etc. No se toca a menos que el cliente confirme que quiere limpieza en este
mismo esfuerzo.

---

## 3. Respuestas confirmadas por el usuario

- **Q1 (feriados) → resuelta.** Solo feriados nacionales oficiales de
  Guatemala: 1 ene, Jueves y Viernes Santo (fecha móvil, calculable), 1 may,
  15 sep, 1 nov, 24-25 dic, 31 dic. Sin asuetos institucionales adicionales
  del IGSS por ahora. **Fases 1, 2 y 3 desbloqueadas.**
- **Q2 (ruteo DAB-60) → resuelta.** Ningún SIAF/orden mezcla renglones de
  distintos grupos — es norma general que una orden solo contenga renglones
  del mismo rango. El ruteo por ORDEN completa (como está hoy) es correcto,
  no hace falta rediseñar a nivel de línea. **Fase 5 desbloqueada.**
- **Q3 (aprobación Programación/Reprogramación) → resuelta.** Es automática
  por fecha (un chequeo cambia el estado de `Solicitado` a `Aprobado` el día
  que corresponde, sin acción humana).
- **Q5 (mapeo Modificaciones) → resuelta.** "INTER" no existe como nombre
  real (fue error de la transcripción del audio), pero la funcionalidad de
  Transferencia entre renglón/sub-producto (origen→destino) **sí es real**,
  solo cambia el nombre. Se mantiene tal como está programada hoy — **sin**
  la restricción de mismo Grupo de Gasto/Subproducto que pedía el prompt
  (esa restricción se descarta salvo que el cliente diga lo contrario más
  adelante). **Fase 3 desbloqueada y reducida de alcance:** ya no hace falta
  tocar la lógica de Transferencia, solo agregarle su ventana de fecha
  (15-20 de cada mes) y el PDF de formato; y agregarle la ventana de fecha
  (1er/2do día hábil, feb-dic) al tipo "Ingru" existente + su PDF.

## 3.1. Puntos menores — sigo con mi propuesta salvo objeción

No son bloqueantes; si el cliente corrige algo después, se ajusta en un
commit aparte.

**Q4. Traslado de saldo con Compromiso al siguiente cuatrimestre.**
Propuesta de diseño: agregar `cuatrimestre` (nullable) y `compromiso_ref`
(texto, el mismo `no_compromiso` que ya se captura en
`comprometerYEnviarADevengado`) a una nueva tabla de "consumo" — o,
más simple y con menos riesgo de romper lo existente: agregar esas dos
columnas directamente a `programacionEntradas` y, al comprometer una orden,
buscar la entrada de programación del cuatrimestre vigente para ese
renglón/subproducto y marcarla con el número de compromiso + el monto
comprometido. Al cerrar un cuatrimestre, todo lo programado sin
`compromiso_ref` se considera caduco (no se traslada); lo que sí tiene
`compromiso_ref` se re-crea como entrada del cuatrimestre siguiente por el
monto comprometido. Implemento esto salvo que el cliente prefiera otro
mecanismo.

**Q6. NIT del beneficiario en pago por cheque.** Propuesta: campo de texto
libre en el formulario de `registrarFormaPagoCheque`, pre-llenado con
`consolidaciones.proveedor_nit` si existe, pero editable — porque el
beneficiario del cheque puede no ser el proveedor (ej. pago a un empleado).
Se guarda en columna nueva `fondoRotativoPagos.nit_beneficiario`.

> **Nota general sobre confiabilidad del prompt:** el documento original
> pasó por dos pasadas de IA (transcripción de audio → generación de
> prompt estructurado) y ya se confirmó al menos un término inventado
> ("INTER"). Donde el prompt describe una regla con nombres/cifras
> específicas que no coincide con lo ya implementado, se prioriza lo ya
> implementado salvo que el cliente confirme explícitamente el cambio.

---

## 4. Enfoque propuesto (una vez resueltas las dudas)

Dado el tamaño, propongo dividirlo en fases entregables por separado (cada
una con su propio typecheck/build/migración/commit), en vez de un solo
cambio gigante:

Todas las dudas bloqueantes ya se resolvieron (§3). Orden sugerido:

1. **Utilidad de días hábiles guatemaltecos** (`src/lib/dias-habiles.ts`).
2. **Ejecución**: arreglar el cálculo real de Programado/Saldo Programado
   por cuatrimestre vigente (no acumulado) — independiente, se puede hacer
   primero para no bloquear nada más.
3. **Programación/Reprogramación**: columna `estado` en `programacionEntradas`,
   ventanas de fecha con la utilidad de (1), aprobación automática por
   fecha, botones Editar/Rechazar/Eliminar mientras `Solicitado`, bloqueo al
   pasar a `Aprobado`, PDF de formato.
4. **Modificaciones**: ventana de fecha 1er/2do día hábil para "Ingru",
   ventana 15-20 de cada mes para Transferencia, ventana Abril/Julio/
   Septiembre para "Ampliación", PDF de formato para las tres.
5. **Compromiso → DAB-60 → Devengado → DAF**: mover `no_devengado` al paso
   de Devengado (agregar formulario ahí, hoy no tiene ninguno), agregar
   fecha envío DAF + estado Enviado/Rechazado/Pagado + fecha de pago
   condicional.
6. **Caducidad de cuatrimestre + traslado por Compromiso**: ledger nuevo
   (propuesta en Q4).
7. **Fondo Rotativo/Pagos**: agregar Tipo/NIT/Beneficiario al pago por
   cheque (propuesta en Q6); estados Enviado/Rechazado + fecha envío DAF en
   FRI; PDF de Arqueo del Fondo Rotativo Interno.

## 5. Verificación (para cada fase)

- `npx tsc --noEmit` y `npm run build` limpios.
- Migración de BD contra la rama de Neon (nunca contra `production`
  directamente sin aprobación).
- Prueba manual de cada flujo nuevo vía el código fuente/lectura estática
  cuando no se pueda levantar sesión autenticada fácilmente (ver limitación
  de clasificador de permisos para logins automatizados encontrada en la
  sesión anterior) — o pidiendo confirmación visual al usuario si aplica.
