const CONFIG_KEY = 'novedadesEquipamientoScriptUrl';
const USER_KEY = 'novedadesEquipamientoUserName';
const ADMIN_KEY = 'novedadesEquipamientoAdmin';
const ADMIN_PASS = '1105';
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzYiO560Az_Eo_hPzAxeczftZG4h9M3SEPjm-ACtrKzfdtHj_CRiqCCenM3KkIy6vyx/exec';

let allTasks = [];
let equipmentMode = false;
let adminMode = false;

const els = {
  configPanel: document.getElementById('configPanel'),
  scriptUrl: document.getElementById('scriptUrl'),
  saveConfig: document.getElementById('saveConfig'),
  btnEquipment: document.getElementById('btnEquipment'),
  btnBoardPdf: document.getElementById('btnBoardPdf'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnAdmin: document.getElementById('btnAdmin'),
  adminPanel: document.getElementById('adminPanel'),
  publicView: document.getElementById('publicView'),
  equipmentView: document.getElementById('equipmentView'),
  userName: document.getElementById('userName'),
  filterText: document.getElementById('filterText'),
  filterPriority: document.getElementById('filterPriority'),
  listPublic: document.getElementById('listPublic'),
  listDisponible: document.getElementById('listDisponible'),
  listAsignada: document.getElementById('listAsignada'),
  listFinalizada: document.getElementById('listFinalizada'),
  countDisponible: document.getElementById('countDisponible'),
  countAsignada: document.getElementById('countAsignada'),
  countFinalizada: document.getElementById('countFinalizada'),
  countVencida: document.getElementById('countVencida'),
  toast: document.getElementById('toast'),
};

init();

function init() {
  if (!localStorage.getItem(CONFIG_KEY)) localStorage.setItem(CONFIG_KEY, DEFAULT_SCRIPT_URL);
  els.scriptUrl.value = getScriptUrl();
  els.userName.value = localStorage.getItem(USER_KEY) || '';
  els.userName.addEventListener('input', () => localStorage.setItem(USER_KEY, els.userName.value.trim()));
  els.saveConfig.addEventListener('click', saveConfig);
  els.btnEquipment.addEventListener('click', toggleEquipmentMode);
  els.btnBoardPdf.addEventListener('click', downloadBoardPdf);
  els.btnRefresh.addEventListener('click', loadTasks);
  els.btnAdmin.addEventListener('click', toggleAdmin);
  els.filterText.addEventListener('input', render);
  els.filterPriority.addEventListener('change', render);
  updateConfigVisibility();
  updateModeVisibility();
  updateAdminVisibility();
  if (getScriptUrl()) loadTasks();
}

function getScriptUrl() {
  return localStorage.getItem(CONFIG_KEY) || DEFAULT_SCRIPT_URL;
}

function saveConfig() {
  const url = els.scriptUrl.value.trim();
  if (!url.startsWith('https://script.google.com/')) {
    showToast('Pegá una URL válida de Apps Script.');
    return;
  }
  localStorage.setItem(CONFIG_KEY, url);
  updateConfigVisibility();
  loadTasks();
}

function updateConfigVisibility() {
  els.configPanel.classList.toggle('hidden', Boolean(getScriptUrl()));
}

function updateModeVisibility() {
  els.publicView.classList.toggle('hidden', equipmentMode);
  els.equipmentView.classList.toggle('hidden', !equipmentMode);
  els.btnEquipment.textContent = equipmentMode ? 'Volver a pizarra' : 'Soy de equipamiento';
}

function updateAdminVisibility() {
  els.adminPanel.classList.toggle('hidden', !equipmentMode || !adminMode);
  els.btnAdmin.classList.toggle('hidden', !equipmentMode);
  els.btnAdmin.textContent = adminMode ? 'Salir de admin' : 'Modo admin';
}

function toggleEquipmentMode() {
  equipmentMode = !equipmentMode;
  if (!equipmentMode) {
    adminMode = false;
    localStorage.removeItem('adminPass');
    localStorage.removeItem(ADMIN_KEY);
  }
  updateModeVisibility();
  updateAdminVisibility();
  render();
}

function toggleAdmin() {
  if (!equipmentMode) return;
  if (adminMode) {
    adminMode = false;
    localStorage.removeItem('adminPass');
  } else {
    const pass = prompt('Clave de administrador');
    if (!pass) return;
    if (pass !== ADMIN_PASS) {
      showToast('Clave de administrador incorrecta.');
      return;
    }
    adminMode = true;
    localStorage.setItem('adminPass', pass);
  }
  localStorage.setItem(ADMIN_KEY, String(adminMode));
  updateAdminVisibility();
  render();
}

async function api(action, params = {}) {
  const baseUrl = getScriptUrl();
  if (!baseUrl) throw new Error('Falta configurar URL de Apps Script.');
  const url = new URL(baseUrl);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  });
  const response = await fetch(url.toString());
  const data = await response.json();
  if (!data.ok) throw new Error(data.message || 'Error en la operación.');
  return data;
}

async function loadTasks() {
  try {
    showToast('Actualizando pizarra...');
    const data = await api('list');
    allTasks = data.tasks || [];
    els.countVencida.textContent = data.releasedExpired || 0;
    render();
    showToast('Pizarra actualizada.');
  } catch (error) {
    showToast(error.message);
  }
}

function render() {
  if (!equipmentMode) {
    renderPublic();
    return;
  }

  const text = els.filterText.value.trim().toLowerCase();
  const priority = els.filterPriority.value;
  const filtered = allTasks.filter(t => {
    const blob = `${t.ID} ${t.UBICACION} ${t.ELEMENTO} ${t.TAREA} ${t.ASIGNADO_A} ${t.CREADO_POR}`.toLowerCase();
    return (!text || blob.includes(text)) && (!priority || t.PRIORIDAD === priority);
  });

  const disponibles = filtered.filter(t => t.ESTADO === 'Disponible');
  const asignadas = filtered.filter(t => t.ESTADO === 'Asignada');
  const finalizadas = filtered.filter(t => t.ESTADO === 'Finalizada');

  els.countDisponible.textContent = disponibles.length;
  els.countAsignada.textContent = asignadas.length;
  els.countFinalizada.textContent = finalizadas.length;

  renderList(els.listDisponible, disponibles);
  renderList(els.listAsignada, asignadas);
  renderList(els.listFinalizada, finalizadas);
}

function renderPublic() {
  const activeTasks = allTasks.filter(t => t.ESTADO !== 'Finalizada');
  els.listPublic.innerHTML = '';
  if (!activeTasks.length) {
    els.listPublic.innerHTML = '<div class="empty public-empty">No hay novedades activas.</div>';
    return;
  }
  activeTasks.forEach(task => els.listPublic.appendChild(createPublicCard(task)));
}

function renderList(container, tasks) {
  container.innerHTML = '';
  if (!tasks.length) {
    container.innerHTML = '<div class="empty">Sin tareas para mostrar.</div>';
    return;
  }
  tasks.forEach(task => container.appendChild(createTaskCard(task)));
}

function createPublicCard(task) {
  const card = document.createElement('article');
  const prioridad = (task.PRIORIDAD || 'sin-prioridad').toLowerCase();
  card.className = `public-card priority-card-${prioridad}`;
  card.innerHTML = `
    <div class="public-mobile">${escapeHtml(getMobileFromLocation(task.UBICACION))}</div>
    <div class="public-title">${escapeHtml(displayText(task.ELEMENTO || 'Elemento sin nombre'))}</div>
    <div class="public-novelty">${escapeHtml(getPublicNovelty(task))}</div>
  `;
  return card;
}

function createTaskCard(task) {
  const card = document.createElement('article');
  const prioridad = (task.PRIORIDAD || 'sin-prioridad').toLowerCase();
  const prioridadLabel = task.PRIORIDAD || 'Sin prioridad';
  const adminMeta = adminMode ? `
      <span><strong>Vencimiento:</strong> ${escapeHtml(task.FECHA_VENCIMIENTO || '-')}</span>
      <span><strong>Estado:</strong> ${escapeHtml(task.ESTADO || '-')}</span>
      ${task.FECHA_ASIGNACION ? `<span><strong>Asignada desde:</strong> ${escapeHtml(task.FECHA_ASIGNACION)}</span>` : ''}
    ` : '';
  card.className = `task-card priority-card-${prioridad} ${task.VENCIDA ? 'overdue' : ''}`;
  card.innerHTML = `
    <div class="task-top">
      <div><strong>#${escapeHtml(task.ID)}</strong></div>
      <span class="priority ${prioridad}">${escapeHtml(prioridadLabel)}</span>
    </div>
    <div class="task-title">${escapeHtml(task.TAREA || 'Sin descripción')}</div>
    <div class="meta">
      <span><strong>Ubicación:</strong> ${escapeHtml(task.UBICACION || '-')}</span>
      <span><strong>Elemento:</strong> ${escapeHtml(task.ELEMENTO || '-')}</span>
      ${task.CREADO_POR ? `<span><strong>Relevo:</strong> ${escapeHtml(task.CREADO_POR)}</span>` : ''}
      ${task.ASIGNADO_A ? `<span><strong>Asignado a:</strong> ${escapeHtml(task.ASIGNADO_A)}</span>` : ''}
      ${adminMeta}
      ${task.OBSERVACIONES ? `<span><strong>Obs:</strong> ${escapeHtml(task.OBSERVACIONES)}</span>` : ''}
    </div>
    <div class="actions"></div>
  `;

  const actions = card.querySelector('.actions');
  if (task.ESTADO === 'Disponible') {
    actions.appendChild(button('Tomar tarea', 'primary small', () => assignTask(task.ID)));
  }
  if (task.ESTADO === 'Asignada') {
    actions.appendChild(button('Finalizar', 'primary small', () => finishTask(task.ID)));
  }
  if (adminMode) {
    actions.appendChild(button('Editar admin', 'secondary small', () => toggleAdminEdit(card, task)));
  }
  return card;
}

function getMobileFromLocation(location) {
  const value = String(location || '').trim();
  if (!value) return 'Sin movil';
  return value.split(/\s+-\s+/)[0] || value;
}

function getPlaceFromLocation(location) {
  const value = String(location || '').trim();
  const parts = value.split(/\s+-\s+/);
  return parts.length > 1 ? parts.slice(1).join(' - ') : value;
}

function getPublicNovelty(task) {
  const tarea = displayText(task.TAREA || task.OBSERVACIONES || 'Revisar novedad');
  return tarea
    .replace(/\bCondicion\b/gi, 'Condición')
    .replace(/\bMas\b/g, 'Más')
    .replace(/\bmas\b/g, 'más');
}

function displayText(value) {
  return String(value || '')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã/g, 'Á')
    .replace(/Ã‰/g, 'É')
    .replace(/Ã/g, 'Í')
    .replace(/Ã“/g, 'Ó')
    .replace(/Ãš/g, 'Ú')
    .replace(/Ã‘/g, 'Ñ');
}

function getPublicNovelty(task) {
  const tarea = displayText(task.TAREA || task.OBSERVACIONES || 'Revisar novedad');
  return tarea
    .replace(/\bCondicion\b/gi, 'Condici\u00f3n')
    .replace(/\bMas\b/g, 'M\u00e1s')
    .replace(/\bmas\b/g, 'm\u00e1s');
}

function displayText(value) {
  let text = String(value || '');
  for (let i = 0; i < 2; i += 1) {
    try {
      const decoded = decodeURIComponent(escape(text));
      if (decoded === text) break;
      text = decoded;
    } catch (error) {
      break;
    }
  }
  return text;
}

function button(text, className, onClick) {
  const btn = document.createElement('button');
  btn.className = `btn ${className}`;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

async function assignTask(id) {
  const name = els.userName.value.trim();
  if (!name) {
    showToast('Completá tu nombre antes de tomar una tarea.');
    els.userName.focus();
    return;
  }
  try {
    await api('assign', { id, user: name });
    showToast('Tarea asignada.');
    await loadTasks();
  } catch (error) {
    showToast(error.message);
  }
}

async function finishTask(id) {
  const name = els.userName.value.trim();
  const obs = prompt('Observación de cierre, opcional:') || '';
  try {
    await api('finish', { id, user: name, observaciones: obs });
    showToast('Tarea finalizada.');
    await loadTasks();
  } catch (error) {
    showToast(error.message);
  }
}

function toggleAdminEdit(card, task) {
  const old = card.querySelector('.admin-edit');
  if (old) { old.remove(); return; }
  const box = document.createElement('div');
  box.className = 'admin-edit';
  box.innerHTML = `
    <div class="admin-grid">
      <div class="field"><label>Prioridad</label><select class="adm-priority"><option value="">Sin prioridad</option><option>Baja</option><option>Media</option><option>Alta</option></select></div>
      <div class="field"><label>Tiempo estimado días</label><input class="adm-days" type="number" min="0" step="1" value="${escapeAttr(task.TIEMPO_ESTIMADO_DIAS || '')}"></div>
    </div>
    <div class="field"><label>Fecha vencimiento</label><input class="adm-due" type="date" value="${toDateInput(task.FECHA_VENCIMIENTO)}"></div>
    <div class="field"><label>Observaciones</label><textarea class="adm-obs">${escapeHtml(task.OBSERVACIONES || '')}</textarea></div>
    <button class="btn primary small adm-save">Guardar cambios</button>
  `;
  box.querySelector('.adm-priority').value = task.PRIORIDAD || '';
  box.querySelector('.adm-save').addEventListener('click', () => saveAdminEdit(task.ID, box));
  card.appendChild(box);
}

async function saveAdminEdit(id, box) {
  try {
    await api('adminUpdate', {
      id,
      prioridad: box.querySelector('.adm-priority').value,
      tiempoEstimadoDias: box.querySelector('.adm-days').value,
      fechaVencimiento: box.querySelector('.adm-due').value,
      observaciones: box.querySelector('.adm-obs').value,
      adminPass: localStorage.getItem('adminPass') || ''
    });
    showToast('Cambios guardados.');
    await loadTasks();
  } catch (error) {
    showToast(error.message);
  }
}

function downloadBoardPdf() {
  if (!allTasks.length) {
    showToast('No hay novedades para descargar.');
    return;
  }
  if (!window.jspdf || !window.jspdf.jsPDF || !window.jspdf.jsPDF.API.autoTable) {
    showToast('No se pudo cargar el generador de PDF.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const rows = allTasks.map(task => [
    task.ID || '',
    task.ESTADO || '',
    task.PRIORIDAD || 'Sin prioridad',
    task.UBICACION || '',
    task.ELEMENTO || '',
    task.TAREA || '',
    task.CREADO_POR || '',
    task.ASIGNADO_A || '',
    task.FECHA_ALTA || ''
  ]);

  doc.autoTable({
    startY: 34,
    head: [['ID', 'Estado', 'Prioridad', 'Ubicacion', 'Elemento', 'Tarea', 'Relevo', 'Asignado', 'Alta']],
    body: rows,
    margin: { top: 34, left: 10, right: 10 },
    styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [5, 38, 58], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [242, 246, 248] },
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 22 },
      2: { cellWidth: 24 },
      3: { cellWidth: 38 },
      4: { cellWidth: 32 },
      5: { cellWidth: 70 },
      6: { cellWidth: 34 },
      7: { cellWidth: 34 },
      8: { cellWidth: 22 }
    },
    didParseCell(data) {
      if (data.section !== 'body') return;
      const prioridad = data.row.raw[2];
      if (prioridad === 'Alta') data.cell.styles.fillColor = [255, 241, 241];
      if (prioridad === 'Media') data.cell.styles.fillColor = [255, 253, 227];
      if (prioridad === 'Baja') data.cell.styles.fillColor = [237, 248, 253];
    },
    willDrawPage() {
      drawBoardPdfHeader(doc);
    }
  });

  doc.save(`Pizarra_novedades_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function drawBoardPdfHeader(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(5, 38, 58);
  doc.rect(0, 0, pageWidth, 26, 'F');
  doc.setFillColor(220, 51, 56);
  doc.rect(0, 24, pageWidth, 2, 'F');

  try {
    const logo = document.querySelector('.brand-logo');
    if (logo && logo.complete) doc.addImage(logo, 'PNG', pageWidth - 28, 3, 18, 18);
  } catch (error) {
    console.warn('No se pudo agregar el logo al PDF.', error);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Pizarra de novedades', 10, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Bomberos Voluntarios Pergamino - ${new Date().toLocaleString('es-AR')}`, 10, 18);
  doc.setTextColor(22, 35, 50);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.add('hidden'), 2400);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
function escapeAttr(value) { return escapeHtml(value).replace(/'/g, '&#039;'); }
function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}
