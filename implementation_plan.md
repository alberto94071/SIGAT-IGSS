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
requiereDab60(r.renglon))`. Si **cualquier** renglón de la orden cae en
200-399 (sin excepción), **toda la orden** pasa por Almacén/DAB-60 antes de
Devengado — incluso si esa misma orden tiene también renglones 100-199, que
según la regla del cliente deberían ir directo a Devengado.
→ **Pregunta bloqueante, ver Q2 abajo.**

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
cero, y necesita saber qué cuenta como feriado.
→ **Pregunta bloqueante, ver Q1 abajo.**

### 2.6 Estados "Solicitado"/"Aprobado"/"Rechazado" en Programación/Reprogramación
No existen en el schema. Hoy cualquier usuario con rol ≠ "consulta" edita en
cualquier momento sin restricción de estado. Hace falta agregar `estado` +
lógica de aprobación (¿automática por fecha, o manual con botón de alguien?).
→ Ver Q3 abajo.

### 2.7 Modificaciones: el mapeo INTER/INTRA/Ampliación no calza limpio con lo que ya existe
- `TIPOS_MODIFICACION` hoy solo tiene `"ingru"` y `"ampliacion"` (2 opciones,
  edición de un solo valor por renglón/subproducto, sin origen/destino).
- Existe una columna `presupuestoRenglones.modificacion_entre_renglones`
  **pero no está conectada a ningún tipo seleccionable** — es una columna
  huérfana.
- El flujo de "Transferencia entre renglón/sub-producto" (`transferirPresupuesto`,
  con origen y destino reales) es el que más se parece a "Modificación entre
  Renglones (INTER)" del pedido del cliente, pero hoy **no restringe** a que
  origen y destino compartan el mismo Grupo de Gasto y mismo Subproducto —
  permite cualquier combinación.
→ Hay que confirmar el mapeo exacto antes de tocar esto. Ver Q5 abajo.

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

## 3. Respuestas ya confirmadas por el usuario

- **Q2 (ruteo DAB-60) → resuelta.** Ningún SIAF/orden mezcla renglones de
  distintos grupos — es norma general que una orden solo contenga renglones
  del mismo rango. Por lo tanto el ruteo por ORDEN completa (como está hoy)
  es correcto y no hace falta rediseñar a nivel de línea. **Fase 5
  desbloqueada.**
- **Q3 (aprobación Programación/Reprogramación) → resuelta.** Es automática
  por fecha (un chequeo cambia el estado de `Solicitado` a `Aprobado` el día
  que corresponde, sin acción humana). **Fase 2 desbloqueada** (falta solo
  Q1 de días hábiles).
- **Q5 (mapeo Modificaciones) → invalidada, requiere aclaración.** El
  usuario indicó que el término "INTER" **no existe** en el negocio real —
  "todo es Ingru" — y que probablemente fue un error de la transcripción
  IA→IA del audio original. Esto es importante: **pone en duda la
  fiabilidad del prompt estructurado en esta sección**, ya que pasó por dos
  pasadas de IA (transcripción de audio + generación de prompt) antes de
  llegar aquí. No se puede diseñar la Fase 3 (Modificaciones) hasta aclarar
  cuántos tipos de modificación existen realmente y cómo se llaman. Ver
  pregunta nueva abajo.

## 3.1. Preguntas abiertas — necesito respuesta antes de codificar

**Q1. Días hábiles — ¿solo feriados nacionales oficiales, o también asuetos
institucionales del IGSS?** El usuario confirmó que sí importan los
feriados (no solo fin de semana), pero falta la fuente exacta. Propuesta:
implemento los feriados nacionales fijos por ley de Guatemala (1 ene, 1 may,
15 sep, 1 nov, 24-25 dic, 31 dic) más Jueves y Viernes Santo (fecha móvil,
calculable). Falta confirmar si el IGSS tiene asuetos institucionales
adicionales (ej. día del empleado público u otro) que deba sumar a esa
lista. Ver pregunta de seguimiento en el chat.

**Q4. Traslado de saldo con Compromiso al siguiente cuatrimestre: ¿cómo se
debe enlazar un Compromiso a la entrada de programación específica que
consumió?** Hoy el Compromiso es un monto agregado por renglón/subproducto,
sin cuatrimestre ni referencia a una fila de `programacionEntradas`. Propongo
agregar `cuatrimestre` y una referencia al compromiso en el registro de
consumo — pero quiero confirmar contigo/el cliente antes de diseñar el
ledger exacto.

**Q5 (reabierta). ¿Cuántos tipos de Modificación existen realmente y cómo
se llaman?** El usuario indicó que "INTER" no existe en el negocio real y
que probablemente fue un error de transcripción — "todo es Ingru". Esto
coincide con lo que YA está programado hoy (`TIPOS_MODIFICACION` solo tiene
`"ingru"` y `"ampliacion"`, sin "entre renglones"). Necesito confirmar: ¿la
Transferencia actual (origen/destino) sigue siendo una funcionalidad real
del negocio bajo otro nombre, o fue también una invención de la
transcripción y no debería existir como "tipo de Modificación"? Ver
pregunta de seguimiento en el chat.

**Q6. Pago por cheque — el NIT del beneficiario: ¿siempre es el NIT del
proveedor de la consolidación (`consolidaciones.proveedor_nit`), o puede
ser un NIT distinto (ej. un empleado) que hay que capturar en un campo
propio del pago?**

> **Nota general sobre confiabilidad del prompt:** dado que el documento
> original pasó por dos pasadas de IA (transcripción de audio → generación
> de prompt estructurado), y ya se detectó al menos un término inventado
> ("INTER"), recomiendo que cualquier regla de negocio con nombres o cifras
> específicas (fechas exactas, nombres de tipos, rangos de renglón) que no
> coincida con lo que ya está implementado se trate como sospechosa hasta
> confirmarla con el cliente, en vez de asumir que el prompt es
> perfectamente fiel al audio original.

---

## 4. Enfoque propuesto (una vez resueltas las dudas)

Dado el tamaño, propongo dividirlo en fases entregables por separado (cada
una con su propio typecheck/build/migración/commit), en vez de un solo
cambio gigante:

1. **Utilidad de días hábiles guatemaltecos** (`src/lib/dias-habiles.ts`) —
   base para todo lo demás de fechas. Bloqueada por Q1.
2. **Programación/Reprogramación**: columna `estado` en `programacionEntradas`,
   ventanas de fecha con la utilidad de (1), botones Editar/Rechazar/Eliminar
   mientras `Solicitado`, bloqueo al pasar a `Aprobado`, PDF de formato.
   Bloqueada por Q1, Q3.
3. **Modificaciones**: restricción de mismo Grupo/Subproducto en
   Transferencia, ventanas de fecha por tipo, PDF de formato. Bloqueada por
   Q1, Q5.
4. **Ejecución**: arreglar el cálculo real de Programado/Saldo Programado
   por cuatrimestre vigente (no acumulado). No bloqueada, se puede hacer ya.
5. **Compromiso → DAB-60 → Devengado → DAF**: mover `no_devengado` al paso
   de Devengado, agregar formulario con fecha envío DAF + estado
   Enviado/Rechazado/Pagado + fecha de pago condicional. Bloqueada por Q2.
6. **Caducidad de cuatrimestre + traslado por Compromiso**: el ledger nuevo.
   Bloqueada por Q4.
7. **Fondo Rotativo/Pagos**: agregar Tipo/NIT/Beneficiario al pago por
   cheque; estados Enviado/Rechazado + fecha envío DAF en FRI; PDF de
   Arqueo del Fondo Rotativo Interno. Bloqueada por Q6 (parcialmente).

## 5. Verificación (para cada fase)

- `npx tsc --noEmit` y `npm run build` limpios.
- Migración de BD contra la rama de Neon (nunca contra `production`
  directamente sin aprobación).
- Prueba manual de cada flujo nuevo vía el código fuente/lectura estática
  cuando no se pueda levantar sesión autenticada fácilmente (ver limitación
  de clasificador de permisos para logins automatizados encontrada en la
  sesión anterior) — o pidiendo confirmación visual al usuario si aplica.
