// ===== MAIN APP =====

let currentView = 'dashboard';

function navigate(view) {
  currentView = view;

  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  refresh();
}

function refresh() {
  Engine.init(DB.get());
  renderPlayerCard();
  renderTopBalance();

  const container = document.getElementById('view-container');
  switch (currentView) {
    case 'dashboard':    container.innerHTML = renderDashboard(); break;
    case 'incomes':      container.innerHTML = renderIncomes(); break;
    case 'expenses':     container.innerHTML = renderExpenses(); break;
    case 'transactions': container.innerHTML = renderTransactions(); break;
    case 'budgets':      container.innerHTML = renderBudgets(); break;
    case 'goals':        container.innerHTML = renderGoals(); break;
    case 'achievements': container.innerHTML = renderAchievements(); break;
    case 'backup':       container.innerHTML = renderBackup(); break;
    default:             container.innerHTML = renderDashboard();
  }
}

// ---- CRUD helpers called from HTML ----
function deleteItem(collection, id) {
  confirmDialog('¿Eliminar este elemento?', () => {
    DB.deleteItem(collection, id);
    toast('Eliminado', 'warning', '🗑️');
    refresh();
  }, true);
}

function toggleItem(collection, id, value) {
  DB.updateItem(collection, id, { active: value });
  refresh();
}

// ---- Backup actions ----
function exportData() {
  const json = DB.exportJSON();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gasterquest_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Datos exportados ✅', 'success');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      DB.importJSON(evt.target.result);
      toast('Datos importados ✅', 'success');
      refresh();
    } catch {
      toast('Error al importar el fichero', 'error', '💀');
    }
  };
  reader.readAsText(file);
}

function resetData() {
  confirmDialog('¿Resetear TODOS los datos?<br><strong style="color:var(--red)">Esta acción no se puede deshacer.</strong>', () => {
    DB.reset();
    toast('Datos reseteados 🔥', 'warning');
    refresh();
  }, true);
}

// ---- Period selector ----
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    refresh();
  });
});

// ---- Sidebar open/close ----
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-backdrop').classList.add('visible');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('visible');
}

// ---- Nav ----
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    navigate(item.dataset.view);
    closeSidebar();
  });
});

// ---- Quick action buttons ----
document.getElementById('btn-quick-expense').addEventListener('click', () => {
  closeSidebar();
  openTxForm('expense');
});
document.getElementById('btn-quick-income').addEventListener('click', () => {
  closeSidebar();
  openTxForm('income');
});

// ---- Mobile menu toggle ----
document.getElementById('menu-toggle').addEventListener('click', () => {
  const isOpen = document.getElementById('sidebar').classList.contains('open');
  isOpen ? closeSidebar() : openSidebar();
});

// ---- Backdrop closes sidebar ----
document.getElementById('sidebar-backdrop').addEventListener('click', closeSidebar);

// ---- Modal close ----
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ---- INIT ----
DB.load();
Engine.init(DB.get());
Engine.checkAchievements();
refresh();

// Dev mode indicator in console
console.log('%c⚔️ GasterQuest — Dev Mode Active', 'color:#f0c040;font-size:16px;font-weight:bold');
console.log('%cDatos en localStorage key: gasterquest_v1', 'color:#706888');
