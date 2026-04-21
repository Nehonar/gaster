// ===== UI RENDERING =====

let currentPeriod = 'month';

// ---- Toast ----
function toast(msg, type = 'success', icon = '⚔️') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

// ---- Modal ----
function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-content').innerHTML = '';
}

// ---- Confirm dialog (replaces native confirm() which breaks on mobile) ----
function confirmDialog(message, onConfirm, danger = false) {
  openModal(`
    <div class="modal-title">⚠️ Confirmar</div>
    <p style="font-size:15px;margin-bottom:20px;line-height:1.5">${message}</p>
    <div style="display:flex;gap:10px;justify-content:flex-end">
      <button class="btn" onclick="closeModal()" style="border:1px solid var(--border);color:var(--text-dim)">Cancelar</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok-btn">Confirmar</button>
    </div>
  `);
  document.getElementById('confirm-ok-btn').addEventListener('click', () => {
    closeModal();
    onConfirm();
  });
}

// ---- Update player card ----
function renderPlayerCard() {
  const lvl = Engine.playerLevel();
  const s = DB.get().settings;
  document.getElementById('player-level').textContent = `Nv. ${lvl.level}`;
  document.getElementById('player-class').textContent = lvl.className;
  document.getElementById('xp-bar').style.width = lvl.pct + '%';
  document.getElementById('xp-label').textContent = `${lvl.xpInLevel} / ${lvl.xpNeeded} XP`;
  document.getElementById('player-name').textContent = s.playerName || 'Aventurero';
  document.getElementById('player-avatar').textContent = s.playerAvatar || '🧙';
}

// ---- Edit player modal ----

const PLAYER_AVATARS = ['🧙','⚔️','🛡️','🏹','🗡️','🪓','🔮','💀','🌿','✨','🎵','👑','🐉','🦅','🐺'];

function openPlayerEdit() {
  const s = DB.get().settings;
  const lvl = Engine.playerLevel();
  openModal(`
    <div class="modal-title">🧙 Editar Personaje</div>
    <form class="rpg-form" onsubmit="savePlayerEdit(event)">
      <div class="form-group">
        <label>Nombre del Aventurero</label>
        <input name="playerName" value="${s.playerName || ''}" placeholder="Tu nombre" maxlength="30" required>
      </div>
      <div class="form-group">
        <label>Lo que eres (aparece al lado del nivel)</label>
        <input name="playerClass" value="${s.playerClass || ''}" placeholder="${lvl.autoClass}" maxlength="30">
        <div style="font-size:11px;color:var(--text-dim);margin-top:4px">
          Déjalo vacío para que cambie solo según tu nivel
        </div>
      </div>
      <div class="form-group">
        <label>Avatar</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
          ${PLAYER_AVATARS.map(a => `
            <label style="cursor:pointer">
              <input type="radio" name="playerAvatar" value="${a}" ${(s.playerAvatar || '🧙') === a ? 'checked' : ''} style="display:none">
              <span class="avatar-opt" style="font-size:26px;padding:6px 8px;border-radius:8px;border:2px solid ${(s.playerAvatar || '🧙') === a ? 'var(--gold)' : 'var(--border)'};display:inline-block;transition:border-color 0.15s">${a}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <button type="submit" class="btn btn-primary">💾 Guardar</button>
    </form>
  `);

  // Highlight selected avatar on click
  document.querySelectorAll('input[name="playerAvatar"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.avatar-opt').forEach(s => s.style.borderColor = 'var(--border)');
      radio.nextElementSibling.style.borderColor = 'var(--gold)';
    });
  });
}

function savePlayerEdit(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  DB.updateItem && DB.get().settings;
  const data = DB.get();
  data.settings.playerName = fd.get('playerName').trim() || 'Aventurero';
  data.settings.playerClass = fd.get('playerClass');
  data.settings.playerAvatar = fd.get('playerAvatar') || '🧙';
  DB.save();
  toast('Personaje actualizado ✨', 'success');
  closeModal();
  refresh();
}

// ---- Top bar balance ----
function renderTopBalance() {
  const savings = Engine.savingsMonthly();
  const el = document.getElementById('top-balance');
  el.textContent = fmt(savings, Engine.currency) + ' / mes';
  el.style.color = savings >= 0 ? 'var(--green)' : 'var(--red)';
}

// ---- Progress bar HTML ----
function progressBar(pct, color = 'green', height = 10) {
  const capped = Math.min(pct, 100);
  return `<div class="bar-container" style="height:${height}px">
    <div class="bar-fill ${color}" style="width:${capped}%"></div>
  </div>`;
}

// ===================== DASHBOARD =====================
function renderDashboard() {
  const d = DB.get();
  const inc = Engine.totalIncomeMonthly();
  const exp = Engine.totalExpenseMonthly();
  const sav = Engine.savingsMonthly();
  const weekly = Engine.savingsWeekly();
  const daily = Engine.savingsDaily();

  const realInc = Engine.realIncomeInPeriod(currentPeriod);
  const realExp = Engine.realExpenseInPeriod(currentPeriod);
  const realSav = Engine.realSavingsInPeriod(currentPeriod);

  const budgets = Engine.budgetStatus();
  const goals = d.goals.filter(g => g.active).slice(0, 3);

  const periodLabel = { month: 'este mes', week: 'esta semana', year: 'este año' }[currentPeriod];

  return `
<div class="dashboard-grid">
  <div class="section-header">
    <h2 class="section-title">🗺️ Mapa del Reino</h2>
  </div>

  <!-- PLANNED STATS -->
  <div>
    <div class="card-title">⚔️ Planificado (mensual)</div>
    <div class="stat-cards">
      <div class="stat-card income">
        <div class="stat-icon">💰</div>
        <div class="stat-label">Ingresos</div>
        <div class="stat-value">${fmt(inc, Engine.currency)}</div>
        <div class="card-sub">/ mes</div>
      </div>
      <div class="stat-card expense">
        <div class="stat-icon">🗡️</div>
        <div class="stat-label">Gastos</div>
        <div class="stat-value">${fmt(exp, Engine.currency)}</div>
        <div class="card-sub">/ mes</div>
      </div>
      <div class="stat-card savings">
        <div class="stat-icon">🏆</div>
        <div class="stat-label">Ahorro</div>
        <div class="stat-value ${sav >= 0 ? 'text-green' : 'text-red'}">${fmt(sav, Engine.currency)}</div>
        <div class="card-sub">/ mes</div>
      </div>
      <div class="stat-card weekly">
        <div class="stat-icon">📅</div>
        <div class="stat-label">Margen semanal</div>
        <div class="stat-value">${fmt(weekly, Engine.currency)}</div>
        <div class="card-sub">/ semana</div>
      </div>
      <div class="stat-card daily">
        <div class="stat-icon">☀️</div>
        <div class="stat-label">Margen diario</div>
        <div class="stat-value">${fmt(daily, Engine.currency)}</div>
        <div class="card-sub">/ día</div>
      </div>
    </div>
  </div>

  <!-- REAL STATS -->
  <div>
    <div class="card-title">📜 Real (${periodLabel})</div>
    <div class="stat-cards">
      <div class="stat-card income">
        <div class="stat-icon">💰</div>
        <div class="stat-label">Ingresos reales</div>
        <div class="stat-value">${fmt(realInc, Engine.currency)}</div>
      </div>
      <div class="stat-card expense">
        <div class="stat-icon">🗡️</div>
        <div class="stat-label">Gastos reales</div>
        <div class="stat-value">${fmt(realExp, Engine.currency)}</div>
      </div>
      <div class="stat-card ${realSav >= 0 ? 'savings' : 'expense'}">
        <div class="stat-icon">${realSav >= 0 ? '✨' : '💀'}</div>
        <div class="stat-label">Balance real</div>
        <div class="stat-value ${realSav >= 0 ? 'text-green' : 'text-red'}">${fmt(realSav, Engine.currency)}</div>
      </div>
    </div>
  </div>

  <!-- BUDGET OVERVIEW -->
  ${budgets.length ? `
  <div>
    <div class="flex justify-between items-center mb-12">
      <div class="card-title">🛡️ Escudos de Presupuesto</div>
      <button class="btn btn-sm" onclick="navigate('budgets')">Ver todos</button>
    </div>
    <div class="budget-list">
      ${budgets.map(b => `
        <div class="budget-item">
          <div class="budget-header">
            <div class="budget-name">${b.catIcon} ${b.catLabel}</div>
            <span class="budget-status ${b.status}">
              ${b.status === 'ok' ? '✅ OK' : b.status === 'warn' ? '⚠️ Cerca' : '💀 Excedido'}
            </span>
          </div>
          ${progressBar(b.overPct, b.status === 'ok' ? 'green' : b.status === 'warn' ? 'yellow' : 'red')}
          <div class="bar-label">
            <span>${fmtShort(b.spent, Engine.currency)} gastado</span>
            <span>${fmtShort(b.objective, Engine.currency)} obj.</span>
          </div>
        </div>
      `).join('')}
    </div>
  </div>
  ` : ''}

  <!-- GOALS OVERVIEW -->
  ${goals.length ? `
  <div>
    <div class="flex justify-between items-center mb-12">
      <div class="card-title">🏆 Misiones Activas</div>
      <button class="btn btn-sm" onclick="navigate('goals')">Ver todas</button>
    </div>
    <div class="goals-list">
      ${goals.map(g => {
        const prog = Engine.goalProgress(g);
        return `
        <div class="goal-card" style="--goal-width:${prog.pct.toFixed(0)}%">
          <div style="position:absolute;bottom:0;left:0;height:2px;width:${prog.pct.toFixed(0)}%;background:${g.color || 'var(--gold)'};transition:width 0.5s"></div>
          <div class="goal-icon">${g.icon || '🎯'}</div>
          <div class="goal-name">${g.name}</div>
          <div class="goal-amounts">${fmt(prog.total, Engine.currency)} / ${fmt(g.targetAmount, Engine.currency)}</div>
          ${progressBar(prog.pct, 'gold')}
          <div class="goal-pct">${prog.pct.toFixed(0)}%</div>
          ${prog.monthsLeft ? `<div class="card-sub">~${prog.monthsLeft} meses al ritmo actual</div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>
  ` : ''}
</div>`;
}

// ===================== INCOMES =====================
function renderIncomes() {
  const incomes = DB.get().incomes;
  const total = Engine.totalIncomeMonthly();

  return `
<div class="section-header">
  <h2 class="section-title">💰 Tesoro</h2>
  <button class="btn btn-success" onclick="openIncomeForm()">+ Nuevo Ingreso</button>
</div>
<div class="card mb-16" style="display:flex;gap:20px;flex-wrap:wrap">
  <div><div class="stat-label">Total mensual</div><div class="stat-value text-green">${fmt(total, Engine.currency)}</div></div>
  <div><div class="stat-label">Fuentes activas</div><div class="stat-value">${incomes.filter(i=>i.active!==false).length}</div></div>
</div>
${incomes.length === 0 ? `
  <div class="empty-state">
    <div class="empty-icon">💰</div>
    <h3>Sin fuentes de ingresos</h3>
    <p>Añade tu sueldo u otros ingresos para empezar a planificar</p>
  </div>
` : `
<div class="card table-scroll">
  <table class="rpg-table">
    <thead><tr>
      <th>Nombre</th><th>Cantidad</th><th class="col-hide-mobile">Frecuencia</th>
      <th class="col-hide-mobile">Tipo</th><th class="col-hide-mobile">Categoría</th><th>Estado</th><th>Acciones</th>
    </tr></thead>
    <tbody>
      ${incomes.map(i => {
        const cat = CATEGORIES[i.category] || CATEGORIES.other;
        return `<tr>
          <td><strong>${i.name}</strong></td>
          <td><span class="chip chip-income">+${fmt(i.amount, Engine.currency)}</span></td>
          <td class="col-hide-mobile">${FREQ_LABELS[i.frequency] || i.frequency}</td>
          <td class="col-hide-mobile"><span class="badge badge-${i.type}">${i.type === 'recurring' ? 'Recurrente' : 'Extra'}</span></td>
          <td class="col-hide-mobile">${cat.icon} ${cat.label}</td>
          <td>
            <label class="toggle">
              <input type="checkbox" ${i.active !== false ? 'checked' : ''} onchange="toggleItem('incomes','${i.id}',this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </td>
          <td style="display:flex;gap:6px">
            <button class="btn btn-sm btn-primary btn-icon" onclick="openIncomeForm('${i.id}')">✏️</button>
            <button class="btn btn-sm btn-danger btn-icon" onclick="deleteItem('incomes','${i.id}')">🗑️</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>`}`;
}

// ===================== EXPENSES =====================
function renderExpenses() {
  const expenses = DB.get().expenses;
  const total = Engine.totalExpenseMonthly();

  return `
<div class="section-header">
  <h2 class="section-title">🗡️ Gastos de Guerra</h2>
  <button class="btn btn-danger" onclick="openExpenseForm()">+ Nuevo Gasto</button>
</div>
<div class="card mb-16" style="display:flex;gap:20px;flex-wrap:wrap">
  <div><div class="stat-label">Total mensual</div><div class="stat-value text-red">${fmt(total, Engine.currency)}</div></div>
  <div><div class="stat-label">Gastos activos</div><div class="stat-value">${expenses.filter(e=>e.active!==false).length}</div></div>
</div>
${expenses.length === 0 ? `
  <div class="empty-state">
    <div class="empty-icon">🗡️</div>
    <h3>Sin gastos registrados</h3>
    <p>Añade tus gastos fijos para ver el balance real</p>
  </div>
` : `
<div class="card table-scroll">
  <table class="rpg-table">
    <thead><tr>
      <th>Nombre</th><th>Cantidad</th><th class="col-hide-mobile">Frecuencia</th>
      <th class="col-hide-mobile">Tipo</th><th class="col-hide-mobile">Categoría</th><th class="col-hide-mobile">Obligatorio</th><th>Estado</th><th>Acciones</th>
    </tr></thead>
    <tbody>
      ${expenses.map(e => {
        const cat = CATEGORIES[e.category] || CATEGORIES.other;
        return `<tr>
          <td><strong>${e.name}</strong></td>
          <td><span class="chip chip-expense">-${fmt(e.amount, Engine.currency)}</span></td>
          <td class="col-hide-mobile">${FREQ_LABELS[e.frequency] || e.frequency}</td>
          <td class="col-hide-mobile"><span class="badge badge-${e.type}">${e.type === 'recurring' ? 'Recurrente' : e.type === 'planned' ? 'Planificado' : 'Extra'}</span></td>
          <td class="col-hide-mobile">${cat.icon} ${cat.label}</td>
          <td class="col-hide-mobile" style="text-align:center">${e.mandatory ? '🔴' : '⚪'}</td>
          <td>
            <label class="toggle">
              <input type="checkbox" ${e.active !== false ? 'checked' : ''} onchange="toggleItem('expenses','${e.id}',this.checked)">
              <span class="toggle-slider"></span>
            </label>
          </td>
          <td style="display:flex;gap:6px">
            <button class="btn btn-sm btn-primary btn-icon" onclick="openExpenseForm('${e.id}')">✏️</button>
            <button class="btn btn-sm btn-danger btn-icon" onclick="deleteItem('expenses','${e.id}')">🗑️</button>
          </td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
</div>`}`;
}

// ===================== TRANSACTIONS =====================
function renderTransactions() {
  const txs = DB.get().transactions.slice().sort((a,b) => b.date.localeCompare(a.date));

  return `
<div class="section-header">
  <h2 class="section-title">📜 Crónica de Batalla</h2>
  <div style="display:flex;gap:8px">
    <button class="btn btn-success btn-sm" onclick="openTxForm('income')">+ Ingreso</button>
    <button class="btn btn-danger btn-sm" onclick="openTxForm('expense')">+ Gasto</button>
  </div>
</div>
${txs.length === 0 ? `
  <div class="empty-state">
    <div class="empty-icon">📜</div>
    <h3>Sin movimientos</h3>
    <p>Registra tus ingresos y gastos reales</p>
  </div>
` : `
<div class="tx-list">
  ${txs.map(tx => {
    const cat = CATEGORIES[tx.category] || CATEGORIES.other;
    return `
    <div class="tx-item">
      <div class="tx-icon">${cat.icon}</div>
      <div class="tx-info">
        <div class="tx-name">${tx.note || cat.label}${tx.isExtra ? ' <span class="badge badge-extra">Extra</span>' : ''}</div>
        <div class="tx-meta">${cat.label} · ${tx.date}</div>
      </div>
      <div class="tx-amount ${tx.kind}">${tx.kind === 'income' ? '+' : '-'}${fmt(tx.amount, Engine.currency)}</div>
      <button class="btn btn-sm btn-danger btn-icon" onclick="deleteItem('transactions','${tx.id}')">🗑️</button>
    </div>`;
  }).join('')}
</div>`}`;
}

// ===================== BUDGETS =====================
function renderBudgets() {
  const budgets = Engine.budgetStatus();

  return `
<div class="section-header">
  <h2 class="section-title">🛡️ Escudos de Presupuesto</h2>
  <button class="btn btn-primary" onclick="openBudgetForm()">+ Nuevo Presupuesto</button>
</div>
${budgets.length === 0 ? `
  <div class="empty-state">
    <div class="empty-icon">🛡️</div>
    <h3>Sin presupuestos</h3>
    <p>Define objetivos por categoría para controlar tus gastos</p>
  </div>
` : `
<div class="budget-list">
  ${budgets.map(b => `
    <div class="budget-item">
      <div class="budget-header">
        <div class="budget-name">${b.catIcon} ${b.catLabel}
          <span class="text-dim" style="font-size:11px;font-weight:normal">
            · ${fmtShort(b.amount, Engine.currency)} / ${FREQ_LABELS[b.frequency]}
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="budget-status ${b.status}">
            ${b.status === 'ok' ? '✅ Bajo control' : b.status === 'warn' ? '⚠️ Cerca del límite' : '💀 ¡Excedido!'}
          </span>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteItem('budgets','${b.id}')">🗑️</button>
        </div>
      </div>
      ${progressBar(b.overPct, b.status === 'ok' ? 'green' : b.status === 'warn' ? 'yellow' : 'red', 12)}
      <div class="bar-label">
        <span>Gastado: <strong>${fmt(b.spent, Engine.currency)}</strong></span>
        <span>Objetivo: <strong>${fmt(b.objective, Engine.currency)}</strong></span>
      </div>
      <div class="mt-8 text-dim" style="font-size:12px">
        ${b.diff >= 0
          ? `<span class="text-green">✅ Te quedan ${fmt(b.diff, Engine.currency)}</span>`
          : `<span class="text-red">💀 Te has pasado ${fmt(Math.abs(b.diff), Engine.currency)}</span>`}
      </div>
    </div>
  `).join('')}
</div>`}`;
}

// ===================== GOALS =====================
function renderGoals() {
  const goals = DB.get().goals;

  return `
<div class="section-header">
  <h2 class="section-title">🏆 Misiones de Ahorro</h2>
  <button class="btn btn-gold" onclick="openGoalForm()">+ Nueva Misión</button>
</div>
${goals.length === 0 ? `
  <div class="empty-state">
    <div class="empty-icon">🏆</div>
    <h3>Sin misiones</h3>
    <p>Crea tu primera meta de ahorro y empieza a ganar XP</p>
  </div>
` : `
<div class="goals-list">
  ${goals.map(g => {
    const prog = Engine.goalProgress(g);
    const completed = prog.pct >= 100;
    return `
    <div class="goal-card ${completed ? 'completed' : ''}">
      <div style="position:absolute;bottom:0;left:0;height:3px;width:${prog.pct.toFixed(0)}%;background:${g.color || 'var(--gold)'};transition:width 0.5s"></div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div class="goal-icon">${g.icon || '🎯'}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-gold" onclick="openContribForm('${g.id}')">+ Aportar</button>
          <button class="btn btn-sm btn-danger btn-icon" onclick="deleteItem('goals','${g.id}')">🗑️</button>
        </div>
      </div>
      <div class="goal-name">${completed ? '✅ ' : ''}${g.name}</div>
      <div class="goal-amounts">
        <span class="text-gold font-cinzel" style="font-size:16px">${fmt(prog.total, Engine.currency)}</span>
        <span class="text-dim"> / ${fmt(g.targetAmount, Engine.currency)}</span>
      </div>
      ${progressBar(prog.pct, 'gold', 12)}
      <div class="flex justify-between mt-8">
        <span class="text-dim" style="font-size:12px">Faltan: ${fmt(prog.remaining, Engine.currency)}</span>
        <span class="goal-pct">${prog.pct.toFixed(0)}%</span>
      </div>
      ${prog.monthsLeft ? `<div class="card-sub mt-8">⏳ ~${prog.monthsLeft} meses al ritmo actual</div>` : ''}
      ${g.deadline ? `<div class="card-sub mt-8">📅 Fecha límite: ${g.deadline}</div>` : ''}
      ${prog.contribs.length ? `
        <div class="divider"></div>
        <div class="card-title" style="font-size:10px">Últimas aportaciones</div>
        <div class="contrib-list">
          ${prog.contribs.slice(-3).reverse().map(c => `
            <div class="contrib-item">
              <span class="text-gold">+${fmt(c.amount, Engine.currency)}</span>
              <span class="text-dim">${c.date}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>`;
  }).join('')}
</div>`}`;
}

// ===================== ACHIEVEMENTS =====================
function renderAchievements() {
  const achs = Engine.allAchievements();
  const unlocked = achs.filter(a => a.unlocked).length;

  return `
<div class="section-header">
  <h2 class="section-title">🎖️ Logros</h2>
  <span class="text-dim">${unlocked} / ${achs.length} desbloqueados</span>
</div>
<div class="achievements-grid">
  ${achs.map(a => `
    <div class="achievement-card ${a.unlocked ? 'unlocked' : ''}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-name">${a.name}</div>
      <div class="ach-desc">${a.desc}</div>
      ${a.unlocked ? `<div class="ach-unlocked">✅ ${a.unlockedAt ? new Date(a.unlockedAt).toLocaleDateString('es') : 'Desbloqueado'}</div>` : '<div class="ach-desc" style="margin-top:4px">🔒 Bloqueado</div>'}
    </div>
  `).join('')}
</div>`;
}

// ===================== BACKUP =====================
function renderBackup() {
  return `
<div class="section-header">
  <h2 class="section-title">💾 Pergamino Mágico</h2>
</div>
<div class="card mb-16">
  <div class="card-title">📤 Exportar datos</div>
  <p style="font-size:13px;color:var(--text-dim);margin-bottom:12px">
    Descarga todos tus datos como un fichero JSON. Puedes usarlo como backup o para transferirlos a otro dispositivo.
  </p>
  <button class="btn btn-primary" onclick="exportData()">📤 Exportar JSON</button>
</div>
<div class="card mb-16">
  <div class="card-title">📥 Importar datos</div>
  <p style="font-size:13px;color:var(--text-dim);margin-bottom:12px">
    Carga un fichero JSON exportado previamente. Esto <strong style="color:var(--red)">reemplazará</strong> todos los datos actuales.
  </p>
  <input type="file" id="import-file" accept=".json" style="display:none" onchange="importData(event)">
  <button class="btn btn-gold" onclick="document.getElementById('import-file').click()">📥 Importar JSON</button>
</div>
<div class="card">
  <div class="card-title" style="color:var(--red)">⚠️ Zona Peligrosa</div>
  <p style="font-size:13px;color:var(--text-dim);margin-bottom:12px">
    Resetea todos los datos y vuelve al estado inicial con datos de demostración.
  </p>
  <button class="btn btn-danger" onclick="resetData()">🔥 Resetear todo</button>
</div>`;
}

// ===================== FORMS =====================
function openIncomeForm(id) {
  const item = id ? DB.get().incomes.find(i => i.id === id) : null;
  const title = item ? 'Editar Ingreso' : 'Nuevo Ingreso';

  openModal(`
<div class="modal-title">💰 ${title}</div>
<form class="rpg-form" onsubmit="saveIncome(event, ${id ? `'${id}'` : 'null'})">
  <div class="form-row">
    <div class="form-group">
      <label>Nombre</label>
      <input name="name" value="${item?.name || ''}" required placeholder="Sueldo, alquiler...">
    </div>
    <div class="form-group">
      <label>Cantidad (€)</label>
      <input name="amount" type="number" step="0.01" min="0" value="${item?.amount || ''}" required placeholder="0.00">
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>Frecuencia</label>
      <select name="frequency">
        ${['weekly','monthly','yearly','once'].map(f => `<option value="${f}" ${item?.frequency === f ? 'selected' : ''}>${FREQ_LABELS[f]}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Tipo</label>
      <select name="type">
        <option value="recurring" ${item?.type === 'recurring' || !item ? 'selected' : ''}>Recurrente</option>
        <option value="extra" ${item?.type === 'extra' ? 'selected' : ''}>Extra</option>
      </select>
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>Categoría</label>
      <select name="category">
        ${Object.entries(CATEGORIES).map(([k,v]) => `<option value="${k}" ${item?.category === k ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Fecha inicio</label>
      <input name="startDate" type="date" value="${item?.startDate || new Date().toISOString().split('T')[0]}">
    </div>
  </div>
  <button type="submit" class="btn btn-success">💾 Guardar</button>
</form>`);
}

function saveIncome(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const item = {
    name: fd.get('name'),
    amount: parseFloat(fd.get('amount')),
    frequency: fd.get('frequency'),
    type: fd.get('type'),
    category: fd.get('category'),
    startDate: fd.get('startDate'),
    active: true
  };
  if (id) {
    DB.updateItem('incomes', id, item);
    toast('Ingreso actualizado ✨', 'success');
  } else {
    DB.addItem('incomes', item);
    toast('¡Nuevo ingreso añadido! 💰', 'success');
  }
  closeModal();
  refresh();
}

function openExpenseForm(id) {
  const item = id ? DB.get().expenses.find(e => e.id === id) : null;
  const title = item ? 'Editar Gasto' : 'Nuevo Gasto';

  openModal(`
<div class="modal-title">🗡️ ${title}</div>
<form class="rpg-form" onsubmit="saveExpense(event, ${id ? `'${id}'` : 'null'})">
  <div class="form-row">
    <div class="form-group">
      <label>Nombre</label>
      <input name="name" value="${item?.name || ''}" required placeholder="Hipoteca, luz...">
    </div>
    <div class="form-group">
      <label>Cantidad (€)</label>
      <input name="amount" type="number" step="0.01" min="0" value="${item?.amount || ''}" required placeholder="0.00">
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>Frecuencia</label>
      <select name="frequency">
        ${['weekly','monthly','yearly','once'].map(f => `<option value="${f}" ${item?.frequency === f ? 'selected' : ''}>${FREQ_LABELS[f]}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Tipo</label>
      <select name="type">
        <option value="recurring" ${item?.type==='recurring'||!item?'selected':''}>Recurrente</option>
        <option value="planned" ${item?.type==='planned'?'selected':''}>Planificado</option>
        <option value="extra" ${item?.type==='extra'?'selected':''}>Extra</option>
      </select>
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>Categoría</label>
      <select name="category">
        ${Object.entries(CATEGORIES).map(([k,v]) => `<option value="${k}" ${item?.category===k?'selected':''}>${v.icon} ${v.label}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Fecha inicio</label>
      <input name="startDate" type="date" value="${item?.startDate || new Date().toISOString().split('T')[0]}">
    </div>
  </div>
  <div class="form-group">
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
      <input type="checkbox" name="mandatory" ${item?.mandatory?'checked':''} style="width:auto">
      Gasto obligatorio
    </label>
  </div>
  <button type="submit" class="btn btn-danger">💾 Guardar</button>
</form>`);
}

function saveExpense(e, id) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const item = {
    name: fd.get('name'),
    amount: parseFloat(fd.get('amount')),
    frequency: fd.get('frequency'),
    type: fd.get('type'),
    category: fd.get('category'),
    startDate: fd.get('startDate'),
    mandatory: fd.get('mandatory') === 'on',
    active: true
  };
  if (id) {
    DB.updateItem('expenses', id, item);
    toast('Gasto actualizado', 'success');
  } else {
    DB.addItem('expenses', item);
    toast('¡Nuevo gasto añadido! 🗡️', 'success');
  }
  closeModal();
  refresh();
}

function openTxForm(defaultKind) {
  const today = new Date().toISOString().split('T')[0];
  openModal(`
<div class="modal-title">📜 Registrar Movimiento</div>
<form class="rpg-form" onsubmit="saveTx(event)">
  <div class="form-row">
    <div class="form-group">
      <label>Tipo</label>
      <select name="kind">
        <option value="expense" ${defaultKind==='expense'?'selected':''}>🗡️ Gasto</option>
        <option value="income" ${defaultKind==='income'?'selected':''}>💰 Ingreso</option>
      </select>
    </div>
    <div class="form-group">
      <label>Cantidad (€)</label>
      <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00">
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>Categoría</label>
      <select name="category">
        ${Object.entries(CATEGORIES).map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Fecha</label>
      <input name="date" type="date" value="${today}" required>
    </div>
  </div>
  <div class="form-group full">
    <label>Nota (opcional)</label>
    <input name="note" placeholder="Supermercado, gasolina...">
  </div>
  <div class="form-group">
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
      <input type="checkbox" name="isExtra" style="width:auto">
      Movimiento extra (no habitual)
    </label>
  </div>
  <button type="submit" class="btn btn-primary">⚔️ Registrar</button>
</form>`);
}

function saveTx(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const item = {
    kind: fd.get('kind'),
    amount: parseFloat(fd.get('amount')),
    category: fd.get('category'),
    date: fd.get('date'),
    note: fd.get('note') || '',
    isExtra: fd.get('isExtra') === 'on'
  };
  DB.addItem('transactions', item);
  const { newlyUnlocked } = Engine.checkAchievements();
  newlyUnlocked.forEach(a => toast(`🎖️ ¡Logro desbloqueado! "${a.name}"`, 'achievement', a.icon));
  toast(`${item.kind === 'income' ? '💰 Ingreso' : '🗡️ Gasto'} registrado`, 'success');
  closeModal();
  refresh();
}

function openBudgetForm() {
  openModal(`
<div class="modal-title">🛡️ Nuevo Presupuesto</div>
<form class="rpg-form" onsubmit="saveBudget(event)">
  <div class="form-row">
    <div class="form-group">
      <label>Categoría</label>
      <select name="category">
        ${Object.entries(CATEGORIES).filter(([k]) => k !== 'salary').map(([k,v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Objetivo (€)</label>
      <input name="amount" type="number" step="0.01" min="0" required placeholder="0.00">
    </div>
  </div>
  <div class="form-group">
    <label>Frecuencia del objetivo</label>
    <select name="frequency">
      ${['weekly','monthly','yearly'].map(f => `<option value="${f}">${FREQ_LABELS[f]}</option>`).join('')}
    </select>
  </div>
  <button type="submit" class="btn btn-primary">🛡️ Crear Escudo</button>
</form>`);
}

function saveBudget(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const cat = fd.get('category');
  const catData = CATEGORIES[cat] || CATEGORIES.other;
  DB.addItem('budgets', {
    category: cat,
    amount: parseFloat(fd.get('amount')),
    frequency: fd.get('frequency'),
    icon: catData.icon
  });
  const { newlyUnlocked } = Engine.checkAchievements();
  newlyUnlocked.forEach(a => toast(`🎖️ ¡Logro desbloqueado! "${a.name}"`, 'achievement', a.icon));
  toast('¡Escudo creado! 🛡️', 'success');
  closeModal();
  refresh();
}

function openGoalForm() {
  openModal(`
<div class="modal-title">🏆 Nueva Misión de Ahorro</div>
<form class="rpg-form" onsubmit="saveGoal(event)">
  <div class="form-row">
    <div class="form-group">
      <label>Nombre de la misión</label>
      <input name="name" required placeholder="Viaje, fondo de emergencia...">
    </div>
    <div class="form-group">
      <label>Objetivo (€)</label>
      <input name="target" type="number" step="0.01" min="1" required placeholder="0.00">
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label>Icono</label>
      <input name="icon" placeholder="🏆" maxlength="4" value="🎯">
    </div>
    <div class="form-group">
      <label>Fecha límite (opcional)</label>
      <input name="deadline" type="date">
    </div>
  </div>
  <div class="form-group">
    <label>Cantidad inicial (€)</label>
    <input name="initial" type="number" step="0.01" min="0" placeholder="0.00" value="0">
  </div>
  <button type="submit" class="btn btn-gold">🏆 Crear Misión</button>
</form>`);
}

function saveGoal(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  DB.addItem('goals', {
    name: fd.get('name'),
    targetAmount: parseFloat(fd.get('target')),
    currentAmount: parseFloat(fd.get('initial') || 0),
    deadline: fd.get('deadline') || null,
    icon: fd.get('icon') || '🎯',
    active: true
  });
  const { newlyUnlocked } = Engine.checkAchievements();
  newlyUnlocked.forEach(a => toast(`🎖️ ¡Logro desbloqueado! "${a.name}"`, 'achievement', a.icon));
  toast('¡Misión creada! 🏆', 'success');
  closeModal();
  refresh();
}

function openContribForm(goalId) {
  const goal = DB.get().goals.find(g => g.id === goalId);
  const today = new Date().toISOString().split('T')[0];

  openModal(`
<div class="modal-title">💰 Aportar a: ${goal.name}</div>
<form class="rpg-form" onsubmit="saveContrib(event,'${goalId}')">
  <div class="form-row">
    <div class="form-group">
      <label>Cantidad (€)</label>
      <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00">
    </div>
    <div class="form-group">
      <label>Fecha</label>
      <input name="date" type="date" value="${today}">
    </div>
  </div>
  <div class="form-group">
    <label>Tipo de aportación</label>
    <select name="source">
      <option value="manual">Manual</option>
      <option value="rounding">Redondeo</option>
      <option value="weekly_surplus">Sobrante semanal</option>
      <option value="extra_income">Ingreso extra</option>
      <option value="sale">Venta</option>
      <option value="saving">Ahorro por no gastar</option>
    </select>
  </div>
  <div class="form-group">
    <label>Nota (opcional)</label>
    <input name="note" placeholder="">
  </div>
  <button type="submit" class="btn btn-gold">⚔️ Aportar</button>
</form>`);
}

function saveContrib(e, goalId) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const amount = parseFloat(fd.get('amount'));
  DB.addItem('goalContributions', {
    goalId,
    amount,
    date: fd.get('date'),
    source: fd.get('source'),
    note: fd.get('note') || ''
  });
  const { newlyUnlocked } = Engine.checkAchievements();
  newlyUnlocked.forEach(a => toast(`🎖️ ¡Logro desbloqueado! "${a.name}"`, 'achievement', a.icon));
  toast(`+${fmt(amount, Engine.currency)} aportados a la misión ✨`, 'success');
  closeModal();
  refresh();
}
