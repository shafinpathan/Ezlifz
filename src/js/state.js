import { showToast } from './utils.js';

export const DEFAULT_SETTINGS = {
  userName: '',
  currWeight: 70,
  goalWeight: 75,
  goal: 'Muscle Gain',
  calGoal: 2500,
  proGoal: 160,
  carbGoal: 280,
  fatGoal: 75,
  waterGoal: 3,
  theme: 'dark'
};

export const DEFAULT_FINANCE_INCOME_CATS = [
  { id: 'inc-1', name: 'Salary',     icon: '💼', color: '#32d74b' },
  { id: 'inc-2', name: 'Freelance',  icon: '💻', color: '#0a84ff' },
  { id: 'inc-3', name: 'Business',   icon: '🏢', color: '#bf5af2' },
  { id: 'inc-4', name: 'Investment', icon: '📈', color: '#ff9f0a' },
  { id: 'inc-5', name: 'Gift',       icon: '🎁', color: '#ff2d55' },
  { id: 'inc-6', name: 'Other',      icon: '➕', color: '#8e8e93' }
];
export const DEFAULT_FINANCE_EXPENSE_CATS = [
  { id: 'exp-1',  name: 'Food & Drinks',  icon: '🍔', color: '#ff9f0a' },
  { id: 'exp-2',  name: 'Transport',      icon: '🚌', color: '#0a84ff' },
  { id: 'exp-3',  name: 'Shopping',       icon: '🛍️', color: '#bf5af2' },
  { id: 'exp-4',  name: 'Health',         icon: '❤️', color: '#ff2d55' },
  { id: 'exp-5',  name: 'Entertainment',  icon: '🎮', color: '#64d2ff' },
  { id: 'exp-6',  name: 'Utilities',      icon: '💡', color: '#ffd60a' },
  { id: 'exp-7',  name: 'Rent',           icon: '🏠', color: '#32d74b' },
  { id: 'exp-8',  name: 'Education',      icon: '📚', color: '#0a84ff' },
  { id: 'exp-9',  name: 'Subscriptions',  icon: '🔄', color: '#ff9f0a' },
  { id: 'exp-10', name: 'Other',          icon: '💳', color: '#8e8e93' }
];
export const DEFAULT_TASK_COLUMNS = [
  { id: 'backlog',     name: 'Backlog',      color: '#8e8e93', order: 0 },
  { id: 'today',       name: 'Today',        color: '#ffd60a', order: 1 },
  { id: 'in-progress', name: 'In Progress',  color: '#0a84ff', order: 2 },
  { id: 'completed',   name: 'Done',         color: '#32d74b', order: 3 }
];

export let state = {
  settings: { ...DEFAULT_SETTINGS },
  meals: [],
  workouts: [],
  metrics: [],
  customMealPresets: null,
  customWorkoutPresets: null,
  streak: 0,
  streakLastDate: null,
  attendance: { subjects: [], logs: [] },
  todo: { tasks: [], totalXp: 0 },
  wardrobe: { items: [], outfits: [], logs: [] },
  skincare: { morningRoutine: [], eveningRoutine: [], products: [], logs: [], streak: 0, streakLastDate: null },
  splitwise: {
    friends: [],
    expenses: [],
    settlements: [],
    qrSettings: { name: '', upi: '', phone: '', address: '', footer: '', qrImage: '', signatureImage: '' }
  },
  finance: {
    accounts: [{ id: 'acc-main', name: 'Cash', type: 'cash', color: '#32d74b', icon: '💵' }],
    transactions: [],
    incomeCategories: DEFAULT_FINANCE_INCOME_CATS.map(c => ({ ...c })),
    expenseCategories: DEFAULT_FINANCE_EXPENSE_CATS.map(c => ({ ...c }))
  },
  habits: { items: [], logs: [] },
  notes: {
    folders: [{ id: 'folder-inbox', name: 'Inbox', color: '#0a84ff', pinned: true }],
    items: []
  },
  custom: {
    taskColumns: DEFAULT_TASK_COLUMNS.map(c => ({ ...c }))
  }
};

let storageWarned = false;

export function storageAvailable() {
  try {
    const k = '__fittrack_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch (e) { return false; }
}

export function saveData() {
  try {
    localStorage.setItem('fittrack_v2', JSON.stringify(state));
  } catch (e) {
    console.warn('Save failed:', e);
    if (!storageWarned) {
      storageWarned = true;
      showToast('Storage unavailable — data will not persist in this environment', 4000);
    }
  }
}

export function loadData() {
  try {
    const raw = localStorage.getItem('fittrack_v2');
    if (raw) {
      const saved = JSON.parse(raw);
      state = { ...state, ...saved };
      state.settings = { ...DEFAULT_SETTINGS, ...saved.settings };
      if (!state.attendance) state.attendance = { subjects: [], logs: [] };
      if (!state.attendance.subjects) state.attendance.subjects = [];
      if (!state.attendance.logs) state.attendance.logs = [];
      if (!state.todo) state.todo = { tasks: [], totalXp: 0 };
      if (!state.todo.tasks) state.todo.tasks = [];
      if (!state.wardrobe) state.wardrobe = { items: [], outfits: [], logs: [] };
      if (!state.wardrobe.items) state.wardrobe.items = [];
      if (!state.wardrobe.outfits) state.wardrobe.outfits = [];
      if (!state.wardrobe.logs) state.wardrobe.logs = [];
      if (!state.skincare) state.skincare = { morningRoutine: [], eveningRoutine: [], products: [], logs: [], streak: 0, streakLastDate: null };
      if (!state.skincare.morningRoutine) state.skincare.morningRoutine = [];
      if (!state.skincare.eveningRoutine) state.skincare.eveningRoutine = [];
      if (!state.skincare.products) state.skincare.products = [];
      if (!state.skincare.logs) state.skincare.logs = [];
      if (!state.splitwise) state.splitwise = { friends: [], expenses: [], settlements: [], qrSettings: { name: '', upi: '', phone: '', address: '', footer: '', qrImage: '', signatureImage: '' } };
      if (!state.splitwise.friends) state.splitwise.friends = [];
      if (!state.splitwise.expenses) state.splitwise.expenses = [];
      if (!state.splitwise.settlements) state.splitwise.settlements = [];
      if (!state.splitwise.qrSettings) state.splitwise.qrSettings = { name: '', upi: '', phone: '', address: '', footer: '', qrImage: '', signatureImage: '' };
      if (!state.finance) state.finance = { accounts: [{ id: 'acc-main', name: 'Cash', type: 'cash', color: '#32d74b', icon: '💵' }], transactions: [], incomeCategories: DEFAULT_FINANCE_INCOME_CATS.map(c => ({ ...c })), expenseCategories: DEFAULT_FINANCE_EXPENSE_CATS.map(c => ({ ...c })) };
      if (!state.finance.accounts) state.finance.accounts = [{ id: 'acc-main', name: 'Cash', type: 'cash', color: '#32d74b', icon: '💵' }];
      if (!state.finance.transactions) state.finance.transactions = [];
      if (!state.finance.incomeCategories) state.finance.incomeCategories = DEFAULT_FINANCE_INCOME_CATS.map(c => ({ ...c }));
      if (!state.finance.expenseCategories) state.finance.expenseCategories = DEFAULT_FINANCE_EXPENSE_CATS.map(c => ({ ...c }));
      if (!state.habits) state.habits = { items: [], logs: [] };
      if (!state.habits.items) state.habits.items = [];
      if (!state.habits.logs) state.habits.logs = [];
      if (!state.notes) state.notes = { folders: [{ id: 'folder-inbox', name: 'Inbox', color: '#0a84ff', pinned: true }], items: [] };
      if (!state.notes.folders) state.notes.folders = [{ id: 'folder-inbox', name: 'Inbox', color: '#0a84ff', pinned: true }];
      if (!state.notes.items) state.notes.items = [];
      if (!state.custom) state.custom = { taskColumns: DEFAULT_TASK_COLUMNS.map(c => ({ ...c })) };
      if (!state.custom.taskColumns) state.custom.taskColumns = DEFAULT_TASK_COLUMNS.map(c => ({ ...c }));
    }
  } catch (e) { console.warn('Load failed:', e); }
}

export function autoSave() { saveData(); }
