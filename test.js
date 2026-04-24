// ===== TEST RUNNER =====
// Run with: node test.js

const fs  = require('fs');
const vm  = require('vm');

// Build a sandbox with all browser globals the source files need
const sandbox = {
  localStorage: {
    _store: {},
    getItem(k)    { return this._store[k] ?? null; },
    setItem(k, v) { this._store[k] = v; },
    removeItem(k) { delete this._store[k]; }
  },
  console,
  Math, JSON, Date, Array, Object, String, Number, Boolean, Set, Map,
  parseInt, parseFloat, isNaN
};
vm.createContext(sandbox);

// `const` at top level is script-scoped in vm, so replace with var
// so the identifiers land on the sandbox object and are accessible here.
function load(file) {
  const src = fs.readFileSync(file, 'utf8').replace(/\bconst\b/g, 'var').replace(/\blet\b/g, 'var');
  vm.runInContext(src, sandbox);
}
load('./js/data.js');
load('./js/engine.js');

// Pull the needed names out of the sandbox
const { Engine, DB, toMonthly } = sandbox;

// ---- Mini test framework ----
let passed = 0, failed = 0;
const BUGS = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌  ${name}`);
    console.log(`       → ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'fallo');
}
function assertEq(a, b, msg) {
  if (Math.abs(a - b) > 0.01) throw new Error(`${msg || ''}: esperado ${b}, obtenido ${a}`);
}
function bug(id, desc) {
  BUGS.push({ id, desc });
  console.log(`  🐛  BUG ${id}: ${desc}`);
}

// ---- Helpers ----
function makeData(overrides = {}) {
  return {
    settings: { currency: 'EUR', playerName: 'Test', playerClass: '', playerAvatar: '🧙' },
    incomes: [],
    expenses: [],
    transactions: [],
    budgets: [],
    goals: [],
    goalContributions: [],
    achievements: [],
    ...overrides
  };
}

const THIS_MONTH = new Date().toISOString().slice(0, 7); // "2026-04"
const LAST_MONTH = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
})();
const LAST_WEEK_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
})();
const date = (d) => `${THIS_MONTH}-${String(d).padStart(2,'0')}`;
const lastDate = (d) => `${LAST_MONTH}-${String(d).padStart(2,'0')}`;

// ===========================================
console.log('\n📐 1. CONVERSIÓN DE FRECUENCIAS (toMonthly)');
// ===========================================

test('mensual → mensual: sin cambio', () => {
  assertEq(toMonthly(100, 'monthly'), 100, 'mensual');
});
test('semanal → mensual: ×52/12 ≈ 4.333', () => {
  assertEq(toMonthly(100, 'weekly'), 100 * 52 / 12, 'semanal');
});
test('anual → mensual: /12', () => {
  assertEq(toMonthly(1200, 'yearly'), 100, 'anual');
});
test('único → mensual: igual al importe', () => {
  // NOTA: un pago único suma igual que mensual, puede ser confuso
  assertEq(toMonthly(500, 'once'), 500, 'único');
});

// ===========================================
console.log('\n💰 2. INGRESOS PLANIFICADOS (totalIncomeMonthly)');
// ===========================================

test('un ingreso mensual simple', () => {
  Engine.init(makeData({ incomes: [
    { id:'i1', name:'Sueldo', amount:1930, frequency:'monthly', active:true }
  ]}));
  assertEq(Engine.totalIncomeMonthly(), 1930, 'sueldo mensual');
});
test('ingreso semanal se normaliza correctamente', () => {
  Engine.init(makeData({ incomes: [
    { id:'i1', name:'Bono', amount:100, frequency:'weekly', active:true }
  ]}));
  assertEq(Engine.totalIncomeMonthly(), 100 * 52/12, 'ingreso semanal');
});
test('ingreso inactivo NO se cuenta', () => {
  Engine.init(makeData({ incomes: [
    { id:'i1', name:'Sueldo',  amount:1000, frequency:'monthly', active:true  },
    { id:'i2', name:'Extra',   amount:500,  frequency:'monthly', active:false }
  ]}));
  assertEq(Engine.totalIncomeMonthly(), 1000, 'ingreso inactivo excluido');
});
test('varios ingresos se suman', () => {
  Engine.init(makeData({ incomes: [
    { id:'i1', amount:1000, frequency:'monthly', active:true },
    { id:'i2', amount:200,  frequency:'monthly', active:true },
    { id:'i3', amount:600,  frequency:'yearly',  active:true }
  ]}));
  assertEq(Engine.totalIncomeMonthly(), 1000 + 200 + 50, 'suma ingresos');
});

// ===========================================
console.log('\n🗡️  3. GASTOS PLANIFICADOS (totalExpenseMonthly)');
// ===========================================

test('gasto mensual simple', () => {
  Engine.init(makeData({ expenses: [
    { id:'e1', amount:650, frequency:'monthly', active:true }
  ]}));
  assertEq(Engine.totalExpenseMonthly(), 650, 'hipoteca mensual');
});
test('gasto semanal normalizado (gasolina 40€/sem)', () => {
  Engine.init(makeData({ expenses: [
    { id:'e1', amount:40, frequency:'weekly', active:true }
  ]}));
  assertEq(Engine.totalExpenseMonthly(), 40*52/12, 'gasolina semanal');
});
test('gasto inactivo NO se cuenta', () => {
  Engine.init(makeData({ expenses: [
    { id:'e1', amount:500, frequency:'monthly', active:true  },
    { id:'e2', amount:200, frequency:'monthly', active:false }
  ]}));
  assertEq(Engine.totalExpenseMonthly(), 500, 'gasto inactivo excluido');
});

// ===========================================
console.log('\n📊 4. AHORRO PLANIFICADO (savingsMonthly)');
// ===========================================

test('ingresos > gastos → ahorro positivo', () => {
  Engine.init(makeData({
    incomes:  [{ id:'i1', amount:2000, frequency:'monthly', active:true }],
    expenses: [{ id:'e1', amount:1200, frequency:'monthly', active:true }]
  }));
  assertEq(Engine.savingsMonthly(), 800, 'ahorro 800');
});
test('gastos > ingresos → ahorro negativo', () => {
  Engine.init(makeData({
    incomes:  [{ id:'i1', amount:1000, frequency:'monthly', active:true }],
    expenses: [{ id:'e1', amount:1500, frequency:'monthly', active:true }]
  }));
  assertEq(Engine.savingsMonthly(), -500, 'déficit 500');
});
test('margen semanal = ahorro * 12 / 52', () => {
  Engine.init(makeData({
    incomes:  [{ id:'i1', amount:2000, frequency:'monthly', active:true }],
    expenses: [{ id:'e1', amount:1000, frequency:'monthly', active:true }]
  }));
  assertEq(Engine.savingsWeekly(), 1000 * 12/52, 'margen semanal');
});

// ===========================================
console.log('\n📜 5. TRANSACCIONES REALES (filtrado por periodo)');
// ===========================================

test('transacción de este mes se incluye', () => {
  Engine.init(makeData({ transactions: [
    { id:'t1', kind:'expense', amount:50, category:'food', date:date(10) }
  ]}));
  assertEq(Engine.realExpenseInPeriod('month'), 50, 'gasto este mes');
});
test('transacción del mes pasado NO se incluye en "month"', () => {
  Engine.init(makeData({ transactions: [
    { id:'t1', kind:'expense', amount:50, category:'food', date:lastDate(10) }
  ]}));
  assertEq(Engine.realExpenseInPeriod('month'), 0, 'gasto mes pasado excluido');
});
test('balance real = ingresos reales - gastos reales', () => {
  Engine.init(makeData({ transactions: [
    { id:'t1', kind:'income',  amount:300, category:'extra', date:date(5)  },
    { id:'t2', kind:'expense', amount:120, category:'food',  date:date(10) }
  ]}));
  assertEq(Engine.realSavingsInPeriod('month'), 180, 'balance real 180');
});
test('múltiples gastos se suman correctamente', () => {
  Engine.init(makeData({ transactions: [
    { id:'t1', kind:'expense', amount:30,  category:'food',  date:date(1)  },
    { id:'t2', kind:'expense', amount:45,  category:'food',  date:date(8)  },
    { id:'t3', kind:'expense', amount:100, category:'food',  date:date(15) }
  ]}));
  assertEq(Engine.realExpenseInPeriod('month'), 175, 'suma gastos');
});

// ===========================================
console.log('\n🛡️  6. PRESUPUESTOS (budgetStatus)');
// ===========================================

test('gasto por debajo del presupuesto → diff positivo', () => {
  Engine.init(makeData({
    budgets: [{ id:'b1', category:'food', amount:200, frequency:'monthly' }],
    transactions: [
      { id:'t1', kind:'expense', amount:150, category:'food', date:date(10) }
    ]
  }));
  const [b] = Engine.budgetStatus();
  assertEq(b.objective, 200, 'objetivo 200');
  assertEq(b.spent, 150, 'gastado 150');
  assertEq(b.diff, 50, 'diff positivo 50');
  assert(b.status === 'ok', 'status ok');
});
test('gasto por encima del presupuesto → diff negativo', () => {
  Engine.init(makeData({
    budgets: [{ id:'b1', category:'food', amount:200, frequency:'monthly' }],
    transactions: [
      { id:'t1', kind:'expense', amount:250, category:'food', date:date(10) }
    ]
  }));
  const [b] = Engine.budgetStatus();
  assertEq(b.diff, -50, 'diff negativo');
  assert(b.status === 'over', 'status over');
});
test('presupuesto semanal compara directamente contra esta semana', () => {
  Engine.init(makeData({
    budgets: [{ id:'b1', category:'food', amount:50, frequency:'weekly' }],
    transactions: []
  }));
  const [b] = Engine.budgetStatus();
  assertEq(b.objective, 50, 'objetivo semanal = 50 directo, no convertido');
  assert(b.period === 'week', 'period = week');
});
test('solo se cuentan gastos, no ingresos, en el presupuesto', () => {
  Engine.init(makeData({
    budgets: [{ id:'b1', category:'food', amount:200, frequency:'monthly' }],
    transactions: [
      { id:'t1', kind:'expense', amount:80,  category:'food', date:date(5)  },
      { id:'t2', kind:'income',  amount:100, category:'food', date:date(10) }  // ingreso en cat food
    ]
  }));
  const [b] = Engine.budgetStatus();
  assertEq(b.spent, 80, 'ingreso no suma al gasto');
});
test('transacciones de otro mes NO afectan presupuesto actual', () => {
  Engine.init(makeData({
    budgets: [{ id:'b1', category:'food', amount:200, frequency:'monthly' }],
    transactions: [
      { id:'t1', kind:'expense', amount:300, category:'food', date:lastDate(10) }
    ]
  }));
  const [b] = Engine.budgetStatus();
  assertEq(b.spent, 0, 'gasto mes pasado no contamina presupuesto actual');
});

// ===========================================
console.log('\n🏆 7. PROGRESO DE METAS (goalProgress)');
// ===========================================

test('currentAmount inicial cuenta como progreso', () => {
  const g = { id:'g1', targetAmount:1000, currentAmount:300 };
  Engine.init(makeData({ goals:[g], goalContributions:[] }));
  const p = Engine.goalProgress(g);
  assertEq(p.total, 300, 'initial amount');
  assertEq(p.pct, 30, 'pct 30%');
});
test('contribuciones se suman al currentAmount', () => {
  const g = { id:'g1', targetAmount:1000, currentAmount:200 };
  Engine.init(makeData({
    goals:[g],
    goalContributions:[
      { id:'c1', goalId:'g1', amount:100, date:date(5) },
      { id:'c2', goalId:'g1', amount:150, date:date(10) }
    ]
  }));
  const p = Engine.goalProgress(g);
  assertEq(p.total, 450, 'total 200+100+150');
  assertEq(p.remaining, 550, 'restante');
});
test('contribuciones de OTRA meta no cuentan', () => {
  const g1 = { id:'g1', targetAmount:500, currentAmount:0 };
  const g2 = { id:'g2', targetAmount:500, currentAmount:0 };
  Engine.init(makeData({
    goals:[g1,g2],
    goalContributions:[
      { id:'c1', goalId:'g2', amount:300, date:date(5) }  // solo a g2
    ]
  }));
  const p = Engine.goalProgress(g1);
  assertEq(p.total, 0, 'contribución de g2 no contamina g1');
});
test('meta completada → pct 100%, remaining 0', () => {
  const g = { id:'g1', targetAmount:400, currentAmount:400 };
  Engine.init(makeData({ goals:[g], goalContributions:[] }));
  const p = Engine.goalProgress(g);
  assertEq(p.pct, 100, 'completada al 100%');
  assertEq(p.remaining, 0, 'sin restante');
});

// ===========================================
console.log('\n⭐ 8. SISTEMA DE XP (playerLevel)');
// ===========================================

test('sin datos → nivel 1, 0 XP', () => {
  Engine.init(makeData());
  const lvl = Engine.playerLevel();
  assert(lvl.level === 1, `nivel esperado 1, obtenido ${lvl.level}`);
  assertEq(lvl.xp, 0, 'XP cero');
});
test('registrar transacciones da 3 XP cada una', () => {
  Engine.init(makeData({ transactions: [
    { id:'t1', kind:'expense', amount:10, category:'food', date:date(1) },
    { id:'t2', kind:'expense', amount:20, category:'food', date:date(2) },
    { id:'t3', kind:'income',  amount:50, category:'extra',date:date(3) }
  ]}));
  const lvl = Engine.playerLevel();
  assertEq(lvl.breakdown.tracking, 9, '3 transacciones × 3 XP = 9');
});
test('aportar 100€ a meta da 50 XP de contribuciones', () => {
  const g = { id:'g1', targetAmount:500, currentAmount:0 };
  Engine.init(makeData({
    goals:[g],
    goalContributions:[{ id:'c1', goalId:'g1', amount:100, date:date(5) }]
  }));
  const lvl = Engine.playerLevel();
  assertEq(lvl.breakdown.contribs, 50, '100 × 0.5 = 50 XP');
});
test('presupuesto semanal respetado la semana pasada da XP', () => {
  Engine.init(makeData({
    budgets: [{ id:'b1', category:'food', amount:100, frequency:'weekly' }],
    transactions: [{ id:'t1', kind:'expense', amount:60, category:'food', date:LAST_WEEK_DATE }]
  }));
  const lvl = Engine.playerLevel();
  assertEq(lvl.breakdown.budget, 40, 'semana pasada: 100-60=40 XP');
});

test('presupuesto semanal de esta semana NO da XP todavía', () => {
  const today = new Date().toISOString().slice(0, 10);
  Engine.init(makeData({
    budgets: [{ id:'b1', category:'food', amount:100, frequency:'weekly' }],
    transactions: [{ id:'t1', kind:'expense', amount:30, category:'food', date:today }]
  }));
  const lvl = Engine.playerLevel();
  assertEq(lvl.breakdown.budget, 0, 'semana actual no cuenta hasta que cierre');
});

test('presupuesto respetado el mes pasado da XP (mes actual no cuenta hasta cerrar)', () => {
  Engine.init(makeData({
    budgets: [{ id:'b1', category:'food', amount:200, frequency:'monthly' }],
    transactions: [{ id:'t1', kind:'expense', amount:150, category:'food', date:lastDate(10) }]
  }));
  const lvl = Engine.playerLevel();
  assertEq(lvl.breakdown.budget, 50, 'sobrante mes pasado 50€ → 50 XP');
});
test('completar una meta da bonus del 10% del objetivo', () => {
  const g = { id:'g1', targetAmount:400, currentAmount:400 };
  Engine.init(makeData({ goals:[g], goalContributions:[] }));
  const lvl = Engine.playerLevel();
  assertEq(lvl.breakdown.goals, 40, '400 × 10% = 40 XP');
});

// --- REGRESIÓN: bugs corregidos ---
console.log('\n✅ 8b. REGRESIÓN — bugs corregidos');

test('XP presupuesto NO baja al registrar un gasto en el mes actual', () => {
  const data = makeData({
    budgets: [{ id:'b1', category:'food', amount:200, frequency:'monthly' }],
    transactions: []
  });
  Engine.init(data);
  const xpAntes = Engine.playerLevel().breakdown.budget; // mes actual, 0 XP (sin historial)

  data.transactions.push({ id:'t1', kind:'expense', amount:50, category:'food', date:date(10) });
  Engine.init(data);
  const xpDespues = Engine.playerLevel().breakdown.budget;

  assert(xpDespues >= xpAntes, `XP no debe bajar: antes=${xpAntes} después=${xpDespues}`);
});

test('XP presupuesto acumula meses pasados (150€ sobraron → 150 XP)', () => {
  const data = makeData({
    budgets: [{ id:'b1', category:'food', amount:200, frequency:'monthly' }],
    transactions: [
      { id:'t1', kind:'expense', amount:50, category:'food', date:lastDate(10) }
    ]
  });
  Engine.init(data);
  const lvl = Engine.playerLevel();
  assertEq(lvl.breakdown.budget, 150, 'mes pasado: 200-50=150 XP acumulados');
});

test('achievement "primera meta" se desbloquea con contribuciones aunque currentAmount=0', () => {
  const g = { id:'g1', targetAmount:100, currentAmount:0 };
  const data = makeData({
    goals:[g],
    goalContributions:[{ id:'c1', goalId:'g1', amount:100, date:date(5) }],
    achievements:[]
  });
  Engine.init(data);
  const { newlyUnlocked } = Engine.checkAchievements();
  const goalAch = newlyUnlocked.find(a => a.id === 'first_goal');
  assert(goalAch, 'achievement first_goal debe desbloquearse');
});

test('achievement saver_100 cuenta contribuciones de todas las metas', () => {
  const g1 = { id:'g1', targetAmount:500, currentAmount:0 };
  const g2 = { id:'g2', targetAmount:500, currentAmount:0 };
  const data = makeData({
    goals:[g1,g2],
    goalContributions:[
      { id:'c1', goalId:'g1', amount:60, date:date(1) },
      { id:'c2', goalId:'g2', amount:60, date:date(2) }
    ],
    achievements:[]
  });
  Engine.init(data);
  const { newlyUnlocked } = Engine.checkAchievements();
  const ach = newlyUnlocked.find(a => a.id === 'saver_100');
  assert(ach, 'saver_100 debe desbloquearse con 120€ entre dos metas');
});

// ===========================================
console.log('\n⚡ 9. ATAQUES DEL DESTINO (imprevistos)');
// ===========================================

test('imprevisto NO cuenta para el gasto del presupuesto', () => {
  Engine.init(makeData({
    budgets: [{ id:'b1', category:'transport', amount:100, frequency:'monthly' }],
    transactions: [
      { id:'t1', kind:'expense', amount:40,  category:'transport', date:date(5), isImprevisto:false },
      { id:'t2', kind:'expense', amount:400, category:'transport', date:date(10), isImprevisto:true }
    ]
  }));
  const [b] = Engine.budgetStatus();
  assertEq(b.spent, 40, 'imprevisto excluido del gasto del presupuesto');
  assert(b.status === 'ok', 'status ok aunque el imprevisto sea grande');
});

test('imprevisto NO penaliza XP en semanas pasadas', () => {
  Engine.init(makeData({
    budgets: [{ id:'b1', category:'transport', amount:100, frequency:'weekly' }],
    transactions: [
      { id:'t1', kind:'expense', amount:30,  category:'transport', date:LAST_WEEK_DATE, isImprevisto:false },
      { id:'t2', kind:'expense', amount:500, category:'transport', date:LAST_WEEK_DATE, isImprevisto:true }
    ]
  }));
  const lvl = Engine.playerLevel();
  assertEq(lvl.breakdown.budget, 70, 'XP = 100-30=70, el imprevisto de 500 no cuenta');
});

test('gasto normal SI cuenta para el presupuesto', () => {
  Engine.init(makeData({
    budgets: [{ id:'b1', category:'food', amount:100, frequency:'monthly' }],
    transactions: [
      { id:'t1', kind:'expense', amount:80, category:'food', date:date(5), isImprevisto:false }
    ]
  }));
  const [b] = Engine.budgetStatus();
  assertEq(b.spent, 80, 'gasto normal sí cuenta');
});

// ===========================================
console.log('\n🏦 10. COFRES (vaultBalance / liquidBalance / totalWealth)');
// ===========================================

test('cofre vacío → balance 0', () => {
  Engine.init(makeData({ vaults:[{id:'v1',name:'Test',active:true}], vaultEntries:[] }));
  const b = Engine.vaultBalance('v1');
  assertEq(b.balance, 0, 'balance inicial');
});

test('depósito de 500€ → balance 500', () => {
  Engine.init(makeData({
    vaults:[{id:'v1',name:'Test',active:true}],
    vaultEntries:[{vaultId:'v1',type:'deposit',amount:500,date:date(1)}]
  }));
  const b = Engine.vaultBalance('v1');
  assertEq(b.balance, 500, 'después de depósito');
  assertEq(b.deposited, 500, 'deposited=500');
});

test('depósito 500 + generado 50 → balance 550', () => {
  Engine.init(makeData({
    vaults:[{id:'v1',name:'Test',active:true}],
    vaultEntries:[
      {vaultId:'v1',type:'deposit',amount:500,date:date(1)},
      {vaultId:'v1',type:'generated',amount:50,date:date(5)}
    ]
  }));
  const b = Engine.vaultBalance('v1');
  assertEq(b.balance, 550, 'depósito + rendimiento');
  assertEq(b.generated, 50, 'generated=50');
});

test('depósito 500, venta 200 → balance 300', () => {
  Engine.init(makeData({
    vaults:[{id:'v1',name:'Test',active:true}],
    vaultEntries:[
      {vaultId:'v1',type:'deposit',amount:500,date:date(1)},
      {vaultId:'v1',type:'sale',amount:200,date:date(10)}
    ]
  }));
  const b = Engine.vaultBalance('v1');
  assertEq(b.balance, 300, 'balance tras venta');
  assertEq(b.sold, 200, 'sold=200');
});

test('liquidBalance: ingresos tx - gastos tx - depósitos + ventas', () => {
  Engine.init(makeData({
    transactions:[
      {id:'t1',kind:'income', amount:1000,category:'salary',date:date(1)},
      {id:'t2',kind:'expense',amount:300, category:'food',  date:date(5)}
    ],
    vaults:[{id:'v1',name:'Test',active:true}],
    vaultEntries:[
      {vaultId:'v1',type:'deposit',amount:200,date:date(2)},
      {vaultId:'v1',type:'sale',   amount:50, date:date(8)}
    ]
  }));
  // 1000 - 300 - 200 + 50 = 550
  assertEq(Engine.liquidBalance(), 550, 'liquid balance 550');
});

test('totalWealth = liquid + vault balances', () => {
  Engine.init(makeData({
    transactions:[{id:'t1',kind:'income',amount:1000,category:'salary',date:date(1)}],
    vaults:[{id:'v1',name:'Test',active:true}],
    vaultEntries:[{vaultId:'v1',type:'deposit',amount:400,date:date(2)}]
  }));
  // liquid = 1000 - 400 = 600, vault = 400, total = 1000
  assertEq(Engine.liquidBalance(), 600, 'liquid 600');
  assertEq(Engine.totalVaultsBalance(), 400, 'vaults 400');
  assertEq(Engine.totalWealth(), 1000, 'wealth 1000');
});

test('dinero generado en cofre aumenta riqueza total sin reducir liquido', () => {
  Engine.init(makeData({
    transactions:[{id:'t1',kind:'income',amount:1000,category:'salary',date:date(1)}],
    vaults:[{id:'v1',name:'Test',active:true}],
    vaultEntries:[
      {vaultId:'v1',type:'deposit',   amount:400,date:date(2)},
      {vaultId:'v1',type:'generated', amount:50, date:date(5)}
    ]
  }));
  // liquid = 1000-400 = 600 (no cambia por generated), vault = 450, total = 1050
  assertEq(Engine.liquidBalance(), 600, 'liquid no cambia con generated');
  assertEq(Engine.totalVaultsBalance(), 450, 'vault 450 con rendimiento');
  assertEq(Engine.totalWealth(), 1050, 'wealth aumenta por rendimiento');
});

// ===========================================
console.log('\n📋 RESUMEN');
// ===========================================
console.log(`\n  Total: ${passed + failed} tests — ✅ ${passed} pasados — ❌ ${failed} fallados`);
if (BUGS.length) {
  console.log(`\n  Bugs confirmados (${BUGS.length}):`);
  BUGS.forEach(b => console.log(`    🐛 ${b.id}: ${b.desc}`));
}
console.log('');
