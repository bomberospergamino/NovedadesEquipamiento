const CONFIG_KEY = 'novedadesEquipamientoScriptUrl';
const USER_KEY = 'novedadesEquipamientoUserName';
const ADMIN_KEY = 'novedadesEquipamientoAdmin';
const ADMIN_PASS = '1105';
const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzYiO560Az_Eo_hPzAxeczftZG4h9M3SEPjm-ACtrKzfdtHj_CRiqCCenM3KkIy6vyx/exec';

let allTasks = [];
let adminMode = localStorage.getItem(ADMIN_KEY) === 'true';

const els = {
  configPanel: document.getElementById('configPanel'),
  scriptUrl: document.getElementById('scriptUrl'),
  saveConfig: document.getElementById('saveConfig'),
  btnRefresh: document.getElementById('btnRefresh'),
  btnAdmin: document.getElementById('btnAdmin'),
  adminPanel: document.getElementById('adminPanel'),
  userName: document.getElementById('userName'),
  filterText: document.getElementById('filterText'),
  filterPriority: document.getElementById('filterPriority'),
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
  els.btnRefresh.addEventListener('click', loadTasks);
  els.btnAdmin.addEventListener('click', toggleAdmin);
  els.filterText.addEventListener('input', render);
  els.filterPriority.addEventListener('change', render);
  updateConfigVisibility();
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

function updateAdminVisibility() {
  els.adminPanel.classList.toggle('hidden', !adminMode);
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
  const text = els.filterText.value.trim().toLowerCase();
  const priority = els.filterPriority.value;
  const filtered = allTasks.filter(t => {
    const blob = `${t.ID} ${t.UBICACION} ${t.ELEMENTO} ${t.TAREA} ${t.ASIGNADO_A}`.toLowerCase();
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

function renderList(container, tasks) {
  container.innerHTML = '';
  if (!tasks.length) {
    container.innerHTML = '<div class="empty">Sin tareas para mostrar.</div>';
    return;
  }
  tasks.forEach(task => container.appendChild(createTaskCard(task)));
}

function createTaskCard(task) {
  const card = document.createElement('article');
  const prioridad = (task.PRIORIDAD || 'sin-prioridad').toLowerCase();
  const prioridadLabel = task.PRIORIDAD || 'Sin prioridad';
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
      <span><strong>Vencimiento:</strong> ${escapeHtml(task.FECHA_VENCIMIENTO || '-')}</span>
      <span><strong>Estado:</strong> ${escapeHtml(task.ESTADO || '-')}</span>
      ${task.ASIGNADO_A ? `<span><strong>Asignado a:</strong> ${escapeHtml(task.ASIGNADO_A)}</span>` : ''}
      ${task.FECHA_ASIGNACION ? `<span><strong>Asignada desde:</strong> ${escapeHtml(task.FECHA_ASIGNACION)}</span>` : ''}
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
