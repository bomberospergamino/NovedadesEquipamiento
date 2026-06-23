const CONFIG_KEY = 'novedadesEquipamientoScriptUrl';
const USER_KEY = 'novedadesEquipamientoUserName';
const ADMIN_KEY = 'novedadesEquipamientoAdmin';
const ADMIN_PASS = '1105';
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzYiO560Az_Eo_hPzAxeczftZG4h9M3SEPjm-ACtrKzfdtHj_CRiqCCenM3KkIy6vyx/exec';

let allTasks = [];
let responsables = [];
let adminSummary = null;
let adminMode = false;
let selectedTask = null;

const els = {
  configPanel: document.getElementById('configPanel'),
  scriptUrl: document.getElementById('scriptUrl'),
  saveConfig: document.getElementById('saveConfig'),
  btnBoardPdf: document.getElementById('btnBoardPdf'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnAdmin: document.getElementById('btnAdmin'),
  publicView: document.getElementById('publicView'),
  adminView: document.getElementById('adminView'),
  adminPanel: document.getElementById('adminPanel'),
  filterText: document.getElementById('filterText'),
  filterStatus: document.getElementById('filterStatus'),
  listPublic: document.getElementById('listPublic'),
  listDisponible: document.getElementById('listDisponible'),
  listFinalizada: document.getElementById('listFinalizada'),
  listControlada: document.getElementById('listControlada'),
  countDisponible: document.getElementById('countDisponible'),
  countFinalizada: document.getElementById('countFinalizada'),
  countControlada: document.getElementById('countControlada'),
  historyLink: document.getElementById('historyLink'),
  yearSummaryText: document.getElementById('yearSummaryText'),
  topResolverText: document.getElementById('topResolverText'),
  mobileSummaryBody: document.getElementById('mobileSummaryBody'),
  taskModal: document.getElementById('taskModal'),
  modalMobile: document.getElementById('modalMobile'),
  modalTitle: document.getElementById('modalTitle'),
  modalDetail: document.getElementById('modalDetail'),
  modalUser: document.getElementById('modalUser'),
  modalObs: document.getElementById('modalObs'),
  modalClose: document.getElementById('modalClose'),
  modalCancel: document.getElementById('modalCancel'),
  modalFinish: document.getElementById('modalFinish'),
  responsablesList: document.getElementById('responsablesList'),
  toast: document.getElementById('toast'),
};

init();

function init() {
  if (!localStorage.getItem(CONFIG_KEY)) localStorage.setItem(CONFIG_KEY, DEFAULT_SCRIPT_URL);
  els.scriptUrl.value = getScriptUrl();
  els.modalUser.value = localStorage.getItem(USER_KEY) || '';
  els.saveConfig.addEventListener('click', saveConfig);
  els.btnBoardPdf.addEventListener('click', downloadBoardPdf);
  els.btnRefresh.addEventListener('click', loadInitialData);
  els.btnAdmin.addEventListener('click', toggleAdmin);
  els.filterText.addEventListener('input', render);
  els.filterStatus.addEventListener('change', render);
  els.modalClose.addEventListener('click', closeTaskModal);
  els.modalCancel.addEventListener('click', closeTaskModal);
  els.modalFinish.addEventListener('click', finishSelectedTask);
  els.taskModal.addEventListener('click', event => {
    if (event.target === els.taskModal) closeTaskModal();
  });
  updateConfigVisibility();
  updateAdminVisibility();
  if (getScriptUrl()) loadInitialData();
}

function getScriptUrl() {
  return localStorage.getItem(CONFIG_KEY) || DEFAULT_SCRIPT_URL;
}

function saveConfig() {
  const url = els.scriptUrl.value.trim();
  if (!url.startsWith('https://script.google.com/')) {
    showToast('Pega una URL valida de Apps Script.');
    return;
  }
  localStorage.setItem(CONFIG_KEY, url);
  updateConfigVisibility();
  loadInitialData();
}

function updateConfigVisibility() {
  els.configPanel.classList.toggle('hidden', Boolean(getScriptUrl()));
}

function updateAdminVisibility() {
  els.publicView.classList.toggle('hidden', adminMode);
  els.adminView.classList.toggle('hidden', !adminMode);
  els.btnAdmin.textContent = adminMode ? 'Salir de admin' : 'Modo admin';
}

function toggleAdmin() {
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
  if (adminMode) loadAdminSummary();
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
  if (!data.ok) throw new Error(data.message || 'Error en la operacion.');
  return data;
}

async function loadInitialData() {
  await Promise.all([loadResponsables(), loadTasks()]);
}

async function loadResponsables() {
  try {
    const data = await api('config');
    responsables = data.responsables || [];
    els.responsablesList.innerHTML = responsables
      .map(name => `<option value="${escapeAttr(name)}"></option>`)
      .join('');
  } catch (error) {
    responsables = [];
  }
}

async function loadTasks() {
  try {
    showToast('Actualizando pizarra...');
    const data = await api('list');
    allTasks = data.tasks || [];
    render();
    if (adminMode) loadAdminSummary();
    showToast('Pizarra actualizada.');
  } catch (error) {
    showToast(error.message);
  }
}

async function loadAdminSummary() {
  try {
    adminSummary = await api('summary', { adminPass: localStorage.getItem('adminPass') || '' });
    renderAdminSummary();
  } catch (error) {
    showToast(error.message);
  }
}

function render() {
  if (adminMode) {
    renderAdmin();
  } else {
    renderPublic();
  }
}

function renderPublic() {
  const disponibles = allTasks.filter(task => task.ESTADO === 'Disponible');
  els.listPublic.innerHTML = '';
  if (!disponibles.length) {
    els.listPublic.innerHTML = '<div class="empty public-empty">No hay novedades disponibles.</div>';
    return;
  }
  disponibles.forEach(task => els.listPublic.appendChild(createPublicCard(task)));
}

function renderAdmin() {
  const text = els.filterText.value.trim().toLowerCase();
  const status = els.filterStatus.value;
  const filtered = allTasks.filter(task => {
    const blob = [
      task.ID,
      task.UBICACION,
      task.ELEMENTO,
      task.TAREA,
      task.CREADO_POR,
      task.REALIZADO_POR,
      task.CONTROLADO_POR,
      task.OBSERVACIONES
    ].join(' ').toLowerCase();
    return (!text || blob.includes(text))
      && (!status || task.ESTADO === status);
  });

  const disponibles = filtered.filter(task => task.ESTADO === 'Disponible');
  const finalizadas = filtered.filter(task => task.ESTADO === 'Finalizada');
  const controladas = filtered.filter(task => task.ESTADO === 'Controlada');

  els.countDisponible.textContent = disponibles.length;
  els.countFinalizada.textContent = finalizadas.length;
  els.countControlada.textContent = controladas.length;

  renderList(els.listDisponible, disponibles);
  renderList(els.listFinalizada, finalizadas);
  renderList(els.listControlada, controladas);
  renderAdminSummary();
}

function renderAdminSummary() {
  if (!adminSummary) {
    els.historyLink.removeAttribute('href');
    els.yearSummaryText.textContent = 'Vamos resolviendo 0 novedades reportadas en el ultimo año.';
    els.topResolverText.textContent = 'Todavia no hay suficientes novedades finalizadas para destacar a alguien.';
    els.mobileSummaryBody.innerHTML = '<tr><td colspan="2">Sin datos para mostrar.</td></tr>';
    return;
  }

  els.historyLink.href = adminSummary.pizarraUrl || adminSummary.spreadsheetUrl || '#';
  const total = Number(adminSummary.totalLastYear || 0);
  els.yearSummaryText.textContent = `Vamos resolviendo ${total} ${total === 1 ? 'novedad reportada' : 'novedades reportadas'} en el ultimo año.`;

  if (adminSummary.topResolver && adminSummary.topResolver.name) {
    els.topResolverText.textContent = `Podemos felicitar a ${displayText(adminSummary.topResolver.name)} por ser la persona que mas novedades resolvio!`;
  } else {
    els.topResolverText.textContent = 'Todavia no hay suficientes novedades finalizadas para destacar a alguien.';
  }

  const rows = adminSummary.byMobile || [];
  els.mobileSummaryBody.innerHTML = rows.length
    ? rows.map(row => `<tr><td>${escapeHtml(displayText(row.mobile || 'Sin movil'))}</td><td>${escapeHtml(row.count)}</td></tr>`).join('')
    : '<tr><td colspan="2">Sin datos para mostrar.</td></tr>';
}

function renderList(container, tasks) {
  container.innerHTML = '';
  if (!tasks.length) {
    container.innerHTML = '<div class="empty">Sin novedades para mostrar.</div>';
    return;
  }
  tasks.forEach(task => container.appendChild(createAdminCard(task)));
}

function createPublicCard(task) {
  const card = document.createElement('article');
  card.className = 'public-card';
  card.tabIndex = 0;
  card.innerHTML = `
    <div class="public-mobile">${escapeHtml(getMobileFromLocation(task.UBICACION))}</div>
    <div class="public-title">${escapeHtml(displayText(task.ELEMENTO || 'Elemento sin nombre'))}</div>
    <div class="public-novelty">${escapeHtml(getPublicNovelty(task))}</div>
  `;
  card.addEventListener('click', () => openTaskModal(task));
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openTaskModal(task);
    }
  });
  return card;
}

function createAdminCard(task) {
  const card = document.createElement('article');
  card.className = 'task-card';
  card.innerHTML = `
    <div class="task-top">
      <div><strong>#${escapeHtml(task.ID)}</strong></div>
    </div>
    <div class="task-title">${escapeHtml(getPublicNovelty(task))}</div>
    <div class="meta">
      <span><strong>Movil:</strong> ${escapeHtml(getMobileFromLocation(task.UBICACION))}</span>
      <span><strong>Ubicacion:</strong> ${escapeHtml(getPlaceFromLocation(task.UBICACION))}</span>
      <span><strong>Elemento:</strong> ${escapeHtml(displayText(task.ELEMENTO || '-'))}</span>
      <span><strong>Estado:</strong> ${escapeHtml(task.ESTADO || '-')}</span>
      <span><strong>Alta:</strong> ${escapeHtml(task.FECHA_ALTA || '-')}</span>
      ${task.CREADO_POR ? `<span><strong>Relevo:</strong> ${escapeHtml(displayText(task.CREADO_POR))}</span>` : ''}
      ${task.REALIZADO_POR ? `<span><strong>Realizado por:</strong> ${escapeHtml(displayText(task.REALIZADO_POR))}</span>` : ''}
      ${task.FECHA_REALIZADO ? `<span><strong>Fecha realizado:</strong> ${escapeHtml(task.FECHA_REALIZADO)}</span>` : ''}
      ${task.CONTROLADO_POR ? `<span><strong>Controlo:</strong> ${escapeHtml(displayText(task.CONTROLADO_POR))}</span>` : ''}
      ${task.FECHA_CONTROLADO ? `<span><strong>Fecha controlado:</strong> ${escapeHtml(task.FECHA_CONTROLADO)}</span>` : ''}
      ${task.OBSERVACIONES ? `<span><strong>Obs:</strong> ${escapeHtml(displayText(task.OBSERVACIONES))}</span>` : ''}
    </div>
    <div class="actions"></div>
  `;

  const actions = card.querySelector('.actions');
  if (task.ESTADO === 'Disponible') {
    actions.appendChild(button('Finalizar ahora', 'primary small', () => openTaskModal(task)));
  }
  if (task.ESTADO === 'Finalizada') {
    actions.appendChild(button('Marcar controlada', 'primary small', () => controlTask(task.ID)));
  }
  actions.appendChild(button('Editar admin', 'secondary small', () => toggleAdminEdit(card, task)));
  return card;
}

function openTaskModal(task) {
  selectedTask = task;
  els.modalMobile.textContent = getMobileFromLocation(task.UBICACION);
  els.modalTitle.textContent = displayText(task.ELEMENTO || 'Novedad');
  els.modalDetail.innerHTML = `
    <div><strong>Novedad:</strong> ${escapeHtml(getPublicNovelty(task))}</div>
    <div><strong>Ubicacion:</strong> ${escapeHtml(getPlaceFromLocation(task.UBICACION))}</div>
    ${task.CREADO_POR ? `<div><strong>Relevo:</strong> ${escapeHtml(displayText(task.CREADO_POR))}</div>` : ''}
    ${task.OBSERVACIONES ? `<div><strong>Observaciones:</strong> ${escapeHtml(displayText(task.OBSERVACIONES))}</div>` : ''}
    ${task.FOTOS ? `<div><a href="${escapeAttr(task.FOTOS)}" target="_blank" rel="noreferrer">Ver PDF del control</a></div>` : ''}
  `;
  els.modalUser.value = localStorage.getItem(USER_KEY) || '';
  els.modalObs.value = '';
  els.taskModal.classList.remove('hidden');
  setTimeout(() => els.modalUser.focus(), 0);
}

function closeTaskModal() {
  selectedTask = null;
  els.taskModal.classList.add('hidden');
}

async function finishSelectedTask() {
  if (!selectedTask) return;
  const user = els.modalUser.value.trim();
  if (!user) {
    showToast('Completa quien realiza la tarea.');
    els.modalUser.focus();
    return;
  }
  try {
    localStorage.setItem(USER_KEY, user);
    await api('finish', { id: selectedTask.ID, user, observaciones: els.modalObs.value.trim() });
    showToast('Novedad finalizada.');
    closeTaskModal();
    await loadTasks();
  } catch (error) {
    showToast(error.message);
  }
}

async function controlTask(id) {
  const user = prompt('Quien controla esta novedad?') || '';
  if (!user.trim()) return;
  try {
    await api('control', {
      id,
      user: user.trim(),
      adminPass: localStorage.getItem('adminPass') || ''
    });
    showToast('Novedad controlada.');
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
    <div class="field"><label>Observaciones</label><textarea class="adm-obs">${escapeHtml(task.OBSERVACIONES || '')}</textarea></div>
    <button class="btn primary small adm-save">Guardar cambios</button>
  `;
  box.querySelector('.adm-save').addEventListener('click', () => saveAdminEdit(task.ID, box));
  card.appendChild(box);
}

async function saveAdminEdit(id, box) {
  try {
    await api('adminUpdate', {
      id,
      observaciones: box.querySelector('.adm-obs').value,
      adminPass: localStorage.getItem('adminPass') || ''
    });
    showToast('Cambios guardados.');
    await loadTasks();
  } catch (error) {
    showToast(error.message);
  }
}

function button(text, className, onClick) {
  const btn = document.createElement('button');
  btn.className = `btn ${className}`;
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}

function getMobileFromLocation(location) {
  const value = displayText(location || '').trim();
  if (!value) return 'Sin movil';
  return value.split(/\s+-\s+/)[0] || value;
}

function getPlaceFromLocation(location) {
  const value = displayText(location || '').trim();
  const parts = value.split(/\s+-\s+/);
  return parts.length > 1 ? parts.slice(1).join(' - ') : value;
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
    getMobileFromLocation(task.UBICACION),
    getPlaceFromLocation(task.UBICACION),
    task.ELEMENTO || '',
    getPublicNovelty(task),
    task.CREADO_POR || '',
    task.REALIZADO_POR || '',
    task.CONTROLADO_POR || ''
  ]);

  doc.autoTable({
    startY: 34,
    head: [['ID', 'Estado', 'Movil', 'Ubicacion', 'Elemento', 'Novedad', 'Relevo', 'Realizado por', 'Controlo']],
    body: rows,
    margin: { top: 34, left: 8, right: 8 },
    styles: { fontSize: 7.5, cellPadding: 2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [5, 38, 58], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [242, 246, 248] },
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

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#039;');
}

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}
