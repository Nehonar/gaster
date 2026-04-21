// ===== DATA LAYER: localStorage persistence =====

const STORAGE_KEY = 'gasterquest_v1';

const DEFAULT_DATA = {
  settings: { currency: 'EUR', playerName: 'Aventurero' },
  incomes: [],
  expenses: [],
  transactions: [],
  budgets: [],
  goals: [],
  goalContributions: [],
  achievements: [],
  stats: { totalSaved: 0, streakDays: 0, lastActivityDate: null }
};

function uuid() {
  return 'id_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

const DB = {
  _data: null,

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this._data = raw ? { ...DEFAULT_DATA, ...JSON.parse(raw) } : this._seed();
    } catch {
      this._data = this._seed();
    }
    return this._data;
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
  },

  get() { return this._data; },

  _seed() {
    const data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    // Demo data so the app doesn't look empty on first load
    const today = new Date().toISOString().split('T')[0];
    const month = today.slice(0, 7);

    data.incomes = [
      { id: uuid(), name: 'Sueldo', amount: 1930, frequency: 'monthly', type: 'recurring', category: 'salary', active: true, startDate: '2026-01-01' },
      { id: uuid(), name: 'Tarjeta comida', amount: 220, frequency: 'monthly', type: 'recurring', category: 'salary', active: true, startDate: '2026-01-01' }
    ];

    data.expenses = [
      { id: uuid(), name: 'Hipoteca', amount: 650, frequency: 'monthly', type: 'recurring', category: 'housing', active: true, mandatory: true, startDate: '2026-01-01' },
      { id: uuid(), name: 'Luz', amount: 80, frequency: 'monthly', type: 'recurring', category: 'utilities', active: true, mandatory: true, startDate: '2026-01-01' },
      { id: uuid(), name: 'Gasolina', amount: 40, frequency: 'weekly', type: 'recurring', category: 'transport', active: true, mandatory: false, startDate: '2026-01-01' },
      { id: uuid(), name: 'ITV', amount: 60, frequency: 'yearly', type: 'planned', category: 'transport', active: true, mandatory: false, startDate: '2026-01-01' }
    ];

    data.budgets = [
      { id: uuid(), category: 'food', amount: 150, frequency: 'weekly', icon: '🍖' },
      { id: uuid(), category: 'transport', amount: 40, frequency: 'weekly', icon: '⚔️' },
      { id: uuid(), category: 'entertainment', amount: 50, frequency: 'monthly', icon: '🎭' }
    ];

    data.goals = [
      { id: uuid(), name: 'Fondo de Emergencia', targetAmount: 3000, currentAmount: 420, deadline: null, active: true, icon: '🛡️', color: '#4080f0' },
      { id: uuid(), name: 'Viaje de Verano', targetAmount: 1200, currentAmount: 280, deadline: '2026-08-01', active: true, icon: '🗺️', color: '#40c070' }
    ];

    // Some sample transactions this month
    const txDates = [1, 3, 5, 8, 10, 12, 14, 16, 18, 20];
    txDates.forEach((d, i) => {
      const dd = String(d).padStart(2, '0');
      const date = `${month}-${dd}`;
      if (i % 2 === 0) {
        data.transactions.push({ id: uuid(), kind: 'expense', amount: 15 + Math.floor(Math.random() * 60), category: ['food','transport','entertainment'][i % 3], date, note: ['Supermercado','Gasolina','Ocio'][i%3], isExtra: i > 6 });
      } else {
        data.transactions.push({ id: uuid(), kind: 'income', amount: 50 + Math.floor(Math.random() * 100), category: 'extra', date, note: 'Ingreso extra', isExtra: true });
      }
    });

    this._data = data;
    this.save();
    return data;
  },

  // ---- CRUD helpers ----
  addItem(collection, item) {
    item.id = item.id || uuid();
    this._data[collection].push(item);
    this.save();
    return item;
  },

  updateItem(collection, id, updates) {
    const idx = this._data[collection].findIndex(x => x.id === id);
    if (idx !== -1) {
      this._data[collection][idx] = { ...this._data[collection][idx], ...updates };
      this.save();
    }
  },

  deleteItem(collection, id) {
    this._data[collection] = this._data[collection].filter(x => x.id !== id);
    this.save();
  },

  exportJSON() {
    return JSON.stringify(this._data, null, 2);
  },

  importJSON(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    this._data = { ...DEFAULT_DATA, ...parsed };
    this.save();
    return this._data;
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this._data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this.save();
    return this._data;
  }
};
