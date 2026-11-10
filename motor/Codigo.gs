/**
 * NASAO · Motor del catálogo (v2 · con unidades)
 * Productos: Ref | Categoría | Nombre | Descripción | Talla | Precio | Foto | Temporada | Estado | Unidades
 *   - Unidades = prendas físicas que tienes (escríbelo tú; si te llegan 2 iguales, pon 2).
 *   - Estado: Disponible · Oculta (manual) · Vendida (automático cuando Unidades llega a 0).
 * Pedidos: una fila por prenda pedida.
 *   - Nuevo      → la prenda queda apartada (no descuenta stock) durante HORAS_APARTADO.
 *   - Pagado / Entregado → descuenta 1 unidad (una sola vez). Si llega a 0 → Vendida.
 *   - Cancelado / Vencido → libera el apartado; si ya se había descontado, devuelve la unidad.
 *   - Un pedido Nuevo sin confirmar en HORAS_APARTADO pasa solo a "Vencido".
 * La web muestra: disponibles = Unidades − apartados activos. Si es 0 → "Apartada".
 */
var HOJA_ID = '1YedFQEEl1HISLeV4iMc8A6mlQtKzoJnVBvjv2XRF8ek';
var HORAS_APARTADO = 24;
var CARPETA_FOTOS = 'Nasao · Fotos nuevas';
var P = {ref:1, cat:2, nombre:3, desc:4, talla:5, precio:6, foto:7, temporada:8, estado:9, unidades:10};
var Q = {fecha:1, pedido:2, cliente:3, celular:4, ref:5, producto:6, talla:7, precio:8, entrega:9, barrio:10, regalo:11, estado:12, pago:13, notas:14, stock:15};

/* Ejecuta esto UNA vez desde el editor (y cada vez que cambies el código de disparadores). */
function configurar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('alEditar').forSpreadsheet(HOJA_ID).onEdit().create();
  CacheService.getScriptCache().remove('fotos'); importarFotos_();
  Logger.log('Motor Nasao listo ✅');
}

function libro_() { return SpreadsheetApp.openById(HOJA_ID); }
function hoja_(n) { return libro_().getSheetByName(n); }

/* Apartados activos por referencia (pedidos "Nuevo" dentro del plazo). También vence los viejos. */
function apartados_() {
  var sh = hoja_('Pedidos'), last = sh.getLastRow(), cuenta = {};
  if (last < 2) return cuenta;
  var rg = sh.getRange(2, 1, last - 1, Q.stock), v = rg.getValues(), lim = Date.now() - HORAS_APARTADO * 3600e3, cambio = false;
  v.forEach(function (r) {
    if (String(r[Q.estado - 1]).trim() !== 'Nuevo') return;
    var f = r[Q.fecha - 1];
    if (f instanceof Date && f.getTime() < lim) { r[Q.estado - 1] = 'Vencido'; cambio = true; return; }
    var ref = String(r[Q.ref - 1]).trim(); cuenta[ref] = (cuenta[ref] || 0) + 1;
  });
  if (cambio) sh.getRange(2, Q.estado, last - 1, 1).setValues(v.map(function (r) { return [r[Q.estado - 1]]; }));
  return cuenta;
}

/* ---------- La web pide el catálogo ---------- */
function doGet(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    importarFotos_();
    var ap = apartados_();
    var datos = hoja_('Productos').getDataRange().getValues(); datos.shift();
    var out = [];
    datos.forEach(function (r) {
      var est = String(r[P.estado - 1]).trim(), ref = String(r[0]).trim();
      var uni = Number(r[P.unidades - 1]); if (r[P.unidades - 1] === '' || isNaN(uni)) uni = 1;
      if (!ref || est === 'Vendida' || est === 'Oculta' || !r[P.precio - 1] || uni <= 0) return;
      var disp = Math.max(0, uni - (ap[ref] || 0));
      out.push({
        ref: ref, cat: String(r[1]).trim().toLowerCase(), nombre: String(r[2]), desc: String(r[3]),
        talla: String(r[4]), precio: Number(r[5]), img: foto_(String(r[6]).trim()),
        temporada: String(r[7]).trim().toLowerCase(), disp: disp, apartada: disp === 0
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
    var ap = apartados_(), datos = hoja_('Productos').getDataRange().getValues(), porRef = {};
    datos.forEach(function (r, i) { if (i) porRef[String(r[0]).trim()] = r; });
    var filas = [], ahora = new Date(), sinStock = [];
    p.items.slice(0, 30).forEach(function (it) {
      var ref = String(it.ref).trim(), r = porRef[ref]; if (!r) return;
      var uni = Number(r[P.unidades - 1]); if (r[P.unidades - 1] === '' || isNaN(uni)) uni = 1;
      var cant = Math.min(Math.max(1, Number(it.cant) || 1), 10);
      for (var k = 0; k < cant; k++) {
        var libre = String(r[P.estado - 1]).trim() === 'Disponible' && uni - (ap[ref] || 0) > 0;
        if (libre) ap[ref] = (ap[ref] || 0) + 1; else sinStock.push(ref);
        filas.push([ahora, limpio_(p.pedido, 20), limpio_(p.cliente, 60), limpio_(p.celular, 20), ref, r[2], r[4], r[5],
          limpio_(p.entrega, 40), limpio_(p.barrio, 80), p.regalo ? 'Sí' : '', libre ? 'Nuevo' : 'Sin stock', '',
          libre ? '' : '⚠️ No había unidades libres al pedir', '']);
      }
    });
    if (filas.length) { var sh = hoja_('Pedidos'); sh.getRange(sh.getLastRow() + 1, 1, filas.length, Q.stock).setValues(filas); }
    return json_({ok: true, sinStock: sinStock});
  } finally { lock.releaseLock(); }
}

/* ---------- Cambios hechos a mano en la hoja (también desde el celular) ---------- */
function alEditar(e) {
  var sh = e.range.getSheet();
  if (sh.getName() !== 'Pedidos' || e.range.getColumn() > Q.estado || e.range.getLastColumn() < Q.estado) return;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    for (var fila = Math.max(2, e.range.getRow()); fila <= e.range.getLastRow(); fila++) {
      var r = sh.getRange(fila, 1, 1, Q.stock).getValues()[0];
      var est = String(r[Q.estado - 1]).trim(), descontado = String(r[Q.stock - 1]) === '✓';
      if ((est === 'Pagado' || est === 'Entregado') && !descontado) {
        sumarUnidades_(r[Q.ref - 1], -1); sh.getRange(fila, Q.stock).setValue('✓');
      } else if ((est === 'Cancelado' || est === 'Vencido' || est === 'Nuevo') && descontado) {
        sumarUnidades_(r[Q.ref - 1], +1); sh.getRange(fila, Q.stock).setValue('');
      }
    }
  } finally { lock.releaseLock(); }
}

function sumarUnidades_(ref, delta) {
  var sh = hoja_('Productos'), last = sh.getLastRow(); if (last < 2) return;
  var refs = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < refs.length; i++) if (String(refs[i][0]).trim() === String(ref).trim()) {
    var c = sh.getRange(i + 2, P.unidades), u = Number(c.getValue()); if (c.getValue() === '' || isNaN(u)) u = 1;
    u = Math.max(0, u + delta); c.setValue(u);
    var est = sh.getRange(i + 2, P.estado);
    if (u === 0 && est.getValue() !== 'Oculta') est.setValue('Vendida');
    if (u > 0 && est.getValue() === 'Vendida') est.setValue('Disponible');
    return;
  }
}

/* ---------- Fotos nuevas desde Drive ---------- */
function importarFotos_() {
  var cache = CacheService.getScriptCache(); if (cache.get('fotos')) return; cache.put('fotos', '1', 300);
  var it = DriveApp.getFoldersByName(CARPETA_FOTOS);
  var carpeta = it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_FOTOS);
  var sh = hoja_('Productos'), usadas = sh.getRange(1, P.foto, sh.getLastRow(), 1).getValues().join('|');
  var props = PropertiesService.getScriptProperties(), n = Number(props.getProperty('ultimaRef') || 100);
  var files = carpeta.getFiles();
  while (files.hasNext()) {
    var f = files.next(); if (f.getMimeType().indexOf('image/') !== 0 || usadas.indexOf(f.getId()) >= 0) continue;
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    n++; sh.appendRow(['NS-' + n, 'pijamas', '', '', '', '', 'drive:' + f.getId(), '', 'Oculta', 1]);
  }
  props.setProperty('ultimaRef', String(n));
}
function foto_(v) { return v.indexOf('drive:') === 0 ? 'https://drive.google.com/thumbnail?id=' + v.slice(6) + '&sz=w800' : v; }

function limpio_(s, max) { return String(s || '').replace(/^[=+\-@]/, "'$&").slice(0, max); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
