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
  if (!confirm('¿Eliminar este elemento?')) return;
  DB.deleteItem(collection, id);
  toast('Eliminado', 'warning', '🗑️');
  refresh();
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
  if (!confirm('¿Resetear TODOS los datos? Esta acción no se puede deshacer.')) return;
  DB.reset();
  toast('Datos reseteados 🔥', 'warning');
  refresh();
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

// ---- Nav ----
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.view));
});

// ---- Quick action buttons ----
document.getElementById('btn-quick-expense').addEventListener('click', () => openTxForm('expense'));
document.getElementById('btn-quick-income').addEventListener('click', () => openTxForm('income'));

// ---- Mobile menu ----
document.getElementById('menu-toggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// Close sidebar on nav click (mobile)
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('open');
    }
  });
});

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
