// ===== CALCULATION ENGINE =====

const CATEGORIES = {
  salary:        { label: 'Salario',        icon: '💰' },
  housing:       { label: 'Vivienda',       icon: '🏰' },
  food:          { label: 'Comida',         icon: '🍖' },
  transport:     { label: 'Transporte',     icon: '⚔️' },
  utilities:     { label: 'Servicios',      icon: '⚡' },
  health:        { label: 'Salud',          icon: '❤️' },
  entertainment: { label: 'Ocio',           icon: '🎭' },
  clothing:      { label: 'Ropa',           icon: '👘' },
  education:     { label: 'Educación',      icon: '📚' },
  savings:       { label: 'Ahorro',         icon: '🏆' },
  extra:         { label: 'Extra',          icon: '✨' },
  other:         { label: 'Otros',          icon: '📦' }
};

const FREQ_LABELS = {
  weekly: 'Semanal', monthly: 'Mensual',
  yearly: 'Anual', once: 'Único'
};

function toMonthly(amount, frequency) {
  switch (frequency) {
    case 'weekly':  return amount * 52 / 12;
    case 'monthly': return amount;
    case 'yearly':  return amount / 12;
    case 'once':    return amount;
    default:        return amount;
  }
}

function toWeekly(amount, frequency) {
  return toMonthly(amount, frequency) * 12 / 52;
}

function fmt(amount, currency = 'EUR') {
  const sym = currency === 'EUR' ? '€' : '$';
  const abs = Math.abs(amount);
  const str = abs >= 1000
    ? (abs / 1000).toFixed(1) + 'k'
    : abs.toFixed(2);
  return (amount < 0 ? '-' : '') + str + ' ' + sym;
}

function fmtShort(amount, currency = 'EUR') {
  const sym = currency === 'EUR' ? '€' : '$';
  return amount.toFixed(0) + ' ' + sym;
}

function getPeriodDates(period) {
  const now = new Date();
  let start, end;
  if (period === 'week') {
    const day = now.getDay() || 7;
    start = new Date(now); start.setDate(now.getDate() - day + 1); start.setHours(0,0,0,0);
    end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else { // year
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }
  return { start, end };
}

const Engine = {
  currency: 'EUR',

  init(data) {
    this.currency = data.settings?.currency || 'EUR';
    this.data = data;
  },

  // Monthly equivalents for all active incomes/expenses
  totalIncomeMonthly() {
    return this.data.incomes
      .filter(i => i.active !== false)
      .reduce((sum, i) => sum + toMonthly(i.amount, i.frequency), 0);
  },

  totalExpenseMonthly() {
    return this.data.expenses
      .filter(e => e.active !== false)
      .reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0);
  },

  savingsMonthly() {
    return this.totalIncomeMonthly() - this.totalExpenseMonthly();
  },

  savingsWeekly() { return this.savingsMonthly() * 12 / 52; },
  savingsDaily()  { return this.savingsMonthly() * 12 / 365; },

  // Real transactions for a period
  transactionsInPeriod(period) {
    const { start, end } = getPeriodDates(period);
    return this.data.transactions.filter(tx => {
      const d = new Date(tx.date);
      return d >= start && d <= end;
    });
  },

  realIncomeInPeriod(period) {
    return this.transactionsInPeriod(period)
      .filter(tx => tx.kind === 'income')
      .reduce((s, tx) => s + tx.amount, 0);
  },

  realExpenseInPeriod(period) {
    return this.transactionsInPeriod(period)
      .filter(tx => tx.kind === 'expense')
      .reduce((s, tx) => s + tx.amount, 0);
  },

  realSavingsInPeriod(period) {
    return this.realIncomeInPeriod(period) - this.realExpenseInPeriod(period);
  },

  // Liquid = all income tx - all expense tx - vault deposits + vault sales
  liquidBalance() {
    const entries = this.data.vaultEntries || [];
    const txIncome  = this.data.transactions.filter(t => t.kind === 'income').reduce((s,t) => s + t.amount, 0);
    const txExpense = this.data.transactions.filter(t => t.kind === 'expense').reduce((s,t) => s + t.amount, 0);
    const deposits  = entries.filter(e => e.type === 'deposit').reduce((s,e) => s + e.amount, 0);
    const sales     = entries.filter(e => e.type === 'sale').reduce((s,e) => s + e.amount, 0);
    return txIncome - txExpense - deposits + sales;
  },

  // Balance of a single vault: deposits + generated - sold
  vaultBalance(vaultId) {
    const entries   = (this.data.vaultEntries || []).filter(e => e.vaultId === vaultId);
    const deposited = entries.filter(e => e.type === 'deposit').reduce((s,e) => s + e.amount, 0);
    const generated = entries.filter(e => e.type === 'generated').reduce((s,e) => s + e.amount, 0);
    const sold      = entries.filter(e => e.type === 'sale').reduce((s,e) => s + e.amount, 0);
    return { balance: deposited + generated - sold, deposited, generated, sold };
  },

  totalVaultsBalance() {
    return (this.data.vaults || [])
      .filter(v => v.active !== false)
      .reduce((s,v) => s + this.vaultBalance(v.id).balance, 0);
  },

  totalWealth() {
    return this.liquidBalance() + this.totalVaultsBalance();
  },

  // Budget status per category
  budgetStatus() {
    const period = 'month';
    const txs = this.transactionsInPeriod(period);

    return this.data.budgets.map(b => {
      const objective = toMonthly(b.amount, b.frequency);
      const spent = txs
        .filter(tx => tx.kind === 'expense' && tx.category === b.category)
        .reduce((s, tx) => s + tx.amount, 0);
      const diff = objective - spent;
      const pct = objective > 0 ? Math.min((spent / objective) * 100, 100) : 0;
      const overPct = objective > 0 ? (spent / objective) * 100 : 0;

      let status = 'ok';
      if (overPct >= 100) status = 'over';
      else if (overPct >= 80) status = 'warn';

      const cat = CATEGORIES[b.category] || CATEGORIES.other;
      return { ...b, objective, spent, diff, pct, overPct, status, catLabel: cat.label, catIcon: b.icon || cat.icon };
    });
  },

  // Goal progress
  goalProgress(goal) {
    const contribs = this.data.goalContributions.filter(c => c.goalId === goal.id);
    const total = contribs.reduce((s, c) => s + c.amount, 0) + (goal.currentAmount || 0);
    const pct = goal.targetAmount > 0 ? Math.min((total / goal.targetAmount) * 100, 100) : 0;
    const remaining = Math.max(goal.targetAmount - total, 0);
    const monthly = this.savingsMonthly();
    const monthsLeft = monthly > 0 && remaining > 0 ? Math.ceil(remaining / (monthly * 0.3)) : null;
    return { total, pct, remaining, monthsLeft, contribs };
  },

  // Budget XP from completed past months only — so XP never decreases
  _budgetXPHistory() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const pastMonths = [...new Set(
      this.data.transactions.map(tx => tx.date.slice(0, 7))
    )].filter(m => m < currentMonth);

    let xp = 0;
    for (const month of pastMonths) {
      const txs = this.data.transactions.filter(tx => tx.date.startsWith(month));
      for (const b of this.data.budgets) {
        const objective = toMonthly(b.amount, b.frequency);
        const spent = txs
          .filter(tx => tx.kind === 'expense' && tx.category === b.category)
          .reduce((s, tx) => s + tx.amount, 0);
        xp += Math.max(0, objective - spent);
      }
    }
    return xp;
  },

  // Player XP earned through real actions only
  playerLevel() {
    const data = this.data;

    // 1. Budget adherence: XP from PAST closed months only (never decreases)
    const budgetXP = this._budgetXPHistory();

    // 2. Goal contributions: 0.5 XP per € contributed
    const contribXP = data.goalContributions.reduce((s, c) => s + c.amount, 0) * 0.5;

    // 3. Completed goals bonus: 10% of target as one-time reward
    const completedXP = data.goals
      .filter(g => this.goalProgress(g).total >= g.targetAmount)
      .reduce((s, g) => s + g.targetAmount * 0.1, 0);

    // 4. Transaction tracking: 3 XP per entry logged
    const txXP = data.transactions.length * 3;

    const xp = budgetXP + contribXP + completedXP + txXP;

    // Cumulative XP thresholds per level (each jump ~20% harder)
    const thresholds = [0, 150, 330, 550, 810, 1120, 1490, 1930, 2450, 3070];
    const classes = ['Aprendiz','Escudero','Guerrero','Caballero','Campeón','Paladín','Héroe','Leyenda','Dios','Inmortal'];

    let level = 1;
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (xp >= thresholds[i]) { level = i + 1; break; }
    }

    const curThresh = thresholds[level - 1] || 0;
    const nextThresh = thresholds[level] || thresholds[thresholds.length - 1];
    const xpInLevel = xp - curThresh;
    const xpNeeded = nextThresh - curThresh;
    const pct = Math.min((xpInLevel / xpNeeded) * 100, 100);
    const autoClass = classes[Math.min(level - 1, classes.length - 1)];
    const customClass = data.settings?.playerClass;

    return {
      level,
      xp: Math.floor(xp),
      xpInLevel: Math.floor(xpInLevel),
      xpNeeded: Math.floor(xpNeeded),
      pct,
      className: customClass || autoClass,
      autoClass,
      breakdown: {
        budget: Math.floor(budgetXP),
        contribs: Math.floor(contribXP),
        goals: Math.floor(completedXP),
        tracking: Math.floor(txXP)
      }
    };
  },

  // Check which achievements should be unlocked
  checkAchievements() {
    const data = this.data;
    const unlocked = new Set(data.achievements.map(a => a.id));
    const newlyUnlocked = [];

    const monthly = this.savingsMonthly();
    const totalSaved = data.goals.reduce((s, g) => s + this.goalProgress(g).total, 0);
    const goalsCompleted = data.goals.filter(g => this.goalProgress(g).total >= g.targetAmount).length;
    const txCount = data.transactions.length;

    const ACHIEVEMENTS = [
      { id: 'first_tx', name: 'Primera Batalla', desc: 'Registra tu primer movimiento', icon: '⚔️', cond: () => txCount >= 1 },
      { id: 'saver_100', name: 'Guardián del Oro', desc: 'Ahorra 100 € en metas', icon: '💰', cond: () => totalSaved >= 100 },
      { id: 'saver_400', name: 'Tesorero del Reino', desc: 'Ahorra 400 € en metas', icon: '🏆', cond: () => totalSaved >= 400 },
      { id: 'first_goal', name: 'Héroe de Misión', desc: 'Completa tu primera meta', icon: '🎯', cond: () => goalsCompleted >= 1 },
      { id: 'positive_savings', name: 'En el Camino Correcto', desc: 'Ten ahorro mensual positivo', icon: '📈', cond: () => monthly > 0 },
      { id: 'budgeter', name: 'Maestro Estratega', desc: 'Crea 3 presupuestos', icon: '🛡️', cond: () => data.budgets.length >= 3 },
      { id: 'goal_maker', name: 'Soñador de Reinos', desc: 'Crea 2 metas de ahorro', icon: '🌟', cond: () => data.goals.length >= 2 },
      { id: 'tx_10', name: 'Veterano', desc: 'Registra 10 movimientos', icon: '📜', cond: () => txCount >= 10 }
    ];

    ACHIEVEMENTS.forEach(ach => {
      if (!unlocked.has(ach.id) && ach.cond()) {
        data.achievements.push({ id: ach.id, unlockedAt: new Date().toISOString() });
        newlyUnlocked.push(ach);
      }
    });

    if (newlyUnlocked.length) DB.save();
    return { ACHIEVEMENTS, newlyUnlocked };
  },

  allAchievements() {
    const unlocked = new Set(this.data.achievements.map(a => a.id));
    const achs = [
      { id: 'first_tx',         name: 'Primera Batalla',        desc: 'Registra tu primer movimiento',   icon: '⚔️' },
      { id: 'saver_100',        name: 'Guardián del Oro',        desc: 'Ahorra 100 € en metas',           icon: '💰' },
      { id: 'saver_400',        name: 'Tesorero del Reino',      desc: 'Ahorra 400 € en metas',           icon: '🏆' },
      { id: 'first_goal',       name: 'Héroe de Misión',         desc: 'Completa tu primera meta',        icon: '🎯' },
      { id: 'positive_savings', name: 'En el Camino Correcto',   desc: 'Ten ahorro mensual positivo',     icon: '📈' },
      { id: 'budgeter',         name: 'Maestro Estratega',       desc: 'Crea 3 presupuestos',             icon: '🛡️' },
      { id: 'goal_maker',       name: 'Soñador de Reinos',       desc: 'Crea 2 metas de ahorro',          icon: '🌟' },
      { id: 'tx_10',            name: 'Veterano',                desc: 'Registra 10 movimientos',         icon: '📜' }
    ];
    return achs.map(a => ({
      ...a,
      unlocked: unlocked.has(a.id),
      unlockedAt: this.data.achievements.find(x => x.id === a.id)?.unlockedAt
    }));
  }
};
