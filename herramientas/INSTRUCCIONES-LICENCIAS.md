# Herramientas CIP sin conexión — licencias

Las herramientas (A-01 SIAF y Voucher/Cheque) ahora piden una **clave de licencia** la primera
vez. La clave se verifica contra una hoja de Google que vos controlás. Con la clave validada,
funcionan sin internet hasta la fecha de vencimiento; solo la **primera activación** necesita conexión.

## Archivos (todos juntos en la misma carpeta)

- `index.html`, `SIAF-A01.html`, `Voucher-Cheque.html` — las herramientas.
- `licencia.js` — hace la verificación. No hay que tocarlo.
- `licencia-config.js` — acá va la dirección de tu servidor (un solo renglón).
- `servidor/Codigo.gs` — el programa que va en Google (no se distribuye al cliente).

## Paso 1 — Publicar el servidor de licencias (una sola vez, gratis)

1. Entrá a Google Sheets con tu cuenta y creá una hoja nueva (ej. "Licencias CIP").
2. Menú **Extensiones → Apps Script**. Borrá lo que aparezca y pegá **todo** el contenido de
   `servidor/Codigo.gs`. Guardá (ícono de disco).
3. Arriba, en la lista de funciones, elegí **prepararHoja** y dale **Ejecutar**. La primera vez
   pide permisos: aceptalos con tu cuenta. Esto crea la pestaña "Licencias" con sus columnas.
4. Botón **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier persona**
   - **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).
5. Abrí `licencia-config.js` con el Bloc de notas y pegá esa URL entre las comillas. Guardá.

Si más adelante cambiás el `Codigo.gs`: **Implementar → Administrar implementaciones → editar (lápiz)
→ Versión: Nueva versión**. Así la URL no cambia.

## Paso 2 — Dar de alta un cliente

En la pestaña **Licencias**, una fila por cliente:

| Columna | Qué poner |
|---|---|
| **Clave** | lo que el cliente escribe para activar (ej. `TACANA-2026`). No distingue mayúsculas. |
| **Cliente** | nombre que se muestra en la herramienta. |
| **Tipo** | `Prueba` (muestra la franja de versión de prueba) o `Pagada` (sin franja). |
| **Días de prueba** | si querés 3 días de prueba, dejá **Vence** vacío y poné `3` aquí. La fecha se calcula sola el día que el cliente activa (cuenta solo días hábiles). |
| **Vence** | último día que puede usarse (inclusive). Vacío y sin días de prueba = sin vencimiento. |
| **Activa** | casilla marcada. Si la desmarcás, se bloquea en la siguiente verificación. |
| **Máx. equipos** | cuántas computadoras pueden usar esa clave. Vacío = sin límite. |

Las columnas **Equipos / Primer uso / Última verificación** las llena el sistema solo.
Para liberar los equipos de una clave (que pueda activarse en otra compu), borrá la celda **Equipos**.

### Para dar exactamente 3 días de prueba
Fila nueva: Clave (ej. `PRUEBA-IGSS`), Tipo `Prueba`, **Días de prueba** `3`, **Vence** vacío,
**Activa** marcada. El día que el cliente activa es el día 1; al cuarto día hábil queda bloqueado.

### Para venderle el sistema
Cambiá su Tipo a `Pagada` y poné en **Vence** la fecha hasta la que pagó (o dejala vacía si es
sin vencimiento). Desaparece la franja de prueba.

## Cómo se comporta en el cliente

- **Con internet:** pregunta al servidor cada vez que abre (y cada 30 min). Manda la fecha, así
  atrasar el reloj de Windows no sirve.
- **Sin internet:** usa la última verificación válida y deja trabajar hasta el vencimiento. Si la
  fecha de la computadora es anterior a la última vez que se usó, se bloquea (reloj atrasado).
- **Borrar los datos del navegador** no reinicia la prueba: el vencimiento lo guarda el servidor,
  así que al reabrir solo vuelve a pedir internet para verificar.

## Límites honestos de esta protección

Es fuerte para un usuario normal, pero **no es inviolable**: `licencia.js` es texto y alguien con
conocimientos técnicos podría editarlo para quitar la verificación, ya que todo corre en la
computadora del cliente. Lo que esta protección **sí** garantiza es que, sin tocar el código, nadie
alarga la prueba solo con el navegador o el reloj. Para blindarlo más habría que ofuscar `licencia.js`
(ver abajo) o mover la lógica de cada herramienta al servidor.

### (Opcional) Ofuscar licencia.js
Con Node instalado, en esta carpeta:

```
npx javascript-obfuscator fuente/licencia.src.js --output licencia.js \
  --compact true --string-array true --string-array-encoding base64 --self-defending true
```

Editá siempre `fuente/licencia.src.js` (es el legible) y regenerá `licencia.js`.
