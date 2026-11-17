/*
 * Verificación de licencia de las herramientas sin conexión de CIP.
 * Fuente legible: el archivo que se distribuye es ../licencia.js (ofuscado), generado con
 *   npx --yes javascript-obfuscator@4.1.1 herramientas/fuente/licencia.src.js \
 *     --output herramientas/licencia.js --compact true --string-array true \
 *     --string-array-encoding base64 --self-defending true
 *
 * Flujo:
 *  - Con internet: consulta el servidor (Google Apps Script) con la clave y el id del equipo.
 *    El servidor decide (clave válida, activa, vencimiento con la fecha del servidor, límite de equipos).
 *  - Sin internet: usa la última respuesta válida del servidor, guardada en este navegador con una
 *    firma; deja trabajar hasta su fecha de vencimiento y bloquea si la fecha de la computadora es
 *    anterior a la última vez que se usó (reloj atrasado a propósito).
 *  - Borrar los datos del navegador solo obliga a volver a verificar con internet: no reinicia la prueba,
 *    porque el vencimiento lo guarda el servidor.
 *
 * La página llama a window.CIP_iniciar() (si existe) solo cuando la licencia queda válida.
 */
(function () {
  'use strict';

  var URL_SERVIDOR = String(window.CIP_LICENCIA_URL || '').trim();
  var SAL = 'cip·tacana·7f3a91·licencia';
  var K_A = 'cip-lic-a', K_B = 'cip-lic-b', K_EQ = 'cip-equipo';
  var RECHEQUEO_MS = 30 * 60 * 1000;
  var CONTACTO = 'https://www.chronos-dev.com';

  var script = document.currentScript;
  var izquierda = (script && script.getAttribute('data-izquierda')) || '0';
  var iniciado = false, desbloqueado = false;

  // ── Utilidades ──
  function hash(str) { // cyrb53
    var h1 = 0xdeadbeef ^ 41, h2 = 0x41c6ce57 ^ 41;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  function hoyLocal() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function fechaCorta(iso) { var p = String(iso).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso; }
  function maxISO(a, b) { return (a || '') > (b || '') ? a : b; }
  function diasHabilesRestantes(desde, hasta) { // inclusive en ambos extremos
    var p = desde.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2], 12), n = 0, iso = desde;
    while (iso <= hasta) {
      if (d.getDay() !== 0 && d.getDay() !== 6) n++;
      d.setDate(d.getDate() + 1);
      iso = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
    return n;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; }
    return null;
  }
  function equipo() {
    var id = ls(K_EQ);
    if (!id || !/^[a-z0-9]{12}$/.test(id)) {
      id = '';
      var abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
      for (var i = 0; i < 12; i++) id += abc[Math.floor(Math.random() * abc.length)];
      ls(K_EQ, id);
    }
    return id;
  }

  // ── Última verificación guardada (firmada, en dos lugares) ──
  function leerUno(k) {
    try {
      var o = JSON.parse(ls(k) || 'null');
      if (!o || !o.d || o.f !== hash(SAL + o.d + equipo())) return null;
      return JSON.parse(o.d);
    } catch (e) { return null; }
  }
  function leerCache() {
    var a = leerUno(K_A), b = leerUno(K_B);
    if (!a || !b) return null; // uno de los dos alterado o borrado: hay que volver a verificar en línea
    return JSON.stringify(a) === JSON.stringify(b) ? a : null;
  }
  function guardarCache(c) {
    var d = JSON.stringify(c), v = JSON.stringify({ d: d, f: hash(SAL + d + equipo()) });
    ls(K_A, v); ls(K_B, v);
  }
  function borrarCache() { ls(K_A, null); ls(K_B, null); }

  // ── Interfaz ──
  var css = '' +
    'html.lic-bloqueado body > *:not(#cip-lic){display:none !important}' +
    '#cip-lic{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:24px;' +
    'background:rgba(15,23,42,.97);color:#fff;text-align:center;font-family:Arial,Helvetica,sans-serif}' +
    'html.lic-bloqueado #cip-lic{display:flex}' +
    '#cip-lic .tarjeta{width:100%;max-width:480px;padding:30px;border:1px solid #475569;border-radius:16px;background:#1e293b;box-shadow:0 20px 60px rgba(0,0,0,.4)}' +
    '#cip-lic h2{margin:0 0 10px;font-size:22px}#cip-lic p{line-height:1.55;color:#cbd5e1;margin:8px 0}' +
    '#cip-lic a{color:#60a5fa;font-weight:bold}#cip-lic .msg{color:#fca5a5;font-weight:bold}' +
    '#cip-lic form{display:flex;gap:8px;margin:16px 0 6px}' +
    '#cip-lic input{flex:1;min-width:0;padding:10px 12px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#fff;font:inherit;font-size:15px;text-transform:uppercase}' +
    '#cip-lic button{padding:10px 16px;border-radius:8px;border:0;background:#2563eb;color:#fff;font:inherit;font-weight:bold;cursor:pointer}' +
    '#cip-lic button:disabled{opacity:.6;cursor:wait}' +
    '#cip-lic-bar{position:fixed;left:' + izquierda + 'px;right:0;bottom:0;height:38px;z-index:20;display:none;align-items:center;overflow:hidden;' +
    'background:#172033;color:#fff;border-top:1px solid #334155;font:12px Arial,Helvetica,sans-serif;white-space:nowrap}' +
    '#cip-lic-bar .pista{display:inline-flex;align-items:center;gap:34px;min-width:max-content;padding-left:12px;animation:cip-marquesina 26s linear infinite}' +
    '#cip-lic-bar:hover .pista{animation-play-state:paused}#cip-lic-bar a{color:#60a5fa;font-weight:800;text-decoration:none}' +
    '#cip-lic-bar .resalte{color:#fde68a;font-weight:700}' +
    '@keyframes cip-marquesina{from{transform:translateX(-100%)}to{transform:translateX(calc(100vw - ' + izquierda + 'px))}}' +
    '@media (max-width:700px){#cip-lic-bar{left:0}}' +
    '@media print{#cip-lic-bar{display:none !important}html:not(.lic-bloqueado) #cip-lic{display:none !important}}';
  var estilo = document.createElement('style'); estilo.textContent = css;
  document.head.appendChild(estilo);
  document.documentElement.classList.add('lic-bloqueado');

  var capa, barra;
  function montar() {
    if (capa) return;
    capa = document.createElement('div'); capa.id = 'cip-lic';
    capa.setAttribute('role', 'dialog'); capa.setAttribute('aria-modal', 'true');
    barra = document.createElement('div'); barra.id = 'cip-lic-bar';
    document.body.appendChild(capa); document.body.appendChild(barra);
  }

  function mostrarVerificando() {
    montar();
    capa.innerHTML = '<div class="tarjeta"><h2>Verificando licencia…</h2><p>Un momento.</p></div>';
  }

  function mostrarFormulario(titulo, mensaje, claveActual) {
    montar();
    document.documentElement.classList.add('lic-bloqueado');
    document.documentElement.classList.remove('lic-ok');
    desbloqueado = false;
    capa.innerHTML = '<div class="tarjeta"><h2>' + esc(titulo) + '</h2>' +
      (mensaje ? '<p class="msg">' + esc(mensaje) + '</p>' : '') +
      '<p>Escribí la clave de licencia que te dio el desarrollador. La primera activación necesita internet.</p>' +
      '<form><input name="clave" autocomplete="off" spellcheck="false" placeholder="Clave de licencia" value="' + esc(claveActual || '') + '">' +
      '<button type="submit">Activar</button></form>' +
      '<p>¿No tenés clave o se venció? Comunicate con el desarrollador: <a href="' + CONTACTO + '" target="_blank" rel="noopener noreferrer">CHRONOS-DEV</a></p></div>';
    var form = capa.querySelector('form'), input = form.querySelector('input'), boton = form.querySelector('button');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var clave = input.value.trim().toUpperCase();
      if (!clave) { input.focus(); return; }
      boton.disabled = true; boton.textContent = 'Verificando…';
      verificar(clave, true);
    });
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 0);
  }

  function mostrarBloqueo(titulo, mensaje) {
    montar();
    document.documentElement.classList.add('lic-bloqueado');
    document.documentElement.classList.remove('lic-ok');
    desbloqueado = false;
    capa.innerHTML = '<div class="tarjeta"><h2>' + esc(titulo) + '</h2><p>' + esc(mensaje) + '</p>' +
      '<p><button type="button" data-a="reintentar">Volver a verificar</button> ' +
      '<button type="button" data-a="otra" style="background:#334155">Usar otra clave</button></p>' +
      '<p><a href="' + CONTACTO + '" target="_blank" rel="noopener noreferrer">CHRONOS-DEV</a></p></div>';
    capa.querySelector('[data-a="reintentar"]').addEventListener('click', function () { mostrarVerificando(); verificar(null, true); });
    capa.querySelector('[data-a="otra"]').addEventListener('click', function () { mostrarFormulario('Activar licencia', '', ''); });
  }

  function desbloquear(info, sinConexion) {
    montar();
    document.documentElement.classList.remove('lic-bloqueado');
    document.documentElement.classList.add('lic-ok');
    desbloqueado = true;
    if (String(info.tipo || '').toLowerCase() === 'prueba') {
      var partes = ['<span><strong>VERSIÓN DE PRUEBA</strong></span>'];
      if (info.cliente) partes.push('<span>' + esc(info.cliente) + '</span>');
      if (info.vence) {
        var n = diasHabilesRestantes(hoyLocal(), info.vence);
        partes.push('<span class="resalte">Vence el ' + fechaCorta(info.vence) + ' · ' +
          (n === 1 ? 'queda 1 día hábil' : 'quedan ' + n + ' días hábiles') + '</span>');
      }
      partes.push('<span>Contacta con el desarrollador</span>', '<span>Visita nuestra página:</span>',
        '<a href="' + CONTACTO + '" target="_blank" rel="noopener noreferrer">CHRONOS-DEV</a>');
      if (sinConexion) partes.push('<span>(sin conexión: se usa la última verificación)</span>');
      barra.innerHTML = '<div class="pista">' + partes.join('') + '</div>';
      barra.style.display = 'flex';
    } else {
      barra.style.display = 'none';
    }
    if (!iniciado && typeof window.CIP_iniciar === 'function') {
      iniciado = true;
      try { window.CIP_iniciar(); } catch (e) { setTimeout(function () { throw e; }); }
    }
  }

  // ── Consulta al servidor ──
  function consultar(clave) {
    return new Promise(function (resolver) {
      var listo = false, ctl = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { if (!listo) { listo = true; if (ctl) ctl.abort(); resolver(null); } }, 10000);
      var url = URL_SERVIDOR + '?clave=' + encodeURIComponent(clave) + '&equipo=' + encodeURIComponent(equipo()) + '&t=' + Date.now();
      fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store', signal: ctl ? ctl.signal : undefined })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (!listo) { listo = true; clearTimeout(t); resolver(j && typeof j.ok === 'boolean' ? j : null); } })
        .catch(function () { if (!listo) { listo = true; clearTimeout(t); resolver(null); } });
    });
  }

  var MOTIVOS = {
    clave_invalida: 'Esa clave no existe. Revisala e intentá de nuevo.',
    desactivada: 'Esta licencia fue desactivada.',
    limite_equipos: 'Esta clave ya se está usando en el máximo de computadoras permitido.',
  };

  function verificar(claveNueva, interactivo) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(URL_SERVIDOR)) {
      mostrarBloqueo('Falta configurar el servidor de licencias',
        'Pegá la URL de la aplicación web de Google Apps Script en el archivo licencia-config.js.');
      return;
    }
    var cache = leerCache();
    var clave = claveNueva || (cache && cache.clave) || ls('cip-lic-clave') || '';
    if (!clave) { mostrarFormulario('Activar licencia', '', ''); return; }

    consultar(clave).then(function (r) {
      var hoyL = hoyLocal();
      if (r && r.ok) {
        var nuevo = { clave: clave, cliente: r.cliente || '', tipo: r.tipo || '', vence: r.vence || null, visto: maxISO(hoyL, r.hoy || '') };
        if (r.hoy && hoyL < r.hoy) nuevo.visto = r.hoy;
        guardarCache(nuevo); ls('cip-lic-clave', clave);
        desbloquear(nuevo, false);
        return;
      }
      if (r && !r.ok && r.motivo !== 'error_servidor') {
        borrarCache();
        if (r.motivo === 'vencida') {
          ls('cip-lic-clave', clave);
          mostrarBloqueo('La licencia ha vencido', (r.cliente ? r.cliente + ': ' : '') + 'el período terminó el ' +
            fechaCorta(r.vence) + '. Para seguir usando el sistema, comunicate con el desarrollador.');
        } else {
          ls('cip-lic-clave', null);
          mostrarFormulario('Activar licencia', MOTIVOS[r.motivo] || 'No se pudo validar la clave.', claveNueva || '');
        }
        return;
      }
      // Sin respuesta del servidor (sin internet o servidor caído)
      if (!cache || cache.clave !== clave) {
        if (desbloqueado && !interactivo) return;
        mostrarFormulario('Activar licencia', 'No hay conexión con el servidor de licencias. La primera activación necesita internet.', clave);
        return;
      }
      if (hoyL < cache.visto) {
        mostrarBloqueo('Revisá la fecha de la computadora',
          'La fecha de esta computadora (' + fechaCorta(hoyL) + ') es anterior a la última vez que se usó el sistema (' +
          fechaCorta(cache.visto) + '). Corregí la fecha o conectate a internet para volver a verificar.');
        return;
      }
      if (cache.vence && hoyL > cache.vence) {
        mostrarBloqueo('La licencia ha vencido', 'El período terminó el ' + fechaCorta(cache.vence) +
          '. Conectate a internet para volver a verificar o comunicate con el desarrollador.');
        return;
      }
      cache.visto = maxISO(cache.visto, hoyL);
      guardarCache(cache);
      desbloquear(cache, true);
    });
  }

  function arrancar() {
    mostrarVerificando();
    verificar(null, false);
    setInterval(function () { verificar(null, false); }, RECHEQUEO_MS);
  }
  if (document.body) arrancar(); else document.addEventListener('DOMContentLoaded', arrancar);
})();
