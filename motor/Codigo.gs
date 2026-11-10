/**
 * NASAO · Motor del catálogo
 * Hoja: Productos (catálogo) y Pedidos (privado).
 * - La web lee los productos (solo datos públicos de las prendas).
 * - Cuando un cliente envía su pedido, las prendas quedan "Apartada".
 * - Si el apartado no se confirma en HORAS_APARTADO, vuelve a "Disponible".
 * - En Pedidos: Estado "Pagado"/"Entregado" → la prenda pasa a "Vendida" (sale de la web).
 *                Estado "Cancelado" → la prenda vuelve a "Disponible".
 * - Fotos nuevas: súbelas a la carpeta de Drive "Nasao · Fotos nuevas" → se crea la fila sola
 *   (Estado "Oculta"); llenas nombre, talla y precio y la pones "Disponible".
 */
var HORAS_APARTADO = 24;
var CARPETA_FOTOS = 'Nasao · Fotos nuevas';
var COL = {ref:1, cat:2, nombre:3, desc:4, talla:5, precio:6, foto:7, temporada:8, estado:9, desde:10};

function hoja_(n) { return SpreadsheetApp.getActive().getSheetByName(n); }

/* ---------- La web pide el catálogo ---------- */
function doGet(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    liberarVencidas_();
    importarFotos_();
    var datos = hoja_('Productos').getDataRange().getValues(); datos.shift();
    var out = [];
    datos.forEach(function (r) {
      var est = String(r[COL.estado - 1]).trim();
      if (!r[0] || est === 'Vendida' || est === 'Oculta' || !r[COL.precio - 1]) return;
      out.push({
        ref: String(r[0]).trim(), cat: String(r[1]).trim().toLowerCase(), nombre: String(r[2]),
        desc: String(r[3]), talla: String(r[4]), precio: Number(r[5]),
        img: foto_(String(r[6]).trim()), temporada: String(r[7]).trim().toLowerCase(),
        apartada: est === 'Apartada'
      });
    });
    return json_({ok: true, productos: out, t: Date.now()});
  } finally { lock.releaseLock(); }
}

/* ---------- La web envía un pedido ---------- */
function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var p = JSON.parse(e.postData.contents || '{}');
    if (!p.items || !p.items.length || !p.cliente || !p.celular) return json_({ok: false});
    var sh = hoja_('Productos'), datos = sh.getDataRange().getValues(), ahora = new Date();
    var porRef = {}; datos.forEach(function (r, i) { if (i) porRef[String(r[0]).trim()] = {fila: i + 1, r: r}; });
    var pedidos = hoja_('Pedidos'), tomadas = [];
    p.items.slice(0, 30).forEach(function (it) {
      var x = porRef[String(it.ref)]; if (!x) return;
      var est = String(x.r[COL.estado - 1]).trim(), nota = '';
      if (est === 'Disponible') {
        sh.getRange(x.fila, COL.estado, 1, 2).setValues([['Apartada', ahora]]);
      } else { nota = '⚠️ Ya estaba ' + est; tomadas.push(it.ref); }
      pedidos.appendRow([ahora, limpio_(p.pedido, 20), limpio_(p.cliente, 60), limpio_(p.celular, 20),
        x.r[0], x.r[2], x.r[4], x.r[5] * (Number(it.cant) || 1), limpio_(p.entrega, 40),
        limpio_(p.barrio, 80), p.regalo ? 'Sí' : '', 'Nuevo', '', nota]);
    });
    return json_({ok: true, tomadas: tomadas});
  } finally { lock.releaseLock(); }
}

/* ---------- Cambios hechos a mano en la hoja (también desde el celular) ---------- */
function onEdit(e) {
  var sh = e.range.getSheet(), n = sh.getName();
  if (n === 'Pedidos' && e.range.getColumn() === 12 && e.range.getRow() > 1) {
    var ref = sh.getRange(e.range.getRow(), 5).getValue(), v = String(e.value || '');
    var nuevo = (v === 'Pagado' || v === 'Entregado') ? 'Vendida' : (v === 'Cancelado' ? 'Disponible' : null);
    if (nuevo) cambiarEstado_(ref, nuevo);
  }
  if (n === 'Productos' && e.range.getColumn() === COL.estado && e.range.getRow() > 1) {
    sh.getRange(e.range.getRow(), COL.desde).setValue(e.value === 'Apartada' ? new Date() : '');
  }
}

function cambiarEstado_(ref, estado) {
  var sh = hoja_('Productos'), refs = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (var i = 0; i < refs.length; i++) if (String(refs[i][0]).trim() === String(ref).trim()) {
    sh.getRange(i + 2, COL.estado, 1, 2).setValues([[estado, estado === 'Apartada' ? new Date() : '']]); return;
  }
}

function liberarVencidas_() {
  var sh = hoja_('Productos'), last = sh.getLastRow(); if (last < 2) return;
  var rg = sh.getRange(2, COL.estado, last - 1, 2), v = rg.getValues(), lim = Date.now() - HORAS_APARTADO * 3600e3, cambio = false;
  v.forEach(function (r) { if (r[0] === 'Apartada' && r[1] instanceof Date && r[1].getTime() < lim) { r[0] = 'Disponible'; r[1] = ''; cambio = true; } });
  if (cambio) rg.setValues(v);
}

/* ---------- Fotos nuevas desde Drive ---------- */
function importarFotos_() {
  var cache = CacheService.getScriptCache(); if (cache.get('fotos')) return; cache.put('fotos', '1', 300);
  var it = DriveApp.getFoldersByName(CARPETA_FOTOS);
  var carpeta = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_FOTOS);
  var sh = hoja_('Productos'), usadas = sh.getRange(1, COL.foto, sh.getLastRow(), 1).getValues().join('|');
  var props = PropertiesService.getScriptProperties(), n = Number(props.getProperty('ultimaRef') || 100);
  var files = carpeta.getFiles();
  while (files.hasNext()) {
    var f = files.next(); if (f.getMimeType().indexOf('image/') !== 0 || usadas.indexOf(f.getId()) >= 0) continue;
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    n++; sh.appendRow(['NS-' + n, 'pijamas', '', '', '', '', 'drive:' + f.getId(), '', 'Oculta', '']);
  }
  props.setProperty('ultimaRef', String(n));
}
function foto_(v) { return v.indexOf('drive:') === 0 ? 'https://drive.google.com/thumbnail?id=' + v.slice(6) + '&sz=w800' : v; }

function limpio_(s, max) { return String(s || '').replace(/^[=+\-@]/, "'$&").slice(0, max); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* Ejecuta esto UNA vez desde el editor para autorizar Drive y crear la carpeta de fotos. */
function configurar() { importarFotos_(); SpreadsheetApp.getActive().toast('Motor Nasao listo ✅'); }
