/******************************************************
 * APPS SCRIPT - NOVEDADES EQUIPAMIENTO
 * Hoja requerida: PIZARRA
 * Encabezados esperados:
 * ID | FECHA_ALTA | ORIGEN | UBICACION | ELEMENTO | TAREA | PRIORIDAD |
 * TIEMPO_ESTIMADO_DIAS | FECHA_VENCIMIENTO | ESTADO | ASIGNADO_A |
 * FECHA_ASIGNACION | FECHA_FINALIZACION | OBSERVACIONES | FOTOS |
 * CREADO_POR | ULTIMA_ACTUALIZACION | ULTIMO_ASIGNADO
 ******************************************************/

const SPREADSHEET_ID = 'PEGAR_ID_DE_TU_GOOGLE_SHEET';
const SHEET_NAME = 'PIZARRA';
const ADMIN_PASS = 'CAMBIAR_CLAVE_ADMIN';
const FINALIZADAS_VISIBLES_DIAS = 7;

function doGet(e) {
  try {
    const action = (e.parameter.action || 'list').trim();
    const params = e.parameter || {};

    if (action === 'list') return jsonResponse(listTasks_());
    if (action === 'assign') return jsonResponse(assignTask_(params));
    if (action === 'finish') return jsonResponse(finishTask_(params));
    if (action === 'adminUpdate') return jsonResponse(adminUpdate_(params));
    if (action === 'createFromNovedad') return jsonResponse(createTaskFromNovedad_(params));

    return jsonResponse({ ok: false, message: 'Acción no reconocida: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, message: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('No existe la hoja ' + SHEET_NAME);
  return sh;
}

function getData_() {
  const sh = getSheet_();
  const values = sh.getDataRange().getValues();
  if (values.length < 1) throw new Error('La hoja no tiene encabezados.');
  const headers = values[0].map(String);
  const rows = values.slice(1);
  const items = rows.map((row, idx) => {
    const obj = { _row: idx + 2 };
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(item => item.ID !== '' && item.ID !== null && item.ID !== undefined);
  return { sh, headers, items };
}

function colIndex_(headers, name) {
  const idx = headers.indexOf(name);
  if (idx === -1) throw new Error('Falta la columna: ' + name);
  return idx + 1;
}

function now_() {
  return new Date();
}

function formatDate_(date) {
  if (!date) return '';
  const tz = Session.getScriptTimeZone() || 'America/Argentina/Buenos_Aires';
  return Utilities.formatDate(new Date(date), tz, 'yyyy-MM-dd HH:mm');
}

function onlyDate_(date) {
  if (!date) return '';
  const tz = Session.getScriptTimeZone() || 'America/Argentina/Buenos_Aires';
  return Utilities.formatDate(new Date(date), tz, 'yyyy-MM-dd');
}

function parseDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function sameOrBeforeToday_(value) {
  const d = parseDate_(value);
  if (!d) return false;
  const today = new Date();
  today.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return d < today;
}

function daysSince_(value) {
  const d = parseDate_(value);
  if (!d) return 0;
  const today = new Date();
  today.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return Math.floor((today - d) / (1000 * 60 * 60 * 24));
}

function nextId_(items) {
  const maxId = items.reduce((max, item) => {
    const n = Number(item.ID);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return maxId + 1;
}

function listTasks_() {
  const releasedExpired = releaseExpired_();
  const { items } = getData_();

  const visible = items.filter(item => {
    const estado = String(item.ESTADO || '').trim();
    if (estado === 'Finalizada') {
      return daysSince_(item.FECHA_FINALIZACION) <= FINALIZADAS_VISIBLES_DIAS;
    }
    return true;
  }).map(item => normalizeForClient_(item));

  return { ok: true, tasks: visible, releasedExpired };
}

function normalizeForClient_(item) {
  const copy = {};
  Object.keys(item).forEach(k => {
    if (k === '_row') return;
    let v = item[k];
    if (Object.prototype.toString.call(v) === '[object Date]') {
      if (k.includes('FECHA')) v = onlyDate_(v);
      else v = formatDate_(v);
    }
    copy[k] = v === null || v === undefined ? '' : String(v);
  });
  copy.VENCIDA = String(item.ESTADO) === 'Asignada' && sameOrBeforeToday_(item.FECHA_VENCIMIENTO);
  return copy;
}

function releaseExpired_() {
  const { sh, headers, items } = getData_();
  const cEstado = colIndex_(headers, 'ESTADO');
  const cAsignado = colIndex_(headers, 'ASIGNADO_A');
  const cUltimo = colIndex_(headers, 'ULTIMO_ASIGNADO');
  const cObs = colIndex_(headers, 'OBSERVACIONES');
  const cUpd = colIndex_(headers, 'ULTIMA_ACTUALIZACION');

  let count = 0;
  items.forEach(item => {
    if (String(item.ESTADO).trim() === 'Asignada' && sameOrBeforeToday_(item.FECHA_VENCIMIENTO)) {
      const anterior = item.ASIGNADO_A || '';
      const obsActual = item.OBSERVACIONES || '';
      const obsNueva = String(obsActual) + (obsActual ? '\n' : '') + 'Tarea vencida. Liberada automáticamente el ' + formatDate_(now_()) + '.';
      sh.getRange(item._row, cEstado).setValue('Disponible');
      sh.getRange(item._row, cUltimo).setValue(anterior);
      sh.getRange(item._row, cAsignado).setValue('');
      sh.getRange(item._row, cObs).setValue(obsNueva);
      sh.getRange(item._row, cUpd).setValue(formatDate_(now_()));
      count++;
    }
  });
  return count;
}

function findById_(id) {
  const data = getData_();
  const item = data.items.find(x => String(x.ID) === String(id));
  if (!item) throw new Error('No se encontró la tarea ID ' + id);
  return { ...data, item };
}

function assignTask_(params) {
  const user = String(params.user || '').trim();
  if (!user) throw new Error('Falta el nombre de quien toma la tarea.');
  const { sh, headers, item } = findById_(params.id);
  if (String(item.ESTADO).trim() !== 'Disponible') {
    throw new Error('La tarea no está disponible.');
  }
  sh.getRange(item._row, colIndex_(headers, 'ESTADO')).setValue('Asignada');
  sh.getRange(item._row, colIndex_(headers, 'ASIGNADO_A')).setValue(user);
  sh.getRange(item._row, colIndex_(headers, 'FECHA_ASIGNACION')).setValue(formatDate_(now_()));
  sh.getRange(item._row, colIndex_(headers, 'ULTIMA_ACTUALIZACION')).setValue(formatDate_(now_()));
  return { ok: true, message: 'Tarea asignada.' };
}

function finishTask_(params) {
  const { sh, headers, item } = findById_(params.id);
  const obsCierre = String(params.observaciones || '').trim();
  const obsActual = item.OBSERVACIONES || '';
  const obsNueva = obsCierre ? String(obsActual) + (obsActual ? '\n' : '') + 'Cierre: ' + obsCierre : obsActual;

  sh.getRange(item._row, colIndex_(headers, 'ESTADO')).setValue('Finalizada');
  sh.getRange(item._row, colIndex_(headers, 'FECHA_FINALIZACION')).setValue(formatDate_(now_()));
  sh.getRange(item._row, colIndex_(headers, 'OBSERVACIONES')).setValue(obsNueva);
  sh.getRange(item._row, colIndex_(headers, 'ULTIMA_ACTUALIZACION')).setValue(formatDate_(now_()));
  return { ok: true, message: 'Tarea finalizada.' };
}

function adminUpdate_(params) {
  if (String(params.adminPass || '') !== ADMIN_PASS) throw new Error('Clave de administrador incorrecta.');
  const { sh, headers, item } = findById_(params.id);

  if (params.prioridad) sh.getRange(item._row, colIndex_(headers, 'PRIORIDAD')).setValue(params.prioridad);
  if (params.tiempoEstimadoDias !== undefined) sh.getRange(item._row, colIndex_(headers, 'TIEMPO_ESTIMADO_DIAS')).setValue(params.tiempoEstimadoDias);
  if (params.fechaVencimiento) sh.getRange(item._row, colIndex_(headers, 'FECHA_VENCIMIENTO')).setValue(params.fechaVencimiento);
  if (params.observaciones !== undefined) sh.getRange(item._row, colIndex_(headers, 'OBSERVACIONES')).setValue(params.observaciones);
  sh.getRange(item._row, colIndex_(headers, 'ULTIMA_ACTUALIZACION')).setValue(formatDate_(now_()));

  return { ok: true, message: 'Tarea actualizada.' };
}

function createTaskFromNovedad_(params) {
  const { sh, headers, items } = getData_();
  const id = nextId_(items);
  const row = headers.map(h => '');

  const set = (name, value) => {
    const idx = headers.indexOf(name);
    if (idx !== -1) row[idx] = value;
  };

  const fechaAlta = formatDate_(now_());
  const prioridad = params.prioridad || 'Media';
  const dias = params.tiempoEstimadoDias || '';
  let vencimiento = params.fechaVencimiento || '';
  if (!vencimiento && dias !== '') {
    const d = now_();
    d.setDate(d.getDate() + Number(dias));
    vencimiento = onlyDate_(d);
  }

  set('ID', id);
  set('FECHA_ALTA', fechaAlta);
  set('ORIGEN', params.origen || 'Novedad equipamiento');
  set('UBICACION', params.ubicacion || '');
  set('ELEMENTO', params.elemento || '');
  set('TAREA', params.tarea || params.novedad || '');
  set('PRIORIDAD', prioridad);
  set('TIEMPO_ESTIMADO_DIAS', dias);
  set('FECHA_VENCIMIENTO', vencimiento);
  set('ESTADO', 'Disponible');
  set('OBSERVACIONES', params.observaciones || '');
  set('FOTOS', params.fotos || '');
  set('CREADO_POR', params.creadoPor || params.usuario || '');
  set('ULTIMA_ACTUALIZACION', fechaAlta);

  sh.appendRow(row);
  return { ok: true, message: 'Tarea creada desde novedad.', id };
}

/******************************************************
 * FUNCIÓN AUXILIAR PARA PROBAR DESDE APPS SCRIPT
 ******************************************************/
function pruebaCrearTarea() {
  const res = createTaskFromNovedad_({
    origen: 'Prueba manual',
    ubicacion: 'Móvil 1',
    elemento: 'Linterna',
    tarea: 'Revisar batería / carga.',
    prioridad: 'Media',
    tiempoEstimadoDias: '7',
    usuario: 'Prueba'
  });
  Logger.log(res);
}
