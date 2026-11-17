/**
 * Servidor de licencias de las herramientas sin conexión de CIP (Google Apps Script).
 *
 * CÓMO PUBLICARLO (una sola vez):
 *  1. Creá una hoja de cálculo nueva en Google Sheets (por ejemplo "Licencias CIP").
 *  2. Menú Extensiones → Apps Script. Borrá lo que haya y pegá TODO este archivo. Guardá.
 *  3. Arriba, elegí la función "prepararHoja" y dale Ejecutar (la primera vez pide permisos:
 *     aceptalos con tu cuenta). Esto crea la pestaña "Licencias" con sus columnas y una fila de ejemplo.
 *  4. Botón "Implementar" → "Nueva implementación" → tipo "Aplicación web".
 *       - Ejecutar como: Yo
 *       - Quién tiene acceso: Cualquier persona
 *     Dale "Implementar" y copiá la "URL de la aplicación web" (termina en /exec).
 *  5. Pegá esa URL en el archivo licencia-config.js, junto a las herramientas.
 *
 * Si después cambiás este código, hacé "Implementar" → "Administrar implementaciones" →
 * editar (lápiz) → Versión: "Nueva versión". Así la URL sigue siendo la misma.
 *
 * CÓMO SE USA LA HOJA (pestaña "Licencias", una fila por cliente):
 *  - Clave:          lo que el cliente escribe para activar (no distingue mayúsculas).
 *  - Cliente:        nombre que se muestra en la herramienta.
 *  - Tipo:           "Prueba" (muestra la franja de versión de prueba) o "Pagada" (sin franja).
 *  - Días de prueba: si dejás "Vence" vacío y ponés un número aquí (por ejemplo 3), la fecha de
 *                    vencimiento se calcula sola la primera vez que el cliente activa: ese día
 *                    cuenta como el día 1 y solo se cuentan días hábiles (lunes a viernes).
 *  - Vence:          último día que puede usarse (inclusive). Vacío y sin días de prueba = sin vencimiento.
 *  - Activa:         casilla. Si la desmarcás, la herramienta se bloquea en la siguiente verificación.
 *  - Máx. equipos:   cuántas computadoras/navegadores distintos pueden usar esa clave. Vacío = sin límite.
 *  - Equipos, Primer uso, Última verificación: los llena el sistema; no hace falta tocarlos.
 *    Para liberar los equipos de una clave, borrá el contenido de la celda "Equipos".
 */

const HOJA = 'Licencias';
const ZONA = 'America/Guatemala';
const COLUMNAS = ['Clave', 'Cliente', 'Tipo', 'Días de prueba', 'Vence', 'Activa',
                  'Máx. equipos', 'Equipos', 'Primer uso', 'Última verificación', 'Notas'];

function prepararHoja() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = libro.getSheetByName(HOJA) || libro.insertSheet(HOJA);
  hoja.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS]).setFontWeight('bold');
  hoja.setFrozenRows(1);
  if (hoja.getLastRow() < 2) {
    hoja.getRange(2, 1, 1, 7).setValues([['DEMO-PRUEBA', 'Cliente de prueba', 'Prueba', 3, '', true, 2]]);
  }
  hoja.getRange(2, 6, Math.max(hoja.getMaxRows() - 1, 1), 1).insertCheckboxes();
  hoja.getRange(2, 5, Math.max(hoja.getMaxRows() - 1, 1), 1).setNumberFormat('dd/mm/yyyy');
}

function doGet(e) {
  return responder(verificar((e && e.parameter) || {}));
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function verificar(p) {
  const hoy = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd');
  const clave = String(p.clave || '').trim().toUpperCase();
  const equipo = String(p.equipo || '').trim().slice(0, 40);
  if (!clave) return { ok: false, motivo: 'clave_invalida', hoy: hoy };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA);
    if (!hoja) return { ok: false, motivo: 'error_servidor', hoy: hoy };
    const datos = hoja.getDataRange().getValues();
    const col = {};
    datos[0].forEach(function (n, i) { col[String(n).trim()] = i; });

    for (let r = 1; r < datos.length; r++) {
      const fila = datos[r];
      if (String(fila[col['Clave']]).trim().toUpperCase() !== clave) continue;
      const celda = function (nombre, valor) { hoja.getRange(r + 1, col[nombre] + 1).setValue(valor); };
      const ahora = new Date();

      if (fila[col['Activa']] !== true && String(fila[col['Activa']]).toUpperCase() !== 'TRUE') {
        return { ok: false, motivo: 'desactivada', hoy: hoy };
      }

      // Equipos que ya usaron la clave
      const lista = String(fila[col['Equipos']] || '').split(',').map(function (s) { return s.trim(); }).filter(String);
      const max = Number(fila[col['Máx. equipos']]) || 0;
      if (equipo && lista.indexOf(equipo) === -1) {
        if (max && lista.length >= max) return { ok: false, motivo: 'limite_equipos', hoy: hoy };
        lista.push(equipo);
        celda('Equipos', lista.join(', '));
      }

      // Vencimiento: fijo, calculado por días de prueba, o sin vencimiento
      let vence = aISO(fila[col['Vence']]);
      const dias = Number(fila[col['Días de prueba']]) || 0;
      if (!vence && dias > 0) {
        vence = sumarDiasHabiles(hoy, dias);
        celda('Vence', fechaDeISO(vence));
      }
      if (!fila[col['Primer uso']]) celda('Primer uso', ahora);
      celda('Última verificación', ahora);

      const tipo = String(fila[col['Tipo']] || 'Pagada').trim();
      const cliente = String(fila[col['Cliente']] || '').trim();
      if (vence && hoy > vence) return { ok: false, motivo: 'vencida', vence: vence, hoy: hoy, cliente: cliente };
      return { ok: true, cliente: cliente, tipo: tipo, vence: vence || null, hoy: hoy };
    }
    return { ok: false, motivo: 'clave_invalida', hoy: hoy };
  } finally {
    lock.releaseLock();
  }
}

// "2026-11-16" + 3 días hábiles → el día 1 es el primer día hábil desde hoy (inclusive)
function sumarDiasHabiles(iso, dias) {
  const d = fechaDeISO(iso);
  let contados = 0;
  while (true) {
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) { contados++; if (contados >= dias) break; }
    d.setDate(d.getDate() + 1);
  }
  return aISO(d);
}

function fechaDeISO(iso) {
  const p = iso.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2], 12, 0, 0);
}

// Acepta fechas de la hoja (Date), "aaaa-mm-dd" o "dd/mm/aaaa"; devuelve "aaaa-mm-dd" o "".
function aISO(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, ZONA, 'yyyy-MM-dd');
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return '';
}
